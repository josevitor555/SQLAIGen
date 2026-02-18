import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import VectorService from './vector_service.js'
import { MistralAIEmbeddings, ChatMistralAI } from '@langchain/mistralai'
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import ChatHistory from '#models/chat_history'

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

interface ColumnMetadata {
  id: number
  tableName: string
  columnName: string
  dataType: string
  description: string
  distance: number
}

@inject()
export default class AiService {
  private embeddingModel: MistralAIEmbeddings
  private mistralClient: ChatMistralAI
  private readonly defaultChatModelSlug = 'langchain:mistral'

  constructor(
    private vectorService: VectorService,
  ) {
    this.embeddingModel = new MistralAIEmbeddings({ apiKey: process.env.MISTRAL_API_KEY })
    this.mistralClient = new ChatMistralAI({ apiKey: process.env.MISTRAL_API_KEY })
  }

  /**
   * Busca estatísticas reais da tabela (row_count, amostra, top valores) para dar "olhos" à IA
   */
  private async fetchTableStatistics(tableName: string): Promise<{
    rowCount: number
    sampleData: string
    columnStats: Record<string, Record<string, number>> | null
  }> {
    const safeTableName = tableName.replace(/[^a-z0-9_]/g, '') // Sanitizar para evitar SQL injection
    if (!safeTableName) return { rowCount: 0, sampleData: '', columnStats: null }

    let rowCount = 0
    let sampleData = ''
    let columnStats: Record<string, Record<string, number>> | null = null

    try {
      // 1. Buscar dataset (row_count + column_stats)
      const dataset = await db.from('datasets')
        .where('internal_table_name', safeTableName)
        .select('row_count', 'column_stats')
        .first()

      if (dataset) {
        if (dataset.row_count !== undefined && dataset.row_count !== null) {
          rowCount = Number(dataset.row_count)
        }
        columnStats = (dataset.column_stats as Record<string, Record<string, number>>) ?? null
      }

      // 2. Se não encontrou row_count no datasets, buscar COUNT(*) direto na tabela
      if (rowCount === 0) {
        const countResult = await db.rawQuery(`SELECT COUNT(*) AS total FROM "${safeTableName}"`)
        rowCount = Number((countResult.rows?.[0] as { total: string })?.total ?? 0)
      }

      // 3. Buscar amostra (5 linhas) para a IA citar nomes e exemplos reais
      const sampleResult = await db.rawQuery(`SELECT * FROM "${safeTableName}" LIMIT 5`)
      sampleData = JSON.stringify(sampleResult.rows || [], null, 0)
    } catch (error) {
      console.error('Erro ao buscar estatísticas da tabela:', error)
    }

    return { rowCount, sampleData, columnStats }
  }

