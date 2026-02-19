### SQLAIGen

A **natural-language SQL generation and data analysis** system, featuring a conversational AI assistant that interprets questions about datasets, returns SQL queries, and delivers insights based on the structure and content of the data.

---

### Introduction

**SQLAIGen** lets users explore data without needing to master SQL. Load a dataset (e.g. a CSV exported from Kaggle), and the system:

- **Generates SQL queries** from questions in natural language (English or other languages).
- **Converses about the data** through an **AI Data Analyst**, who explains findings, cites examples, and suggests further analyses.

The backend uses **embeddings** (Mistral) and **similarity search** (pgvector) to map the user’s question to the most relevant columns and tables, so that the generated SQL and AI answers stay aligned with the actual data schema.
Now supports multiple models via **OpenRouter** (Claude, Gemini, DeepSeek, etc.).

---

### Overview

- **1 Problem:** Many users have data in CSV or tables but don’t know how to write SQL or aren’t familiar with the schema.
- **2 Solution:** An application that accepts CSV uploads, builds a “semantic schema” (metadata + column embeddings), and provides:
- **2.1 Query Lab:** natural-language question → AI-generated SQL.
- **2.2 Conversation Mode:** a dialogue with Connor, who analyzes the data (statistics, samples, precomputed aggregations) and responds in natural language without showing SQL, in a senior analyst tone.

The AI follows strict rules: it does not invent rankings from samples; it distinguishes frequency from sum; when exact data isn’t available, it suggests using SQL Mode. The system combines **friendly conversation** with **analytical rigor**.

---

### Goals

- [x] Enable **data analysis in natural language**, lowering the SQL barrier.
- [x] Generate **valid PostgreSQL SQL** from text questions.
- [x] Provide a **conversational assistant** that interprets questions, cites real examples, and suggests next steps.
- [x] Keep **schema consistency**: embeddings and metadata so that SQL and AI answers reflect the loaded columns and tables.
- [x] Support **conversation history** (per session) and **query history** in the lab.
- [x] **Multi-Model Support**: Use state-of-the-art models (Claude Opus 4.5, Gemini 3 Pro, DeepSeek V3, etc.) via OpenRouter.

---

### Features

| Feature | Description |
|--------|-------------|
| **Data Source** | CSV file upload; automatic delimiter detection (`,` or `;`); table creation in PostgreSQL and dataset registration. |
| **Semantic Schema** | Descriptions and embeddings (Mistral) for each column; stored in `table_contexts` (pgvector) for similarity search. |
| **Query Lab** | Natural-language question → single PostgreSQL SQL query, with correct quoting and casing; option to run the query and view results. |
| **Conversation Mode** | Chat with the **AI Analyst**, who receives schema context, data sample, and statistics (counts, aggregations). It responds in text, citing examples when possible, without showing SQL. |
| **History** | History of questions and generated SQL in the lab; chat message history per session identifier (tracking the AI model used). |
| **Theme** | Toggle between light and dark mode (persisted in `localStorage`). |

---

#### AI Persona

The system features a **Senior Data Analyst** persona who guides users in **Conversation Mode** and brings natural-language analyses to life.
It is designed to be helpful, professional, and strictly data-driven, avoiding hallucinations about fictional entities.

<img width="1919" height="944" alt="Captura de tela 2026-02-18 161254" src="https://github.com/user-attachments/assets/de5c2d0f-5472-44f9-af80-680298d63078" />

### Example usage with the “AI Models Benchmark 2026” dataset (Kaggle)

The **[AI Models Benchmark Dataset 2026 (Latest)](https://www.kaggle.com/datasets/asadullahcreative/ai-models-benchmark-dataset-2026-latest)** from Kaggle contains information about AI models (name, provider, parameters, context window, benchmarks, etc.). After downloading the CSV and loading it in SQLAIGen via **Data Source**, you can use the AI Assistant and the Query Lab as follows.

---

#### Example 1: “Which AI model has the largest context window?”

- **Conversation Mode:** The AI uses the semantic schema and dataset statistics (e.g. columns like “context window” or “context_length”) to identify the model with the largest context window. The answer is in natural language, citing the model name and value when available, and may suggest refinements or follow-up questions.
- **Query Lab:** The user types the same question; the system generates a SQL query, e.g.:
  - Order by context window (or equivalent column) descending and return the first row (or top N), using the table and real column names from the loaded CSV.

Thus the user gets **text insight** (AI Analysis) and **reusable SQL** (lab).

#### Example 2: Other typical questions on the same dataset

- *“Which models have more than 100B parameters?”*  
  → The AI describes the findings; the lab generates a `SELECT` with a filter on the parameters column.

- *“Which model has the best score on benchmark X?”*  
  → The AI may cite the model and score; the lab generates SQL with `ORDER BY` on the benchmark column and `LIMIT 1` (or equivalent).

- *“List all unique providers.”*  
  → The AI summarizes the providers; the lab generates `SELECT DISTINCT "provider"` (or the actual column name) on the loaded table.

In these cases, the AI **analyzes the data** (statistics and samples) and the **Query Lab** delivers the corresponding **SQL query**, always aligned with the loaded dataset schema (including AI Models Benchmark 2026).

---

### Tech stack (summary)

- **Frontend:** React, TypeScript, Vite.
- **Backend:** AdonisJS 6 (Node.js).
- **Database:** PostgreSQL with pgvector extension (embeddings).
- **AI:** Mistral (LangChain) for embeddings and text/SQL generation.

---

### How to run

1. **Backend:** In the backend folder (e.g. `sql-ai-generator/backend`), configure `.env` (including `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, and PostgreSQL connection with pgvector). Then: `npm install` and `node ace serve --hmr` (or `npm run dev`).
2. **Frontend:** In the frontend folder (e.g. `sql-ai-generator/sqlaigenerator`), run `npm install` and `npm run dev`.
3. **Usage:** Open the app, go to **Data Source**, upload a CSV, select your preferred AI Model (e.g. Claude Sonnet 3.5), then use **Conversation Mode** and **Query Lab**.

---

#### Example dataset reference

- **Dataset:** [AI Models Benchmark Dataset 2026 (Latest)](https://www.kaggle.com/datasets/asadullahcreative/ai-models-benchmark-dataset-2026-latest) (Kaggle).  
- In SQLAIGen: after downloading and uploading the CSV, the AI analyzes the data and the system generates SQL and insights for questions about models, context window, parameters, benchmarks, and providers.
