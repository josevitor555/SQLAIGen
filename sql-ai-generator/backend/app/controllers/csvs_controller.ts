import { HttpContext } from '@adonisjs/core/http'
import IngestionService from '#services/ingestion_service'
import { inject } from '@adonisjs/core'
import app from '@adonisjs/core/services/app'

@inject()
export default class CsvsController {
  constructor(protected ingestionService: IngestionService) { }

  /**
   * Este é o "Gatilho"! 
   * O usuário envia o arquivo via POST e o sistema faz o resto.
   */
  async upload({ request, response }: HttpContext) {
    const csvFile = request.file('file', {
      size: '10mb',
      extnames: ['csv'],
    })

    if (!csvFile) {
      return response.badRequest({ message: 'Arquivo não enviado' })
    }

    if (!csvFile.isValid) {
      return response.badRequest({ message: 'Arquivo inválido', errors: csvFile.errors })
    }

    try {
      console.log(`📤 Recebendo upload: ${csvFile.clientName} (${(csvFile.size / 1024).toFixed(2)} KB)`)

      // Move o arquivo para uma pasta temporária
      await csvFile.move(app.makePath('tmp/uploads'))
      const filePath = csvFile.filePath!
      console.log(`✅ Arquivo salvo em: ${filePath}`)

      // DISPARA O GATILHO (O seu IngestionService)
      console.log('🚀 Iniciando processamento do CSV...')
      const result = await this.ingestionService.processCSV(filePath, csvFile.clientName)
      console.log('✅ Processamento concluído com sucesso!')

      return response.ok({
        message: 'Dataset processado com sucesso!',
        data: result
      })
    } catch (error) {
      console.error('❌ Erro ao processar CSV:', error)

      // Fornecer mensagem de erro mais detalhada
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      const errorStack = error instanceof Error ? error.stack : undefined

      console.error('Stack trace:', errorStack)

      return response.internalServerError({
        message: 'Erro ao processar o arquivo CSV',
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      })
    }
  }
}