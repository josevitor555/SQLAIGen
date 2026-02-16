import { inject } from '@adonisjs/core'
import fs from 'fs'
import csvParser from 'csv-parser'
import VectorService from './vector_service.js'
import { ChatMistralAI } from '@langchain/mistralai'
import { MistralAIEmbeddings } from '@langchain/mistralai'

@inject()
export default class IngestionService {
  private mistralClient: ChatMistralAI
  private embeddingModel: MistralAIEmbeddings

  constructor(
    private vectorService: VectorService,
  ) {
    this.mistralClient = new ChatMistralAI({ apiKey: process.env.MISTRAL_API_KEY })
    this.embeddingModel = new MistralAIEmbeddings({ apiKey: process.env.MISTRAL_API_KEY })
  }

  /**
   * Detecta o separador do CSV (; ou ,) analisando a primeira linha
   */
  private async detectSeparator(filePath: string): Promise<string> {
    const firstLine = await new Promise<string>((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
      let buffer = ''
      stream.on('data', (chunk) => {
        buffer += chunk.toString()
        const newlineIndex = buffer.indexOf('\n')
        if (newlineIndex !== -1) {
          resolve(buffer.slice(0, newlineIndex))
          stream.destroy()
        }
      })
      stream.on('end', () => resolve(buffer.split('\n')[0] || buffer))
      stream.on('error', reject)
    })
    const separator = firstLine.includes(';') ? ';' : ','
    console.log(`📌 Delimitador detectado: "${separator}"`)
    return separator
  }

  /**
   * Processa um arquivo CSV e armazena metadados com embeddings
   */
  async processCSV(filePath: string, fileName?: string) {
    console.log('Iniciando processamento do CSV:', fileName)

    // Detectar separador automaticamente (suporta ; e ,)
    const separator = await this.detectSeparator(filePath)

    // Ler o cabeçalho do CSV para obter nomes e tipos de colunas
    console.log('Extraindo colunas do CSV...')
    const columns = await this.extractColumnsFromCSV(filePath, separator)
    console.log(`Encontradas ${columns.length} colunas:`, columns.map(c => c.name).join(', '))

    const tableName = fileName
      ? fileName.toLowerCase().replace(/\.csv$/i, '').replace(/[^a-z0-9_]/g, '_')
      : this.getTableNameFromFilePath(filePath)

    console.log(`Nome da tabela: ${tableName}`)

    // IMPORTANTE: Criar tabela física com os dados do CSV
    console.log('🏗️ Criando tabela física no banco de dados...')
    const { rowCount, columnsWithTypes } = await this.createPhysicalTable(filePath, tableName, columns, separator)
    console.log(`Tabela criada com ${rowCount} linhas importadas`)

    // Para cada coluna, gerar embedding e salvar no vetor
    console.log(`Processando ${columns.length} colunas para gerar embeddings...`)
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      console.log(`  [${i + 1}/${columns.length}] Processando coluna: ${column.name}`)

      // Gerar descrição e embedding para a coluna
      console.log(`    → Gerando descrição com IA...`)
      const description = await this.generateColumnDescription(column.name, fileName || filePath)
      console.log(`    → Descrição: "${description}"`)

      console.log(`    → Gerando embedding (1024D)...`)
      const embedding = await this.generateEmbedding(`${column.name} ${description}`)
      console.log(`    → Embedding gerado com ${embedding.length} dimensões`)

      // Salvar contexto no banco de dados
      console.log(`    → Salvando contexto vetorial...`)
      await this.vectorService.saveContext(
        tableName,
        column.name,
        column.type || 'TEXT',
        description,
        embedding
      )
      console.log(`    Coluna ${column.name} processada`)
    }
    console.log('Todos os embeddings foram gerados e salvos')

    // Calcular resumo estatístico (Top 5 valores de colunas categóricas) para o Connor
    console.log('📊 Calculando resumo estatístico (Top 5 por coluna categórica)...')
    const columnStats = await this.calculateColumnStats(tableName, columnsWithTypes)

    // Registrar o dataset no banco de dados
    console.log('Registrando dataset no banco...')
    const db = (await import('@adonisjs/lucid/services/db')).default
    await db.table('datasets').insert({
      original_name: fileName || filePath.split('/').pop() || 'unknown.csv',
      internal_table_name: tableName,
      column_count: columns.length,
      row_count: rowCount,
      column_stats: columnStats,
      created_at: new Date(),
      updated_at: new Date()
    })
    console.log('Dataset registrado')

