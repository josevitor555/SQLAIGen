import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import AiService from '../services/ai_service.js'
import SchemaService from '../services/schema_service.js'
import ChatHistory from '#models/chat_history'
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
   * Modo Conversa: analisa o dataset em vez de gerar SQL.
   * Se identifier for enviado, recupera histórico, envia contexto à IA e persiste a nova troca.
   */
  async chat({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        question: vine.string().minLength(3).maxLength(1000),
        identifier: vine.string().maxLength(64).optional(),
        model: vine.string().minLength(3).maxLength(100).optional(),
      })
    )

    try {
      const payload = await validator.validate(request.all())
      const analysis = await this.aiService.analyzeDataset(
        payload.question,
        payload.identifier,
        payload.model
      )

      return {
        question: payload.question,
        response: analysis
      }
    } catch (error) {
      console.error('Erro no Modo Conversa:', error)
      return response.status(500).json({
        error: 'Falha ao analisar o dataset',
        message: (error as Error).message
      })
    }
  }

  /**
   * Retorna as últimas N mensagens do chat para um identifier (para restaurar conversa na UI).
   */
  async chatHistory({ request, response }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        identifier: vine.string().maxLength(64),
        limit: vine.number().min(1).max(50).optional()
      })
    )

    try {
      const { identifier, limit = 10 } = await validator.validate(request.all())
      const messages = await ChatHistory.getLastMessages(identifier, limit)
      return {
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISO()
        }))
      }
    } catch (error) {
      console.error('Erro ao buscar histórico do chat:', error)
      return response.status(500).json({
        error: 'Falha ao buscar histórico',
        message: (error as Error).message
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
