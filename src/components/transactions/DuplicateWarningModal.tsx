import { Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateBR } from '@/lib/formatters'
import type { DuplicateCandidate } from '@/lib/duplicate-check'

interface DuplicateWarningModalProps {
  open: boolean
  candidates: DuplicateCandidate[]
  isSubmitting?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Alerta de lançamento duplicado: lista os lançamentos já existentes que casam
 * (descrição, valor, data, conta) e oferece "Salvar assim mesmo" ou "Voltar".
 */
export function DuplicateWarningModal({
  open,
  candidates,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: DuplicateWarningModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Possível lançamento duplicado
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Já existe{candidates.length > 1 ? 'm' : ''} lançamento
            {candidates.length > 1 ? 's' : ''} com o mesmo valor neste dia:
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-56 space-y-2 overflow-y-auto py-1">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-slate-800" title={c.description}>
                  {c.description || '(sem descrição)'}
                </span>
                <span className="shrink-0 font-semibold text-slate-900">
                  {formatCurrency(c.amount)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {formatDateBR(c.effectiveDate)}
                {c.accountName ? ` · ${c.accountName}` : ''}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 pt-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Voltar e revisar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar assim mesmo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
