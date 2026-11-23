import { parseBackup, toCsv, toJson } from '../src/lib/backup.ts'
import { buildSampleEntries } from '../src/lib/sample.ts'
import { FLAG_MESSAGES, summarizeWeek, workTypeBreakdown, workoutCorrelation } from '../src/lib/scoring.ts'
import type { DailyEntry, WorkType } from '../src/types.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function day(partial: Partial<DailyEntry> & Pick<DailyEntry, 'date'>): DailyEntry {
  return {
    isThesisDay: true,
    workType: 'creative',
    dailyGoal: 'יעד',
    outputScore: 2,
    focusScore: 2,
    balanceScore: 1,
    balanceTags: [],
    notes: '',
    ...partial,
  }
}

const today = new Date(2026, 10, 24)
assert(today.getDay() === 2, '24 Nov 2026 is a Tuesday')
const samples = buildSampleEntries(today)
const sampleKeys = Object.keys(samples).sort()
assert(sampleKeys.join() === '2026-11-22,2026-11-23,2026-11-24', `sample dates ${sampleKeys.join()}`)
assert(Object.values(samples).every((entry) => entry.isSample), 'samples are marked')

const sampleSummary = summarizeWeek(Object.values(samples))
assert(sampleSummary.average === 5.3, `sample average ${sampleSummary.average}`)
assert(sampleSummary.light === 'yellow', `sample light ${sampleSummary.light}`)
assert(sampleSummary.flags.length === 0, 'sample week has no flags')
assert(sampleSummary.thesisDaysCount === 3, 'three thesis days')
assert(sampleSummary.creativeDaysCount === 1, 'one creative day')

const neutral = summarizeWeek([
  day({ date: '2026-11-22', isThesisDay: false, outputScore: 0, balanceScore: 0 }),
])
assert(neutral.light === 'neutral' && neutral.average === null, 'non-thesis week is neutral')

const green = summarizeWeek([
  day({ date: '2026-11-22', outputScore: 4, focusScore: 4, balanceScore: 2 }),
  day({ date: '2026-11-23', outputScore: 3, focusScore: 3, balanceScore: 2 }),
])
assert(green.average === 9 && green.light === 'green' && green.flags.length === 0, 'clean green week')

const exactGreen = summarizeWeek([
  day({ date: '2026-11-22', outputScore: 4, focusScore: 3, balanceScore: 0 }),
  day({ date: '2026-11-23', outputScore: 4, focusScore: 4, balanceScore: 0 }),
])
assert(exactGreen.average === 7.5, `7.5 average got ${exactGreen.average}`)
assert(exactGreen.light === 'red', 'balance 0 on two days is burnout, so red')
assert(exactGreen.flags.some((flag) => flag.message === FLAG_MESSAGES.burnout), 'burnout flag text')

const yellowFloor = summarizeWeek([day({ date: '2026-11-22', outputScore: 2, focusScore: 2, balanceScore: 1 })])
assert(yellowFloor.average === 5 && yellowFloor.light === 'yellow', '5.0 stays yellow')

const low = summarizeWeek([
  day({ date: '2026-11-22', outputScore: 2, focusScore: 2, balanceScore: 1 }),
  day({ date: '2026-11-23', outputScore: 2, focusScore: 2, balanceScore: 1 }),
  day({ date: '2026-11-24', outputScore: 1, focusScore: 2, balanceScore: 1 }),
])
assert(low.average === 4.7 && low.light === 'red' && low.flags.length === 0, `low week ${low.average} ${low.light}`)

const maintenance = summarizeWeek([
  day({ date: '2026-11-22', workType: 'maintenance', outputScore: 4, focusScore: 4, balanceScore: 2 }),
  day({ date: '2026-11-23', workType: 'research', outputScore: 4, focusScore: 4, balanceScore: 2 }),
  day({ date: '2026-11-24', workType: 'maintenance', outputScore: 4, focusScore: 4, balanceScore: 2 }),
])
assert(maintenance.average === 10 && maintenance.light === 'red', 'high average still red with a flag')
assert(maintenance.flags[0]?.message === FLAG_MESSAGES.maintenance, 'maintenance flag text')

const bottleneck = summarizeWeek([
  day({ date: '2026-11-22', outputScore: 0, focusScore: 4, balanceScore: 2 }),
  day({ date: '2026-11-23', outputScore: 0, focusScore: 4, balanceScore: 2 }),
  day({ date: '2026-11-24', isThesisDay: false, outputScore: 0, workType: 'maintenance' }),
])
assert(bottleneck.stuckOutputCount === 2, 'non-thesis zero does not count')
assert(bottleneck.flags.some((flag) => flag.message === FLAG_MESSAGES.bottleneck), 'bottleneck flag text')
assert(bottleneck.light === 'red', 'bottleneck forces red')

const slices = workTypeBreakdown(Object.values(samples))
assert(slices.reduce((sum, slice) => sum + slice.percent, 0) === 100, 'percents sum to 100')
assert(slices.every((slice) => slice.count === 1), 'one day of each work type')

const correlation = workoutCorrelation(Object.values(samples))
assert(correlation.workoutAvg === 4 && correlation.workoutCount === 1, 'workout output')
assert(correlation.restAvg === 1.5 && correlation.restCount === 2, 'rest output')

const state = {
  version: 1 as const,
  entries: {
    '2026-11-22': day({
      date: '2026-11-22',
      dailyGoal: 'יעד, עם פסיק',
      notes: 'שורה אחת, עם "ציטוט"\nושורה שנייה',
      balanceTags: ['ריצה', 'שינה טובה'],
      isSample: true,
      workType: 'research' satisfies WorkType,
    }),
  },
  reflections: {
    '2026-11-22': {
      weekId: '2026-11-22',
      topAchievement: 'פסקה',
      bottleneck: 'נתקעתי, כי חסר נתון',
      nextFirstStep: 'לכתוב פתיחה',
    },
  },
}

const csv = parseBackup(toCsv(state))
assert(csv.ok, csv.ok ? '' : csv.error)
if (csv.ok) {
  const restored = csv.state.entries['2026-11-22']
  assert(restored?.notes.includes('\n'), 'csv keeps newlines')
  assert(restored?.notes.includes('"ציטוט"'), 'csv keeps quotes')
  assert(restored?.dailyGoal === 'יעד, עם פסיק', 'csv keeps commas')
  assert(restored?.balanceTags.join('|') === 'ריצה|שינה טובה', 'csv keeps tags')
  assert(restored?.isSample === true, 'csv keeps sample flag')
  assert(csv.state.reflections['2026-11-22']?.bottleneck === 'נתקעתי, כי חסר נתון', 'csv keeps reflection')
}

const json = parseBackup(toJson(state))
assert(json.ok && json.state.entries['2026-11-22']?.workType === 'research', 'json roundtrip')

console.log('scoring and backup checks passed')
