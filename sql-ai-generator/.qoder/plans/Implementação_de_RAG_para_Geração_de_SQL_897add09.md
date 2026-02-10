# Implementação de RAG para Geração de SQL

## Configurações Iniciais

### 1. Atualização do .env
Adicione as seguintes variáveis ao arquivo `backend/.env`:
```
# Banco de dados PostgreSQL
DB_CONNECTION=pg
PG_HOST=seu_host_supabase
PG_PORT=5432
PG_USER=seu_usuario
PG_PASSWORD=sua_senha
PG_DATABASE=seu_banco_dados

# API da Mistral
MISTRAL_API_KEY=sua_chave_api_mistral
```

### 2. Atualização do start/env.ts
Atualize o arquivo `backend/start/env.ts` para incluir as novas variáveis:
```typescript
export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string.optional({ format: 'host' }), // Tornar opcional para permitir PG_* abaixo
  DB_PORT: Env.schema.number.optional(),
  DB_USER: Env.schema.string.optional(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variáveis para PostgreSQL (Supabase)
  |----------------------------------------------------------
  */
  PG_HOST: Env.schema.string({ format: 'host' }),
  PG_PORT: Env.schema.number(),
  PG_USER: Env.schema.string(),
  PG_PASSWORD: Env.schema.string.optional(),
  PG_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variáveis para IA
  |----------------------------------------------------------
  */
  MISTRAL_API_KEY: Env.schema.string(),
})
```

### 3. Atualização do config/database.ts
Modifique o arquivo `backend/config/database.ts` para usar as variáveis PG_*:
```typescript
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT'),
        user: env.get('PG_USER'),
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
```

## 1. Migrations (Ordem Cronológica)

### M1 (enable_pgvector): `database/migrations/1770722452515_enable_pgvector_extension.ts`
```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'enable_pgvector'

  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS vector')
  }

  async down() {
    this.schema.raw('DROP EXTENSION IF EXISTS vector')
  }
}
```

### M2 (table_contexts): `database/migrations/1770722452516_create_table_contexts_table.ts`
```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'table_contexts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('table_name').notNullable()
      table.string('column_name').notNullable()
      table.string('data_type').notNullable()
      table.text('description')
      
      // Coluna de embedding vetorial
      table.specificType('embedding', 'vector(1024)').notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    // Criar índice para busca vetorial
    this.schema.raw('CREATE INDEX idx_table_contexts_embedding ON table_contexts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

## 2. Services (app/services)

### VectorService: `backend/app/services/vector_service.ts`
```typescript
import { inject } from '@adonisjs/core'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DbAccessTokensManager } from '@adonisjs/auth/access_tokens'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import type { DatabaseService } from '@adonisjs/lucid/database'

interface TableContextAttributes {
  id: number
  tableName: string
  columnName: string
  dataType: string
  description?: string
  embedding: number[]
  createdAt: Date
  updatedAt: Date
}

interface TableContextRelations {
}

@inject()
export default class VectorService {
  constructor(private db: DatabaseService) {}

  /**
   * Salva o contexto de uma coluna com seu embedding
   */
  async saveContext(tableName: string, columnName: string, dataType: string, description: string, embedding: number[]) {
    const query = `
      INSERT INTO table_contexts (table_name, column_name, data_type, description, embedding, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CAST($5 AS vector), NOW(), NOW())
    `
    
    await this.db.rawQuery(query, [tableName, columnName, dataType, description, `[${embedding.join(',')}]`])
  }

  /**
   * Encontra colunas relevantes com base na similaridade de cosseno
   */
  async findRelevantColumns(question: string, embedding: number[], limit: number = 5) {
    const query = `
      SELECT *, 
             embedding <=> CAST($1 AS vector) as distance
      FROM table_contexts
      ORDER BY embedding <=> CAST($1 AS vector)
      LIMIT $2
    `
    
    const result = await this.db.rawQuery(query, [`[${embedding.join(',')}]`, limit])
    return result.rows.map(row => ({
      id: row.id,
      tableName: row.table_name,
      columnName: row.column_name,
      dataType: row.data_type,
      description: row.description,
      distance: row.distance
    }))
  }
}
```

### IngestionService: `backend/app/services/ingestion_service.ts`
```typescript
import { inject } from '@adonisjs/core'
import fs from 'fs'
import csvParser from 'csv-parser'
import { VectorService } from './vector_service.js'
import { MistralClient } from '@mistralai/mistralai'
import type { EnvService } from '@adonisjs/core/env'

@inject()
export default class IngestionService {
  private mistralClient: MistralClient

  constructor(
    private vectorService: VectorService,
    private env: EnvService
  ) {
    this.mistralClient = new MistralClient(env.get('MISTRAL_API_KEY'))
  }

