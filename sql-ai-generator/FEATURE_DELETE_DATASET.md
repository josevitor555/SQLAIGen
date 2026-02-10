# 🗑️ Feature: Deletar Dataset

## 📋 Descrição
Permite que o usuário delete completamente o dataset atual usando um **ícone de lixeira** no SchemaViewer, limpando todos os dados relacionados e resetando o aplicativo para um estado limpo.

---

## ✨ Funcionalidades Implementadas

### 1. **Backend - Endpoint de Deleção** ✅

#### **Rota**
```
DELETE /schemas/latest
DELETE /api/schemas/latest
```

#### **Arquivos Modificados**
- `backend/start/routes.ts` - Nova rota DELETE
- `backend/app/controllers/schemas_controller.ts` - Método `destroy()`
- `backend/app/services/schema_service.ts` - Método `deleteLatestDataset()`

#### **O Que É Deletado**
1. **Tabela física** no PostgreSQL (ex: `DROP TABLE "university_enrollments"`)
2. **Embeddings e metadados** da tabela em `table_contexts`
3. **Registro do dataset** na tabela `datasets`

#### **Código do Service**
```typescript
async deleteLatestDataset() {
    const dataset = await db.from('datasets')
        .orderBy('created_at', 'desc')
        .first()

    if (!dataset) {
        throw new Error('Nenhum dataset encontrado para deletar')
    }

    const tableName = dataset.internal_table_name

    // 1. Deletar tabela física
    await db.rawQuery(`DROP TABLE IF EXISTS "${tableName}"`)
    
    // 2. Deletar contextos vetoriais
    await db.from('table_contexts')
        .where('table_name', tableName)
        .delete()
    
    // 3. Deletar registro do dataset
    await db.from('datasets')
        .where('id', dataset.id)
        .delete()

    return { deletedTable: tableName, originalName: dataset.original_name }
}
```

---

### 2. **Frontend - UI e Interação** ✅

#### **Arquivos Modificados**
- `sqlaigenerator/src/components/system/SchemaViewer.tsx`
  - Adicionado ícone de lixeira (`Trash2`)
  - Função `handleDeleteDataset()`
  - Modal de confirmação
  - Estado de loading durante deleção

- `sqlaigenerator/src/App.tsx`
  - Função `handleDeleteDataset()` para resetar estado global
  - Passa callback para `SchemaViewer`

---

## 🎨 Interface do Usuário

### **Antes**
```
┌──────────────────────────────────────────┐
│ Semantic Context                         │
│                [university_enrollments.csv] │
└──────────────────────────────────────────┘
```

### **Depois**
```
┌──────────────────────────────────────────┐
│ Semantic Context                         │
│         [university_enrollments.csv] [🗑️] │
└──────────────────────────────────────────┘
     ↑ Nome do dataset          ↑ Botão de deletar
```

### **Hover State**
- Ícone fica **vermelho** ao passar o mouse
- Background **vermelho translúcido** aparece
- Tooltip mostra "Delete dataset"

### **Loading State**
Durante a deleção, o ícone muda para um spinner animado:
```
[university_enrollments.csv] [⟳]
```

---

## 🔄 Fluxo Completo

### **1. Usuário Clica no Ícone de Lixeira**
```
USUÁRIO → Clica em 🗑️ no SchemaViewer
```

### **2. Modal de Confirmação**
```
┌────────────────────────────────────────┐
│ Tem certeza que deseja deletar o      │
│ dataset "university_enrollments.csv"?  │
│                                        │
│ Isso irá remover:                      │
│ - A tabela física do banco            │
│ - Todos os embeddings e metadados     │
│ - O histórico de queries              │
│                                        │
│ Esta ação não pode ser desfeita.      │
│                                        │
│     [Cancelar]      [OK]               │
└────────────────────────────────────────┘
```

