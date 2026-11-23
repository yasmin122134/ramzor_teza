import { isValidDateKey } from './dates.ts'
import { BALANCE_TAG_SET } from './labels.ts'
import { seedState } from './sample.ts'
import type { DailyEntry, PersistedState, WeeklyReflection, WorkType } from '../types.ts'

export const STORAGE_KEY = 'ramzor-teza-v1'

const WORK_TYPES: readonly WorkType[] = ['creative', 'research', 'maintenance']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeScore(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return null
  return value
}

export function sanitizeEntry(raw: unknown): DailyEntry | null {
  if (!isRecord(raw) || typeof raw.date !== 'string' || !isValidDateKey(raw.date)) return null
  const workType = WORK_TYPES.includes(raw.workType as WorkType) ? (raw.workType as WorkType) : null
  const tags = Array.isArray(raw.balanceTags)
    ? raw.balanceTags.filter((tag): tag is string => typeof tag === 'string' && BALANCE_TAG_SET.has(tag))
    : []
  const entry: DailyEntry = {
    date: raw.date,
    isThesisDay: raw.isThesisDay === true,
    workType,
    dailyGoal: typeof raw.dailyGoal === 'string' ? raw.dailyGoal.slice(0, 140) : '',
    outputScore: sanitizeScore(raw.outputScore, 4),
    focusScore: sanitizeScore(raw.focusScore, 4),
    balanceScore: sanitizeScore(raw.balanceScore, 2),
    balanceTags: tags,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
  }
  if (raw.isSample === true) entry.isSample = true
  return entry
}

export function sanitizeReflection(raw: unknown, fallbackId: string): WeeklyReflection | null {
  if (!isRecord(raw)) return null
  const weekId = typeof raw.weekId === 'string' && isValidDateKey(raw.weekId) ? raw.weekId : fallbackId
  if (!isValidDateKey(weekId)) return null
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 2000) : '')
  return {
    weekId,
    topAchievement: text(raw.topAchievement),
    bottleneck: text(raw.bottleneck),
    nextFirstStep: text(raw.nextFirstStep),
  }
}

export function sanitizeState(raw: unknown): PersistedState | null {
  if (!isRecord(raw)) return null

  const entries: Record<string, DailyEntry> = {}
  if (Array.isArray(raw.entries)) {
    for (const item of raw.entries) {
      const entry = sanitizeEntry(item)
      if (entry) entries[entry.date] = entry
    }
  } else if (isRecord(raw.entries)) {
    for (const value of Object.values(raw.entries)) {
      const entry = sanitizeEntry(value)
      if (entry) entries[entry.date] = entry
    }
  } else if (raw.entries !== undefined) {
    return null
  }

  if (raw.reflections !== undefined && !isRecord(raw.reflections)) return null
  const reflections: Record<string, WeeklyReflection> = {}
  if (isRecord(raw.reflections)) {
    for (const [key, value] of Object.entries(raw.reflections)) {
      const reflection = sanitizeReflection(value, key)
      if (reflection) reflections[reflection.weekId] = reflection
    }
  }

  if (Object.keys(entries).length > 4000) return null
  return { version: 1, entries, reflections }
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return seedState(new Date())
    const parsed: unknown = JSON.parse(raw)
    return sanitizeState(parsed) ?? { version: 1, entries: {}, reflections: {} }
  } catch {
    return { version: 1, entries: {}, reflections: {} }
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // A full quota or private mode should keep the session usable.
  }
}