    console.log('Processamento concluído com sucesso!')
    return {
      tableName,
      columnsProcessed: columns.length,
      columns: columns.map(c => c.name),
      rowsImported: rowCount
    }
  }

  /**
   * Sanitiza nome de coluna para uso seguro em PostgreSQL.
   * Remove pontos (evita interpretação tabela.coluna), aspas e substitui espaços por underscores.
   */
  private sanitizeColumnName(raw: string, index: number): string {
    let cleaned = raw
      .trim()
      .replace(/[."]/g, '')        // Remove pontos e aspas
      .replace(/\s+/g, '_')       // Substitui espaços por underscores
      .toLowerCase()              // Padroniza para minúsculas

    if (!cleaned) return `column_${index + 1}`
    return cleaned
  }

  /**
   * Extrai colunas de um arquivo CSV
   */
  private async extractColumnsFromCSV(filePath: string, separator: string = ','): Promise<Array<{ name: string, type?: string, originalHeader?: string }>> {
    return new Promise((resolve, reject) => {
      const columns: Array<{ name: string, type?: string, originalHeader?: string }> = []
      let resolved = false

      const stream = fs.createReadStream(filePath)
        .pipe(csvParser({ separator }))
        .on('data', (row) => {
          if (!resolved) {
            // Pega os nomes das colunas (keys do primeiro objeto) e sanitiza para PostgreSQL
            const columnNames = Object.keys(row)
            columns.push(...columnNames.map((name, i) => ({
              name: this.sanitizeColumnName(name, i),
              originalHeader: name.trim()
            })))
            console.log('✅ Extração de colunas concluída')
            resolved = true
            stream.destroy() // Parar de ler o arquivo
            resolve(columns)
          }
        })
        .on('error', (error) => {
          if (!resolved) {
            console.error('❌ Erro ao extrair colunas:', error)
            reject(error)
          }
        })
    })
  }

  /**
   * Cria uma tabela física no banco de dados com os dados do CSV
   * Esta é a funcionalidade central que transforma o CSV em uma fonte consultável
   */
  private async createPhysicalTable(
    filePath: string,
    tableName: string,
    columns: Array<{ name: string, type?: string, originalHeader?: string }>,
    separator: string = ','
  ): Promise<{ rowCount: number; columnsWithTypes: Array<{ name: string; type: string }> }> {
    const db = (await import('@adonisjs/lucid/services/db')).default

    // Mapa: nome sanitizado (usado na tabela) -> cabeçalho original do CSV (para ler das linhas)
    const headerByColName = Object.fromEntries(
      columns.map(c => [c.name, c.originalHeader ?? c.name])
    )

    // Inferir tipos de dados analisando os dados
    const columnsWithTypes = await this.inferColumnTypes(filePath, columns, separator)

    // Criar a definição da tabela
    const columnDefinitions = columnsWithTypes
      .map(col => `"${col.name}" ${col.type || 'TEXT'}`)
      .join(', ')

    // Dropar tabela se já existir (para permitir re-upload)
    await db.rawQuery(`DROP TABLE IF EXISTS "${tableName}"`)

    // Criar tabela
    await db.rawQuery(`CREATE TABLE "${tableName}" (${columnDefinitions})`)

    // Importar dados do CSV
    let rowCount = 0
    const rows: any[] = []

    console.log('    📥 Lendo dados do CSV...')
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser({ separator }))
        .on('data', (row) => {
          rows.push(row)
        })
        .on('end', () => resolve())
        .on('error', reject)
    })
    console.log(`    ✅ ${rows.length} linhas lidas do CSV`)

    // Inserir dados em lotes: PostgreSQL tem limite de ~65.535 parâmetros por query
    const maxParamsPerQuery = 65000
    const paramsPerRow = columnsWithTypes.length
    const batchSize = Math.max(1, Math.min(500, Math.floor(maxParamsPerQuery / paramsPerRow)))
    const totalBatches = Math.ceil(rows.length / batchSize)

    console.log(`    💾 Inserindo dados em ${totalBatches} lotes de até ${batchSize} linhas...`)

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1

      // Preparar valores para bulk insert
      const valueSets: any[][] = []
      for (const row of batch) {
        const values = columnsWithTypes.map(col => {
          const csvKey = headerByColName[col.name] ?? col.name
          const value = row[csvKey]
          return value === undefined || value === null || value === '' ? null : value
        })
        valueSets.push(values)
      }

      // Construir query de bulk insert usando Knex query builder
      const columnNames = columnsWithTypes.map(col => col.name)

      // Usar o query builder do Knex para bulk insert (mais seguro e compatível)
      await db.table(tableName).multiInsert(
        valueSets.map(values => {
          const rowData: Record<string, any> = {}
          columnNames.forEach((name, idx) => {
            rowData[name] = values[idx]
          })
          return rowData
        })
      )

      rowCount += batch.length
      console.log(`      ✓ Lote ${batchNumber}/${totalBatches} inserido (${rowCount}/${rows.length} linhas)`)
    }

    console.log(`    ✅ Total de ${rowCount} linhas inseridas com sucesso`)
    return { rowCount, columnsWithTypes }
  }

  /**
   * Infere os tipos de dados das colunas analisando uma amostra dos dados
   */
  private async inferColumnTypes(
    filePath: string,
    columns: Array<{ name: string, type?: string, originalHeader?: string }>,
    separator: string = ','
  ): Promise<Array<{ name: string, type: string }>> {
    const sampleRows: any[] = []
    const sampleSize = 100

    await new Promise<void>((resolve, reject) => {
      let count = 0
      fs.createReadStream(filePath)
        .pipe(csvParser({ separator }))
        .on('data', (row) => {
          if (count < sampleSize) {
            sampleRows.push(row)
            count++
          }
        })
        .on('end', () => resolve())
        .on('error', reject)
    })

    return columns.map(col => {
      const csvKey = col.originalHeader ?? col.name
      const values = sampleRows.map(row => row[csvKey]).filter(v => v !== null && v !== undefined && v !== '')

      if (values.length === 0) {
        return { name: col.name, type: 'TEXT' }
      }

      // Verificar se todos os valores são inteiros
      const allIntegers = values.every(v => /^-?\d+$/.test(v))
      if (allIntegers) {
        return { name: col.name, type: 'INTEGER' }
      }

      // Verificar se todos os valores são floats
      const allFloats = values.every(v => /^-?\d+\.?\d*$/.test(v))
      if (allFloats) {
        return { name: col.name, type: 'FLOAT' }
      }

      // Verificar se todos os valores são datas
      const allDates = values.every(v => !isNaN(Date.parse(v)))
      if (allDates) {
        return { name: col.name, type: 'DATE' }
      }

      return { name: col.name, type: 'TEXT' }
    })
  }

  /**
   * Gera uma descrição para uma coluna usando IA
   */
  private async generateColumnDescription(columnName: string, filePath: string): Promise<string> {
    // Neste caso, vamos inferir o tipo e descrição com base no nome da coluna
    // Em uma implementação completa, poderíamos analisar os dados reais

    const prompt = `Você é um especialista em análise de dados. Dado o nome de uma coluna "${columnName}" em um arquivo CSV chamado "${filePath}", forneça uma descrição clara e concisa do que essa coluna representa. Responda com apenas a descrição, sem adicionar nenhum texto extra.`

    try {
      const response = await this.mistralClient.invoke(prompt);

      return response.content.toString().trim() || ''
    } catch (error) {
      console.error('Erro ao gerar descrição da coluna:', error)
      return `Coluna ${columnName}`
    }
  }

  /**
   * Gera embedding para um texto usando Mistral
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddingModel.embedQuery(text);

      return embedding
    } catch (error) {
      console.error('Erro ao gerar embedding:', error)
      // Retornar um array de zeros como fallback (não ideal, mas evita falhas)
      return Array(1024).fill(0)
    }
  }

  /**
   * Indica se o nome da coluna sugere "valor" (montante, venda, tarifa, etc.)
   */
  private isValueColumn(colName: string): boolean {
    const lower = colName.toLowerCase()
    const valuePatterns = [
      'amount', 'sales', 'fare', 'value', 'price', 'total', 'revenue',
      'valor', 'venda', 'preco', 'tarifa', 'receita', 'montante', 'sum'
    ]
    return valuePatterns.some(p => lower.includes(p))
  }

  /**
   * Escolhe a coluna "dimensão" principal (ex: Vendedor, Categoria) para cruzar com valores.
   * Preferência: primeira coluna TEXT; ou nome que sugira dimensão (seller, category, name, etc.).
   */
  private pickDimensionColumn(columns: Array<{ name: string; type: string }>): { name: string; type: string } | null {
    const dimensionPatterns = ['seller', 'vendedor', 'category', 'categoria', 'name', 'nome', 'product', 'country', 'region']
    const textColumns = columns.filter(c => c.type === 'TEXT')
    const byName = textColumns.find(c => dimensionPatterns.some(p => c.name.toLowerCase().includes(p)))
    return byName ?? textColumns[0] ?? null
  }

  /**
   * Calcula os 5 valores mais comuns para cada coluna de texto/categoria (frequência)
   * e, para colunas numéricas de "valor", o Top 5 por SOMA agrupado pela dimensão principal.
   * Permite que o Connor responda "David vendeu X" sem rodar SQL.
   */
  private async calculateColumnStats(
    tableName: string,
    columns: Array<{ name: string; type: string }>
  ): Promise<Record<string, Record<string, number>> | null> {
    const db = (await import('@adonisjs/lucid/services/db')).default
    const stats: Record<string, Record<string, number>> = {}

    console.log(`📊 Calculando resumo estatístico para a tabela: ${tableName}`)

    // --- 1) Top 5 por FREQUÊNCIA (colunas categóricas) ---
    for (const col of columns) {
      if (col.type !== 'TEXT' && col.type !== 'INTEGER') continue

      try {
        let query = db
          .from(tableName)
          .select(col.name, db.raw('COUNT(*) as cnt'))
          .whereNotNull(col.name)

        if (col.type === 'TEXT') {
          query = query.whereNot(col.name, '')
        }

        const result = await query
          .groupBy(col.name)
          .orderBy('cnt', 'desc')
          .limit(5)

        if (result && result.length > 0) {
          const topValues: Record<string, number> = {}
          for (const row of result as any[]) {
            const val = row[col.name] !== null ? String(row[col.name]) : 'Nulo'
            topValues[val] = Number(row.cnt)
          }
          stats[col.name] = topValues
        }
      } catch (err) {
        console.error(`Erro ao processar coluna ${col.name}:`, (err as Error).message)
      }
    }

    // --- 2) Top 5 por SOMA: colunas de valor (FLOAT/INTEGER) cruzadas com a dimensão principal ---
    const dimensionCol = this.pickDimensionColumn(columns)
    const valueColumns = columns.filter(
      c => (c.type === 'FLOAT' || c.type === 'INTEGER') && this.isValueColumn(c.name)
    )

    if (dimensionCol && valueColumns.length > 0) {
      const quotedTable = `"${tableName}"`
      const quotedDim = `"${dimensionCol.name}"`

      for (const valueCol of valueColumns) {
        const quotedVal = `"${valueCol.name}"`
        try {
          const sumResult = await db.rawQuery(
            `SELECT ${quotedDim}, SUM(${quotedVal}) AS total FROM ${quotedTable} WHERE ${quotedDim} IS NOT NULL AND ${quotedVal} IS NOT NULL GROUP BY ${quotedDim} ORDER BY total DESC LIMIT 5`
          )
          const rows = (sumResult.rows || []) as Array<Record<string, unknown>>
          if (rows.length > 0) {
            const key = `${valueCol.name}_sum_by_${dimensionCol.name}`
            const topBySum: Record<string, number> = {}
            for (const row of rows) {
              const dimVal = row[dimensionCol.name] != null ? String(row[dimensionCol.name]) : 'Nulo'
              topBySum[dimVal] = Number(row.total)
            }
            stats[key] = topBySum
            console.log(`  ✓ Top 5 por SOMA: ${key}`, Object.keys(topBySum))
          }
        } catch (err) {
          console.error(`Erro ao calcular soma por dimensão (${valueCol.name} por ${dimensionCol.name}):`, (err as Error).message)
        }
      }
    }

    return Object.keys(stats).length ? stats : null
  }

  /**
   * Extrai nome da tabela do caminho do arquivo
   */
  private getTableNameFromFilePath(filePath: string): string {
    const fileName = filePath.split('/').pop()?.split('.')[0] || 'unknown'
    return fileName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }
}