import db from '@adonisjs/lucid/services/db'

interface TableContextAttributes {
  id: number
  tableName: string
  columnName: string
  dataType: string
  description?: string
  embedding: number[]
  createdAt: Date
  updatedAt: Date
}

export default class VectorService {
  /**
   * Salva o contexto de uma coluna com seu embedding
   */
  async saveContext(tableName: string, columnName: string, dataType: string, description: string, embedding: number[]) {
    const query = `
      INSERT INTO table_contexts (table_name, column_name, data_type, description, embedding, created_at, updated_at)
      VALUES (?, ?, ?, ?, CAST(? AS vector), NOW(), NOW())
    `

    await db.rawQuery(query, [tableName, columnName, dataType, description, `[${embedding.join(',')}]`])
  }

  /**
   * Encontra colunas relevantes com base na similaridade de cosseno
   */
  async findRelevantColumns(question: string, embedding: number[], limit: number = 5) {
    const query = `
      SELECT *, 
             embedding <=> CAST(? AS vector) as distance
      FROM table_contexts
      ORDER BY embedding <=> CAST(? AS vector)
      LIMIT ?
    `

    const result = await db.rawQuery(query, [`[${embedding.join(',')}]`, `[${embedding.join(',')}]`, limit])
    return result.rows.map((row: any) => ({
      id: row.id,
      tableName: row.table_name,
      columnName: row.column_name,
      dataType: row.data_type,
      description: row.description,
      distance: row.distance
    }))
  }
}
