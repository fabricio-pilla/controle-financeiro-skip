import * as React from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { ptBR } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDateBR } from '@/lib/formatters'

export interface DatePickerProps {
  id?: string
  value?: string // ISO "YYYY-MM-DD"
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  clearable?: boolean
  label?: string
}

/**
 * Converte string "YYYY-MM-DD" em Date local sem distorção de fuso horário.
 */
function parseYMD(ymd?: string): Date | undefined {
  if (!ymd) return undefined
  const clean = ymd.split(/[T\s]/)[0]
  const parts = clean.split('-')
  if (parts.length !== 3) return undefined
  const [y, m, d] = parts.map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

/**
 * Converte Date para string "YYYY-MM-DD" local.
 */
function formatYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  required = false,
  className,
  clearable = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = React.useMemo(() => parseYMD(value), [value])

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      if (clearable) onChange('')
      return
    }
    onChange(formatYMD(date))
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal rounded-xl h-11 px-3 border-input bg-background hover:bg-slate-50',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-500 shrink-0" />
          <span className="flex-1 truncate">{value ? formatDateBR(value) : placeholder}</span>
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onChange('')
                }
              }}
              className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 ml-1"
              title="Limpar data"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl border-slate-200" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={ptBR}
          initialFocus
        />
        {/* Atalhos rápidos para facilidade no dia a dia brasileiro */}
        <div className="flex items-center justify-between border-t border-slate-100 p-2 text-xs bg-slate-50/50 rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
            onClick={() => {
              handleSelect(new Date())
            }}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-slate-600 hover:text-slate-800"
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() - 1)
              handleSelect(d)
            }}
          >
            Ontem
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-slate-600 hover:text-slate-800"
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() + 1)
              handleSelect(d)
            }}
          >
            Amanhã
          </Button>
          {clearable && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
