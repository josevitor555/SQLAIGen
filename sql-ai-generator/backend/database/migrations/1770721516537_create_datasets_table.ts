import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'datasets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('original_name').notNullable() // Nome do arquivo .csv
      table.string('internal_table_name').notNullable() // Nome da tabela criada no banco
      table.integer('column_count').notNullable()
      table.integer('row_count').defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}