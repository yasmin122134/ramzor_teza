const SHORT_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']

export const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

export const FULL_DAYS = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת']

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  return toDateKey(parseDateKey(key)) === key
}

/** Sunday-start week, matching the Israeli calendar (א׳–ש׳). */
export function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() + days)
  return copy
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function recentWeekStarts(anchor: Date, count = 8): Date[] {
  const current = startOfWeek(anchor)
  return Array.from({ length: count }, (_, index) => addDays(current, (index - (count - 1)) * 7))
}

export function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const startMonth = SHORT_MONTHS[start.getMonth()] ?? ''
  const endMonth = SHORT_MONTHS[end.getMonth()] ?? ''
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ב${startMonth} ${start.getFullYear()}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ב${startMonth} – ${end.getDate()} ב${endMonth} ${end.getFullYear()}`
  }
  return `${start.getDate()} ב${startMonth} ${start.getFullYear()} – ${end.getDate()} ב${endMonth} ${end.getFullYear()}`
}

export function formatDayMonth(date: Date): string {
  const month = SHORT_MONTHS[date.getMonth()] ?? ''
  return `${date.getDate()} ב${month}`
}

export function formatChartLabel(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}`
}
