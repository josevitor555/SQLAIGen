import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Habilita a inteligência vetorial no Postgres
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS vector')
  }

  async down() {
    await this.db.rawQuery('DROP EXTENSION IF EXISTS vector')
  }
}