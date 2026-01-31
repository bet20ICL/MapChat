import { format, parseISO, isWithinInterval, isValid } from 'date-fns'

export function formatDate(isoString: string, formatStr: string = 'MMM d, yyyy'): string {
  try {
    const date = parseISO(isoString)
    if (!isValid(date)) return isoString
    return format(date, formatStr)
  } catch {
    return isoString
  }
}

export function isDateInRange(
  dateStr: string | undefined,
  startStr: string | null,
  endStr: string | null,
): boolean {
  if (!dateStr) return true
  if (!startStr || !endStr) return true

  try {
    const date = parseISO(dateStr)
    const start = parseISO(startStr)
    const end = parseISO(endStr)

    if (!isValid(date) || !isValid(start) || !isValid(end)) return true

    return isWithinInterval(date, { start, end })
  } catch {
    return true
  }
}

export function getDateRange(dates: (string | undefined)[]): { min: string; max: string } | null {
  const validDates = dates
    .filter((d): d is string => !!d)
    .map((d) => parseISO(d))
    .filter((d) => isValid(d))
    .sort((a, b) => a.getTime() - b.getTime())

  if (validDates.length === 0) return null

  return {
    min: validDates[0].toISOString(),
    max: validDates[validDates.length - 1].toISOString(),
  }
}
