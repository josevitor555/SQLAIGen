import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import SchemaService from '../services/schema_service.js'

@inject()
export default class SchemasController {
    constructor(private schemaService: SchemaService) { }

    /**
     * Retorna o schema do dataset mais recente
     */
    async show({ response }: HttpContext) {
        try {
            const schema = await this.schemaService.getLatestSchema()

            if (!schema) {
                return response.status(404).json({
                    message: 'Nenhum dataset encontrado. Faça upload de um CSV primeiro.'
                })
            }

            return response.ok(schema)
        } catch (error) {
            console.error('Erro ao buscar schema:', error)
            return response.status(500).json({
                error: 'Falha ao buscar schema',
                message: (error as Error).message
            })
        }
    }

    /**
     * Deleta o dataset mais recente e todos os seus dados
     */
    async destroy({ response }: HttpContext) {
        try {
            await this.schemaService.deleteLatestDataset()

            return response.ok({
                message: 'Dataset deletado com sucesso'
            })
        } catch (error) {
            console.error('Erro ao deletar dataset:', error)
            return response.status(500).json({
                error: 'Falha ao deletar dataset',
                message: (error as Error).message
            })
        }
    }
}
