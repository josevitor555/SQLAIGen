import { inject } from '@adonisjs/core'
import VectorService from './vector_service.js'
import { ChatMistralAI } from '@langchain/mistralai'
import { MistralAIEmbeddings } from '@langchain/mistralai'

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
  private mistralClient: ChatMistralAI
  private embeddingModel: MistralAIEmbeddings

  constructor(
    private vectorService: VectorService,
  ) {
    this.mistralClient = new ChatMistralAI({ apiKey: process.env.MISTRAL_API_KEY })
    this.embeddingModel = new MistralAIEmbeddings({ apiKey: process.env.MISTRAL_API_KEY })
  }

  /**
   * Analisa o dataset com base na pergunta do usuário - Modo Conversa
   * Não gera SQL, apenas analisa estrutura, colunas, relacionamentos e fornece insights
   */
  async analyzeDataset(question: string): Promise<string> {
    const questionEmbedding = await this.generateEmbedding(question)
    const relevantColumns = await this.vectorService.findRelevantColumns(question, questionEmbedding, 15)

    const schemaInfo = relevantColumns.map((col: ColumnMetadata) =>
      `Tabela: ${col.tableName}, Coluna: ${col.columnName}, Tipo: ${col.dataType}, Descrição: ${col.description}`
    ).join('\n')

    const systemPrompt = `Você é o "SG-AI", um assistente de análise de dados inteligente, amigável e perspicaz. Seu objetivo é ajudar o usuário a extrair o máximo de valor do dataset, conversando de forma natural, como um colega de equipe sênior faria.

CONTEXTO DO DATASET (O que você "enxerga"):
${schemaInfo}

DIRETRIZES DE PERSONALIDADE E ESTILO (CHATGPT-LIKE):
- **Tom de Voz**: Use um tom profissional, porém acessível e entusiasmado. Seja proativo e não apenas reativo.
- **Saudações e Fluidez**: Não precisa ser excessivamente formal. Pode usar expressões como "Olhando aqui os seus dados...", "Uma coisa interessante que notei é..." ou "Fazendo uma leitura rápida, vejo que...".
- **Sem Listas Secas**: Em vez de apenas listar pontos, conecte as ideias. Use bullet points apenas para organizar sugestões, mas introduza-os com uma breve análise.
- **Insights Contextuais**: Use o conhecimento técnico para sugerir *por que* certa coluna é importante. (Ex: "A coluna 'required' é crucial porque ela separa o que é crítico do que é opcional no seu projeto").
- **Emojis**: Use emojis de forma sutil para dar leveza à conversa (ex: 📊, 💡, ✅, 🚀).
- **Zero SQL**: Nunca mostre código SQL aqui. Fale sobre a *lógica* do negócio e dos dados.

ESTRUTURA DA RESPOSTA:
1. Comece com uma frase de reconhecimento sobre o que o usuário perguntou ou sobre o estado geral do dataset.
2. Desenvolva a análise misturando observações técnicas com insights práticos.
3. Termine sempre com uma pergunta aberta ou uma sugestão instigante para manter o engajamento.`

    const prompt = `${systemPrompt}

PERGUNTA DO USUÁRIO: ${question}

Responda com sua análise:`

    try {
      const response = await this.mistralClient.invoke(prompt)
      return response.content.toString().trim()
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
}