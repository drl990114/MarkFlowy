import { describe, expect, it } from 'vitest'
import { DEFAULT_CURRENT_DATE_FORMAT, formatCurrentDate } from '../date'

describe('utils/date', () => {
  it('formats dates as YYYY-MM-DD', () => {
    expect(formatCurrentDate(DEFAULT_CURRENT_DATE_FORMAT, new Date(2026, 6, 4))).toBe('2026-07-04')
  })

  it('supports custom dayjs formats', () => {
    expect(formatCurrentDate('YYYY/MM/DD HH:mm', new Date(2026, 6, 4, 9, 8))).toBe(
      '2026/07/04 09:08',
    )
  })

  it('falls back to the default format when empty', () => {
    expect(formatCurrentDate(' ', new Date(2026, 6, 4))).toBe('2026-07-04')
  })
})
