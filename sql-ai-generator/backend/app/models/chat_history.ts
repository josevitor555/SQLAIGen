import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type ChatRole = 'user' | 'assistant'

export default class ChatHistory extends BaseModel {
  static table = 'chat_history'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare identifier: string

  @column()
  declare role: ChatRole

  @column()
  declare content: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  /**
   * Últimas N mensagens de um identifier, em ordem cronológica (mais antiga primeiro).
   */
  static async getLastMessages(identifier: string, limit: number = 10) {
    return await ChatHistory.query()
      .where('identifier', identifier)
      .orderBy('created_at', 'asc')
      .limit(limit)
  }
}
