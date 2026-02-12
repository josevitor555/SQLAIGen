import { Upload, Database, Terminal, History, User, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SidebarProps {
    activeTab: 'upload' | 'schema' | 'query' | 'history';
    onTabChange: (tab: 'upload' | 'schema' | 'query' | 'history') => void;
    className?: string;
}

export function Sidebar({ activeTab, onTabChange, className = "hidden md:flex" }: SidebarProps) {
    const [isDark, setIsDark] = useState(() => {
        // Verificar preferência salva ou padrão do sistema
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        // Aplicar ou remover classe 'dark' no elemento HTML
        const html = document.documentElement;
        if (isDark) {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    const navItems = [
        { id: 'upload', label: 'Fonte de Dados', icon: Upload },
        { id: 'schema', label: 'Esquema Semântico', icon: Database },
        { id: 'query', label: 'Laboratório de Consultas', icon: Terminal },
        { id: 'history', label: 'Histórico', icon: History },
    ] as const;

    return (
        <aside className={`w-72 flex flex-col justify-between bg-muted h-full ${className}`}>
            <div>
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="h-8 w-8 bg-sidebar-primary rounded-lg flex items-center justify-center text-sidebar-primary-foreground">
                            <span className="font-medium text-base">SG</span>
                        </div>
                        <span className="text-sidebar-foreground font-semibold">
                            SQLAIGen
                        </span>
                    </div>

                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const isActive = activeTab === item.id;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onTabChange(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-base font-medium rounded-full transition-colors ${isActive
                                        ? 'text-sidebar-foreground bg-muted ring-1 ring-sidebar-border'
                                        : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                                        }`}
                                >
                                    <Icon size={18} strokeWidth={1.5} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>

                    <nav className="mt-2">
                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-3 px-3 py-2 text-base font-medium rounded-full transition-all duration-200 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 border border-sidebar-border/20 hover:border-sidebar-border/40"
                        >
                            <div className="h-5 w-5 flex items-center justify-center">
                                {isDark ? (
                                    <Sun size={18} strokeWidth={1.5} className="transition-transform duration-200" />
                                ) : (
                                    <Moon size={18} strokeWidth={1.5} className="transition-transform duration-200" />
                                )}
                            </div>
                            <span className="flex-1 text-left">
                                {isDark ? 'Modo Escuro' : 'Modo Claro'}
                            </span>
                        </button>
                    </nav>
                </div>
            </div>

            <div className="border-t border-sidebar-border/10">
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-muted-foreground">
                            <User size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-medium text-sidebar-foreground">Usuário Aluno</span>
                            <span className="text-base text-muted-foreground">Licença Acadêmica</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
