import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/contexts/CompanyContext'
import { Category, TransactionType } from '@/types/database'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { DynamicIcon, AVAILABLE_ICONS } from '@/components/common/DynamicIcon'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface CategoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  defaultType?: TransactionType
}

export function CategoryModal({
  open,
  onOpenChange,
  category,
  defaultType = 'despesa',
}: CategoryModalProps) {
  const { createCategory, updateCategory } = useCompany()
  const isEditing = Boolean(category)

  const [name, setName] = useState(category?.name || '')
  const [type, setType] = useState<TransactionType>(category?.type || defaultType)
  const [color, setColor] = useState(category?.color || PALETTE_COLORS[0])
  const [icon, setIcon] = useState(category?.icon || 'Tag')
  const [isSubmitting, setIsSubmitting] = useState(false)

  React.useEffect(() => {
    if (category) {
      setName(category.name)
      setType(category.type)
      setColor(category.color)
      setIcon(category.icon)
    } else {
      setName('')
      setType(defaultType)
      setColor(PALETTE_COLORS[0])
      setIcon('Tag')
    }
  }, [category, defaultType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da categoria.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing && category) {
        await updateCategory(category.id, {
          name,
          type,
          color,
          icon,
        })
        toast.success('Categoria atualizada com sucesso!')
      } else {
        await createCategory({
          name,
          type,
          color,
          icon,
        })
        toast.success('Categoria criada com sucesso!')
      }
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar categoria.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Agrupe suas receitas e despesas para relatórios detalhados.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className="text-sm font-medium text-slate-700">
              Nome da Categoria *
            </Label>
            <Input
              id="cat-name"
              placeholder="Ex: Consultoria / Aluguel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-type" className="text-sm font-medium text-slate-700">
              Tipo *
            </Label>
            <Select value={type} onValueChange={(v: TransactionType) => setType(v)}>
              <SelectTrigger id="cat-type" className="rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Icon Picker */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Ícone</Label>
            <div className="grid grid-cols-6 gap-2 p-2 border border-slate-200 rounded-xl max-h-32 overflow-y-auto">
              {AVAILABLE_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                    icon === ic
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={ic}
                >
                  <DynamicIcon name={ic} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Cor de Destaque</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Criar Categoria'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
