import { sanitizeEntry, sanitizeWeek } from './storage.ts'
import type { DailyEntry, PersistedState, WeekRecord, WorkMix } from '../types.ts'

const SYNC_KEY = 'ramzor-teza-sync'

export interface SyncMarks {
  entries: Record<string, string>
  weeks: Record<string, string>
  ackedEntries: Record<string, string>
  ackedWeeks: Record<string, string>
  deletedEntries: Record<string, string>
  deletedWeeks: Record<string, string>
  replaceAll: boolean
}

export interface EntryRow {
  user_id: string
  date: string
  is_thesis_day: boolean
  work_mix: WorkMix
  daily_goal: string
  output_score: number | null
  effective_hours: number
  quality_idle_hours: number
  bad_idle_hours: number
  balance_score: number | null
  balance_tags: string[]
  notes: string
  next_step_breadcrumb: string
  work_location: string
  social_context: string
  sleep_hours: number
  updated_at: string
}

export interface WeekRow {
  user_id: string
  week_id: string
  target_weekly_hours: number
  top_achievement: string
  bottleneck: string
  next_first_step: string
  updated_at: string
}

export interface MergeResult {
  state: PersistedState
  marks: SyncMarks
  uploadEntries: DailyEntry[]
  uploadWeeks: WeekRecord[]
  deleteEntries: string[]
  deleteWeeks: string[]
}

export function emptySync(): SyncMarks {
  return {
    entries: {},
    weeks: {},
    ackedEntries: {},
    ackedWeeks: {},
    deletedEntries: {},
    deletedWeeks: {},
    replaceAll: false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const map: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && key.length > 0 && key.length < 40) map[key] = item
  }
  return map
}

export function loadSync(): SyncMarks {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    if (!raw) return emptySync()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return emptySync()
    return {
      entries: stringMap(parsed.entries),
      weeks: stringMap(parsed.weeks),
      ackedEntries: stringMap(parsed.ackedEntries),
      ackedWeeks: stringMap(parsed.ackedWeeks),
      deletedEntries: stringMap(parsed.deletedEntries),
      deletedWeeks: stringMap(parsed.deletedWeeks),
      replaceAll: parsed.replaceAll === true,
    }
  } catch {
    return emptySync()
  }
}

export function saveSync(marks: SyncMarks): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(marks))
  } catch {
    // The journal itself is still stored separately.
  }
}

export function withoutSamples(state: PersistedState): PersistedState {
  const entries: Record<string, DailyEntry> = {}
  for (const [date, entry] of Object.entries(state.entries)) {
    if (!entry.isSample) entries[date] = entry
  }
  return { version: 2, entries, weeks: state.weeks }
}

export function withStamps(state: PersistedState, marks: SyncMarks, now: string): SyncMarks {
  const cleaned = withoutSamples(state)
  const entries = { ...marks.entries }
  const weeks = { ...marks.weeks }
  let changed = false
  for (const date of Object.keys(cleaned.entries)) {
    if (!entries[date]) {
      entries[date] = now
      changed = true
    }
  }
  for (const weekId of Object.keys(cleaned.weeks)) {
    if (!weeks[weekId]) {
      weeks[weekId] = now
      changed = true
    }
  }
  if (!changed) return marks
  return { ...marks, entries, weeks }
}

