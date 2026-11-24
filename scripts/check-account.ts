import {
  bundleEntries,
  dirtyWork,
  emptySync,
  mergeAccount,
  rowToEntry,
  rowToWeek,
} from '../src/lib/account.ts'
import type { DailyEntry, PersistedState, WeekRecord } from '../src/types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function entry(date: string, partial: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date,
    isThesisDay: true,
    workMix: { builder: 100, drafting: 0, research: 0, maintenance: 0 },
    dailyGoal: '',
    outputScore: 4,
    effectiveHours: 1,
    qualityIdleHours: 0,
    badIdleHours: 0,
    balanceScore: 2,
    balanceTags: [],
    notes: '',
    nextStepBreadcrumb: '',
    workLocation: 'lab',
    socialContext: 'alone',
    ...partial,
  }
}

function week(weekId: string, partial: Partial<WeekRecord> = {}): WeekRecord {
  return {
    weekId,
    targetWeeklyHours: 20,
    topAchievement: '',
    bottleneck: '',
    nextFirstStep: '',
    ...partial,
  }
}

function state(entries: DailyEntry[], weeks: WeekRecord[] = []): PersistedState {
  return {
    version: 2,
    entries: Object.fromEntries(entries.map((item) => [item.date, item])),
    weeks: Object.fromEntries(weeks.map((item) => [item.weekId, item])),
  }
}

const now = '2026-11-24T12:00:00.000Z'
const earlier = '2026-11-24T08:00:00.000Z'
const later = '2026-11-24T18:00:00.000Z'
const blank = state([])

const localOnly = mergeAccount(
  state([entry('2026-11-24', { outputScore: 3, isSample: true }), entry('2026-11-23', { outputScore: 2 })]),
  blank,
  emptySync(),
  {},
  {},
  now,
)
assert(localOnly.uploadEntries.length === 1 && localOnly.uploadEntries[0]?.date === '2026-11-23', 'sample stays off the upload')
assert(localOnly.state.entries['2026-11-24'] === undefined, 'sample is left out of the account view')
assert(localOnly.state.entries['2026-11-23']?.outputScore === 2, 'real local day is kept')

const remoteWins = mergeAccount(
  state([entry('2026-11-24', { outputScore: 1 })]),
  state([entry('2026-11-24', { outputScore: 4, workLocation: 'batza' })]),
  { ...emptySync(), entries: { '2026-11-24': earlier } },
  { '2026-11-24': later },
  {},
  now,
)
assert(remoteWins.state.entries['2026-11-24']?.outputScore === 4, 'newer remote day wins')
assert(remoteWins.uploadEntries.length === 0, 'remote win is not uploaded again')
assert(remoteWins.state.entries['2026-11-24']?.workLocation === 'batza', 'remote location is kept')

const localWins = mergeAccount(
  state([entry('2026-11-24', { outputScore: 1, socialContext: 'collaborative' })]),
  state([entry('2026-11-24', { outputScore: 4 })]),
  { ...emptySync(), entries: { '2026-11-24': later }, ackedEntries: { '2026-11-24': earlier } },
  { '2026-11-24': earlier },
  {},
  now,
)
assert(localWins.state.entries['2026-11-24']?.outputScore === 1, 'newer local day wins')
assert(localWins.uploadEntries.length === 1, 'newer local day is uploaded')
assert(localWins.state.entries['2026-11-24']?.socialContext === 'collaborative', 'local company is kept')

const legacy = mergeAccount(
  state([entry('2026-11-22', { outputScore: 2 })]),
  state([entry('2026-11-22', { outputScore: 3 })]),
  emptySync(),
  { '2026-11-22': earlier },
  {},
  now,
)
assert(legacy.state.entries['2026-11-22']?.outputScore === 3 && legacy.uploadEntries.length === 0, 'unstamped local day yields to the cloud')

const removed = mergeAccount(
  blank,
  state([entry('2026-11-24')]),
  { ...emptySync(), deletedEntries: { '2026-11-24': later } },
  { '2026-11-24': earlier },
  {},
  now,
)
assert(removed.state.entries['2026-11-24'] === undefined && removed.deleteEntries.join() === '2026-11-24', 'a newer deletion removes the cloud day')

