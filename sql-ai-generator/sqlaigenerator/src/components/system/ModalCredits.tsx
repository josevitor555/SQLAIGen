interface ModalCreditsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModalCredits({ isOpen, onClose }: ModalCreditsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-elevated border-subtle border shadow-elevated rounded-xl max-w-md w-full mx-4 p-6 fade-in">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Créditos finais
            </h2>
            <p className="text-base text-muted-foreground mt-1">
              Projeto desenvolvido pelos seguintes participantes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-muted-foreground hover:text-foreground focus-ring rounded-md px-2 py-1"
          >
            Close
          </button>
        </div>

        <ul className="space-y-1.5 text-base text-foreground">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>José Vitor de Sousa Feitosa</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Maria Monalisa Andrade Macedo Moura</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Júlia Gabriela Sobral Santos</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Mylena da Silva Coelho</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Kleyvison Thomas Lima da Silva</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Sarah Maria Da Silva Zacarias</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
