import { describe, it, expect } from 'vitest'
import { getTodayLocalDateStr, isFutureDate, resolvePaidStatus } from './formatters'

describe('payment date and paid status resolution', () => {
  it('getTodayLocalDateStr returns current date as YYYY-MM-DD', () => {
    const today = getTodayLocalDateStr()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const now = new Date()
    const expectedYear = String(now.getFullYear())
    expect(today.startsWith(expectedYear)).toBe(true)
  })

  it('isFutureDate correctly detects future, today, and past dates', () => {
    const today = getTodayLocalDateStr()
    const [y, m, d] = today.split('-').map(Number)

    // Past date (yesterday)
    const yesterdayDate = new Date(y, m - 1, d - 1)
    const pastStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`

    // Future date (tomorrow)
    const tomorrowDate = new Date(y, m - 1, d + 1)
    const futureStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

    // Far future date
    const farFutureStr = `${y + 1}-01-15`

    expect(isFutureDate(today)).toBe(false)
    expect(isFutureDate(pastStr)).toBe(false)
    expect(isFutureDate(futureStr)).toBe(true)
    expect(isFutureDate(farFutureStr)).toBe(true)

    // Accepting timestamps as well
    expect(isFutureDate(`${futureStr}T15:30:00.000Z`)).toBe(true)
    expect(isFutureDate(`${pastStr} 00:00:00`)).toBe(false)
    expect(isFutureDate(`${today}T23:59:59`)).toBe(false)
    expect(isFutureDate('')).toBe(false)
    expect(isFutureDate(null)).toBe(false)
  })

  it('data futura -> paid false mesmo desejando true', () => {
    const today = getTodayLocalDateStr()
    const [y, m, d] = today.split('-').map(Number)
    const tomorrowDate = new Date(y, m - 1, d + 1)
    const futureStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

    expect(resolvePaidStatus(futureStr, true)).toBe(false)
    expect(resolvePaidStatus(futureStr, false)).toBe(false)
    expect(resolvePaidStatus(`${y + 2}-05-20`, true)).toBe(false)
  })

  it('data de hoje -> respeita o toggle desejado', () => {
    const today = getTodayLocalDateStr()

    expect(resolvePaidStatus(today, true)).toBe(true)
    expect(resolvePaidStatus(today, false)).toBe(false)
    expect(resolvePaidStatus(`${today}T00:00:00.000Z`, true)).toBe(true)
    expect(resolvePaidStatus(`${today}T00:00:00.000Z`, false)).toBe(false)
  })

  it('data passada -> respeita o toggle desejado', () => {
    const today = getTodayLocalDateStr()
    const [y, m, d] = today.split('-').map(Number)
    const yesterdayDate = new Date(y, m - 1, d - 1)
    const pastStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`

    expect(resolvePaidStatus(pastStr, true)).toBe(true)
    expect(resolvePaidStatus(pastStr, false)).toBe(false)
    expect(resolvePaidStatus('2020-01-01', true)).toBe(true)
    expect(resolvePaidStatus('2020-01-01', false)).toBe(false)
  })
})
