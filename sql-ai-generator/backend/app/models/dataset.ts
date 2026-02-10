import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Dataset extends BaseModel {
    @column({ isPrimary: true })
    declare id: number

    @column()
    declare originalName: string

    @column()
    declare internalTableName: string

    @column()
    declare columnCount: number

    @column()
    declare rowCount: number

    @column.dateTime({ autoCreate: true })
    declare createdAt: DateTime

    @column.dateTime({ autoCreate: true, autoUpdate: true })
    declare updatedAt: DateTime
}
