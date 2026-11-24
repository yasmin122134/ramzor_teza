import { DEFAULT_TARGET_HOURS, WORK_ORDER } from './mix.ts'
import { sanitizeState } from './storage.ts'
import type { DailyEntry, PersistedState, WeekRecord } from '../types.ts'

const HEADERS = [
  'type',
  'date',
  'weekId',
  'isThesisDay',
  'workType',
  'builder',
  'drafting',
  'research',
  'maintenance',
  'dailyGoal',
  'outputScore',
  'focusScore',
  'effectiveHours',
  'qualityIdleHours',
  'badIdleHours',
  'balanceScore',
  'balanceTags',
  'notes',
  'nextStepBreadcrumb',
  'workLocation',
  'socialContext',
  'sleepHours',
  'topAchievement',
  'bottleneck',
  'nextFirstStep',
  'targetWeeklyHours',
  'isSample',
] as const

type Header = (typeof HEADERS)[number]

export type BackupResult = { ok: true; state: PersistedState } | { ok: false; error: string }

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  return escapeCell(String(value))
}

function row(values: Partial<Record<Header, string | number | boolean | null>>): string {
  return HEADERS.map((key) => cell(values[key])).join(',')
}

function dominantType(entry: DailyEntry): string {
  return WORK_ORDER.reduce((best, type) => (entry.workMix[type] > entry.workMix[best] ? type : best))
}

function hasWeekContent(week: WeekRecord): boolean {
  return (
    week.targetWeeklyHours !== DEFAULT_TARGET_HOURS ||
    Boolean(week.topAchievement || week.bottleneck || week.nextFirstStep)
  )
}

export function toCsv(state: PersistedState): string {
  const lines = [HEADERS.join(',')]
  for (const date of Object.keys(state.entries).sort()) {
    const entry = state.entries[date]
    if (!entry) continue
    lines.push(
      row({
        type: 'entry',
        date: entry.date,
        isThesisDay: entry.isThesisDay ? 'true' : 'false',
        workType: dominantType(entry),
        builder: entry.workMix.builder,
        drafting: entry.workMix.drafting,
        research: entry.workMix.research,
        maintenance: entry.workMix.maintenance,
        dailyGoal: entry.dailyGoal,
        outputScore: entry.outputScore,
        effectiveHours: entry.effectiveHours,
        qualityIdleHours: entry.qualityIdleHours,
        badIdleHours: entry.badIdleHours,
        balanceScore: entry.balanceScore,
        balanceTags: entry.balanceTags.join('|'),
        notes: entry.notes,
        nextStepBreadcrumb: entry.nextStepBreadcrumb,
        workLocation: entry.workLocation,
        socialContext: entry.socialContext,
        sleepHours: entry.sleepHours,
        isSample: entry.isSample ? 'true' : 'false',
      }),
    )
  }
  for (const weekId of Object.keys(state.weeks).sort()) {
    const week = state.weeks[weekId]
    if (!week || !hasWeekContent(week)) continue
    lines.push(
      row({
        type: 'week',
        weekId: week.weekId,
        topAchievement: week.topAchievement,
        bottleneck: week.bottleneck,
        nextFirstStep: week.nextFirstStep,
        targetWeeklyHours: week.targetWeeklyHours,
      }),
    )
  }
  return `\uFEFF${lines.join('\n')}\n`
}

export function toJson(state: PersistedState): string {
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
      weeks: state.weeks,
    },
    null,
    2,
  )
}

export function backupFilename(extension: 'json' | 'csv', today = new Date()): string {
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `ramzor-teza-${year}-${month}-${day}.${extension}`
}

