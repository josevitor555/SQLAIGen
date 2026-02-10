import router from '@adonisjs/core/services/router'

router.get('/', async () => {
  return {
    hello: 'SQLAIGen API',
    status: 'running'
  }
})

const CsvsController = () => import('#controllers/csvs_controller')
const QueriesController = () => import('#controllers/queries_controller')
const SchemasController = () => import('#controllers/schemas_controller')

// CORS - Habilitar para frontend
router.group(() => {
  // Rota de Ingestão (Gatilho de Upload)
  router.post('/datasets/upload', [CsvsController, 'upload'])

  // Rotas de Schema
  router.get('/schemas/latest', [SchemasController, 'show'])
  router.delete('/schemas/latest', [SchemasController, 'destroy'])

  // Rotas de Pergunta (Gatilho de IA)
  router.post('/queries/ask', [QueriesController, 'ask'])
  router.post('/queries/execute', [QueriesController, 'execute'])
}).prefix('/api')

// Rota sem prefixo /api (para compatibilidade com frontend atual)
router.post('/datasets/upload', [CsvsController, 'upload'])
router.get('/schemas/latest', [SchemasController, 'show'])
router.delete('/schemas/latest', [SchemasController, 'destroy'])
router.post('/queries/ask', [QueriesController, 'ask'])
router.post('/queries/execute', [QueriesController, 'execute'])

