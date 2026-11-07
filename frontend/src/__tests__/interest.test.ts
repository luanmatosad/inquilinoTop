import { describe, it, expect } from 'vitest'
import { monthlyToDaily, dailyToMonthly } from '@/lib/interest'

describe('interest', () => {
  it('ida: 1% ao mês = 0,033333 ao dia', () => expect(monthlyToDaily(1)).toBe(0.033333))
  it('volta: 0,033333 ao dia = 1,00 ao mês', () => expect(dailyToMonthly(0.033333)).toBe(1))
  it('ida e volta sem deriva', () => {
    for (const m of [0.5, 1, 2.5, 3.33, 10]) expect(dailyToMonthly(monthlyToDaily(m))).toBe(m)
  })
  it('zero e vazio', () => {
    expect(monthlyToDaily(0)).toBe(0)
    expect(monthlyToDaily('')).toBe(0)
    expect(monthlyToDaily(undefined)).toBe(0)
    expect(dailyToMonthly(0)).toBe(0)
    expect(dailyToMonthly(null)).toBe(0)
  })
  it('aceita vírgula decimal', () => expect(monthlyToDaily('2,5')).toBe(0.083333))
})
