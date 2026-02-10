import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import AiService from '../services/ai_service.js'
import SchemaService from '../services/schema_service.js'
import vine from '@vinejs/vine'

@inject()
export default class QueriesController {
  constructor(
    private aiService: AiService,
    private schemaService: SchemaService
  ) { }

  /**
   * Recebe uma pergunta e retorna uma consulta SQL gerada
   */
  async ask({ request, response }: HttpContext) {
    // Validar entrada
    const validator = vine.compile(
      vine.object({
        question: vine.string().minLength(5).maxLength(500)
      })
    )

    try {
      const payload = await validator.validate(request.all())

      // Gerar consulta SQL com base na pergunta
      const sqlQuery = await this.aiService.generateSQL(payload.question)

      return {
        question: payload.question,
        sqlQuery: sqlQuery
      }
    } catch (error) {
      console.error('Erro ao gerar consulta SQL:', error)
      return response.status(500).json({
        error: 'Falha ao gerar consulta SQL',
        message: error.message
      })
    }
  }

  /**
   * Executa uma query SQL gerada
   */
  async execute({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        sqlQuery: vine.string().minLength(10).maxLength(2000)
      })
    )

    try {
      const payload = await validator.validate(request.all())

      // Executar a query de forma segura
      const result = await this.schemaService.executeQuery(payload.sqlQuery)

      return {
        sqlQuery: payload.sqlQuery,
        rows: result.rows,
        rowCount: result.rowCount
      }
    } catch (error) {
      console.error('Erro ao executar query:', error)
      return response.status(500).json({
        error: 'Falha ao executar query',
        message: (error as Error).message
      })
    }
  }
}