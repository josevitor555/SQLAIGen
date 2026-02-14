import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'datasets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('column_stats').nullable().comment('Top 5 valores mais comuns por coluna categórica')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('column_stats')
    })
  }
}
