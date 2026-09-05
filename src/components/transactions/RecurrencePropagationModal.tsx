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
import { Layers, FastForward, CheckCircle2, Repeat, Package, Trash2 } from 'lucide-react'

export type PropagationChoice = 'all' | 'future' | 'single'
export type PropagationMode = 'update' | 'delete'

interface RecurrencePropagationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isInstallment: boolean
  isRecurring: boolean
  mode?: PropagationMode
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
  mode = 'update',
  currentInstallment,
  totalInstallments,
  onConfirm,
  isSubmitting = false,
}: RecurrencePropagationModalProps) {
  const [choice, setChoice] = React.useState<PropagationChoice>('future')

  // Reset to default on open
  React.useEffect(() => {
    if (open) {
      setChoice(mode === 'delete' ? 'single' : 'future')
    }
  }, [open, mode])

  const isDelete = mode === 'delete'

  const title = isDelete
    ? isInstallment
      ? 'Excluir Lançamento Parcelado'
      : 'Excluir Lançamento Recorrente'
    : isInstallment
      ? 'Atualizar Lançamento Parcelado'
      : 'Atualizar Lançamento Recorrente'

  const description = isInstallment
    ? `Este lançamento faz parte de uma compra parcelada${
        currentInstallment && totalInstallments
          ? ` (parcela ${currentInstallment} de ${totalInstallments})`
          : ''
      }. Como deseja aplicar a ${isDelete ? 'exclusão' : 'alteração'}?`
    : `Este lançamento é uma despesa ou receita recorrente. Como deseja aplicar a ${
        isDelete ? 'exclusão' : 'alteração'
      }?`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDelete ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {isDelete ? (
                <Trash2 className="w-5 h-5" />
              ) : isInstallment ? (
                <Package className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
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
            {/* Opção 3 / 1 conforme escopo: Somente esse registro */}
            <Label
              htmlFor="choice-single"
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                choice === 'single'
                  ? isDelete
                    ? 'border-rose-600 bg-rose-50/50 text-rose-950 shadow-sm'
                    : 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RadioGroupItem value="single" id="choice-single" className="mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <CheckCircle2
                    className={`w-4 h-4 ${isDelete ? 'text-rose-600' : 'text-indigo-600'}`}
                  />
                  <span>
                    {isDelete ? 'Somente esse registro' : 'Atualizar somente esse registro'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {isDelete
                    ? 'Exclui exclusivamente este lançamento, mantendo todos os outros intactos.'
                    : 'Altera exclusivamente este registro, sem modificar nenhum outro lançamento.'}
                </p>
              </div>
            </Label>

            {/* Opção 2: Esse e os próximos */}
            <Label
              htmlFor="choice-future"
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                choice === 'future'
                  ? isDelete
                    ? 'border-rose-600 bg-rose-50/50 text-rose-950 shadow-sm'
                    : 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RadioGroupItem value="future" id="choice-future" className="mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <FastForward
                    className={`w-4 h-4 ${isDelete ? 'text-rose-600' : 'text-indigo-600'}`}
                  />
                  <span>{isDelete ? 'Esse e os próximos' : 'Atualizar esse e os próximos'}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {isDelete
                    ? isInstallment
                      ? 'Exclui a parcela atual e todas as parcelas subsequentes desta compra, mantendo as parcelas anteriores.'
                      : 'Exclui este lançamento e todas as ocorrências futuras desta recorrência, mantendo o histórico anterior.'
                    : isInstallment
                      ? 'Altera a parcela atual e todas as parcelas futuras, mantendo as parcelas anteriores intactas.'
                      : 'Altera o lançamento atual e todas as ocorrências a partir desta data, mantendo o histórico anterior.'}
                </p>
              </div>
            </Label>

            {/* Opção 1: Todos os registros */}
            <Label
              htmlFor="choice-all"
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                choice === 'all'
                  ? isDelete
                    ? 'border-rose-600 bg-rose-50/50 text-rose-950 shadow-sm'
                    : 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-sm'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RadioGroupItem value="all" id="choice-all" className="mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <Layers className={`w-4 h-4 ${isDelete ? 'text-rose-600' : 'text-indigo-600'}`} />
                  <span>{isDelete ? 'Todos os registros' : 'Atualizar todos os registros'}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {isDelete
                    ? isInstallment
                      ? 'Exclui todas as parcelas desta compra (passadas e futuras).'
                      : 'Exclui o grupo inteiro de recorrência (todas as ocorrências passadas e futuras).'
                    : isInstallment
                      ? 'Altera a parcela atual e todas as outras parcelas desta compra (passadas e futuras).'
                      : 'Altera o registro atual e todas as outras ocorrências desta recorrência (passadas e futuras).'}
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
            className={`text-white rounded-xl h-10 px-5 font-semibold shadow-sm ${
              isDelete ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isSubmitting
              ? isDelete
                ? 'Excluindo...'
                : 'Aplicando...'
              : isDelete
                ? 'Confirmar Exclusão'
                : 'Confirmar Atualização'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
