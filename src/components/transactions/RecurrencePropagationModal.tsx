import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Layers, FastForward, CheckCircle2, Repeat, Package } from 'lucide-react'

export type PropagationChoice = 'all' | 'future' | 'single'

interface RecurrencePropagationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isInstallment: boolean
  isRecurring: boolean
  currentInstallment?: number
  totalInstallments?: number
  onConfirm: (choice: PropagationChoice) => void
  isSubmitting?: boolean
}

export function RecurrencePropagationModal({
  open,
  onOpenChange,
  isInstallment,
  isRecurring,
  currentInstallment,
  totalInstallments,
  onConfirm,
  isSubmitting = false,
}: RecurrencePropagationModalProps) {
  const [choice, setChoice] = React.useState<PropagationChoice>('future')

  // Reset to default on open
  React.useEffect(() => {
    if (open) {
      setChoice('future')
    }
  }, [open])

  const title = isInstallment ? 'Atualizar Lançamento Parcelado' : 'Atualizar Lançamento Recorrente'

  const description = isInstallment
    ? `Este lançamento faz parte de uma compra parcelada${
        currentInstallment && totalInstallments
          ? ` (parcela ${currentInstallment} de ${totalInstallments})`
          : ''
      }. Como deseja aplicar as alterações?`
    : 'Este lançamento é uma despesa ou receita recorrente. Como deseja aplicar as alterações?'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {isInstallment ? <Package className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600 text-left pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <RadioGroup
            value={choice}
            onValueChange={(val) => setChoice(val as PropagationChoice)}
            className="space-y-2.5"
          >
            {/* Opção 1: Todos */}
            <Label
              htmlFor="choice-all"
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                choice === 'all'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RadioGroupItem value="all" id="choice-all" className="mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Atualizar todos os registros</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {isInstallment
                    ? 'Altera a parcela atual e todas as outras parcelas desta compra (passadas e futuras).'
                    : 'Altera o registro atual e todas as outras ocorrências desta recorrência (passadas e futuras).'}
                </p>
              </div>
            </Label>

            {/* Opção 2: Esse e os próximos */}
            <Label
              htmlFor="choice-future"
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                choice === 'future'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RadioGroupItem value="future" id="choice-future" className="mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <FastForward className="w-4 h-4 text-indigo-600" />
                  <span>Atualizar esse e os próximos</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {isInstallment
                    ? 'Altera a parcela atual e todas as parcelas futuras, mantendo as parcelas anteriores intactas.'
                    : 'Altera o lançamento atual e todas as ocorrências a partir desta data, mantendo o histórico anterior.'}
                </p>
              </div>
            </Label>

            {/* Opção 3: Somente esse */}
            <Label
              htmlFor="choice-single"
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                choice === 'single'
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RadioGroupItem value="single" id="choice-single" className="mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Atualizar somente esse registro</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  Altera exclusivamente este registro, sem modificar nenhum outro lançamento.
                </p>
              </div>
            </Label>
          </RadioGroup>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-10"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(choice)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-5 font-semibold shadow-sm"
          >
            {isSubmitting ? 'Aplicando...' : 'Confirmar Atualização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