  /**
   * Monta o system prompt do Connor — analista de dados sênior da The Boring Interprise. Usado tanto em prompt único quanto em chat com histórico.
   */
  private async buildAnalyzeSystemPrompt(question: string): Promise<string> {
    const questionEmbedding = await this.generateEmbedding(question)
    const relevantColumns = await this.vectorService.findRelevantColumns(question, questionEmbedding, 15)
    const tableName = relevantColumns[0]?.tableName ?? ''
    const { rowCount, sampleData, columnStats } = await this.fetchTableStatistics(tableName)

    const schemaInfo = relevantColumns.map((col: ColumnMetadata) =>
      `Tabela: ${col.tableName}, Coluna: ${col.columnName}, Tipo: ${col.dataType}, Descrição: ${col.description}`
    ).join('\n')

    const statsDescription = columnStats && Object.keys(columnStats).length > 0
      ? Object.entries(columnStats)
        .map(([col, values]) => {
          const isSum = col.includes('_sum_by_')
          const label = isSum ? 'SOMA' : 'FREQUÊNCIA (quantidade de registros)'
          const vals = Object.entries(values as Record<string, number>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
          return `Agregação [${label}] na coluna ${col}: [${vals}]`
        })
        .join('\n')
      : ''
    const topValuesText = statsDescription ? `\n${statsDescription}\n` : ''

    const realDataContext = tableName
      ? `
CONTEXTO REAL DOS DADOS:
- Tabela: ${tableName} | Total de linhas: ${rowCount}
- Amostra: ${sampleData}
${topValuesText}

INSTRUÇÕES DE ANÁLISE:
1. **Identificação Direta**: Analise a amostra de dados e os metadados em busca de informações que confirmem a pergunta do usuário.
2. **Citação de Exemplos**: Cite exemplos reais encontrados na amostra para ilustrar sua resposta.
3. **Cruzamento de Dados**: Utilize o raciocínio lógico para relacionar colunas e valores.
4. **Tratamento de Nomes**: Identifique nomes relevantes na coluna de nomes, se houver, e apresente-os como achados.
5. **Proibição de Inferência Amostral (A Regra do Silêncio)**: Nunca use a "amostra" (sampleData) para concluir rankings ou totais globais. A amostra serve apenas para citar EXEMPLOS de nomes ou formatos. Para rankings ou totais exatos, se o valor agregado não estiver nas columnStats, admita que não tem a soma exata e sugira ao usuário usar o Modo SQL.

DIFERENÇA ENTRE FREQUÊNCIA E VALOR:
- Se você vir algo como "Valor (222)" em uma agregação de FREQUÊNCIA, isso significa que esse valor aparece 222 vezes nos registros (contagem).
- NÃO assuma que ele é o maior em valor financeiro a menos que exista uma estatística explícita de SOMA (SUM) nas agregações acima.
- Se a pergunta exigir uma conta (ex: "quem vendeu mais em valor?") que não estiver nas agregações (sem SOMA disponível), diga: "Consigo ver quem mais aparece nos registros (frequência), mas para saber o valor exato, preciso processar uma query de soma. Quer que eu faça isso no Modo SQL?"
6. **Dados Quantitativos**: Se o usuário perguntar "quantos?", "qual o total?", "tem mais X ou Y?", use os valores fornecidos nas agregações acima (FREQUÊNCIA ou SOMA conforme o caso). Não especule se você tiver o dado real.

DIRETRIZES DE PERSONALIDADE:
- Você é um analista de dados sênior focado em extrair insights valiosos.
- Use frases como: "Analisando os registros...", "Observando os dados...", "Encontrei alguns exemplos interessantes...".
- Mantenha o tom profissional, objetivo e útil.
- **SQL no Modo Conversa**: Quando for útil responder com uma consulta (ex.: "me mostre o SQL para...", "qual query retorna X?", ou quando a pergunta pedir listagem/agregação que exija SQL), inclua a query em um bloco markdown com syntax SQL. Use exatamente: \`\`\`sql seguido da query em uma ou mais linhas e feche com \`\`\`. Use aspas duplas em identificadores PostgreSQL e o mesmo case das tabelas/colunas do esquema acima. Assim o usuário pode copiar e executar no Laboratório. Para perguntas apenas exploratórias ou que você responde com estatísticas já disponíveis, responda só em texto.`
      : ''

    return `Você é um analista de dados sênior experiente. Seu objetivo é extrair e apresentar fatos concretos do dataset, citando nomes e exemplos reais quando disponíveis, sempre baseando-se estritamente nos dados fornecidos.
${realDataContext}

CONTEXTO DO ESQUEMA (metadados das colunas):
${schemaInfo}

ESTRUTURA DA RESPOSTA:
1. Comece com uma frase de reconhecimento sobre o que o usuário perguntou.
2. Apresente seus achados citando dados reais da amostra e das estatísticas.
3. Quando fizer sentido, inclua a query SQL em um bloco \`\`\`sql ... \`\`\` para o usuário poder copiar e executar.
4. Termine com uma pergunta aberta ou sugestão para aprofundar a análise.`
  }

  /**
   * Analisa o dataset com base na pergunta do usuário - Modo Conversa.
   * Se identifier for informado: recupera histórico, envia contexto + nova pergunta para a IA e persiste user + assistant no banco.
   */
  async analyzeDataset(question: string, identifier?: string, model?: string): Promise<string> {
    const systemPrompt = await this.buildAnalyzeSystemPrompt(question)
    const selectedModel = model || this.defaultChatModelSlug
    const useMistralLangChain = selectedModel === this.defaultChatModelSlug || selectedModel === 'mistralai/mistral-small-24b'

    try {
      if (identifier) {
        // 1. Recuperar: últimas mensagens do identifier
        const historyRows = await ChatHistory.getLastMessages(identifier, 10)

        // 2. Formatar: histórico de mensagens para o formato esperado pela IA
        const messages: Message[] = [
          { role: 'system', content: systemPrompt },
          ...historyRows.map((row) => ({
            role: row.role as 'user' | 'assistant',
            content: row.content
          })),
          { role: 'user', content: question },
        ];

        // 3. Chamar: IA com o histórico de mensagens
        const responseText = useMistralLangChain
          ? await this.callMistralChat(messages)
          : await this.callOpenRouter(messages, selectedModel)

        // 4. Salvar: nova pergunta do usuário e resposta da IA
        await ChatHistory.create({ identifier, role: 'user', content: question, model: selectedModel })
        await ChatHistory.create({ identifier, role: 'assistant', content: responseText, model: selectedModel })
        return responseText
      }

      // 5. Chamar: IA sem histórico (primeira pergunta)
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ]

      // 6. Retornar: resposta da IA sem persistência
      const responseText = useMistralLangChain
        ? await this.callMistralChat(messages)
        : await this.callOpenRouter(messages, selectedModel)
      return responseText
    } catch (error) {
      console.error('Erro ao analisar dataset:', error)
      throw new Error(`Falha ao analisar o dataset: ${(error as Error).message}`)
    }
  }

