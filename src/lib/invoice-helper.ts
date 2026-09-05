/**
 * Invoice date helpers (Fechamento e Vencimento de faturas de cartão de crédito)
 *
 * Regra de negócio:
 * Quando o lançamento é feito numa conta de cartão de crédito:
 * Comparar a data da compra com o dia de fechamento da fatura daquela conta (closing_day).
 * - Se purchaseDate.day >= closing_day: a fatura deste mês já fechou, então a data de pagamento
 *   cai no dia de vencimento (due_day) do MÊS SEGUINTE.
 * - Se purchaseDate.day < closing_day: a fatura ainda está aberta, então a data de pagamento
 *   cai no dia de vencimento (due_day) do MESMO mês.
 *
 * Tratar dia inexistente no mês (ex: 31 em fev, ou 31 em meses de 30 dias): usar o último dia do mês alvo.
 *
 * Se a conta NÃO for cartão de crédito ou não possuir fechamento/vencimento configurado:
 * A data de pagamento padrão coincide com a data de compra.
 */

export interface AccountInvoiceConfig {
  type?: string
  closing_day?: number
  due_day?: number
}

/**
 * Retorna o último dia de um determinado mês e ano.
 * Mês em base 1..12
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Calcula a data de pagamento (formato YYYY-MM-DD) a partir da data de compra e da configuração da conta.
 *
 * @param purchaseDateStr Data da compra no formato YYYY-MM-DD
 * @param account Conta ou configuração da conta
 * @returns Data de pagamento calculada YYYY-MM-DD
 */
export function calculatePaymentDate(
  purchaseDateStr: string,
  account?: AccountInvoiceConfig | null,
): string {
  if (!purchaseDateStr) {
    purchaseDateStr = new Date().toISOString().split('T')[0]
  }

  // Parse YYYY-MM-DD manualmente para evitar problemas de timezone UTC vs Local
  const parts = purchaseDateStr.split('T')[0].split('-')
  const purchaseYear = parseInt(parts[0], 10)
  const purchaseMonth = parseInt(parts[1], 10) // 1-12
  const purchaseDay = parseInt(parts[2], 10)

  if (isNaN(purchaseYear) || isNaN(purchaseMonth) || isNaN(purchaseDay)) {
    return purchaseDateStr
  }

  // Se não for conta do tipo 'credito', data de pagamento coincide com data de compra
  if (!account || account.type !== 'credito') {
    return purchaseDateStr
  }

  const closingDay =
    account.closing_day !== undefined && account.closing_day !== null && account.closing_day > 0
      ? Math.min(31, Math.max(1, Math.floor(account.closing_day)))
      : null

  const dueDay =
    account.due_day !== undefined && account.due_day !== null && account.due_day > 0
      ? Math.min(31, Math.max(1, Math.floor(account.due_day)))
      : null

  // Se não tem due_day configurado, coincide com a compra
  if (!dueDay) {
    return purchaseDateStr
  }

  // Se tem due_day mas não tem closing_day:
  // Se a compra foi após o dueDay, joga para o próximo mês; senão mesmo mês.
  // Mas se tiver closingDay (caso ideal da especificação):
  let targetYear = purchaseYear
  let targetMonth = purchaseMonth

  if (closingDay !== null) {
    if (purchaseDay >= closingDay) {
      // Compra no dia do fechamento ou posterior -> cai no vencimento do mês seguinte
      targetMonth += 1
      if (targetMonth > 12) {
        targetMonth = 1
        targetYear += 1
      }
    } else {
      // Compra anterior ao fechamento -> cai no vencimento do mesmo mês
      // targetMonth e targetYear permanecem os mesmos
    }
  } else {
    // Sem dia de fechamento: se compra >= dueDay, próximo mês; senão mesmo mês
    if (purchaseDay >= dueDay) {
      targetMonth += 1
      if (targetMonth > 12) {
        targetMonth = 1
        targetYear += 1
      }
    }
  }

  // Ajustar dia inexistente no mês alvo (ex: 31 em fev -> 28 ou 29)
  const maxDayInTargetMonth = getLastDayOfMonth(targetYear, targetMonth)
  const finalDay = Math.min(dueDay, maxDayInTargetMonth)

  const yStr = String(targetYear).padStart(4, '0')
  const mStr = String(targetMonth).padStart(2, '0')
  const dStr = String(finalDay).padStart(2, '0')

  return `${yStr}-${mStr}-${dStr}`
}