### **3. Se Confirmar**
```
SchemaViewer.handleDeleteDataset()
           ↓
DELETE /schemas/latest
           ↓
SchemaService.deleteLatestDataset()
  ├─ DROP TABLE "university_enrollments"
  ├─ DELETE FROM table_contexts WHERE table_name = '...'
  └─ DELETE FROM datasets WHERE id = ...
           ↓
200 OK { message: "Dataset deletado com sucesso" }
           ↓
App.handleDeleteDataset()
  ├─ setCurrentDataset('No dataset loaded')
  ├─ setHistory([])
  └─ setActiveTab('upload') ← Volta para tela de upload
```

### **4. Resultado Final**
- ✅ Tabela deletada do banco de dados
- ✅ Embeddings removidos
- ✅ Histórico limpo
- ✅ Usuário redirecionado para tela de Upload
- ✅ App pronto para novo upload

---

## 🛡️ Validações e Segurança

### **Backend**
- ✅ Verifica se existe dataset para deletar
- ✅ Usa transação para garantir consistência
- ✅ Trata erros gracefully (continua mesmo se DROP TABLE falhar)
- ✅ Retorna mensagem de sucesso/erro clara

### **Frontend**
- ✅ **Modal de confirmação** antes de deletar
- ✅ **Advertência clara** sobre consequências
- ✅ Desabilita botão durante deleção (evita cliques múltiplos)
- ✅ Mostra spinner durante processamento
- ✅ Trata erros e mostra alert se falhar

---

## 📊 Estados da Aplicação

### **Antes da Deleção**
```javascript
{
  currentDataset: "university_enrollments.csv",
  history: [
    { query: "Show all students", sql: "SELECT * FROM..." },
    { query: "Count rows", sql: "SELECT COUNT(*) FROM..." }
  ],
  activeTab: "schema"
}
```

### **Depois da Deleção**
```javascript
{
  currentDataset: "No dataset loaded",
  history: [],
  activeTab: "upload"
}
```

---

## 🧪 Como Testar

### **Teste 1: Deleção Bem-Sucedida**
1. Faça upload de um CSV
2. Vá para "Schema"
3. Clique no ícone de lixeira 🗑️
4. Confirme a deleção
5. **Resultado Esperado**:
   - Volta para tela de Upload
   - Histórico limpo
   - Dataset removido do banco

### **Teste 2: Cancelar Deleção**
1. Vá para "Schema"
2. Clique no ícone de lixeira
3. Clique em "Cancelar" no modal
4. **Resultado Esperado**:
   - Nada acontece
   - Permanece no Schema
   - Dados preservados

### **Teste 3: Re-upload Após Deleção**
1. Delete um dataset
2. Faça upload de um novo CSV
3. **Resultado Esperado**:
   - Novo dataset carregado
   - Histórico vazio (fresh start)
   - Nome do dataset atualizado

---

## 🎯 Benefícios

### **1. Gestão Completa do Dataset** ✅
- Usuário tem controle total sobre seus dados
- Pode limpar e começar do zero facilmente

### **2. Limpeza Adequada** 🧹
- Remove TODOS os vestígios do dataset:
  - Tabela física
  - Embeddings
  - Metadados
  - Histórico de queries

### **3. UX Intuitiva** 💡
- Ícone de lixeira universalmente reconhecido
- Confirmação antes de ação destrutiva
- Feedback visual durante processamento
- Redirecionamento automático

### **4. Segurança** 🛡️
- Modal de confirmação previne deleções acidentais
- Advertência clara sobre consequências
- Não permite cancelamento durante processamento

---

## 📝 Logs do Backend

Durante a deleção, o console mostra:
```
✅ Tabela física "university_enrollments" deletada
✅ Contextos vetoriais de "university_enrollments" deletados
✅ Registro do dataset "university_enrollments.csv" deletado
```

---

## 🚀 Status

- ✅ Backend implementado
- ✅ Endpoint DELETE criado
- ✅ Service de deleção funcional
- ✅ UI com ícone de lixeira
- ✅ Modal de confirmação
- ✅ Estado global resetado
- ✅ Redirecionamento automático

**Funcionalidade 100% Completa!** 🎉

---

**Data**: 2026-02-10  
**Versão**: 1.0