  /**
   * Processa um arquivo CSV e armazena metadados com embeddings
   */
  async processCSV(filePath: string) {
    // Ler o cabeçalho do CSV para obter nomes e tipos de colunas
    const columns = await this.extractColumnsFromCSV(filePath)
    
    // Para cada coluna, gerar embedding e salvar no vetor
    for (const column of columns) {
      // Gerar descrição e embedding para a coluna
      const description = await this.generateColumnDescription(column.name, filePath)
      const embedding = await this.generateEmbedding(`${column.name} ${description}`)
      
      // Salvar contexto no banco de dados
      await this.vectorService.saveContext(
        this.getTableNameFromFilePath(filePath),
        column.name,
        column.type || 'unknown',
        description,
        embedding
      )
    }
  }

  /**
   * Extrai colunas de um arquivo CSV
   */
  private async extractColumnsFromCSV(filePath: string): Promise<Array<{name: string, type?: string}>> {
    return new Promise((resolve, reject) => {
      const columns: Array<{name: string, type?: string}> = []
      const rs = fs.createReadStream(filePath)
      
      rs.pipe(csvParser({ headers: false }))
        .on('headers', (headers) => {
          // Primeira linha contém os nomes das colunas
          columns.push(...headers.map(header => ({ name: header.trim() })))
          rs.destroy() // Parar após ler os cabeçalhos
        })
        .on('error', reject)
        .on('close', () => resolve(columns))
    })
  }

  /**
   * Gera uma descrição para uma coluna usando IA
   */
  private async generateColumnDescription(columnName: string, filePath: string): Promise<string> {
    // Neste caso, vamos inferir o tipo e descrição com base no nome da coluna
    // Em uma implementação completa, poderíamos analisar os dados reais
    
    const prompt = `Você é um especialista em análise de dados. Dado o nome de uma coluna "${columnName}" em um arquivo CSV chamado "${filePath}", forneça uma descrição clara e concisa do que essa coluna representa. Responda com apenas a descrição, sem adicionar nenhum texto extra.`
    
    try {
      const response = await this.mistralClient.chat({
        model: 'mistral-large-latest',
        messages: [
          { role: 'user', content: prompt }
        ],
        maxTokens: 100
      })
      
      return response.choices[0].message.content?.trim() || ''
    } catch (error) {
      console.error('Erro ao gerar descrição da coluna:', error)
      return `Coluna ${columnName}`
    }
  }

  /**
   * Gera embedding para um texto usando Mistral
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.mistralClient.embeddings({
        model: 'mistral-embed',
        input: text
      })
      
      return response.data[0].embedding
    } catch (error) {
      console.error('Erro ao gerar embedding:', error)
      // Retornar um array de zeros como fallback (não ideal, mas evita falhas)
      return Array(1024).fill(0)
    }
  }

  /**
   * Extrai nome da tabela do caminho do arquivo
   */
  private getTableNameFromFilePath(filePath: string): string {
    const fileName = filePath.split('/').pop()?.split('.')[0] || 'unknown'
    return fileName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }
}
```

### AiService: `backend/app/services/ai_service.ts`
```typescript
import { inject } from '@adonisjs/core'
import { VectorService } from './vector_service.js'
import { MistralClient } from '@mistralai/mistralai'
import type { EnvService } from '@adonisjs/core/env'

interface ColumnMetadata {
  id: number
  tableName: string
  columnName: string
  dataType: string
  description: string
  distance: number
}

@inject()
export default class AiService {
  private mistralClient: MistralClient

  constructor(
    private vectorService: VectorService,
    private env: EnvService
  ) {
    this.mistralClient = new MistralClient(env.get('MISTRAL_API_KEY'))
  }

  /**
   * Gera uma consulta SQL com base na pergunta do usuário e nos metadados relevantes
   */
  async generateSQL(question: string): Promise<string> {
    // Gerar embedding para a pergunta
    const questionEmbedding = await this.generateEmbedding(question)
    
    // Buscar colunas relevantes
    const relevantColumns = await this.vectorService.findRelevantColumns(question, questionEmbedding, 10)
    
    // Gerar SQL com base nos metadados encontrados
    return await this.generateSQLWithMetadata(question, relevantColumns)
  }

