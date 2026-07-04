import dayjs from 'dayjs'

export const DEFAULT_CURRENT_DATE_FORMAT = 'YYYY-MM-DD'

export type CurrentDateFormatOption = string | (() => string | undefined)

export function resolveCurrentDateFormat(format?: CurrentDateFormatOption): string {
  const value = typeof format === 'function' ? format() : format
  return value?.trim() || DEFAULT_CURRENT_DATE_FORMAT
}

export function formatCurrentDate(
  format?: CurrentDateFormatOption,
  date = new Date(),
): string {
  return dayjs(date).format(resolveCurrentDateFormat(format))
}
