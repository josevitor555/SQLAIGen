import { Menu } from 'lucide-react';

interface MobileHeaderProps {
    onMenuToggle: () => void;
}

export function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
    return (
        <div className="md:hidden fixed top-0 w-full bg-background border-b border-border z-50 px-4 py-3 flex justify-between items-center">
            <span className="text-foreground font-semibold tracking-tight">SQLAIGen</span>
            <button className="text-muted-foreground" onClick={onMenuToggle}>
                <Menu size={24} />
            </button>
        </div>
    );
}