  /**
   * Gera embedding para um texto usando Mistral
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.mistralClient.embeddings({
        model: 'mistral-embed',
        input: text
      })
      
      return response.data[0].embedding
    } catch (error) {
      console.error('Erro ao gerar embedding:', error)
      // Retornar um array de zeros como fallback (não ideal, mas evita falhas)
      return Array(1024).fill(0)
    }
  }

  /**
   * Gera SQL com base nos metadados das colunas relevantes
   */
  private async generateSQLWithMetadata(question: string, columns: ColumnMetadata[]): Promise<string> {
    // Formatar metadados para o prompt
    const schemaInfo = columns.map(col => 
      `Tabela: ${col.tableName}, Coluna: ${col.columnName}, Tipo: ${col.dataType}, Descrição: ${col.description}`
    ).join('\n')
    
    const prompt = `Você é um especialista em PostgreSQL. Com base na pergunta do usuário e no esquema do banco de dados fornecido, gere uma consulta SQL válida para PostgreSQL que responda à pergunta.

Pergunta: ${question}

Esquema do banco de dados:
${schemaInfo}

Instruções:
- Gere apenas a consulta SQL, sem explicações adicionais
- Use aliases apropriados para tabelas e colunas quando necessário
- Considere JOINs se necessário para combinar informações de diferentes tabelas
- Selecione apenas as colunas necessárias para responder à pergunta
- Use filtros WHERE adequados com base na pergunta
- Não inclua ";" no final da consulta
- Se não for possível gerar uma consulta válida com as tabelas fornecidas, responda com "Nenhuma consulta pode ser gerada com as tabelas disponíveis"`

    try {
      const response = await this.mistralClient.chat({
        model: 'mistral-large-latest',
        messages: [
          { role: 'user', content: prompt }
        ],
        maxTokens: 500
      })
      
      let sqlQuery = response.choices[0].message.content?.trim() || ''
      
      // Limpar resposta caso contenha explicações adicionais
      if (sqlQuery.startsWith('Nenhuma consulta')) {
        throw new Error(sqlQuery)
      }
      
      // Remover possíveis marcações de código
      sqlQuery = sqlQuery.replace(/```sql\n?|\n?```/g, '').trim()
      
      return sqlQuery
    } catch (error) {
      console.error('Erro ao gerar SQL:', error)
      throw new Error(`Falha ao gerar consulta SQL: ${(error as Error).message}`)
    }
  }
}
```

## 3. Controllers (app/controllers)

### CsvsController: `backend/app/controllers/csvs_controller.ts`
```typescript
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { IngestionService } from '../services/ingestion_service.js'
import vine from '@vinejs/vine'

export default class CsvsController {
  @inject()
  constructor(private ingestionService: IngestionService) {}

  /**
   * Faz upload e processa um arquivo CSV
   */
  async upload({ request, response }: HttpContext) {
    // Validar o upload do arquivo
    const validator = vine.compile(
      vine.object({
        file: vine.file({
          size: '10mb',
          extnames: ['csv']
        })
      })
    )

    try {
      const payload = await validator.validate(request.all())
      
      // Obter o arquivo CSV
      const csvFile = request.file('file')
      
      if (!csvFile || !csvFile.isValid) {
        return response.badRequest({ error: 'Arquivo inválido ou ausente' })
      }

      // Criar diretório temporário se não existir
      const fs = await import('fs')
      const path = await import('path')
      
      const tmpDir = path.join(process.cwd(), 'tmp')
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true })
      }

      // Salvar arquivo temporariamente
      const filePath = path.join(tmpDir, csvFile.clientName)
      await csvFile.move(tmpDir, { name: csvFile.clientName })

      // Processar o arquivo CSV
      await this.ingestionService.processCSV(filePath)

      return { message: 'CSV processado com sucesso', fileName: csvFile.clientName }
    } catch (error) {
      console.error('Erro ao processar upload de CSV:', error)
      return response.badRequest({ error: error.messages || 'Erro ao processar arquivo CSV' })
    }
  }
}
```

### QueriesController: `backend/app/controllers/queries_controller.ts`
```typescript
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { AiService } from '../services/ai_service.js'
import vine from '@vinejs/vine'

export default class QueriesController {
  @inject()
  constructor(private aiService: AiService) {}

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
}
```

## 4. Instalação de Dependências

Adicione as seguintes dependências ao projeto:

```bash
cd backend
npm install csv-parser
npm install -D @types/csv-parser
npm i @langchain/mistralai
```

## 5. Rotas

Adicione as rotas no arquivo `start/routes.ts`:

```typescript
import router from '@adonisjs/core/services/router'

router.post('/upload-csv', () => import('#controllers/csvs_controller')).as('csv.upload')
router.post('/ask', () => import('#controllers/queries_controller')).as('queries.ask')
```

## 6. Execução

1. Execute as migrations:
```bash
cd backend
node ace migration:run
```

2. Certifique-se de que as variáveis de ambiente estão configuradas corretamente no `.env`.

3. Inicie o servidor:
```bash
node ace serve --watch
```

## 7. Testes

Para testar o sistema:

1. Faça upload de um arquivo CSV:
```bash
curl -X POST -F "file=@sample.csv" http://localhost:3333/upload-csv
```

2. Faça uma pergunta para gerar SQL:
```bash
curl -X POST -H "Content-Type: application/json" -d '{"question":"Quantos usuários têm mais de 18 anos?"}' http://localhost:3333/ask
```