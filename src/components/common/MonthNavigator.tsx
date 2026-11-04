import * as React from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface MonthNavigatorProps {
  /**
   * Mês selecionado no formato "YYYY-MM" ou "all" para todos os meses
   */
  value: string
  /**
   * Callback quando o mês muda
   */
  onChange: (month: string) => void
  /**
   * Indica se a requisição do mês está carregando
   */
  isLoading?: boolean
  className?: string
}

const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const MONTH_NAMES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Retorna o "YYYY-MM" de hoje no fuso local.
 */
function getTodayYM(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Desloca um YYYY-MM por delta meses (ex: -1, +1).
 */
function shiftYM(ym: string, delta: number): string {
  let y: number
  let m: number
  if (/^\d{4}-\d{2}$/.test(ym)) {
    const parts = ym.split('-').map(Number)
    y = parts[0]
    m = parts[1] - 1
  } else {
    const now = new Date()
    y = now.getFullYear()
    m = now.getMonth()
  }
  const target = new Date(y, m + delta, 1)
  const resY = target.getFullYear()
  const resM = String(target.getMonth() + 1).padStart(2, '0')
  return `${resY}-${resM}`
}

/**
 * Formata um YYYY-MM para exibição amigável em português: "Outubro 2026"
 */
function formatMonthTitle(ym: string): string {
  if (ym === 'all') return 'Todos os Meses'
  const match = ym.match(/^(\d{4})-(\d{2})$/)
  if (!match) return ym
  const year = match[1]
  const monthIdx = parseInt(match[2], 10) - 1
  const monthName = MONTH_NAMES_FULL[monthIdx] || match[2]
  return `${monthName} ${year}`
}

export function MonthNavigator({
  value,
  onChange,
  isLoading = false,
  className,
}: MonthNavigatorProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const todayYM = React.useMemo(() => getTodayYM(), [])
  const isCurrentMonth = value === todayYM
  const isAllMonths = value === 'all'

  // Ano sendo navegado dentro do popover de seleção de mês
  const [pickerYear, setPickerYear] = React.useState<number>(() => {
    if (/^\d{4}-\d{2}$/.test(value)) {
      return parseInt(value.split('-')[0], 10)
    }
    return new Date().getFullYear()
  })

  // Sincroniza pickerYear se value mudar externamente
  React.useEffect(() => {
    if (/^\d{4}-\d{2}$/.test(value)) {
      setPickerYear(parseInt(value.split('-')[0], 10))
    }
  }, [value])

  const handlePrev = () => {
    onChange(shiftYM(value, -1))
  }

  const handleNext = () => {
    onChange(shiftYM(value, 1))
  }

  const handleToday = () => {
    onChange(todayYM)
    setPickerOpen(false)
  }

  const handleAll = () => {
    onChange('all')
    setPickerOpen(false)
  }

  const handleSelectMonth = (monthIndexZeroBased: number) => {
    const ym = `${pickerYear}-${String(monthIndexZeroBased + 1).padStart(2, '0')}`
    onChange(ym)
    setPickerOpen(false)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-xs select-none',
        className,
      )}
    >
      {/* Botão Mês Anterior */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        title="Mês anterior"
        className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {/* Popover com grade de meses para navegação direta */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              'h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold hover:bg-slate-100 transition-colors',
              isAllMonths
                ? 'text-indigo-600'
                : isCurrentMonth
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-800',
            )}
          >
            <CalendarIcon
              className={cn(
                'w-3.5 h-3.5 shrink-0',
                isLoading ? 'animate-spin text-indigo-500' : 'text-slate-500',
              )}
            />
            <span className="capitalize">{formatMonthTitle(value)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3 rounded-2xl shadow-xl border-slate-200 space-y-3"
          align="start"
        >
          {/* Cabeçalho do Popover: seletor de ano */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => setPickerYear((y) => y - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold text-slate-800">{pickerYear}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => setPickerYear((y) => y + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Grade 3x4 dos 12 meses */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES_SHORT.map((name, idx) => {
              const ym = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`
              const isSelected = value === ym
              const isCurrent = ym === todayYM

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={cn(
                    'h-9 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1 relative',
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : isCurrent
                        ? 'bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 border border-indigo-200'
                        : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <span>{name}</span>
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              )
            })}
          </div>

          {/* Rodapé com atalhos Hoje e Todos os Meses */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className={cn(
                'h-7 px-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
                isCurrentMonth && 'bg-indigo-50',
              )}
            >
              Mês Atual (Hoje)
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAll}
              className={cn(
                'h-7 px-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                isAllMonths && 'bg-slate-100 text-indigo-600 font-bold',
              )}
            >
              <Layers className="w-3 h-3 mr-1" />
              Todos
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Botão Próximo Mês */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleNext}
        title="Próximo mês"
        className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {/* Atalho "Hoje" direto na barra */}
      <Button
        type="button"
        variant={isCurrentMonth ? 'secondary' : 'ghost'}
        size="sm"
        onClick={handleToday}
        title="Voltar ao mês atual"
        className={cn(
          'h-8 px-2 text-xs font-semibold rounded-lg shrink-0 transition-colors',
          isCurrentMonth
            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
        )}
      >
        Hoje
      </Button>

      {/* Atalho "Todos os Meses" com badge/toggle */}
      <Button
        type="button"
        variant={isAllMonths ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => onChange(isAllMonths ? todayYM : 'all')}
        title={isAllMonths ? 'Voltar ao mês atual' : 'Ver todos os meses'}
        className={cn(
          'h-8 px-2 text-xs font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1',
          isAllMonths
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
        )}
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Todos</span>
      </Button>
    </div>
  )
}
