export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatDateBR(dateString: string): string {
  if (!dateString) return ''
  // Support YYYY-MM-DD or ISO string
  const cleanDate = dateString.split('T')[0]
  const [year, month, day] = cleanDate.split('-')
  if (!year || !month || !day) return dateString
  return `${day}/${month}/${year}`
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

export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}
