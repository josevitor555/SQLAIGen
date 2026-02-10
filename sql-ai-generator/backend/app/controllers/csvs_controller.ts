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
      // Move o arquivo para uma pasta temporária
      await csvFile.move(app.makePath('tmp/uploads'))
      const filePath = csvFile.filePath!

      // DISPARA O GATILHO (O seu IngestionService)
      const result = await this.ingestionService.processCSV(filePath, csvFile.clientName)

      return response.ok({
        message: 'Dataset processado com sucesso!',
        data: result
      })
    } catch (error) {
      console.error(error)
      return response.internalServerError({ message: 'Erro ao processar o gatilho de ingestão' })
    }
  }
}