const restored = mergeAccount(
  blank,
  state([entry('2026-11-24', { outputScore: 2 })]),
  { ...emptySync(), deletedEntries: { '2026-11-24': earlier } },
  { '2026-11-24': later },
  {},
  now,
)
assert(restored.state.entries['2026-11-24']?.outputScore === 2 && restored.deleteEntries.length === 0, 'a newer cloud day survives an old deletion')

const replaced = mergeAccount(
  state([entry('2026-11-23', { isSample: true }), entry('2026-11-24', { outputScore: 2 })], [week('2026-11-22', { targetWeeklyHours: 16 })]),
  state([entry('2026-11-22')], [week('2026-11-15', { topAchievement: 'ישן' })]),
  { ...emptySync(), replaceAll: true },
  {},
  {},
  now,
)
assert(replaced.state.entries['2026-11-23'] === undefined && replaced.state.entries['2026-11-24']?.outputScore === 2, 'replace keeps the local journal')
assert(replaced.deleteEntries.join() === '2026-11-22', 'replace removes cloud days missing locally')
assert(replaced.deleteWeeks.join() === '2026-11-15', 'replace removes cloud weeks missing locally')
assert(replaced.marks.replaceAll === true, 'replace stays pending until the upload succeeds')

const dirty = dirtyWork(state([entry('2026-11-24')], [week('2026-11-22', { bottleneck: 'ניסוי' })]), {
  ...emptySync(),
  entries: { '2026-11-24': later },
  weeks: { '2026-11-22': later },
  ackedEntries: { '2026-11-24': later },
  deletedWeeks: { '2026-11-15': earlier },
})
assert(dirty.uploadEntries.length === 0, 'acked day is clean')
assert(dirty.uploadWeeks.length === 1 && dirty.deleteWeeks.join() === '2026-11-15', 'unacked week and tombstone stay dirty')

const row = rowToEntry({
  date: '2026-11-24',
  is_thesis_day: true,
  work_mix: { builder: 70, drafting: 20, research: 10, maintenance: 0 },
  daily_goal: 'תרשים',
  output_score: '4',
  effective_hours: '4.0',
  quality_idle_hours: '0.5',
  bad_idle_hours: '0',
  balance_score: null,
  balance_tags: ['swim'],
  notes: '',
  next_step_breadcrumb: 'לפתוח',
  work_location: 'lab',
  social_context: 'collaborative',
  sleep_hours: '5.5',
  updated_at: later,
})
assert(row?.effectiveHours === 4 && row.qualityIdleHours === 0.5 && row.outputScore === 4, 'numeric strings become hours and scores')
assert(row?.workLocation === 'lab' && row.socialContext === 'collaborative' && row.balanceScore === null, 'environment and empty balance survive the row')
assert(row?.sleepHours === 5.5, 'sleep survives the row')
assert(rowToEntry({ date: 'nope' }) === null, 'a bad row is dropped')

const bundled = bundleEntries([
  {
    date: '2026-11-24',
    is_thesis_day: false,
    work_mix: { builder: 0, drafting: 0, research: 0, maintenance: 100 },
    daily_goal: '',
    output_score: null,
    effective_hours: 0,
    quality_idle_hours: 0,
    bad_idle_hours: 0,
    balance_score: null,
    balance_tags: [],
    notes: '',
    next_step_breadcrumb: '',
    work_location: 'home_other',
    social_context: 'alone',
    updated_at: earlier,
  },
])
assert(bundled.entries['2026-11-24']?.isThesisDay === false && bundled.stamps['2026-11-24'] === earlier, 'bundle keeps the stamp')

const weekRow = rowToWeek({
  week_id: '2026-11-22',
  target_weekly_hours: '16.0',
  top_achievement: 'תרשים',
  bottleneck: '',
  next_first_step: '',
  updated_at: later,
})
assert(weekRow?.targetWeeklyHours === 16 && weekRow.topAchievement === 'תרשים', 'week target arrives as a number')

console.log('account merge checks passed')
