import dayjs from 'dayjs'

// Keep settings available without loading the legacy editor for its date helpers.
export const DEFAULT_CURRENT_DATE_FORMAT = 'YYYY-MM-DD'

export function formatCurrentDate(format?: string): string {
  return dayjs().format(format?.trim() || DEFAULT_CURRENT_DATE_FORMAT)
}