  /**
   * Gera uma consulta SQL com base na pergunta do usuário e nos metadados relevantes
   */
  async generateSQL(question: string): Promise<string> {
    // Gerar embedding para a pergunta
    const questionEmbedding = await this.generateEmbedding(question)

    // Buscar colunas relevantes
    const relevantColumns = await this.vectorService.findRelevantColumns(question, questionEmbedding, 10)

    // Gerar SQL com base nos metadados encontrados
    return await this.generateSQLWithMetadata(question, relevantColumns)
  }

  /**
   * Gera embedding para um texto usando Mistral
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddingModel.embedQuery(text)

      return embedding
    } catch (error) {
      console.error('Erro ao gerar embedding:', error)
      // Retornar um array de zeros como fallback (não ideal, mas evita falhas)
      return Array(1024).fill(0)
    }
  }

  /**
   * Gera SQL com base nos metadados das colunas relevantes
   */
  private async generateSQLWithMetadata(question: string, columns: ColumnMetadata[]): Promise<string> {
    // Formatar metadados para o prompt
    const schemaInfo = columns.map(col =>
      `Tabela: ${col.tableName}, Coluna: ${col.columnName}, Tipo: ${col.dataType}, Descrição: ${col.description}`
    ).join('\n')

    const prompt = `Você é um especialista em PostgreSQL. Com base na pergunta do usuário e no esquema do banco de dados fornecido, gere uma consulta SQL válida para PostgreSQL que responda à pergunta.

Pergunta: ${question}

Esquema do banco de dados:
${schemaInfo}

INSTRUÇÕES CRÍTICAS PARA POSTGRESQL:
- PostgreSQL é CASE-SENSITIVE quando você usa aspas duplas nos identificadores
- SEMPRE use aspas duplas ("") ao redor de TODOS os nomes de tabelas e colunas
- Use EXATAMENTE o mesmo case (maiúsculas/minúsculas) que aparece no esquema acima
- Exemplo CORRETO: SELECT "Country", "Amount" FROM "chocolate_sales__2_"
- Exemplo INCORRETO: SELECT Country, Amount FROM chocolate_sales__2_
- Exemplo INCORRETO: SELECT country, amount FROM chocolate_sales__2_

Regras adicionais:
- A PRIMEIRA palavra da sua resposta DEVE ser SELECT (ou WITH para CTEs)
- NÃO adicione NENHUM prefixo como "SQL:", "Query:", etc
- NÃO adicione blocos de código markdown (\`\`\`sql)
- Gere apenas a consulta SQL pura, sem explicações adicionais
- Use aliases apropriados para tabelas (ex: c para a tabela principal)
- Ao usar aliases, ainda use aspas duplas: c."Country", c."Amount"
- Considere JOINs se necessário para combinar informações de diferentes tabelas
- Selecione apenas as colunas necessárias para responder à pergunta
- Use filtros WHERE adequados com base na pergunta
- Para valores monetários com "$" e vírgulas, use: CAST(REPLACE(REPLACE(c."Amount", '$', ''), ',', '') AS NUMERIC)
- Não inclua ";" no final da consulta
- Se não for possível gerar uma consulta válida com as tabelas fornecidas, responda com "Nenhuma consulta pode ser gerada com as tabelas disponíveis"

REGRAS DE UNICIDADE E ESTRUTURA:
- Gere EXATAMENTE UMA única consulta SQL.
- NUNCA retorne mais de um comando SELECT na mesma resposta.
- Se a pergunta exigir múltiplas visões, tente consolidar em uma única query usando JOINs, CTEs (WITH) ou UNION ALL.
- NÃO repita o comando SELECT no meio da resposta.
- A consulta deve ser autossuficiente e responder à pergunta de forma direta.

FORMATO DE SAÍDA ESPERADO:
Sua resposta deve começar IMEDIATAMENTE com SELECT (sem espaços ou caracteres antes).
Exemplo: SELECT c."Country", SUM(...) FROM "tabela" c GROUP BY c."Country"`

    try {
      const response = await this.mistralClient.invoke(prompt)
      let sqlQuery = response.content.toString().trim()

      console.log('🤖 Resposta bruta da IA:', sqlQuery)

      // Limpar resposta caso contenha explicações adicionais
      if (sqlQuery.startsWith('Nenhuma consulta')) {
        throw new Error(sqlQuery)
      }

      // Remover possíveis marcações de código
      sqlQuery = sqlQuery.replace(/```sql\n?|\n?```/g, '').trim()

      // Remover possíveis prefixos comuns de erro da IA
      sqlQuery = sqlQuery.replace(/^(sql|SQL):\s*/i, '').trim()

      // Corrigir duplicação de letras no início (ex: SSELECT -> SELECT)
      sqlQuery = sqlQuery.replace(/^S(SELECT)/i, '$1')
      sqlQuery = sqlQuery.replace(/^W(WITH)/i, '$1')

      // Normalizar espaços em branco
      sqlQuery = sqlQuery.replace(/\s+/g, ' ').trim()

      // Se a IA gerou múltiplos SELECTs (erro comum), manter apenas o primeiro
      const selectMatches = sqlQuery.match(/SELECT/gi) || []
      if (selectMatches.length > 1) {
        const parts = sqlQuery.split(/(?=SELECT)/i)
        sqlQuery = parts[0].trim()
      }

      // Garantir que começa com uma palavra-chave SQL válida
      if (!sqlQuery.match(/^(SELECT|WITH|INSERT|UPDATE|DELETE)/i)) {
        throw new Error('Query gerada não começa com uma palavra-chave SQL válida')
      }

      console.log('✅ Query limpa:', sqlQuery)

      return sqlQuery
    } catch (error) {
      console.error('Erro ao gerar SQL:', error)
      throw new Error(`Falha ao gerar consulta SQL: ${(error as Error).message}`)
    }
  }

  /**
   * Chama o OpenRouter usando a compatibilidade com o OpenAI Chat Completions
   */
  private async callOpenRouter(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    model: string
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY não configurada no ambiente')
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3333',
        'X-Title': 'SQLAIGen',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenRouter erro ${res.status}: ${text}`)
    }

    const data = await res.json() as {
      choices: Array<{ message?: { content?: string }, delta?: { content?: string } }>
    }
    const content = data?.choices?.[0]?.message?.content || ''
    return (content || '').trim()
  }

  private async callMistralChat(messages: Message[]): Promise<string> {
    const langChainMessages = messages.map((m) => {
      if (m.role === 'system') return new SystemMessage(m.content)
      if (m.role === 'assistant') return new AIMessage(m.content)
      return new HumanMessage(m.content)
    })

    const res = await this.mistralClient.invoke(langChainMessages)
    return (res.content?.toString() || '').trim()
  }
}
