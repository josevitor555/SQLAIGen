import { ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SchemaViewerProps {
    onNavigateToQuery: () => void;
    onDeleteDataset?: () => void; // Callback para quando dataset for deletado
}

interface SchemaColumn {
    name: string;
    type: string;
    description?: string;
    example?: any;
}

interface Schema {
    tableName: string;
    originalName: string;
    rowCount: number;
    columns: SchemaColumn[];
}

export function SchemaViewer({ onNavigateToQuery, onDeleteDataset }: SchemaViewerProps) {
    const [schema, setSchema] = useState<Schema | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const API_URL = 'http://localhost:3333';

    useEffect(() => {
        fetchSchema();
    }, []);

    const fetchSchema = async () => {
        try {
            const response = await fetch(`${API_URL}/schemas/latest`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Falha ao buscar schema');
            }

            setSchema(data);
        } catch (err) {
            console.error('Erro ao buscar schema:', err);
            setError(err instanceof Error ? err.message : 'Erro ao carregar schema');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDataset = async () => {
        // Confirmação
        const confirmDelete = window.confirm(
            `Tem certeza que deseja deletar o dataset "${schema?.originalName}"?\n\nIsso irá remover:\n- A tabela física do banco\n- Todos os embeddings e metadados\n- O histórico de queries\n\nEsta ação não pode ser desfeita.`
        );

        if (!confirmDelete) return;

        setIsDeleting(true);

        try {
            const response = await fetch(`${API_URL}/schemas/latest`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Falha ao deletar dataset');
            }

            // Sucesso! Notificar o componente pai
            if (onDeleteDataset) {
                onDeleteDataset();
            }
        } catch (err) {
            console.error('Erro ao deletar dataset:', err);
            alert(`Erro ao deletar dataset: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const getTypeBadgeColor = (type: string) => {
        const upperType = type.toUpperCase();
        if (upperType.includes('INT')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        if (upperType.includes('VARCHAR') || upperType.includes('TEXT')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (upperType.includes('FLOAT') || upperType.includes('NUMERIC') || upperType.includes('DECIMAL')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        if (upperType.includes('DATE') || upperType.includes('TIMESTAMP')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6 h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="text-white/20 animate-spin" />
                    <span className="text-base text-white/40 font-medium">Carregando schema...</span>
                </div>
            </div>
        );
    }

    if (error || !schema) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6 h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || 'Schema não encontrado'}</p>
                    <p className="text-muted-foreground text-sm">Faça upload de um CSV primeiro.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-12 px-6 fade-in h-full overflow-auto">
            <header className="flex items-end justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-medium tracking-tight text-white mb-2">Contexto Semântico</h1>
                    <p className="text-base text-muted-foreground">
                        A IA utiliza este esquema inferido para mapear linguagem natural para lógica SQL. Verifique os tipos de dados abaixo.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-base text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full border border-white/10 tracking-wider">
                        {schema.originalName}
                    </div>
                    <button
                        onClick={handleDeleteDataset}
                        disabled={isDeleting}
                        className="text-muted-foreground hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Deletar conjunto de dados"
                    >
                        {isDeleting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Trash2 size={18} />
                        )}
                    </button>
                </div>
            </header>

            <div className="border border-white/10 rounded-xl overflow-hidden bg-[#1a1a1a] shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/2">
                            <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase">Nome da Coluna</th>
                            <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase">Tipo Inferido</th>
                            <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase">Valor de Exemplo</th>
                            <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase">Descrição</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-white/5">
                        {schema.columns.map((column, idx) => (
                            <tr key={idx} className="group hover:bg-white/2 transition-colors">
                                <td className="py-4 px-4 text-base text-muted-foreground">{column.name}</td>
                                <td className="py-4 px-4">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getTypeBadgeColor(column.type)}`}>
                                        {column.type.toUpperCase()}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-base text-muted-foreground">
                                    {column.example !== null && column.example !== undefined
                                        ? String(column.example)
                                        : '-'}
                                </td>
                                <td className="py-4 px-4 text-base text-muted-foreground">
                                    {column.description || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={onNavigateToQuery}
                    className="group flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-all"
                >
                    Prosseguir para o Laboratório de Consultas
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </div>
    );
}