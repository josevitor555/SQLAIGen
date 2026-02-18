import { useEffect, useState } from 'react';
import './App.css';
import { Sidebar } from './components/system/Sidebar';
import { MobileHeader } from './components/system/MobileHeader';
import { UploadSection } from './components/system/UploadSection';
import { SchemaViewer } from './components/system/SchemaViewer';
import { QueryLab } from './components/system/QueryLab';
import { HistoryLog, type HistoryItem, HISTORY_STORAGE_KEY } from './components/system/HistoryLog';
import { ModalCredits } from './components/system/ModalCredits';
import { ChatMode } from './components/pages/ChatMode';

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'schema' | 'query' | 'history' | 'chat'>('upload');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });
  const [currentDataset, setCurrentDataset] = useState<string>('Nenhum conjunto de dados carregado');
  const [showCredits, setShowCredits] = useState(false);

  // Exibe o modal de créditos uma vez na primeira renderização,
  // com um pequeno atraso para não quebrar a experiência inicial.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowCredits(true);
    }, 1200);

    return () => clearTimeout(timeout);
  }, []);

  const handleTabChange = (tab: 'upload' | 'schema' | 'query' | 'history' | 'chat') => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleSchemaReady = (datasetName: string) => {
    // Atualizar o dataset atual e limpar o histórico para nova sessão
    setCurrentDataset(datasetName);
    setHistory([]); // Limpar histórico anterior
  };

  const handleNavigateToSchema = () => setActiveTab('schema');
  const handleNavigateToQuery = () => setActiveTab('query');

  const handleDeleteDataset = () => {
    // Resetar estado do app após deletar dataset
    setCurrentDataset('Nenhum conjunto de dados carregado');
    setHistory([]);
    setActiveTab('upload'); // Voltar para tela de upload
  };

  const addToHistory = (query: string, sqlOrError: string, timestamp: string) => {
    // Check if it's an error message or SQL based on content or logic
    // In QueryLab logic, if valid, it passes SQL. If invalid, it passes error message.
    // But wait, QueryLab passed `query, sql, timestamp`.
    // Let's refine `addToHistory` signature in App to be flexible.

    const isError = !sqlOrError.trim().toUpperCase().startsWith('SELECT');

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      query,
      sql: isError ? undefined : sqlOrError,
      timestamp,
      error: isError ? sqlOrError : undefined
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const clearHistory = () => setHistory([]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  return (
    <div className="text-foreground bg-background h-screen flex overflow-hidden selection:bg-muted selection:text-foreground font-inter">
      {/* Desktop Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col h-full relative">
        <MobileHeader onMenuToggle={() => setIsSidebarOpen(true)} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto no-scrollbar relative md:p-0 pt-16 h-full">
          {activeTab === 'upload' && (
            <UploadSection
              onSchemaReady={handleSchemaReady}
              onNavigateToSchema={handleNavigateToSchema}
            />
          )}
          {activeTab === 'schema' && (
            <SchemaViewer
              onNavigateToQuery={handleNavigateToQuery}
              onDeleteDataset={handleDeleteDataset}
            />
          )}
          {activeTab === 'query' && (
            <QueryLab onAddToHistory={addToHistory} currentDataset={currentDataset} />
          )}
          {activeTab === 'history' && (
            <HistoryLog history={history} onClearHistory={clearHistory} />
          )}
          {activeTab === 'chat' && (
            <ChatMode currentDataset={currentDataset} />
          )}
        </main>

        {/* Modal de Créditos Finais */}
        <ModalCredits isOpen={showCredits} onClose={() => setShowCredits(false)} />

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 transition-opacity"
              onClick={() => setIsSidebarOpen(false)}
            ></div>
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-muted h-full shadow-xl transform transition-transform">
              <Sidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                className="flex h-full w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
