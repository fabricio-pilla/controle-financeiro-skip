import React, { useState, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/contexts/CompanyContext'
import { TransactionType, RESPONSIBLE_PERSONS } from '@/types/database'
import { parseNaturalLanguageTransaction } from '@/lib/nlp-parser'
import type { ParsedTransaction } from '@/lib/nlp-parser'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/formatters'
import {
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Wand2,
  Tag,
  Wallet,
  Calendar,
  CreditCard,
  UserCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface AiTransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EXAMPLES = [
  'Padaria 25,90 no crédito',
  'Salário 5000',
  'Netflix 39,90 parcelado em 12x no Nubank',
  'Aluguel 1500 dia 10',
  'Freela site 3500 recebido dia 15',
  'Ontem paguei 89,90 no restaurante',
  'Uber 25,50',
]

export function AiTransactionModal({ open, onOpenChange }: AiTransactionModalProps) {
  const { accounts, categories, subcategories, createTransaction } = useCompany()

  const [text, setText] = useState('')
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null)
  const [hasInterpreted, setHasInterpreted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Editable preview fields
  const [type, setType] = useState<TransactionType>('despesa')
  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [responsible, setResponsible] = useState<string>('')
  const [installmentsTotal, setInstallmentsTotal] = useState(1)

  // Reset when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setText('')
      setParsed(null)
      setHasInterpreted(false)
      setType('despesa')
      setDescription('')
      setAmountStr('')
      setDate(new Date().toISOString().split('T')[0])
      setAccountId(accounts[0]?.id || '')
      setCategoryId('')
      setSubcategoryId('')
      setResponsible('')
      setInstallmentsTotal(1)
    }
  }, [open, accounts])

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  )

  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId],
  )

  React.useEffect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some((c) => c.id === categoryId)
      if (!exists) {
        setCategoryId(filteredCategories[0].id)
        setSubcategoryId('')
      }
    }
  }, [type, filteredCategories, categoryId])

  const handleInterpret = () => {
    if (!text.trim()) {
      toast.error('Digite uma descrição para interpretar.')
      return
    }
    if (accounts.length === 0) {
      toast.error('Cadastre uma conta antes de lançar.')
      return
    }

    setIsInterpreting(true)
    // Simulate small delay for UX feedback
    setTimeout(() => {
      try {
        const result = parseNaturalLanguageTransaction(text, accounts, categories)
        setParsed(result)
        setType(result.type)
        setDescription(result.description)
        setAmountStr(result.amount > 0 ? String(result.amount) : '')
        setDate(result.date)
        setAccountId(result.account_id || accounts[0]?.id || '')
        setInstallmentsTotal(result.installments_total)
        // Check if description matches any known responsible person
        const lowerText = text.toLowerCase()
        const matchedResp = RESPONSIBLE_PERSONS.find((p) => lowerText.includes(p.toLowerCase()))
        if (matchedResp) {
          setResponsible(matchedResp)
        } else {
          setResponsible('')
        }

        // Category & Subcategory matching
        let finalCatId = ''
        if (result.category_id) {
          finalCatId = result.category_id
          setCategoryId(result.category_id)
        } else {
          const fallback =
            categories.find(
              (c) =>
                c.type === result.type &&
                (c.name.toLowerCase().includes('outros') || c.name.toLowerCase().includes('geral')),
            ) ||
            categories.find((c) => c.type === result.type) ||
            null
          finalCatId = fallback?.id || ''
          setCategoryId(finalCatId)
        }

        // Try to match subcategory from text
        const possibleSubs = subcategories.filter((s) => s.category_id === finalCatId)
        const matchedSub = possibleSubs.find((s) => lowerText.includes(s.name.toLowerCase()))
        if (matchedSub) {
          setSubcategoryId(matchedSub.id)
        } else {
          setSubcategoryId('')
        }

        setHasInterpreted(true)
      } catch (err: any) {
        toast.error(err?.message || 'Não consegui interpretar o texto.')
      } finally {
        setIsInterpreting(false)
      }
    }, 350)
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      toast.error('Ajuste a descrição antes de confirmar.')
      return
    }
    const parsedAmount = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor válido maior que zero.')
      return
    }
    if (!accountId) {
      toast.error('Selecione uma conta.')
      return
    }
    if (!categoryId) {
      toast.error('Selecione uma categoria.')
      return
    }

    setIsSubmitting(true)
    try {
      await createTransaction({
        description,
        amount: parsedAmount,
        type,
        account_id: accountId,
        category_id: categoryId,
        subcategory_id: subcategoryId || undefined,
        date,
        responsible: responsible || undefined,
        installments_total: installmentsTotal,
      })
      toast.success(
        installmentsTotal > 1
          ? `Lançamento parcelado em ${installmentsTotal}x criado com sucesso!`
          : 'Lançamento criado com sucesso!',
      )
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar lançamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            Lançamento Inteligente
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Descreva seu lançamento em linguagem natural e a IA interpreta os campos para você.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4 pt-2">
          {/* Text input */}
          <div className="space-y-1.5">
            <Label htmlFor="ai-text" className="text-sm font-medium text-slate-700">
              Descreva seu lançamento
            </Label>
            <Textarea
              id="ai-text"
              placeholder="Ex: 'Almoço no restaurante 89,90 no cartão de crédito' ou 'Netflix 39,90 parcelado em 12x'"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-xl min-h-[90px] resize-none"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EXAMPLES.slice(0, 4).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setText(ex)}
                  className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleInterpret}
            disabled={isInterpreting || !text.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
          >
            {isInterpreting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Interpretando...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Interpretar com IA ✨
              </>
            )}
          </Button>

          {/* Preview / editable fields */}
          {hasInterpreted && parsed && (
            <div className="space-y-4 animate-fade-in">
              {/* Confidence badges */}
              <div className="flex flex-wrap gap-1.5">
                <ConfidenceBadge label="Tipo" ok={parsed.confidence.type} />
                <ConfidenceBadge label="Valor" ok={parsed.confidence.amount} />
                <ConfidenceBadge label="Data" ok={parsed.confidence.date} />
                <ConfidenceBadge label="Categoria" ok={parsed.confidence.category} />
                <ConfidenceBadge label="Conta" ok={parsed.confidence.account} />
                {parsed.installments_total > 1 && (
                  <ConfidenceBadge label="Parcelas" ok={parsed.confidence.installments} />
                )}
              </div>

              {/* Type Selector */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setType('despesa')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    type === 'despesa'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  Despesa
                </button>
                <button
                  type="button"
                  onClick={() => setType('receita')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    type === 'receita'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Receita
                </button>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="ai-desc" className="text-sm font-medium text-slate-700">
                  Descrição *
                </Label>
                <Input
                  id="ai-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl h-11"
                  required
                />
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-amount"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5 text-slate-500" />
                    Valor (R$) *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      R$
                    </span>
                    <Input
                      id="ai-amount"
                      type="number"
                      step="0.01"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      className="rounded-xl h-11 pl-10 font-bold tabular-nums"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-date"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Data *
                  </Label>
                  <Input
                    id="ai-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl h-11"
                    required
                  />
                </div>
              </div>

              {/* Account & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-account"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5 text-slate-500" />
                    Conta *
                  </Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="ai-account" className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione a conta..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: acc.color }}
                            />
                            {acc.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-category"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    Categoria *
                  </Label>
                  <Select
                    value={categoryId}
                    onValueChange={(val) => {
                      setCategoryId(val)
                      const valid = subcategories.filter((s) => s.category_id === val)
                      if (!valid.some((s) => s.id === subcategoryId)) {
                        setSubcategoryId('')
                      }
                    }}
                  >
                    <SelectTrigger id="ai-category" className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subcategory */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="ai-subcategory"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    Subcategoria (opcional)
                  </Label>
                  {subcategoryId && (
                    <button
                      type="button"
                      onClick={() => setSubcategoryId('')}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <Select
                  value={subcategoryId || '__none__'}
                  onValueChange={(v) => setSubcategoryId(v === '__none__' ? '' : v)}
                  disabled={!categoryId || filteredSubcategories.length === 0}
                >
                  <SelectTrigger id="ai-subcategory" className="rounded-xl h-11">
                    <SelectValue
                      placeholder={
                        !categoryId
                          ? 'Selecione uma categoria primeiro'
                          : filteredSubcategories.length === 0
                            ? 'Nenhuma subcategoria para esta categoria'
                            : 'Selecione uma subcategoria...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="__none__">
                      <span className="text-slate-400">Nenhuma subcategoria</span>
                    </SelectItem>
                    {filteredSubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                sub.color ||
                                categories.find((c) => c.id === sub.category_id)?.color ||
                                '#6366F1',
                            }}
                          />
                          <span>{sub.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Responsible Person */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="ai-responsible"
                  className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  Responsável (opcional)
                </Label>
                <Select
                  value={responsible || '__none__'}
                  onValueChange={(v) => setResponsible(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger id="ai-responsible" className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione o responsável..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="__none__">
                      <span className="text-slate-400">Não definido / Vazio</span>
                    </SelectItem>
                    {RESPONSIBLE_PERSONS.map((person) => (
                      <SelectItem key={person} value={person}>
                        {person}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Installments */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="ai-installments"
                  className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  Parcelado em X vezes
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="ai-installments"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={installmentsTotal}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setInstallmentsTotal(isNaN(v) || v < 1 ? 1 : Math.min(v, 60))
                    }}
                    className="rounded-xl h-11 w-28 font-semibold tabular-nums"
                  />
                  <span className="text-sm text-slate-500">x (à vista = 1)</span>
                </div>
                {installmentsTotal > 1 && (
                  <p className="text-xs text-indigo-600 font-medium animate-fade-in">
                    Serão criadas {installmentsTotal} transações de{' '}
                    {formatCurrency(
                      (parseFloat(amountStr.replace(',', '.')) || 0) / installmentsTotal,
                    )}{' '}
                    cada, com datas mensais a partir de {date}.
                  </p>
                )}
              </div>
            </div>
          )}

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
              disabled={isSubmitting || !hasInterpreted}
              className={`rounded-xl h-11 text-white font-medium ${
                type === 'despesa'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar Lançamento'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfidenceBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] gap-1 px-2 py-0.5 rounded-full font-medium ${
        ok
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {label}
    </Badge>
  )
}
