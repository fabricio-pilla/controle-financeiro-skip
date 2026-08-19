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
import { SegmentType } from '@/types/database'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { maskCNPJ } from '@/lib/formatters'
import { toast } from 'sonner'
import { Loader2, Building2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface CreateCompanyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (companyId: string) => void
}

const SEGMENTS: SegmentType[] = [
  'Serviços',
  'Comércio',
  'Indústria',
  'Tecnologia',
  'Varejo',
  'Outro',
]

export function CreateCompanyModal({ open, onOpenChange, onSuccess }: CreateCompanyModalProps) {
  const { createCompany } = useCompany()
  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [segment, setSegment] = useState<SegmentType>('Serviços')
  const [color, setColor] = useState(PALETTE_COLORS[0])
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da empresa')
      return
    }

    setIsSubmitting(true)
    try {
      const comp = await createCompany(name, segment, color, cnpj, description)
      toast.success(`Empresa "${comp.name}" criada com sucesso! Você é o Proprietário.`)
      setName('')
      setCnpj('')
      setSegment('Serviços')
      setColor(PALETTE_COLORS[0])
      setDescription('')
      onOpenChange(false)
      if (onSuccess) onSuccess(comp.id)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar empresa')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Nova Empresa</DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Crie um novo tenant com categorias padrão e controle isolado.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-name" className="text-sm font-medium text-slate-700">
              Nome da Empresa *
            </Label>
            <Input
              id="company-name"
              placeholder="Ex: Minha Empresa Ltda"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="company-cnpj" className="text-sm font-medium text-slate-700">
                CNPJ (opcional)
              </Label>
              <Input
                id="company-cnpj"
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-segment" className="text-sm font-medium text-slate-700">
                Segmento *
              </Label>
              <Select value={segment} onValueChange={(v: SegmentType) => setSegment(v)}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Cor de Identificação</Label>
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

          <div className="space-y-1.5">
            <Label htmlFor="company-description" className="text-sm font-medium text-slate-700">
              Descrição (opcional)
            </Label>
            <Textarea
              id="company-description"
              placeholder="Breve descrição do segmento de atuação da empresa..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl min-h-[80px] resize-none"
            />
          </div>

          <DialogFooter className="pt-4 flex items-center justify-end gap-2">
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
              className="rounded-xl h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Empresa'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
