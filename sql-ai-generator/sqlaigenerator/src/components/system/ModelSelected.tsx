import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  value?: string
  onChange?: (modelSlug: string) => void
}

const STORAGE_KEY = 'chat_current_model'

const DEFAULT_MODEL = { label: 'Mistral (LangChain)', slug: 'langchain:mistral' }

const OPENROUTER_MODELS = [
  { label: 'Claude Sonnet 4.5', slug: 'anthropic/claude-sonnet-4.5' },
  { label: 'MiMo-V2-Flash', slug: 'xiaomi/mimo-v2-flash' },
  { label: 'Gemini 3 Flash Preview', slug: 'google/gemini-3-flash-preview' },
  { label: 'DeepSeek V3.2', slug: 'deepseek/deepseek-v3.2' },
  { label: 'Claude Opus 4.5', slug: 'anthropic/claude-opus-4.5' },
]

function findLabelBySlug(slug?: string) {
  if (!slug) return DEFAULT_MODEL.label
  if (slug === DEFAULT_MODEL.slug || slug === 'mistralai/mistral-small-24b') return DEFAULT_MODEL.label
  const item = OPENROUTER_MODELS.find((m) => m.slug === slug)
  return item?.label ?? DEFAULT_MODEL.label
}

function normalizeSlug(slug?: string) {
  if (!slug) return DEFAULT_MODEL.slug
  if (slug === 'mistralai/mistral-small-24b') return DEFAULT_MODEL.slug
  return slug
}

export function ModelSelected({ value, onChange }: Props) {
  const defaultSlug = useMemo(
    () => normalizeSlug(value || localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL.slug),
    [value]
  )
  const [open, setOpen] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string>(defaultSlug)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedSlug)
    onChange?.(selectedSlug)
  }, [selectedSlug, onChange])

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs" aria-label="Modelo">
            Modelo: {findLabelBySlug(selectedSlug)}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuLabel>Modelo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setOpen(true)
            }}
          >
            Selecione um Modelo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-elevated border-subtle border rounded-xl w-full max-w-sm mx-4 p-4 fade-in">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Selecionar modelo</h2>
                <p className="text-base text-muted-foreground mt-1">Escolha um modelo abaixo</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground focus-ring rounded-md px-2 py-1"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="px-3 text-base font-medium text-muted-foreground">Padrão (LangChain)</div>
              {(() => {
                const active = selectedSlug === DEFAULT_MODEL.slug
                return (
                  <button
                    key={DEFAULT_MODEL.slug}
                    onClick={() => {
                      setSelectedSlug(DEFAULT_MODEL.slug)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-full border transition-colors ${
                      active
                        ? 'border-ring bg-muted'
                        : 'border-subtle bg-background hover:bg-accent'
                    }`}
                  >
                    <span className="text-base text-foreground">{DEFAULT_MODEL.label}</span>
                    {active && <Check className="size-4 text-foreground" />}
                  </button>
                )
              })()}

              <div className="border-t border-subtle" />

              <div className="px-3 text-base font-medium text-muted-foreground">Outros (OpenRouter)</div>
              {OPENROUTER_MODELS.map(({ label, slug }) => {
                const active = selectedSlug === slug
                return (
                  <button
                    key={slug}
                    onClick={() => {
                      setSelectedSlug(slug)
                      setOpen(false)
                    }}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-full border transition-colors ${
                      active
                        ? 'border-ring bg-muted'
                        : 'border-subtle bg-background hover:bg-accent'
                    }`}
                  >
                    <span className="text-base text-foreground">{label}</span>
                    {active && <Check className="size-4 text-foreground" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
