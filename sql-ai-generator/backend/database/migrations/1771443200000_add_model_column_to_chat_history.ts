import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chat_history'

  async up() {
    // Verifica se a coluna já existe antes de tentar criar
    const hasColumn = await this.schema.hasColumn(this.tableName, 'model')
    
    if (!hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.string('model', 64).nullable().comment('Slug do modelo de IA utilizado')
      })
    }
  }

  async down() {
    // Verifica se a coluna existe antes de tentar remover
    const hasColumn = await this.schema.hasColumn(this.tableName, 'model')

    if (hasColumn) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('model')
      })
    }
  }
}
