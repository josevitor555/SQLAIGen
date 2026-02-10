import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

@inject()
export default class SchemaService {
    /**
     * Busca o schema mais recente do banco de dados
     */
    async getLatestSchema() {
        // Buscar o dataset mais recente
        const dataset = await db
            .from('datasets')
            .orderBy('created_at', 'desc')
            .first()

        if (!dataset) {
            return null
        }

        // Buscar informações das colunas da tabela_contexts
        const columns = await db
            .from('table_contexts')
            .where('table_name', dataset.internal_table_name)
            .select('column_name', 'data_type', 'description')
            .orderBy('id', 'asc')

        // Pegar alguns exemplos de valores de cada coluna
        const exampleValues: Record<string, any> = {}

        for (const column of columns) {
            try {
                const result = await db.rawQuery(
                    `SELECT "${column.column_name}" FROM "${dataset.internal_table_name}" WHERE "${column.column_name}" IS NOT NULL LIMIT 1`
                )

                if (result.rows && result.rows.length > 0) {
                    exampleValues[column.column_name] = result.rows[0][column.column_name]
                }
            } catch (error) {
                console.error(`Erro ao buscar exemplo para coluna ${column.column_name}:`, error)
                exampleValues[column.column_name] = null
            }
        }

        return {
            tableName: dataset.internal_table_name,
            originalName: dataset.original_name,
            rowCount: dataset.row_count,
            columns: columns.map(col => ({
                name: col.column_name,
                type: col.data_type,
                description: col.description,
                example: exampleValues[col.column_name]
            }))
        }
    }

    /**
     * Executa uma query SQL de forma segura (somente SELECT)
     */
    async executeQuery(sqlQuery: string) {
        // Validar que é uma query SELECT
        const trimmedQuery = sqlQuery.trim().toUpperCase()

        if (!trimmedQuery.startsWith('SELECT')) {
            throw new Error('Apenas queries SELECT são permitidas')
        }

        // Validar que não contém comandos perigosos
        const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC']
        const containsDangerous = dangerousKeywords.some(keyword =>
            trimmedQuery.includes(keyword)
        )

        if (containsDangerous) {
            throw new Error('Query contém comandos não permitidos')
        }

        try {
            const result = await db.rawQuery(sqlQuery)
            return {
                rows: result.rows || [],
                rowCount: result.rowCount || 0
            }
        } catch (error) {
            console.error('Erro ao executar query:', error)
            throw new Error(`Erro ao executar query: ${(error as Error).message}`)
        }
    }

    /**
     * Deleta o dataset mais recente e todos os seus dados associados
     */
    async deleteLatestDataset() {
        // Buscar o dataset mais recente
        const dataset = await db
            .from('datasets')
            .orderBy('created_at', 'desc')
            .first()

        if (!dataset) {
            throw new Error('Nenhum dataset encontrado para deletar')
        }

        const tableName = dataset.internal_table_name

        // 1. Deletar a tabela física
        try {
            await db.rawQuery(`DROP TABLE IF EXISTS "${tableName}"`)
            console.log(`✅ Tabela física "${tableName}" deletada`)
        } catch (error) {
            console.error(`Erro ao deletar tabela física "${tableName}":`, error)
            // Continuar mesmo se falhar
        }

        // 2. Deletar contextos vetoriais da tabela
        await db
            .from('table_contexts')
            .where('table_name', tableName)
            .delete()
        console.log(`✅ Contextos vetoriais de "${tableName}" deletados`)

        // 3. Deletar registro do dataset
        await db
            .from('datasets')
            .where('id', dataset.id)
            .delete()
        console.log(`✅ Registro do dataset "${dataset.original_name}" deletado`)

        return {
            deletedTable: tableName,
            originalName: dataset.original_name
        }
    }
}
