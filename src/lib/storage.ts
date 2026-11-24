import { isValidDateKey } from './dates.ts'
import {
  BALANCE_TAG_SET,
  DEFAULT_SLEEP_HOURS,
  DEFAULT_SOCIAL_CONTEXT,
  DEFAULT_WORK_LOCATION,
  LOCATIONS,
  SLEEP_MAX,
  SLEEP_MIN,
  SOCIAL_CONTEXTS,
} from './labels.ts'
import { DEFAULT_TARGET_HOURS, WORK_ORDER, mixSum, normalizeToHundred, zeroMix } from './mix.ts'
import { seedState } from './sample.ts'
import { hoursFromLegacyFocus } from './scoring.ts'
import type { DailyEntry, PersistedState, SocialContext, WeekRecord, WorkLocation, WorkMix } from '../types.ts'

export const STORAGE_KEY = 'ramzor-teza-v1'
const ACCOUNT_FLAG = 'ramzor-teza-account'

export function hasAccount(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_FLAG) === '1'
  } catch {
    return false
  }
}

export function rememberAccount(): void {
  try {
    localStorage.setItem(ACCOUNT_FLAG, '1')
  } catch {
    // The journal can still sync during this visit.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeScore(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return null
  return value
}

function sanitizeHours(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const snapped = Math.round(value * 2) / 2
  if (snapped < 0) return 0
  if (snapped > 16) return 16
  return snapped
}

export function sanitizeTarget(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TARGET_HOURS
  const snapped = Math.round(value * 2) / 2
  if (snapped < 1) return 1
  if (snapped > 80) return 80
  return snapped
}

function readMix(value: unknown): WorkMix | null {
  if (!isRecord(value)) return null
  const present = WORK_ORDER.some((type) => typeof value[type] === 'number' && Number.isFinite(value[type]))
  if (!present) return null
  const mix = zeroMix()
  for (const type of WORK_ORDER) {
    const amount = value[type]
    mix[type] = typeof amount === 'number' && Number.isFinite(amount) ? Math.max(0, amount) : 0
  }
  const sum = mixSum(mix)
  const exact = sum === 100 && WORK_ORDER.every((type) => mix[type] <= 100 && mix[type] % 5 === 0)
  if (exact) return mix
  if (sum <= 0) return null
  const scaled = zeroMix()
  for (const type of WORK_ORDER) scaled[type] = (mix[type] / sum) * 100
  return normalizeToHundred(scaled)
}

function mixFromRaw(raw: Record<string, unknown>): WorkMix {
  const nested = readMix(raw.workMix)
  if (nested) return nested
  const flat = readMix({
    builder: raw.builder,
    drafting: raw.drafting,
    research: raw.research,
    maintenance: raw.maintenance,
  })
  if (flat) return flat
  const legacy = typeof raw.workType === 'string' ? raw.workType : ''
  if (legacy === 'builder') return { builder: 100, drafting: 0, research: 0, maintenance: 0 }
  if (legacy === 'drafting') return { builder: 0, drafting: 100, research: 0, maintenance: 0 }
  if (legacy === 'creative') return { builder: 50, drafting: 50, research: 0, maintenance: 0 }
  if (legacy === 'research') return { builder: 0, drafting: 0, research: 100, maintenance: 0 }
  if (legacy === 'maintenance') return { builder: 0, drafting: 0, research: 0, maintenance: 100 }
  return { builder: 25, drafting: 25, research: 25, maintenance: 25 }
}

function hoursFromRaw(raw: Record<string, unknown>): Pick<DailyEntry, 'effectiveHours' | 'qualityIdleHours' | 'badIdleHours'> {
  const effective = sanitizeHours(raw.effectiveHours)
  const quality = sanitizeHours(raw.qualityIdleHours)
  const bad = sanitizeHours(raw.badIdleHours)
  if (effective !== null || quality !== null || bad !== null) {
    return {
      effectiveHours: effective ?? 0,
      qualityIdleHours: quality ?? 0,
      badIdleHours: bad ?? 0,
    }
  }
  const focus = sanitizeScore(raw.focusScore, 4)
  if (focus !== null) return hoursFromLegacyFocus(focus)
  return { effectiveHours: 0, qualityIdleHours: 0, badIdleHours: 0 }
}

function readLocation(value: unknown): WorkLocation {
  return LOCATIONS.some((item) => item.id === value) ? (value as WorkLocation) : DEFAULT_WORK_LOCATION
}

function readSocial(value: unknown): SocialContext {
  return SOCIAL_CONTEXTS.some((item) => item.id === value) ? (value as SocialContext) : DEFAULT_SOCIAL_CONTEXT
}

export function sanitizeSleep(value: unknown): number {
  const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return DEFAULT_SLEEP_HOURS
  const snapped = Math.round(numeric * 2) / 2
  if (snapped < SLEEP_MIN) return SLEEP_MIN
  if (snapped > SLEEP_MAX) return SLEEP_MAX
  return snapped
}

export function sanitizeEntry(raw: unknown): DailyEntry | null {
  if (!isRecord(raw) || typeof raw.date !== 'string' || !isValidDateKey(raw.date)) return null
  const tags = Array.isArray(raw.balanceTags)
    ? raw.balanceTags.filter((tag): tag is string => typeof tag === 'string' && BALANCE_TAG_SET.has(tag))
    : []
  const entry: DailyEntry = {
    date: raw.date,
    isThesisDay: raw.isThesisDay === true,
    workMix: mixFromRaw(raw),
    dailyGoal: typeof raw.dailyGoal === 'string' ? raw.dailyGoal.slice(0, 140) : '',
    outputScore: sanitizeScore(raw.outputScore, 4),
    ...hoursFromRaw(raw),
    balanceScore: sanitizeScore(raw.balanceScore, 2),
    balanceTags: tags,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '',
    nextStepBreadcrumb: typeof raw.nextStepBreadcrumb === 'string' ? raw.nextStepBreadcrumb.slice(0, 180) : '',
    workLocation: readLocation(raw.workLocation),
    socialContext: readSocial(raw.socialContext),
    sleepHours: sanitizeSleep(raw.sleepHours),
  }
  if (raw.isSample === true) entry.isSample = true
  return entry
}

export function emptyWeek(weekId: string): WeekRecord {
  return {
    weekId,
    targetWeeklyHours: DEFAULT_TARGET_HOURS,
    topAchievement: '',
    bottleneck: '',
    nextFirstStep: '',
  }
}

export function sanitizeWeek(raw: unknown, fallbackId: string): WeekRecord | null {
  if (!isRecord(raw)) return null
  const weekId = typeof raw.weekId === 'string' && isValidDateKey(raw.weekId) ? raw.weekId : fallbackId
  if (!isValidDateKey(weekId)) return null
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 2000) : '')
  return {
    weekId,
    targetWeeklyHours: sanitizeTarget(raw.targetWeeklyHours),
    topAchievement: text(raw.topAchievement),
    bottleneck: text(raw.bottleneck),
    nextFirstStep: text(raw.nextFirstStep),
  }
}

function keepWeek(week: WeekRecord): boolean {
  return (
    week.targetWeeklyHours !== DEFAULT_TARGET_HOURS ||
    Boolean(week.topAchievement || week.bottleneck || week.nextFirstStep)
  )
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

  if (raw.weeks !== undefined && !isRecord(raw.weeks)) return null
  if (raw.reflections !== undefined && !isRecord(raw.reflections)) return null
  const weeks: Record<string, WeekRecord> = {}
  const sources: Record<string, unknown>[] = []
  if (isRecord(raw.reflections)) sources.push(raw.reflections)
  if (isRecord(raw.weeks)) sources.push(raw.weeks)
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const week = sanitizeWeek(value, key)
      if (week && keepWeek(week)) weeks[week.weekId] = week
    }
  }

  if (Object.keys(entries).length > 4000) return null
  return { version: 2, entries, weeks }
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return hasAccount() ? { version: 2, entries: {}, weeks: {} } : seedState(new Date())
    const parsed: unknown = JSON.parse(raw)
    return sanitizeState(parsed) ?? { version: 2, entries: {}, weeks: {} }
  } catch {
    return { version: 2, entries: {}, weeks: {} }
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // A full quota or private mode should keep the session usable.
  }
}
