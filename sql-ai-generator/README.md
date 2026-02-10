# 🚀 SQLAIGen - Retrieval-Augmented Generation para Consultas SQL

SQLAIGen é um ecossistema de inteligência de dados que transforma arquivos CSV brutos em fontes de consulta semântica através de um fluxo automatizado de Retrieval-Augmented Generation (RAG).

## 🎯 Visão Geral

O sistema utiliza **pgvector** (PostgreSQL) + **Mistral AI** para criar um "cérebro" semântico que:
1. ✅ Ingere CSVs e cria tabelas físicas dinâmicas
2. ✅ Gera embeddings de 1024 dimensões para cada coluna
3. ✅ Armazena metadados vetoriais na `table_contexts`
4. ✅ Interpola perguntas em linguagem natural
5. ✅ Recupera colunas relevantes via busca por similaridade de cosseno
6. ✅ Gera comandos SQL precisos com Mistral AI
7. ✅ Executa queries de forma segura

## 📦 Tech Stack

### Backend (AdonisJS)
- **Framework**: AdonisJS 6  
- **Database**: PostgreSQL + pgvector
- **AI**: Mistral AI (embeddings + SQL generation)
- **Linguagem**: TypeScript

### Frontend (React + Vite)
- **Framework**: React + Vite
- **Estilização**: Tailwind CSS
- **Linguagem**: TypeScript

## 🛠️ Pré-requisitos

- Node.js >= 18
- PostgreSQL >= 14 com extensão **pgvector**
- Conta Mistral AI (https://console.mistral.ai/)

## ⚙️ Configuração

### 1. Configurar o PostgreSQL com pgvector

```sql
-- Conectar ao PostgreSQL
psql -U postgres

-- Criar o banco de dados
CREATE DATABASE sqlaigen;

-- Conectar ao banco
\c sqlaigen

-- Ativar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Backend Setup

```bash
cd backend

# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Editar .env e configurar:
# - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE
# - MISTRAL_API_KEY (obter em https://console.mistral.ai/)
nano .env

# Gerar APP_KEY
node ace generate:key

# Executar migrations
node ace migration:run

# Iniciar servidor
npm run dev
```

O backend estará rodando em `http://localhost:3333`

### 3. Frontend Setup

```bash
cd sqlaigenerator

# Instalar dependências
npm install

# Iniciar aplicação
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## 🎬 Como Usar

### 1. Upload de CSV
1. Acesse `http://localhost:5173`
2. Clique em "Upload CSV Dataset"
3. Selecione um arquivo CSV
4. Aguarde o processamento (criação de tabela + embeddings)

### 2. Visualizar Schema
1. Após o upload, clique em "View Schema"
2. Veja as colunas, tipos inferidos, exemplos e descrições geradas por IA

### 3. Fazer Perguntas
1. Clique em "Proceed to Query Lab"
2. Digite uma pergunta em linguagem natural (ex: "Mostre os 10 clientes com maior valor de compra")
3. O sistema irá:
   - Gerar embedding da pergunta
   - Buscar colunas similares via cosine similarity
   - Gerar SQL com Mistral AI
   - Exibir o SQL gerado

### 4. Executar Query (Opcional)
Você pode adicionar um botão no frontend para executar a query via endpoint:
```
POST /queries/execute
{ "sqlQuery": "SELECT * FROM tabela LIMIT 10" }
```

## 📁 Estrutura do Projeto

```
sql-ai-generator/
├── backend/                    # API AdonisJS
│   ├── app/
│   │   ├── controllers/        # Controllers HTTP
│   │   │   ├── csvs_controller.ts
│   │   │   ├── queries_controller.ts
│   │   │   └── schemas_controller.ts
│   │   ├── models/             # Models Lucid
│   │   │   └── dataset.ts
│   │   └── services/           # Serviços de negócio
│   │       ├── ingestion_service.ts  # Processamento de CSV
│   │       ├── vector_service.ts     # Operações com pgvector
│   │       ├── ai_service.ts         # IA (Mistral)
│   │       └── schema_service.ts     # Gerenciamento de schema
│   ├── database/migrations/    # Migrations do banco
│   └── start/routes.ts         # Rotas da API
│
└── sqlaigenerator/             # Frontend React
    └── src/
        ├── components/
        │   └── system/
        │       ├── UploadSection.tsx     # Upload de CSV
        │       ├── SchemaViewer.tsx      # Visualização do schema
        │       └── QueryLab.tsx          # Interface de perguntas
        └── App.tsx
```

## 🔑 Endpoints da API

### Upload de CSV
```http
POST /datasets/upload
Content-Type: multipart/form-data
file: <arquivo.csv>
```

### Buscar Schema
```http
GET /schemas/latest
```

### Gerar SQL
```http
POST /queries/ask
Content-Type: application/json
{ "question": "Mostre os 10 produtos mais vendidos" }
```

### Executar SQL
```http
POST /queries/execute
Content-Type: application/json
{ "sqlQuery": "SELECT * FROM produtos LIMIT 10" }
```

## 🧠 Como Funciona o RAG

1. **Ingestão** (`IngestionService`):
   - Lê CSV e infere tipos de dados (INTEGER, FLOAT, TEXT, DATE)
   - Cria tabela física no PostgreSQL
   - Importa todos os dados do CSV
   - Gera descrição de cada coluna com Mistral AI
   - Cria embeddings de 1024 dimensões
   - Armazena na `table_contexts`

2. **Busca Semântica** (`VectorService`):
   - Recebe pergunta do usuário
   - Gera embedding da pergunta
   - Busca top-N colunas por similaridade de cosseno (`<=>`)
   - Retorna metadados relevantes

3. **Geração de SQL** (`AiService`):
   - Recebe metadados das colunas relevantes
   - Monta prompt para Mistral AI
   - Gera SQL válido para PostgreSQL
   - Retorna query otimizada

4. **Execução Segura** (`SchemaService`):
   - Valida que é apenas SELECT
   - Bloqueia comandos perigosos (DROP, DELETE, etc)
   - Executa no banco
   - Retorna resultados

## 🧪 Exemplo de CSV

Crie um arquivo `vendas.csv`:

```csv
produto,categoria,preco,quantidade,data_venda
Notebook,Eletrônicos,3500.00,10,2024-01-15
Mouse,Acessórios,45.90,50,2024-01-16
Teclado,Acessórios,120.00,30,2024-01-16
Monitor,Eletrônicos,850.00,20,2024-01-17
```

Perguntas exemplo:
- "Qual o produto mais caro?"
- "Mostre as vendas de eletrônicos"
- "Total de vendas por categoria"

## 🐛 Troubleshooting

### Erro: "pgvector extension not found"
```sql
-- Instalar pgvector no PostgreSQL
CREATE EXTENSION vector;
```

### Erro: "MISTRAL_API_KEY not configured"
- Obtenha uma chave em https://console.mistral.ai/
- Adicione no `.env`: `MISTRAL_API_KEY=sua_chave_aqui`

### Erro: "CORS blocked"
- Certifique-se de que o backend está em `http://localhost:3333`
- Verifique se o frontend está fazendo requisições para a URL correta

## 📝 Licença

MIT

## 🤝 Contribuições

Pull requests são bem-vindos! Para mudanças importantes, abra uma issue primeiro.

---

**Desenvolvido com ❤️ usando PostgreSQL + pgvector + Mistral AI**
