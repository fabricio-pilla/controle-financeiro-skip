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
import { useCompany } from '@/contexts/CompanyContext'
import { Category, Subcategory } from '@/types/database'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { DynamicIcon, AVAILABLE_ICONS } from '@/components/common/DynamicIcon'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface SubcategoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  subcategory?: Subcategory | null
}

export function SubcategoryModal({
  open,
  onOpenChange,
  category,
  subcategory,
}: SubcategoryModalProps) {
  const { createSubcategory, updateSubcategory } = useCompany()
  const isEditing = Boolean(subcategory)

  const [name, setName] = useState(subcategory?.name || '')
  const [color, setColor] = useState(subcategory?.color || '')
  const [icon, setIcon] = useState(subcategory?.icon || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  React.useEffect(() => {
    if (subcategory) {
      setName(subcategory.name)
      setColor(subcategory.color || '')
      setIcon(subcategory.icon || '')
    } else {
      setName('')
      setColor('')
      setIcon('')
    }
  }, [subcategory, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da subcategoria.')
      return
    }
    if (!category && !subcategory) {
      toast.error('Categoria pai não encontrada.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isEditing && subcategory) {
        await updateSubcategory(subcategory.id, {
          name: name.trim(),
          color: color.trim() || undefined,
          icon: icon.trim() || undefined,
        })
        toast.success('Subcategoria atualizada com sucesso!')
      } else if (category) {
        await createSubcategory({
          category_id: category.id,
          name: name.trim(),
          color: color.trim() || undefined,
          icon: icon.trim() || undefined,
        })
        toast.success('Subcategoria criada com sucesso!')
      }
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar subcategoria.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const effectiveColor = color || category?.color || PALETTE_COLORS[0]
  const effectiveIcon = icon || category?.icon || 'Tag'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Subcategoria' : 'Nova Subcategoria'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Subcategoria vinculada a{' '}
            <strong className="text-slate-800 font-semibold">{category?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="subcat-name" className="text-sm font-medium text-slate-700">
              Nome da Subcategoria *
            </Label>
            <Input
              id="subcat-name"
              placeholder="Ex: Água, Luz, Combustível, Supermercado..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          {/* Icon Picker (optional, inherits from category) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">Ícone (opcional)</Label>
              {icon && (
                <button
                  type="button"
                  onClick={() => setIcon('')}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Usar ícone da categoria ({category?.icon || 'Tag'})
                </button>
              )}
            </div>
            <div className="grid grid-cols-6 gap-2 p-2 border border-slate-200 rounded-xl max-h-32 overflow-y-auto">
              {AVAILABLE_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic === icon ? '' : ic)}
                  className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                    (icon || category?.icon) === ic
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={ic}
                >
                  <DynamicIcon name={ic} className="w-4 h-4" />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Se não selecionar, herda o ícone da categoria-pai: <strong>{effectiveIcon}</strong>.
            </p>
          </div>

          {/* Color Picker (optional, inherits from category) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">
                Cor de Destaque (opcional)
              </Label>
              {color && (
                <button
                  type="button"
                  onClick={() => setColor('')}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Usar cor da categoria
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(color === c ? '' : c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                    effectiveColor === c
                      ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Cor atual:{' '}
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-1 align-middle"
                style={{ backgroundColor: effectiveColor }}
              />
              {color ? 'Personalizada' : 'Herdada da categoria pai'}
            </p>
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
                'Criar Subcategoria'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
