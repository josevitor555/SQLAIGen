import { useState } from 'react';
import { Database, Wand2, Loader2, Copy, ShieldAlert, Search } from 'lucide-react';

interface QueryProps {
    onAddToHistory: (query: string, sql: string, timestamp: string) => void;
    currentDataset: string;
}

export function QueryLab({ onAddToHistory, currentDataset }: QueryProps) {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ sql: string; success: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const API_URL = 'http://localhost:3333';

    const generateSQL = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        setResult(null);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/queries/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: query }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Falha ao gerar SQL');
            }

            // Sucesso!
            const generatedSQL = data.sqlQuery;
            setResult({ sql: generatedSQL, success: true });
            onAddToHistory(
                query,
                generatedSQL,
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            );
        } catch (err) {
            console.error('Erro ao gerar SQL:', err);
            const errorMsg = err instanceof Error ? err.message : 'Erro ao processar pergunta';
            setError(errorMsg);
            setResult({ sql: '', success: false });
            onAddToHistory(
                query,
                `Error: ${errorMsg}`,
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto py-12 px-6 fade-in h-full overflow-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-medium tracking-tight text-foreground mb-2">Linguagem Natural para SQL</h1>
                <p className="text-base text-muted-foreground max-w-2xl">
                    Faça perguntas sobre seus dados. O sistema gera instruções <span className="font-mono text-xs bg-muted/20 text-foreground px-1.5 py-0.5 rounded">SELECT</span> baseadas estritamente na estrutura CSV fornecida.
                </p>
            </header>

            {/* Input Area */}
            <div className="bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/10 ring-4 ring-transparent focus-within:ring-white/5 focus-within:border-white/20 transition-all">
                <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    rows={3}
                    className="w-full resize-none border-none bg-transparent p-4 text-base text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
                    placeholder="ex: Mostre-me os 5 melhores alunos com o maior GPA matriculados em CS-101..."
                />
                <div className="flex justify-between items-center px-4 pb-3 pt-2 border-t border-white/5">
                    <div className="text-base text-muted-foreground flex items-center gap-1.5">
                        <Database size={14} />
                        Contexto: <span className="text-muted-foreground">{currentDataset}</span>
                    </div>
                    <button
                        onClick={generateSQL}
                        disabled={isLoading || !query.trim()}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium py-2 px-4 rounded-lg shadow-sm transition-all flex items-center gap-2"
                    >
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                        Gerar SQL
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="py-12 flex justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 size={32} className="text-white/20 animate-spin" />
                        <span className="text-base text-white/40 font-medium">Analisando relacionamentos do esquema...</span>
                    </div>
                </div>
            )}

            {/* Result Success */}
            {result && result.success && (
                <div className="mt-10 fade-in">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-base font-medium text-muted-foreground">Consulta Gerada</h3>
                        <div className="flex gap-2">
                            <span className="text-base bg-muted/10 px-2 py-1 rounded border border-subtle">SOMENTE LEITURA</span>
                            <span className="text-base bg-muted/10 px-2 py-1 rounded border border-subtle">DIALETO POSTGRESQL</span>
                        </div>
                    </div>

                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-linear-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative rounded-xl bg-[#0a0a0a] overflow-hidden shadow-2xl border border-white/10">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/10 border-b border-subtle">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-muted/60"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-muted/40"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-muted/20"></div>
                                </div>
                                <button
                                    className="text-subtle hover:text-foreground transition-colors"
                                    onClick={() => navigator.clipboard.writeText(result.sql)}
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                            <div className="p-6 overflow-x-auto">
                                <pre className="font-mono text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                    {result.sql}
                                </pre>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-4 status-info rounded-xl flex gap-3">
                        <ShieldAlert className="text-blue-500 shrink-0" size={18} />
                        <p className="text-base text-subtle leading-relaxed">
                            <strong className="text-foreground">SQL Gerado por IA:</strong> Esta consulta foi gerada com base no esquema do seu conjunto de dados e metadados de colunas indexadas usando busca de similaridade vetorial.
                        </p>
                    </div>
                </div>
            )}

            {/* Result Error */}
            {result && !result.success && (
                <div className="mt-8 fade-in">
                    <div className="rounded-xl border border-subtle bg-muted/10 p-10 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-muted/10 rounded-full flex items-center justify-center mb-4 border border-subtle">
                            <Search className="text-subtle" size={24} />
                        </div>
                        <h3 className="text-base font-medium text-foreground mb-2">Informação Não Disponível</h3>
                        <p className="text-sm text-subtle max-w-md">
                            {error || `O conjunto de dados atual não contém informações sobre "${query}". A IA é restrita ao esquema enviado para evitar fabricação.`}
                        </p>
                        <button
                            onClick={() => setQuery('')}
                            className="mt-6 text-xs font-medium text-foreground hover:text-muted-foreground underline underline-offset-4 transition-colors"
                        >
                            Tente uma pergunta diferente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}