import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Send, Loader2, User, Bot, Database } from 'lucide-react';
import { ModelSelected } from '@/components/system/ModelSelected';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: string;
  timestamp: string;
}

interface ChatModeProps {
  currentDataset: string;
}

const API_URL = 'http://localhost:3333';
const CHAT_IDENTIFIER_KEY = 'chat_identifier';
const CHAT_DATASET_KEY = 'chat_current_dataset';
const CHAT_MODEL_KEY = 'chat_current_model';
const DEFAULT_MODEL_SLUG = 'langchain:mistral';

function getOrCreateIdentifier(): string {
  let id = localStorage.getItem(CHAT_IDENTIFIER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CHAT_IDENTIFIER_KEY, id);
  }
  return id;
}

export function ChatMode({ currentDataset }: ChatModeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [identifier] = useState(() => getOrCreateIdentifier());
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const stored = localStorage.getItem(CHAT_MODEL_KEY);
    if (!stored) return DEFAULT_MODEL_SLUG;
    if (stored === 'mistralai/mistral-small-24b') return DEFAULT_MODEL_SLUG;
    return stored;
  });
  const [persistedDataset, setPersistedDataset] = useState<string>(() => {
    const stored = localStorage.getItem(CHAT_DATASET_KEY) || '';
    if (currentDataset && currentDataset !== 'Nenhum conjunto de dados carregado') {
      localStorage.setItem(CHAT_DATASET_KEY, currentDataset);
      return currentDataset;
    }
    return stored;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(CHAT_MODEL_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (currentDataset && currentDataset !== 'Nenhum conjunto de dados carregado') {
      setPersistedDataset(currentDataset);
      localStorage.setItem(CHAT_DATASET_KEY, currentDataset);
    }
  }, [currentDataset]);

  // Carregar histórico ao montar (últimas 10 mensagens do identifier)
  useEffect(() => {
    if (!identifier) return;
    fetch(`${API_URL}/chat/history?identifier=${encodeURIComponent(identifier)}&limit=10`)
      .then((res) => res.ok ? res.json() : { messages: [] })
      .then((data) => {
        const list = (data.messages ?? []) as { id: number; role: 'user' | 'assistant'; content: string; createdAt: string }[];
        if (list.length > 0) {
          setMessages((prev) =>
            prev.length === 0
              ? list.map((m) => ({
                id: `${m.role}-${m.id}`,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }))
              : prev
          );
        }
      })
      .catch(() => { });
  }, [identifier]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          identifier,
          dataset: persistedDataset || undefined,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Falha ao processar a pergunta');
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: data.response || 'Resposta processada.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao processar sua mensagem.';
      const assistantMessage: ChatMessage = {
        id: `assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: 'Não foi possível processar sua pergunta.',
        error: errorMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasDataset = Boolean(persistedDataset && persistedDataset !== 'Nenhum conjunto de dados carregado');

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto fade-in">
      {/* Header */}
      <header className="flex-shrink-0 py-6 px-6 border-b border-subtle">
        <h1 className="text-2xl font-medium tracking-tight text-foreground mb-2">
          Modo Conversa
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl">
          Chat with Connor, your senior data analyst at The Boring Interprise; he analyzes your dataset. The assistant inspects structure, columns, and relationships.
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Database size={14} />
          <span>
            Contexto: <span className="text-foreground font-medium">{persistedDataset || currentDataset}</span>
          </span>
        </div>
      </header>

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-6 px-6 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mb-4 border border-subtle">
              <Bot className="text-muted-foreground" size={28} />
            </div>
            <h3 className="text-base font-medium text-foreground mb-2">
              Inicie uma conversa sobre seus dados
            </h3>
            <p className="text-base text-muted-foreground max-w-md mb-6">
              Pergunte sobre a estrutura dos dados, ex: &quot;Quais colunas existem?&quot;, &quot;Explique o relacionamento entre as tabelas&quot; ou &quot;Que tipos de análise posso fazer?&quot;
            </p>
            {!hasDataset && (
              <div className="status-warning rounded-xl px-4 py-3 text-sm">
                Carregue um conjunto de dados na aba &quot;Fonte de Dados&quot; para conversar sobre ele.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground border border-subtle'
                    }`}
                >
                  {msg.role === 'user' ? (
                    <User size={16} />
                  ) : (
                    <Bot size={16} />
                  )}
                </div>
                <div
                  className={`flex-1 max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                >
                  <div
                    className={`inline-block rounded-xl px-4 py-3 ${msg.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted border border-subtle text-foreground'
                      }`}
                  >
                    <div className="text-base break-words text-left prose prose-sm dark:prose-invert max-w-none [&_*]:text-inherit [&_ul]:my-2 [&_ol]:my-2 [&_p]:mt-4 [&_p]:mb-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mt-4 mb-4 first:mt-0 last:mb-0 text-inherit">{children}</p>
                          ),
                          code: ({ className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const content = String(children).replace(/\n$/, '');
                            const isBlock = Boolean(match);
                            if (isBlock && match) {
                              return (
                                <SyntaxHighlighter
                                  language={match[1]}
                                  style={dark}
                                  PreTag="div"
                                  customStyle={{
                                    marginTop: '0.75em',
                                    marginBottom: '0.75em',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    padding: '0.75rem 1rem',
                                  }}
                                  codeTagProps={{ style: { fontFamily: 'inherit' } }}
                                >
                                  {content}
                                </SyntaxHighlighter>
                              );
                            }
                            return (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.error && (
                      <div className="mt-3 status-error rounded-lg px-3 py-2 text-sm">
                        {msg.error}
                      </div>
                    )}
                  </div>

                  {/* Timestamp agora garantido abaixo do balão */}
                  <span className="mt-1.5 text-xs text-muted-foreground font-medium px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-subtle">
                  <Bot size={16} className="text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-xl border border-subtle">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Processando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-6 pt-4 border-subtle">
        <div className="bg-muted rounded-xl border border-subtle ring-4 ring-transparent focus-within:ring-ring/40 focus-within:border-ring transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasDataset
                ? 'Digite sua pergunta sobre o conjunto de dados...'
                : 'Carregue um conjunto de dados para começar...'
            }
            disabled={!hasDataset || isLoading}
            rows={2}
            className="w-full resize-none border-none bg-transparent p-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between items-center px-4 pb-3 pt-2 border-t border-subtle gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Pressione Enter para enviar, Shift+Enter para nova linha
              </span>
              <ModelSelected value={selectedModel} onChange={setSelectedModel} />
            </div>
            <button
              onClick={sendMessage}
              disabled={!hasDataset || isLoading || !input.trim()}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium py-2 px-5 rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Enviar Mensagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
