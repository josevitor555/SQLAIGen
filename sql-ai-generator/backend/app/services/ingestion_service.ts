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
   * Processa um arquivo CSV e armazena metadados com embeddings
   */
  async processCSV(filePath: string, fileName?: string) {
    console.log('🚀 Iniciando processamento do CSV:', fileName)

    // Ler o cabeçalho do CSV para obter nomes e tipos de colunas
    console.log('📝 Extraindo colunas do CSV...')
    const columns = await this.extractColumnsFromCSV(filePath)
    console.log(`✅ Encontradas ${columns.length} colunas:`, columns.map(c => c.name).join(', '))

    const tableName = fileName
      ? fileName.toLowerCase().replace(/\.csv$/i, '').replace(/[^a-z0-9_]/g, '_')
      : this.getTableNameFromFilePath(filePath)

    console.log(`📊 Nome da tabela: ${tableName}`)

    // IMPORTANTE: Criar tabela física com os dados do CSV
    console.log('🏗️ Criando tabela física no banco de dados...')
    const rowCount = await this.createPhysicalTable(filePath, tableName, columns)
    console.log(`✅ Tabela criada com ${rowCount} linhas importadas`)

    // Para cada coluna, gerar embedding e salvar no vetor
    console.log(`🧠 Processando ${columns.length} colunas para gerar embeddings...`)
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
      console.log(`    ✅ Coluna ${column.name} processada`)
    }
    console.log('✅ Todos os embeddings foram gerados e salvos')

    // Registrar o dataset no banco de dados
    console.log('💾 Registrando dataset no banco...')
    const db = (await import('@adonisjs/lucid/services/db')).default
    await db.table('datasets').insert({
      original_name: fileName || filePath.split('/').pop() || 'unknown.csv',
      internal_table_name: tableName,
      column_count: columns.length,
      row_count: rowCount,
      created_at: new Date(),
      updated_at: new Date()
    })
    console.log('✅ Dataset registrado')

    console.log('🎉 Processamento concluído com sucesso!')
    return {
      tableName,
      columnsProcessed: columns.length,
      columns: columns.map(c => c.name),
      rowsImported: rowCount
    }
  }

  /**
   * Extrai colunas de um arquivo CSV
   */
  private async extractColumnsFromCSV(filePath: string): Promise<Array<{ name: string, type?: string }>> {
    return new Promise((resolve, reject) => {
      const columns: Array<{ name: string, type?: string }> = []
      let resolved = false

      const stream = fs.createReadStream(filePath)
        .pipe(csvParser())  // Usar vírgula como delimitador (padrão)
        .on('data', (row) => {
          if (!resolved) {
            // Pega os nomes das colunas (keys do primeiro objeto)
            const columnNames = Object.keys(row)
            columns.push(...columnNames.map((name) => ({ name: name.trim() })))
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
    columns: Array<{ name: string, type?: string }>
  ): Promise<number> {
    const db = (await import('@adonisjs/lucid/services/db')).default

    // Inferir tipos de dados analisando os dados
    const columnsWithTypes = await this.inferColumnTypes(filePath, columns)

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
        .pipe(csvParser())  // Usar vírgula como delimitador (padrão)
        .on('data', (row) => {
          rows.push(row)
        })
        .on('end', () => resolve())
        .on('error', reject)
    })
    console.log(`    ✅ ${rows.length} linhas lidas do CSV`)

    // Inserir dados em lotes usando bulk insert para melhor performance
    const batchSize = 500 // Aumentado para melhor performance
    const totalBatches = Math.ceil(rows.length / batchSize)

    console.log(`    💾 Inserindo dados em ${totalBatches} lotes de até ${batchSize} linhas...`)

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1

      // Preparar valores para bulk insert
      const valueSets: any[][] = []
      for (const row of batch) {
        const values = columnsWithTypes.map(col => {
          const value = row[col.name]
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
    return rowCount
  }

  /**
   * Infere os tipos de dados das colunas analisando uma amostra dos dados
   */
  private async inferColumnTypes(
    filePath: string,
    columns: Array<{ name: string, type?: string }>
  ): Promise<Array<{ name: string, type: string }>> {
    const sampleRows: any[] = []
    const sampleSize = 100

    await new Promise<void>((resolve, reject) => {
      let count = 0
      fs.createReadStream(filePath)
        .pipe(csvParser())  // Usar vírgula como delimitador (padrão)
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
      const values = sampleRows.map(row => row[col.name]).filter(v => v !== null && v !== undefined && v !== '')

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
   * Extrai nome da tabela do caminho do arquivo
   */
  private getTableNameFromFilePath(filePath: string): string {
    const fileName = filePath.split('/').pop()?.split('.')[0] || 'unknown'
    return fileName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }
}