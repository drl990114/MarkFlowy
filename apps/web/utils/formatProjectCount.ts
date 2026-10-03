/** Show conservative milestones rather than implying rounded-up totals. */
export function formatProjectCount(value: number, locale: string): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (value < 10) return number.format(value)

  const step = 10 ** Math.max(1, String(value).length - 2)
  const rounded = Math.floor(value / step) * step
  const cjk = /^(zh|ja)(-|$)/i.test(locale)
  const units: [number, string][] = cjk
    ? [
        [1e8, locale.startsWith('ja') ? '億' : '亿'],
        [1e4, '万'],
        [1e3, 'k'],
      ]
    : [
        [1e9, 'B'],
        [1e6, 'M'],
        [1e3, 'k'],
      ]
  const [divisor, suffix] = units.find(([threshold]) => rounded >= threshold) || [1, '']
  return `${number.format(rounded / divisor)}${suffix}+`
}