function stampTime(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function newer(localStamp: string | undefined, remoteStamp: string | undefined): boolean {
  return stampTime(localStamp) > stampTime(remoteStamp)
}

function asNumber(value: unknown, fallback: number | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function entryToRow(userId: string, entry: DailyEntry, updatedAt: string): EntryRow {
  return {
    user_id: userId,
    date: entry.date,
    is_thesis_day: entry.isThesisDay,
    work_mix: entry.workMix,
    daily_goal: entry.dailyGoal,
    output_score: entry.outputScore,
    effective_hours: entry.effectiveHours,
    quality_idle_hours: entry.qualityIdleHours,
    bad_idle_hours: entry.badIdleHours,
    balance_score: entry.balanceScore,
    balance_tags: entry.balanceTags,
    notes: entry.notes,
    next_step_breadcrumb: entry.nextStepBreadcrumb,
    work_location: entry.workLocation,
    social_context: entry.socialContext,
    sleep_hours: entry.sleepHours,
    updated_at: updatedAt,
  }
}

export function weekToRow(userId: string, week: WeekRecord, updatedAt: string): WeekRow {
  return {
    user_id: userId,
    week_id: week.weekId,
    target_weekly_hours: week.targetWeeklyHours,
    top_achievement: week.topAchievement,
    bottleneck: week.bottleneck,
    next_first_step: week.nextFirstStep,
    updated_at: updatedAt,
  }
}

export function rowToEntry(raw: unknown): DailyEntry | null {
  if (!isRecord(raw)) return null
  let mix: unknown = raw.work_mix
  if (typeof mix === 'string') {
    try {
      mix = JSON.parse(mix) as unknown
    } catch {
      mix = null
    }
  }
  const date = typeof raw.date === 'string' ? raw.date.slice(0, 10) : ''
  return sanitizeEntry({
    date,
    isThesisDay: raw.is_thesis_day === true,
    workMix: mix,
    dailyGoal: raw.daily_goal,
    outputScore: asNumber(raw.output_score, null),
    effectiveHours: asNumber(raw.effective_hours, 0),
    qualityIdleHours: asNumber(raw.quality_idle_hours, 0),
    badIdleHours: asNumber(raw.bad_idle_hours, 0),
    balanceScore: asNumber(raw.balance_score, null),
    balanceTags: raw.balance_tags,
    notes: raw.notes,
    nextStepBreadcrumb: raw.next_step_breadcrumb,
    workLocation: raw.work_location,
    socialContext: raw.social_context,
    sleepHours: raw.sleep_hours,
  })
}

export function rowToWeek(raw: unknown): WeekRecord | null {
  if (!isRecord(raw) || typeof raw.week_id !== 'string') return null
  const weekId = raw.week_id.slice(0, 10)
  return sanitizeWeek(
    {
      weekId,
      targetWeeklyHours: asNumber(raw.target_weekly_hours, null),
      topAchievement: raw.top_achievement,
      bottleneck: raw.bottleneck,
      nextFirstStep: raw.next_first_step,
    },
    weekId,
  )
}

export function bundleEntries(rows: unknown[]): { entries: Record<string, DailyEntry>; stamps: Record<string, string> } {
  const entries: Record<string, DailyEntry> = {}
  const stamps: Record<string, string> = {}
  for (const row of rows) {
    const entry = rowToEntry(row)
    if (!entry) continue
    entries[entry.date] = entry
    if (isRecord(row) && typeof row.updated_at === 'string') stamps[entry.date] = row.updated_at
  }
  return { entries, stamps }
}

export function bundleWeeks(rows: unknown[]): { weeks: Record<string, WeekRecord>; stamps: Record<string, string> } {
  const weeks: Record<string, WeekRecord> = {}
  const stamps: Record<string, string> = {}
  for (const row of rows) {
    const week = rowToWeek(row)
    if (!week) continue
    weeks[week.weekId] = week
    if (isRecord(row) && typeof row.updated_at === 'string') stamps[week.weekId] = row.updated_at
  }
  return { weeks, stamps }
}

function cloneMarks(marks: SyncMarks): SyncMarks {
  return {
    entries: { ...marks.entries },
    weeks: { ...marks.weeks },
    ackedEntries: { ...marks.ackedEntries },
    ackedWeeks: { ...marks.ackedWeeks },
    deletedEntries: { ...marks.deletedEntries },
    deletedWeeks: { ...marks.deletedWeeks },
    replaceAll: marks.replaceAll,
  }
}

export function mergeAccount(
  local: PersistedState,
  remote: PersistedState,
  marks: SyncMarks,
  remoteEntryStamps: Record<string, string>,
  remoteWeekStamps: Record<string, string>,
  now: string,
): MergeResult {
  if (marks.replaceAll) {
    const state = withoutSamples(local)
    const next = cloneMarks(marks)
    for (const date of Object.keys(state.entries)) if (!next.entries[date]) next.entries[date] = now
    for (const weekId of Object.keys(state.weeks)) if (!next.weeks[weekId]) next.weeks[weekId] = now
    return {
      state,
      marks: next,
      uploadEntries: Object.values(state.entries).filter((entry) => next.entries[entry.date] !== next.ackedEntries[entry.date]),
      uploadWeeks: Object.values(state.weeks).filter((week) => next.weeks[week.weekId] !== next.ackedWeeks[week.weekId]),
      deleteEntries: Object.keys(remote.entries).filter((date) => !state.entries[date]),
      deleteWeeks: Object.keys(remote.weeks).filter((weekId) => !state.weeks[weekId]),
    }
  }

  const next = cloneMarks(marks)
  const entries: Record<string, DailyEntry> = {}
  const weeks: Record<string, WeekRecord> = {}
  const uploadEntries: DailyEntry[] = []
  const uploadWeeks: WeekRecord[] = []
  const deleteEntries: string[] = []
  const deleteWeeks: string[] = []
  const blockedEntries = new Set<string>()
  const blockedWeeks = new Set<string>()

  for (const [date, deletedAt] of Object.entries(marks.deletedEntries)) {
    if (!remote.entries[date]) {
      delete next.deletedEntries[date]
      continue
    }
    if (!newer(deletedAt, remoteEntryStamps[date])) {
      delete next.deletedEntries[date]
      continue
    }
    blockedEntries.add(date)
    delete next.entries[date]
    delete next.ackedEntries[date]
    deleteEntries.push(date)
  }

  for (const [weekId, deletedAt] of Object.entries(marks.deletedWeeks)) {
    if (!remote.weeks[weekId]) {
      delete next.deletedWeeks[weekId]
      continue
    }
    if (!newer(deletedAt, remoteWeekStamps[weekId])) {
      delete next.deletedWeeks[weekId]
      continue
    }
    blockedWeeks.add(weekId)
    delete next.weeks[weekId]
    delete next.ackedWeeks[weekId]
    deleteWeeks.push(weekId)
  }

  for (const [date, entry] of Object.entries(remote.entries)) {
    if (blockedEntries.has(date)) continue
    entries[date] = entry
    const stamp = remoteEntryStamps[date] || next.entries[date] || now
    next.entries[date] = stamp
    next.ackedEntries[date] = stamp
  }

  for (const [weekId, week] of Object.entries(remote.weeks)) {
    if (blockedWeeks.has(weekId)) continue
    weeks[weekId] = week
    const stamp = remoteWeekStamps[weekId] || next.weeks[weekId] || now
    next.weeks[weekId] = stamp
    next.ackedWeeks[weekId] = stamp
  }

  for (const entry of Object.values(local.entries)) {
    if (entry.isSample || blockedEntries.has(entry.date)) continue
    const localStamp = marks.entries[entry.date]
    const remoteStamp = remoteEntryStamps[entry.date]
    if (!remote.entries[entry.date] || newer(localStamp, remoteStamp)) {
      const stamp = localStamp || now
      entries[entry.date] = entry
      next.entries[entry.date] = stamp
      if (next.ackedEntries[entry.date] !== stamp) uploadEntries.push(entry)
    }
  }

  for (const week of Object.values(local.weeks)) {
    if (blockedWeeks.has(week.weekId)) continue
    const localStamp = marks.weeks[week.weekId]
    const remoteStamp = remoteWeekStamps[week.weekId]
    if (!remote.weeks[week.weekId] || newer(localStamp, remoteStamp)) {
      const stamp = localStamp || now
      weeks[week.weekId] = week
      next.weeks[week.weekId] = stamp
      if (next.ackedWeeks[week.weekId] !== stamp) uploadWeeks.push(week)
    }
  }

  return {
    state: { version: 2, entries, weeks },
    marks: next,
    uploadEntries,
    uploadWeeks,
    deleteEntries,
    deleteWeeks,
  }
}

export function dirtyWork(state: PersistedState, marks: SyncMarks): MergeResult {
  const cleaned = withoutSamples(state)
  return {
    state: cleaned,
    marks,
    uploadEntries: Object.values(cleaned.entries).filter((entry) => marks.entries[entry.date] !== marks.ackedEntries[entry.date]),
    uploadWeeks: Object.values(cleaned.weeks).filter((week) => marks.weeks[week.weekId] !== marks.ackedWeeks[week.weekId]),
    deleteEntries: Object.keys(marks.deletedEntries),
    deleteWeeks: Object.keys(marks.deletedWeeks),
  }
}
