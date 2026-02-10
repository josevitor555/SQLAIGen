import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'table_contexts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('table_name').notNullable()
      table.string('column_name').notNullable()
      table.string('data_type').notNullable()
      table.text('description').nullable()

      // Embedding de 1024 dimensões (padrão Mistral)
      table.specificType('embedding', 'vector(1024)').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    // Índice para busca semântica veloz
    this.schema.raw('CREATE INDEX idx_table_contexts_embedding ON table_contexts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}