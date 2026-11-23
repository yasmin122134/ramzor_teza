import { sanitizeState } from './storage.ts'
import type { DailyEntry, PersistedState, WeeklyReflection } from '../types.ts'

const HEADERS = [
  'type',
  'date',
  'weekId',
  'isThesisDay',
  'workType',
  'dailyGoal',
  'outputScore',
  'focusScore',
  'balanceScore',
  'balanceTags',
  'notes',
  'topAchievement',
  'bottleneck',
  'nextFirstStep',
  'isSample',
] as const

export type BackupResult = { ok: true; state: PersistedState } | { ok: false; error: string }

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`
  return value
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  return escapeCell(String(value))
}

function hasReflectionText(reflection: WeeklyReflection): boolean {
  return Boolean(reflection.topAchievement || reflection.bottleneck || reflection.nextFirstStep)
}

function entryRow(entry: DailyEntry): string {
  return [
    cell('entry'),
    cell(entry.date),
    cell(''),
    cell(entry.isThesisDay ? 'true' : 'false'),
    cell(entry.workType ?? ''),
    cell(entry.dailyGoal),
    cell(entry.outputScore ?? ''),
    cell(entry.focusScore ?? ''),
    cell(entry.balanceScore ?? ''),
    cell(entry.balanceTags.join('|')),
    cell(entry.notes),
    cell(''),
    cell(''),
    cell(''),
    cell(entry.isSample ? 'true' : 'false'),
  ].join(',')
}

function reflectionRow(reflection: WeeklyReflection): string {
  return [
    cell('reflection'),
    cell(''),
    cell(reflection.weekId),
    cell(''),
    cell(''),
    cell(''),
    cell(''),
    cell(''),
    cell(''),
    cell(''),
    cell(''),
    cell(reflection.topAchievement),
    cell(reflection.bottleneck),
    cell(reflection.nextFirstStep),
    cell(''),
  ].join(',')
}

export function toCsv(state: PersistedState): string {
  const lines = [HEADERS.join(',')]
  for (const date of Object.keys(state.entries).sort()) {
    const entry = state.entries[date]
    if (entry) lines.push(entryRow(entry))
  }
  for (const weekId of Object.keys(state.reflections).sort()) {
    const reflection = state.reflections[weekId]
    if (reflection && hasReflectionText(reflection)) lines.push(reflectionRow(reflection))
  }
  return `\uFEFF${lines.join('\n')}\n`
}

export function toJson(state: PersistedState): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
      reflections: state.reflections,
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
  let row: string[] = []
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
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else if (char !== '\r') {
      field += char ?? ''
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
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
  const reflections: Record<string, WeeklyReflection> = {}
  for (const cells of rows.slice(1)) {
    const type = pick(cells, 'type').trim()
    if (type === 'entry') {
      entries.push({
        date: pick(cells, 'date').trim(),
        isThesisDay: pick(cells, 'isThesisDay').trim() === 'true',
        workType: pick(cells, 'workType').trim() || null,
        dailyGoal: pick(cells, 'dailyGoal'),
        outputScore: parseNumber(pick(cells, 'outputScore')),
        focusScore: parseNumber(pick(cells, 'focusScore')),
        balanceScore: parseNumber(pick(cells, 'balanceScore')),
        balanceTags: pick(cells, 'balanceTags')
          .split('|')
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: pick(cells, 'notes'),
        isSample: pick(cells, 'isSample').trim() === 'true',
      })
    } else if (type === 'reflection') {
      const weekId = pick(cells, 'weekId').trim()
      reflections[weekId] = {
        weekId,
        topAchievement: pick(cells, 'topAchievement'),
        bottleneck: pick(cells, 'bottleneck'),
        nextFirstStep: pick(cells, 'nextFirstStep'),
      }
    }
  }

  const state = sanitizeState({ version: 1, entries, reflections })
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
