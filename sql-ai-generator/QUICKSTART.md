# 🚀 Guia Rápido de Início - SQLAIGen

## ⚡ Setup Rápido (5 minutos)

### 1. Pré-requisitos
```bash
# Verificar versões
node --version   # >= 18
psql --version   # >= 14
```

### 2. Banco de Dados
```sql
# Abrir PostgreSQL
psql -U postgres

# Criar banco e ativar pgvector
CREATE DATABASE sqlaigen;
\c sqlaigen
CREATE EXTENSION vector;
\q
```

### 3. Backend
```bash
cd backend

# Instalar
npm install

# Configurar ambiente
cp .env.example .env

# Editar .env e adicionar:
# MISTRAL_API_KEY=sua_chave_aqui (obter em https://console.mistral.ai/)
# DB_PASSWORD=sua_senha_postgres

# Gerar chave
node ace generate:key

# Migrations
node ace migration:run

# Iniciar
npm run dev
```

✅ Backend rodando em `http://localhost:3333`

### 4. Frontend
```bash
cd sqlaigenerator

# Instalar e iniciar
npm install
npm run dev
```

✅ Frontend rodando em `http://localhost:5173`

---

## 🎯 Testar o Sistema

1. **Abra** `http://localhost:5173`
2. **Upload** do arquivo `exemplo_vendas.csv` (na raiz do projeto)
3. **Aguarde** o processamento (10-30 segundos)
4. **Clique** em "View Schema" para ver o schema gerado
5. **Vá para** "Query Lab"
6. **Digite** uma pergunta:
   - "Quais são os 5 produtos mais caros?"
   - "Mostre todas as vendas de eletrônicos"
   - "Qual o total de vendas por categoria?"
   - "Quem vendeu mais produtos?"

---

## 🔑 Obter Mistral API Key

1. Acesse: https://console.mistral.ai/
2. Crie uma conta (se não tiver)
3. Vá em "API Keys"
4. Clique em "Create new key"
5. Copie a chave e cole no `.env`:
   ```
   MISTRAL_API_KEY=sua_chave_aqui
   ```

---

## 🐛 Problemas Comuns

### Erro: "pgvector extension not found"
```sql
# Reconnect to your database
psql -U postgres -d sqlaigen
CREATE EXTENSION vector;
```

### Erro: "Migration failed"
```bash
# Resetar migrations
node ace migration:rollback
node ace migration:run
```

### Erro: "CORS blocked"
- ✅ O CORS já está configurado
- Verifique se backend está em `localhost:3333`
- Verifique se frontend está em `localhost:5173`

### Erro: "Mistral API error"
- Verifique se a chave está configurada no `.env`
- Verifique se tem créditos na conta Mistral

---

## 📊 Arquitetura Resumida

```
CSV Upload
    ↓
[IngestionService]
    ↓
Cria Tabela Física + Gera Embeddings (1024D)
    ↓
Salva em table_contexts
    ↓
[Pergunta do Usuário]
    ↓
Gera Embedding da Pergunta
    ↓
Busca Colunas Similares (cosine similarity)
    ↓
[Mistral AI] Gera SQL
    ↓
Retorna Query
```

---

## ✨ Próximos Passos

Após testar o sistema básico:

1. **Experimente** com seus próprios CSVs
2. **Faça** perguntas complexas
3. **Analise** o SQL gerado
4. **(Opcional)** Adicione botão de execução no frontend
5. **(Opcional)** Implemente cache de embeddings

---

**🎉 Pronto! Seu sistema RAG está funcionando!**

Para mais detalhes, veja:
- `README.md` - Documentação completa
- `IMPLEMENTACOES.md` - Detalhes técnicos
