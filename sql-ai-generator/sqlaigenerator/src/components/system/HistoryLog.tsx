import { Trash2, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

export interface HistoryItem {
    id: string;
    query: string;
    sql?: string;
    timestamp: string;
    error?: string;
}

interface HistoryLogProps {
    history: HistoryItem[];
    onClearHistory: () => void;
}

export const HISTORY_STORAGE_KEY = 'query_history';

export function HistoryLog({ history, onClearHistory }: HistoryLogProps) {
    useEffect(() => {
        try {
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        } catch {}
    }, [history]);

    return (
        <div className="max-w-4xl mx-auto py-12 px-6 fade-in h-full overflow-auto text-foreground">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-medium text-foreground mb-2">Histórico de Interações</h1>
                    <p className="text-base text-muted-foreground">
                        Log de auditoria das consultas geradas. Edição ou reexecução estão desabilitadas.
                    </p>
                </div>
                <button
                    onClick={onClearHistory}
                    className="text-base text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                >
                    <Trash2 size={14} />
                    Limpar Log
                </button>
            </header>

            <div className="space-y-4">
                {history.length === 0 && (
                    <div className="text-center text-muted-foreground py-16">
                        <div className="bg-muted/10 rounded-xl p-8 border border-subtle inline-block">
                            <p className="text-base mb-2">Nenhuma consulta ainda</p>
                            <p className="text-base text-foreground">
                                Comece a fazer perguntas no Laboratório de Consultas para ver o histórico aqui.
                            </p>
                        </div>
                    </div>
                )}
                {history.map((item) => (
                    <div
                        key={item.id}
                        className={`bg-muted rounded-lg border border-white/10 p-5 hover:border-white/20 transition-all ${item.error ? 'opacity-60' : ''}`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <p className="text-base font-medium text-muted-foreground">"{item.query}"</p>
                            <span className="text-base text-muted-foreground">{item.timestamp}</span>
                        </div>

                        {item.error ? (
                            <div className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
                                <XCircle className="text-muted-foreground" size={14} />
                                <span>{item.error}</span>
                            </div>
                        ) : (
                            <div className="rounded border border-subtle p-0 overflow-hidden">
                                <SyntaxHighlighter
                                    language="sql"
                                    style={atomOneDark}
                                    customStyle={{
                                        margin: 0,
                                        padding: '1rem',
                                        fontSize: '14px',
                                        background: 'transparent',
                                    }}
                                    showLineNumbers={false}
                                    wrapLongLines
                                >
                                    {item.sql || ''}
                                </SyntaxHighlighter>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
