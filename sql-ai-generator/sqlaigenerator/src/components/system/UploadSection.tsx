import { useRef, useState } from 'react';
import { FileText, ShieldCheck, FileCheck, ArrowRight, Loader2 } from 'lucide-react';

interface UploadSectionProps {
    onSchemaReady: (datasetName: string) => void;
    onNavigateToSchema: () => void;
}

export function UploadSection({ onSchemaReady, onNavigateToSchema }: UploadSectionProps) {
    const [isUploaded, setIsUploaded] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ name: string, size: number, tableName?: string, columns?: string[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const API_URL = 'http://localhost:3333';

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/datasets/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Falha ao processar o arquivo');
            }

            // Sucesso!
            setIsUploaded(true);
            setUploadedFile({
                name: file.name,
                size: file.size,
                tableName: data.data?.tableName,
                columns: data.data?.columns
            });
            onSchemaReady(file.name); // Passar o nome do arquivo para o App
        } catch (err) {
            console.error('Erro ao fazer upload:', err);
            setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
            setIsUploaded(false);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    }

    return (
        <div className="max-w-3xl mx-auto py-12 px-6 fade-in h-full flex flex-col items-center justify-center">
            <header className="mb-10 text-center md:text-left w-full">
                <h1 className="text-2xl font-medium tracking-tight text-foreground mb-2">Configuração do Conjunto de Dados</h1>
                <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                    Faça upload de um arquivo CSV para estabelecer a fonte da verdade para o modelo de IA.
                    <br />
                    Este sistema gera SQL para exploração educacional e não executa consultas em um banco de dados de produção real.
                </p>
            </header>

            <div
                className={`w-full bg-card rounded-xl border border-dashed p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer group relative ${isUploaded ? 'border-primary/50 bg-primary/5' :
                    isUploading ? 'border-blue-500/50 bg-blue-500/5' :
                        'border-border'
                    }`}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                />

                {isUploading ? (
                    <>
                        <div className="w-12 h-12 bg-muted rounded-lg border border-border flex items-center justify-center mx-auto mb-4">
                            <Loader2 className="text-blue-500 animate-spin" size={24} />
                        </div>
                        <h3 className="text-base font-medium text-foreground mb-1">Processando arquivo...</h3>
                        <p className="text-base text-muted-foreground mb-6">Gerando embeddings e indexando dados</p>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 bg-muted rounded-lg border border-border flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <FileText className="text-muted-foreground group-hover:text-foreground" size={24} />
                        </div>
                        <h3 className="text-base font-medium text-foreground mb-1">Upload do Conjunto de Dados CSV</h3>
                        <p className="text-base text-muted-foreground mb-6">Arraste e solte ou clique para navegar</p>

                        <div className="flex items-center justify-center gap-2 text-base text-muted-foreground bg-muted py-2 px-3 rounded-full inline-flex border border-border">
                            <ShieldCheck size={14} />
                            <span>Validação de processamento local ativada</span>
                        </div>
                    </>
                )}
            </div>

            {error && (
                <div className="w-full mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-4 fade-in">
                    <p className="text-base text-red-500 font-medium">{error}</p>
                </div>
            )}

            {isUploaded && uploadedFile && (
                <div className="w-full mt-6 bg-card border border-border rounded-lg p-4 flex items-center justify-between shadow-sm fade-in">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-md flex items-center justify-center border border-emerald-500/20">
                            <FileCheck className="text-emerald-500" size={20} />
                        </div>
                        <div>
                            <p className="text-base font-medium text-foreground">{uploadedFile.name}</p>
                            <p className="text-base text-muted-foreground">
                                {(uploadedFile.size / 1024).toFixed(1)}KB •
                                {uploadedFile.columns ? ` ${uploadedFile.columns.length} colunas` : ' Processado'} •
                                Tabela: {uploadedFile.tableName || 'Desconhecida'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToSchema();
                        }}
                        className="flex items-center gap-2 text-base font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
                    >
                        Visualizar Esquemas <ArrowRight size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
