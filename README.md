# SQLAIGen

Sistema de **geração de SQL e análise de dados em linguagem natural**, com um assistente conversacional (Morgan) que interpreta perguntas sobre conjuntos de dados, retorna consultas SQL e insights baseados na estrutura e no conteúdo dos dados.

---

### Introdução

O **SQLAIGen** permite que usuários explorem dados sem precisar dominar SQL. Basta carregar um dataset (por exemplo, um CSV exportado do Kaggle), e o sistema:

- **Gera consultas SQL** a partir de perguntas em português (ou outro idioma).
- **Conversa sobre os dados** por meio do **Morgan**, analista de dados sênior da empresa fictícia *The Boring Interprise*, que explica achados, cita exemplos e sugere análises.

O backend usa **embeddings** (Mistral) e **busca por similaridade** (pgvector) para mapear a pergunta do usuário às colunas e tabelas mais relevantes, garantindo que o SQL e as respostas do Morgan estejam alinhados ao esquema real dos dados.

---

### Contexto geral

- **Problema:** Muitos usuários têm dados em CSV ou tabelas mas não sabem escrever SQL ou não conhecem bem o esquema.
- **Solução:** Uma aplicação que aceita upload de CSV, constrói um “esquema semântico” (metadados + embeddings das colunas) e oferece:
  1. **Laboratório de Consultas:** pergunta em texto → SQL gerado por IA.
  2. **Modo Conversa:** diálogo com o Morgan, que analisa os dados (estatísticas, amostras, agregações pré-calculadas) e responde em linguagem natural, sem exibir SQL, com tom de analista sênior.

O Morgan segue regras rígidas: não inventa rankings a partir de amostras; distingue frequência de soma; quando não tiver o dado exato, sugere usar o Modo SQL. Assim, o sistema combina **conversa amigável** com **rigor analítico**.

---

### Objetivos

- Permitir **análise de dados por linguagem natural**, reduzindo a barreira do SQL.
- Gerar **consultas SQL válidas em PostgreSQL** a partir de perguntas em texto.
- Oferecer um **assistente conversacional (Morgan)** que interpreta perguntas, cita exemplos reais e sugere próximos passos.
- Manter **consistência com o esquema**: uso de embeddings e metadados para que SQL e respostas do Morgan reflitam as colunas e tabelas carregadas.
- Suportar **histórico de conversa** (por sessão) e **histórico de consultas** no laboratório.

---

### Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Fonte de Dados** | Upload de arquivo CSV; detecção automática de separador (`,` ou `;`); criação de tabela no PostgreSQL e registro do dataset. |
| **Esquema Semântico** | Geração de descrições e embeddings (Mistral) para cada coluna; armazenamento em `table_contexts` (pgvector) para busca por similaridade. |
| **Laboratório de Consultas** | Pergunta em linguagem natural → geração de uma única query SQL (PostgreSQL), com aspas duplas e case corretos; opção de executar a query e ver resultados. |
| **Modo Conversa** | Chat com o **Morgan**, que recebe contexto do esquema, amostra dos dados e estatísticas (contagens, agregações). Responde em texto, citando exemplos quando possível, sem exibir SQL. |
| **Histórico** | Histórico de perguntas e SQL geradas no laboratório; histórico de mensagens do chat por identificador de sessão. |
| **Tema** | Alternância entre modo claro e escuro (persistida em `localStorage`). |

---

#### Imagens do Morgan

O **Morgan** é o analista de dados sênior da *The Boring Interprise*, nosso personagem fictício que guia os usuários no **Modo Conversa** e dá vida às análises em linguagem natural.

![Morgan](sql-ai-generator\sqlaigenerator\public\morgan.png)

---

### Exemplos de uso com o dataset “AI Models Benchmark 2026” (Kaggle)

O dataset **[AI Models Benchmark Dataset 2026 (Latest)](https://www.kaggle.com/datasets/asadullahcreative/ai-models-benchmark-dataset-2026-latest)** do Kaggle contém informações sobre modelos de IA (nome, provedor, parâmetros, janela de contexto, benchmarks etc.). Após fazer o download do CSV e carregá-lo no SQLAIGen pela **Fonte de Dados**, você pode usar o Morgan e o Laboratório de Consultas da seguinte forma.

### Exemplo 1: “Qual modelo de IA tem maior janela de contexto?”

- **Modo Conversa (Morgan):** O Morgan usa o esquema semântico e as estatísticas do dataset (por exemplo, colunas como “context window” ou “context_length”) para identificar o modelo com maior janela de contexto. A resposta é em linguagem natural, citando o nome do modelo e o valor quando disponível, e pode sugerir refinamentos ou perguntas complementares.
- **Laboratório de Consultas:** O usuário digita a mesma pergunta; o sistema gera uma query SQL, por exemplo:
  - Ordenar por janela de contexto (ou coluna equivalente) em ordem decrescente e retornar o primeiro registro (ou top N), usando a tabela e os nomes de colunas reais do CSV carregado.

Assim, o usuário obtém **insight em texto** (Morgan) e **SQL reutilizável** (laboratório).

#### Exemplo 2: Outras perguntas típicas sobre o mesmo dataset

- *“Quais modelos têm mais de 100B parâmetros?”*  
  → Morgan descreve os achados; o laboratório gera um `SELECT` com filtro na coluna de parâmetros.

- *“Qual o modelo com melhor score no benchmark X?”*  
  → Morgan pode citar o modelo e o score; o laboratório gera SQL com `ORDER BY` na coluna de benchmark e `LIMIT 1` (ou equivalente).

- *“Liste todos os provedores únicos.”*  
  → Morgan resume os provedores; o laboratório gera `SELECT DISTINCT "provider"` (ou nome real da coluna) na tabela carregada.

Nesses casos, o Morgan **analisa os dados** (estatísticas e amostras) e o **Laboratório de Consultas** entrega a **query SQL** correspondente, sempre alinhada ao esquema do dataset carregado (incluindo o AI Models Benchmark 2026).

---

### Stack técnica (resumo)

- **Frontend:** React, TypeScript, Vite.
- **Backend:** AdonisJS 6 (Node.js).
- **Banco:** PostgreSQL com extensão pgvector (embeddings).
- **IA:** Mistral (LangChain) para embeddings e geração de texto/SQL.

---

### Como executar

1. **Backend:** na pasta do backend (ex.: `sql-ai-generator/backend`), configurar `.env` (incluindo `MISTRAL_API_KEY` e conexão PostgreSQL com pgvector). Em seguida: `npm install` e `node ace serve --hmr` (ou `npm run dev`).
2. **Frontend:** na pasta do frontend (ex.: `sql-ai-generator/sqlaigenerator`), `npm install` e `npm run dev`.
3. Acessar a aplicação, ir em **Fonte de Dados**, fazer upload do CSV (por exemplo, o do [AI Models Benchmark Dataset 2026](https://www.kaggle.com/datasets/asadullahcreative/ai-models-benchmark-dataset-2026-latest)), e depois usar **Modo Conversa** (Morgan) e **Laboratório de Consultas** com perguntas como *“Qual modelo de IA tem maior janela de contexto?”*.

---

#### Referência do dataset de exemplo

- **Dataset:** [AI Models Benchmark Dataset 2026 (Latest)](https://www.kaggle.com/datasets/asadullahcreative/ai-models-benchmark-dataset-2026-latest) (Kaggle).  
- Uso no SQLAIGen: após download e upload do CSV, o Morgan analisa os dados e o sistema gera SQL e insights para perguntas sobre modelos, janela de contexto, parâmetros, benchmarks e provedores.
