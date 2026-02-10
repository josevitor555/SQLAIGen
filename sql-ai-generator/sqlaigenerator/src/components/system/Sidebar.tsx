import { Upload, Database, Terminal, History, User } from 'lucide-react';
// Removed unused cn import 
// Given the previous user context check, I didn't see a lib folder, so I'll create the utility or just use template literals for now to be safe.
// I'll create a simple utility function in the component or assume standard class manipulation.
// Re-reading file structure: `src/components` exists. `src/lib` was not explicitly checked but standard shadcn init creates it.
// I'll just use template strings for simplicity and robustness.

interface SidebarProps {
    activeTab: 'upload' | 'schema' | 'query' | 'history';
    onTabChange: (tab: 'upload' | 'schema' | 'query' | 'history') => void;
    className?: string;
}

export function Sidebar({ activeTab, onTabChange, className = "hidden md:flex" }: SidebarProps) {
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
                            SQLGen<span className="text-muted-foreground font-normal">.edu</span>
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
                </div>
            </div>

            <div className="p-6 border-t border-sidebar-border/10">
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
        </aside>
    );
}
