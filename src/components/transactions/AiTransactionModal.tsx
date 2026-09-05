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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/contexts/CompanyContext'
import { TransactionType, RecurrenceType, Account } from '@/types/database'
import { parseNaturalLanguageTransaction } from '@/lib/nlp-parser'
import type { ParsedTransaction } from '@/lib/nlp-parser'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/formatters'
import { calculatePaymentDate } from '@/lib/invoice-helper'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
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
  Repeat,
  CheckCircle2,
  AlertCircle,
  Mic,
} from 'lucide-react'

interface AiTransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EXAMPLES = [
  'Fabricio Entrada Salario 8000,00 recorrente',
  'Padaria 25,90 no crédito',
  'Salário 5000 mensal',
  'Netflix 39,90 parcelado em 12x no Nubank',
  'Aluguel 1500 dia 10',
  'Freela site 3500 recebido dia 15',
  'Ontem paguei 89,90 no restaurante',
  'Uber 25,50',
]

export function AiTransactionModal({ open, onOpenChange }: AiTransactionModalProps) {
  const { accounts, categories, subcategories, createTransaction } = useCompany()

  // Conta principal/padrão do controle: cai nela quando a IA não identificar conta
  const primaryAccount = useMemo(
    () => accounts.find((a) => a.is_primary) || accounts[0] || null,
    [accounts],
  )
  const resolveAccountId = (accId?: string): string => {
    if (accId && accounts.some((a) => a.id === accId)) return accId
    return primaryAccount?.id || accounts[0]?.id || ''
  }
  const defaultDateForAccount = (acc: Account | null): string => {
    if (!acc) return new Date().toISOString().split('T')[0]
    const today = new Date()
    if (acc.type === 'credito' && acc.due_day) {
      const y = today.getFullYear()
      const m = String(today.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(y, today.getMonth() + 1, 0).getDate()
      const day = Math.min(acc.due_day, lastDay)
      return `${y}-${m}-${String(day).padStart(2, '0')}`
    }
    return today.toISOString().split('T')[0]
  }

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
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('mensal')
  const [installmentsTotal, setInstallmentsTotal] = useState(1)

  // Assistente de voz (Web Speech API)
  const {
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    toggleListening,
    errorMessage: speechError,
  } = useSpeechRecognition({
    lang: 'pt-BR',
    continuous: true,
    interimResults: true,
    onResult: (transcriptText) => {
      setText(transcriptText)
    },
    onError: (err) => {
      toast.error(err)
    },
  })

  // Reset when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setText('')
      setParsed(null)
      setHasInterpreted(false)
      setType('despesa')
      setDescription('')
      setAmountStr('')
      const today = new Date().toISOString().split('T')[0]
      setDate(today)
      setPaymentDate(calculatePaymentDate(today, primaryAccount))
      setAccountId(primaryAccount?.id || '')
      setCategoryId('')
      setSubcategoryId('')
      setIsRecurring(false)
      setRecurrenceType('mensal')
      setInstallmentsTotal(1)
    } else {
      if (isListening) {
        stopListening()
      }
    }
  }, [open, accounts, primaryAccount])

  const filteredCategories = useMemo(() => {
    return categories
      .filter((c) => {
        // Always include currently selected category
        if (c.id === categoryId) return true
        // Matching type
        if (c.type === type) return true
        // Allow personal categories (Fabrício, Raffaela, Helena, Emanuel, Matheus) and Investimento across both
        const normName = c.name.toLowerCase().trim()
        return (
          normName === 'fabrício' ||
          normName === 'fabricio' ||
          normName === 'raffaela' ||
          normName === 'rafaela' ||
          normName === 'helena' ||
          normName === 'emanuel' ||
          normName === 'matheus' ||
          normName === 'investimento'
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  }, [categories, type, categoryId])

  const filteredSubcategories = useMemo(
    () =>
      subcategories
        .filter((s) => s.category_id === categoryId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [subcategories, categoryId],
  )

  React.useEffect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some((c) => c.id === categoryId)
      if (!exists && !hasInterpreted) {
        setCategoryId(filteredCategories[0].id)
        setSubcategoryId('')
      }
    }
  }, [type, filteredCategories, categoryId, hasInterpreted])

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
        const result = parseNaturalLanguageTransaction(text, accounts, categories, subcategories)
        setParsed(result)
        setType(result.type)
        setDescription(result.description)
        setAmountStr(result.amount > 0 ? String(result.amount) : '')
        const resolvedAccId = resolveAccountId(result.account_id)
        setAccountId(resolvedAccId)

        // Se a data de compra veio do parser ou padrão hoje:
        const chosenPurchaseDate = result.confidence.date
          ? result.date
          : new Date().toISOString().split('T')[0]
        setDate(chosenPurchaseDate)

        // Calcula a data de pagamento conforme fechamento/vencimento do cartão
        const accObj = accounts.find((a) => a.id === resolvedAccId) || null
        const calculatedPayDate = calculatePaymentDate(chosenPurchaseDate, accObj)
        setPaymentDate(calculatedPayDate)

        setInstallmentsTotal(result.installments_total)
        setIsRecurring(Boolean(result.is_recurring))
        setRecurrenceType(result.recurrence_type || 'mensal')

        // Category matching
        let finalCatId = ''
        if (result.category_id) {
          finalCatId = result.category_id
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
        }
        setCategoryId(finalCatId)

        // Subcategory matching
        if (result.subcategory_id) {
          setSubcategoryId(result.subcategory_id)
        } else {
          // Try to match subcategory from text under the selected category
          const lowerText = text.toLowerCase()
          const possibleSubs = subcategories.filter((s) => s.category_id === finalCatId)
          const matchedSub = possibleSubs.find((s) => lowerText.includes(s.name.toLowerCase()))
          if (matchedSub) {
            setSubcategoryId(matchedSub.id)
          } else {
            setSubcategoryId('')
          }
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
        payment_date: paymentDate || date,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : undefined,
        installments_total: installmentsTotal,
      })
      toast.success(
        installmentsTotal > 1
          ? `Lançamento parcelado em ${installmentsTotal}x criado com sucesso!`
          : isRecurring
            ? 'Lançamento recorrente criado com sucesso!'
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
          {/* Text input + Voice Assistant */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-text" className="text-sm font-medium text-slate-700">
                Descreva seu lançamento
              </Label>

              {/* Botão de Microfone / Assistente de Voz */}
              <button
                type="button"
                onClick={() => {
                  if (!isSpeechSupported) {
                    toast.error(
                      'Seu navegador não suporta reconhecimento de voz — use Chrome ou Edge.',
                    )
                    return
                  }
                  toggleListening()
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-300'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                }`}
                title={
                  !isSpeechSupported
                    ? 'Seu navegador não suporta reconhecimento de voz — use Chrome ou Edge'
                    : isListening
                      ? 'Clique para parar de gravar'
                      : 'Falar por voz (Web Speech API)'
                }
              >
                {isListening ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <Mic className="w-3.5 h-3.5" />
                    Ouvindo...
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-indigo-600" />
                    Assistente de Voz
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <Textarea
                id="ai-text"
                placeholder={
                  isListening
                    ? 'Ouvindo sua voz... Fale normalmente seu lançamento.'
                    : "Ex: 'Notebook 3500 no crédito em 10x' ou 'Almoço 45 no cartão santander'"
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={`rounded-xl min-h-[90px] resize-none transition-colors ${
                  isListening ? 'border-rose-400 bg-rose-50/20 ring-1 ring-rose-400' : ''
                }`}
              />
            </div>

            {speechError && <p className="text-xs text-rose-600 font-medium">{speechError}</p>}

            {!isSpeechSupported && (
              <p className="text-[11px] text-amber-600">
                Seu navegador não suporta reconhecimento de voz — use Chrome ou Edge.
              </p>
            )}

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
                {subcategoryId && (
                  <ConfidenceBadge label="Subcategoria" ok={parsed.confidence.subcategory} />
                )}
                <ConfidenceBadge label="Conta" ok={parsed.confidence.account} />
                {parsed.is_recurring && (
                  <ConfidenceBadge label="Recorrente" ok={parsed.confidence.recurrence} />
                )}
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

              {/* Amount */}
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

              {/* Data da Compra & Data de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-date"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Data da Compra *
                  </Label>
                  <Input
                    id="ai-date"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      const newDate = e.target.value
                      setDate(newDate)
                      const acc = accounts.find((a) => a.id === accountId) || null
                      if (acc && acc.type === 'credito') {
                        setPaymentDate(calculatePaymentDate(newDate, acc))
                      } else {
                        setPaymentDate(newDate)
                      }
                    }}
                    className="rounded-xl h-11"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-payment-date"
                    className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Data de Pagamento *
                  </Label>
                  <Input
                    id="ai-payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
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
                  <Select
                    value={accountId}
                    onValueChange={(val) => {
                      setAccountId(val)
                      const acc = accounts.find((a) => a.id === val) || null
                      setPaymentDate(calculatePaymentDate(date, acc))
                    }}
                  >
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
                            {acc.is_primary && (
                              <span className="text-[10px] font-semibold text-amber-600">
                                (principal)
                              </span>
                            )}
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

              {/* Recurring Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="ai-recurring-toggle"
                    className="text-sm font-medium text-slate-800 flex items-center gap-1.5"
                  >
                    <Repeat className="w-3.5 h-3.5 text-slate-600" />
                    Lançamento Recorrente
                  </Label>
                  <p className="text-xs text-slate-500">
                    Marque se este valor se repete periodicamente (ex: Salário mensal)
                  </p>
                </div>
                <Switch
                  id="ai-recurring-toggle"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>

              {isRecurring && (
                <div className="space-y-1.5 animate-fade-in">
                  <Label
                    htmlFor="ai-recurrence-type"
                    className="text-sm font-medium text-slate-700"
                  >
                    Periodicidade
                  </Label>
                  <Select
                    value={recurrenceType}
                    onValueChange={(v: RecurrenceType) => setRecurrenceType(v)}
                  >
                    <SelectTrigger id="ai-recurrence-type" className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Installments */}
              {!isRecurring && (
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
              )}
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
