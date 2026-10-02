import { describe, it, expect } from 'vitest'
import { calculatePaymentDate, getLastDayOfMonth, getInvoiceDifferenceInfo } from './invoice-helper'

describe('Invoice Closing and Due Date Rules (calculatePaymentDate)', () => {
  const creditCardConfig = {
    type: 'credito',
    closing_day: 10,
    due_day: 18,
  }

  // 1. Compra no dia exato do fechamento (>= closing_day -> mês seguinte)
  it('compra no dia exato do fechamento cai no vencimento do mês seguinte', () => {
    // Exemplo do usuário: Compra 10/08/2026 com fechamento 10/08 -> pagamento 18/09/2026
    const res = calculatePaymentDate('2026-08-10', creditCardConfig)
    expect(res).toBe('2026-09-18')
  })

  // 2. Compra antes do fechamento (< closing_day -> mesmo mês)
  it('compra antes do fechamento cai no vencimento do mesmo mês', () => {
    // Compra 09/08/2026 com fechamento 10/08 -> pagamento 18/08/2026
    const res = calculatePaymentDate('2026-08-09', creditCardConfig)
    expect(res).toBe('2026-08-18')
  })

  // 3. Compra depois do fechamento (> closing_day -> mês seguinte)
  it('compra depois do fechamento cai no vencimento do mês seguinte', () => {
    // Compra 15/08/2026 com fechamento 10/08 -> pagamento 18/09/2026
    const res = calculatePaymentDate('2026-08-15', creditCardConfig)
    expect(res).toBe('2026-09-18')
  })

  // 4. Vencimento dia 31 em fevereiro (ajuste para último dia de fev: 28 ou 29)
  it('vencimento dia 31 ajusta para o último dia do mês (fevereiro não bissexto -> 28)', () => {
    const cardWithDue31 = {
      type: 'credito',
      closing_day: 15,
      due_day: 31,
    }
    // Compra 20/01/2025 (depois do fechamento 15) -> fatura de fevereiro/2025 -> 2025-02-28
    const res = calculatePaymentDate('2025-01-20', cardWithDue31)
    expect(res).toBe('2025-02-28')
  })

  it('vencimento dia 31 ajusta para o último dia do mês (fevereiro bissexto -> 29)', () => {
    const cardWithDue31 = {
      type: 'credito',
      closing_day: 15,
      due_day: 31,
    }
    // 2024 foi bissexto -> Compra 20/01/2024 -> 2024-02-29
    const res = calculatePaymentDate('2024-01-20', cardWithDue31)
    expect(res).toBe('2024-02-29')
  })

  it('vencimento dia 31 em mês de 30 dias (abril) ajusta para 30', () => {
    const cardWithDue31 = {
      type: 'credito',
      closing_day: 5,
      due_day: 31,
    }
    // Compra 10/03/2026 (após fechamento 5) -> fatura de abril/2026 -> 2026-04-30
    const res = calculatePaymentDate('2026-03-10', cardWithDue31)
    expect(res).toBe('2026-04-30')
  })

  // 5. Virada de ano (compra 20/12 com fechamento 10/12 -> pagamento 18/01 do ano seguinte)
  it('virada de ano: compra 20/12 com fechamento 10/12 cai em 18/01 do ano seguinte', () => {
    const res = calculatePaymentDate('2026-12-20', creditCardConfig)
    expect(res).toBe('2027-01-18')
  })

  it('virada de ano: compra antes do fechamento (05/12) permanece no ano corrente (18/12)', () => {
    const res = calculatePaymentDate('2026-12-05', creditCardConfig)
    expect(res).toBe('2026-12-18')
  })

  // 6. Contas que não são cartão de crédito mantêm data de compra
  it('conta do tipo banco/dinheiro coincide a data de pagamento com a de compra', () => {
    const bankAccount = {
      type: 'banco',
      closing_day: 10,
      due_day: 18,
    }
    const res = calculatePaymentDate('2026-08-15', bankAccount)
    expect(res).toBe('2026-08-15')
  })

  // 7. Conta de cartão sem due_day configurado coincide com data de compra
  it('cartão sem due_day configurado retorna a data de compra', () => {
    const cardWithoutDue = {
      type: 'credito',
    }
    const res = calculatePaymentDate('2026-08-15', cardWithoutDue)
    expect(res).toBe('2026-08-15')
  })

  it('getLastDayOfMonth calcula corretamente', () => {
    expect(getLastDayOfMonth(2025, 2)).toBe(28)
    expect(getLastDayOfMonth(2024, 2)).toBe(29)
    expect(getLastDayOfMonth(2026, 4)).toBe(30)
    expect(getLastDayOfMonth(2026, 8)).toBe(31)
  })
})

describe('Invoice Difference Info Banner (getInvoiceDifferenceInfo)', () => {
  const creditCardConfig = {
    type: 'credito',
    closing_day: 10,
    due_day: 18,
  }

  it('retorna null se a conta não for cartão de crédito', () => {
    const bankAccount = {
      type: 'banco',
      closing_day: 10,
      due_day: 18,
    }
    const info = getInvoiceDifferenceInfo('2026-08-15', bankAccount)
    expect(info).toBeNull()
  })

  it('retorna null se a compra cair no mesmo mês do pagamento', () => {
    // Compra 05/08 com fechamento 10/08 -> fatura vence 18/08 (mesmo mês)
    const info = getInvoiceDifferenceInfo('2026-08-05', creditCardConfig)
    expect(info).toBeNull()
  })

  it('retorna os dados e o banner correto quando o pagamento cai em mês posterior', () => {
    // Compra 10/08 (dia do fechamento) -> fatura de Setembro/2026 (fecha 10/08, vence 18/09)
    const info = getInvoiceDifferenceInfo('2026-08-10', creditCardConfig)
    expect(info).not.toBeNull()
    expect(info?.hasDifference).toBe(true)
    expect(info?.purchaseDayMonth).toBe('10/08')
    expect(info?.invoiceMonthYear).toBe('Setembro/2026')
    expect(info?.closingDayMonth).toBe('10/08')
    expect(info?.dueDayMonth).toBe('18/09')
    expect(info?.bannerText).toBe(
      'Compra em 10/08 cai na fatura de Setembro/2026 (fecha 10/08, vence 18/09) — o lançamento aparecerá em Setembro/2026.',
    )
  })

  it('funciona corretamente na virada de ano', () => {
    // Compra 20/12/2026 -> fatura de Janeiro/2027 (fecha 10/12, vence 18/01)
    const info = getInvoiceDifferenceInfo('2026-12-20', creditCardConfig)
    expect(info).not.toBeNull()
    expect(info?.purchaseDayMonth).toBe('20/12')
    expect(info?.invoiceMonthYear).toBe('Janeiro/2027')
    expect(info?.closingDayMonth).toBe('10/12')
    expect(info?.dueDayMonth).toBe('18/01')
    expect(info?.bannerText).toBe(
      'Compra em 20/12 cai na fatura de Janeiro/2027 (fecha 10/12, vence 18/01) — o lançamento aparecerá em Janeiro/2027.',
    )
  })
})
