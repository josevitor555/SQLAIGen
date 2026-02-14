import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chat_history'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('identifier', 64).notNullable().comment('UUID ou IP temporário para distinguir conversas sem login')
      table.string('role', 16).notNullable().comment("'user' ou 'assistant'")
      table.text('content').notNullable().comment('Conteúdo da mensagem')
      table.timestamp('created_at').notNullable()

      table.index(['identifier', 'created_at'], 'chat_history_identifier_created_at_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}

/*
  Query de exemplo: últimas 10 mensagens de um identifier específico (ordem cronológica):

  SELECT id, identifier, role, content, created_at
  FROM chat_history
  WHERE identifier = :identifier
  ORDER BY created_at DESC
  LIMIT 10;

  Em Lucid (Model):
  await ChatHistory.query()
    .where('identifier', identifier)
    .orderBy('created_at', 'desc')
    .limit(10)
*/