export function downloadText(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let rowCells: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char ?? ''
      }
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ',') {
      rowCells.push(field)
      field = ''
    } else if (char === '\n') {
      rowCells.push(field)
      field = ''
      rows.push(rowCells)
      rowCells = []
    } else if (char !== '\r') {
      field += char ?? ''
    }
  }

  if (field.length > 0 || rowCells.length > 0) {
    rowCells.push(field)
    rows.push(rowCells)
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseScore(value: string): number | null {
  const parsed = parseNumber(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

function parseCsvBackup(text: string): BackupResult {
  const rows = parseCsv(text)
  const header = rows[0]
  if (!header) return { ok: false, error: 'קובץ ה־CSV חסר כותרת.' }
  const index = new Map(header.map((name, position) => [name.trim(), position]))
  if (!index.has('type') || !index.has('date')) {
    return { ok: false, error: 'קובץ ה־CSV לא תואם לייצוא של רמזור תזה.' }
  }

  const pick = (cells: string[], name: string) => {
    const position = index.get(name)
    if (position === undefined) return ''
    return cells[position] ?? ''
  }

  const entries = []
  const weeks: Record<string, WeekRecord> = {}
  for (const cells of rows.slice(1)) {
    const type = pick(cells, 'type').trim()
    if (type === 'entry') {
      const builder = parseNumber(pick(cells, 'builder'))
      const drafting = parseNumber(pick(cells, 'drafting'))
      const research = parseNumber(pick(cells, 'research'))
      const maintenance = parseNumber(pick(cells, 'maintenance'))
      const hasMix = [builder, drafting, research, maintenance].some((value) => value !== null)
      entries.push({
        date: pick(cells, 'date').trim(),
        isThesisDay: pick(cells, 'isThesisDay').trim() === 'true',
        workType: pick(cells, 'workType').trim() || null,
        workMix: hasMix
          ? {
              builder: builder ?? 0,
              drafting: drafting ?? 0,
              research: research ?? 0,
              maintenance: maintenance ?? 0,
            }
          : undefined,
        dailyGoal: pick(cells, 'dailyGoal'),
        outputScore: parseScore(pick(cells, 'outputScore')),
        focusScore: parseScore(pick(cells, 'focusScore')),
        effectiveHours: parseNumber(pick(cells, 'effectiveHours')),
        qualityIdleHours: parseNumber(pick(cells, 'qualityIdleHours')),
        badIdleHours: parseNumber(pick(cells, 'badIdleHours')),
        balanceScore: parseScore(pick(cells, 'balanceScore')),
        balanceTags: pick(cells, 'balanceTags')
          .split('|')
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: pick(cells, 'notes'),
        nextStepBreadcrumb: pick(cells, 'nextStepBreadcrumb'),
        workLocation: pick(cells, 'workLocation').trim(),
        socialContext: pick(cells, 'socialContext').trim(),
        sleepHours: parseNumber(pick(cells, 'sleepHours')),
        isSample: pick(cells, 'isSample').trim() === 'true',
      })
    } else if (type === 'week' || type === 'reflection') {
      const weekId = pick(cells, 'weekId').trim()
      weeks[weekId] = {
        weekId,
        targetWeeklyHours: parseNumber(pick(cells, 'targetWeeklyHours')) ?? DEFAULT_TARGET_HOURS,
        topAchievement: pick(cells, 'topAchievement'),
        bottleneck: pick(cells, 'bottleneck'),
        nextFirstStep: pick(cells, 'nextFirstStep'),
      }
    }
  }

  const state = sanitizeState({ version: 2, entries, weeks })
  if (!state) return { ok: false, error: 'לא הצלחנו לקרוא את נתוני ה־CSV.' }
  return { ok: true, state }
}

export function parseBackup(text: string): BackupResult {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return { ok: false, error: 'הקובץ ריק.' }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      const state = sanitizeState(parsed)
      if (!state) return { ok: false, error: 'קובץ ה־JSON לא תואם לגיבוי של רמזור תזה.' }
      return { ok: true, state }
    } catch {
      return { ok: false, error: 'קובץ ה־JSON לא תקין.' }
    }
  }
  return parseCsvBackup(trimmed)
}
