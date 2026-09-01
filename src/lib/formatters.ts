export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatDateBR(dateString?: string | null): string {
  if (!dateString) return '-'
  const str = String(dateString).trim()
  if (!str) return '-'

  // Clean time part if present: "2026-01-18 00:00:00.000Z" or "2026-01-18T00:00:00.000Z"
  const cleanDate = str.split(/[T\s]/)[0]
  const parts = cleanDate.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    if (year && month && day && year.length === 4) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
    }
  }

  // Check if it's already in DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0')
    const month = brMatch[2].padStart(2, '0')
    let year = brMatch[3]
    if (year.length === 2) year = '20' + year
    return `${day}/${month}/${year}`
  }

  return str
}

export function getGreeting(name?: string): string {
  const hour = new Date().getHours()
  let greeting = 'Olá'
  if (hour >= 5 && hour < 12) {
    greeting = 'Bom dia'
  } else if (hour >= 12 && hour < 18) {
    greeting = 'Boa tarde'
  } else {
    greeting = 'Boa noite'
  }
  return name ? `${greeting}, ${name.split(' ')[0]}!` : `${greeting}!`
}

export function getInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
