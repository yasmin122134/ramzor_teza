import type { DailyEntry, Light, RedFlag, WeeklySummary, WorkType } from '../types.ts'

export const FLAG_MESSAGES = {
  maintenance: '⚠️ מלכודת קריאה/תחזוקה (0 ימי יצירה)',
  burnout: '⚠️ סכנת שחיקה (0 התאוששות)',
  bottleneck: '⚠️ תקיעות טכנית (כדאי להתייעץ עם המנחה)',
} as const

export function round1FromSum(sum: number, count: number): number {
  if (count <= 0) return 0
  return Math.round((sum * 10) / count) / 10
}

export function isCompleteThesisDay(entry: DailyEntry): entry is DailyEntry & {
  workType: WorkType
  outputScore: number
  focusScore: number
  balanceScore: number
} {
  return (
    entry.isThesisDay &&
    entry.workType !== null &&
    entry.outputScore !== null &&
    entry.focusScore !== null &&
    entry.balanceScore !== null
  )
}

export function dailyTotal(
  entry: Pick<DailyEntry, 'outputScore' | 'focusScore' | 'balanceScore'>,
): number | null {
  if (entry.outputScore === null || entry.focusScore === null || entry.balanceScore === null) return null
  return entry.outputScore + entry.focusScore + entry.balanceScore
}

export function lightFromTotal(total: number): Light {
  if (total >= 8) return 'green'
  if (total <= 4) return 'red'
  return 'yellow'
}

export function dailyLight(entry: DailyEntry): Light {
  if (!entry.isThesisDay) return 'neutral'
  const total = dailyTotal(entry)
  if (total === null) return 'neutral'
  return lightFromTotal(total)
}

export function summarizeWeek(entries: DailyEntry[]): WeeklySummary {
  const thesis = entries.filter(isCompleteThesisDay)
  if (thesis.length === 0) {
    return {
      light: 'neutral',
      average: null,
      thesisDaysCount: 0,
      creativeDaysCount: 0,
      averageBalance: null,
      stuckOutputCount: 0,
      flags: [],
    }
  }

  const totalSum = thesis.reduce(
    (sum, entry) => sum + entry.outputScore + entry.focusScore + entry.balanceScore,
    0,
  )
  const balanceSum = thesis.reduce((sum, entry) => sum + entry.balanceScore, 0)
  const average = round1FromSum(totalSum, thesis.length)
  const averageBalance = round1FromSum(balanceSum, thesis.length)
  const creativeDaysCount = thesis.filter((entry) => entry.workType === 'creative').length
  const stuckOutputCount = thesis.filter((entry) => entry.outputScore === 0).length
  const flags: RedFlag[] = []

  if (thesis.length >= 3 && creativeDaysCount === 0) {
    flags.push({ id: 'maintenance', message: FLAG_MESSAGES.maintenance })
  }
  if (thesis.length >= 2 && thesis.every((entry) => entry.balanceScore === 0)) {
    flags.push({ id: 'burnout', message: FLAG_MESSAGES.burnout })
  }
  if (stuckOutputCount >= 2) {
    flags.push({ id: 'bottleneck', message: FLAG_MESSAGES.bottleneck })
  }

  let light: Light
  if (average < 5 || flags.length > 0) light = 'red'
  else if (average >= 7.5) light = 'green'
  else light = 'yellow'

  return {
    light,
    average,
    thesisDaysCount: thesis.length,
    creativeDaysCount,
    averageBalance,
    stuckOutputCount,
    flags,
  }
}

export interface WorkSlice {
  type: WorkType
  count: number
  percent: number
}

const WORK_ORDER: WorkType[] = ['creative', 'research', 'maintenance']

export function workTypeBreakdown(entries: DailyEntry[]): WorkSlice[] {
  const thesis = entries.filter(isCompleteThesisDay)
  const counts: Record<WorkType, number> = { creative: 0, research: 0, maintenance: 0 }
  for (const entry of thesis) counts[entry.workType] += 1
  const total = thesis.length
  if (total === 0) {
    return WORK_ORDER.map((type) => ({ type, count: 0, percent: 0 }))
  }

  const raw = WORK_ORDER.map((type) => {
    const exact = (counts[type] / total) * 100
    const floor = Math.floor(exact)
    return { type, count: counts[type], floor, frac: exact - floor }
  })
  let remaining = 100 - raw.reduce((sum, item) => sum + item.floor, 0)
  const ranked = [...raw].sort(
    (a, b) => b.frac - a.frac || WORK_ORDER.indexOf(a.type) - WORK_ORDER.indexOf(b.type),
  )
  const bonus = new Set<WorkType>()
  for (const item of ranked) {
    if (remaining <= 0) break
    bonus.add(item.type)
    remaining -= 1
  }
  return raw.map((item) => ({
    type: item.type,
    count: item.count,
    percent: item.floor + (bonus.has(item.type) ? 1 : 0),
  }))
}

export interface WorkoutCorrelation {
  workoutAvg: number | null
  workoutCount: number
  restAvg: number | null
  restCount: number
}

export function workoutCorrelation(entries: DailyEntry[]): WorkoutCorrelation {
  const thesis = entries.filter(isCompleteThesisDay)
  const workout = thesis.filter((entry) => entry.balanceScore === 2)
  const rest = thesis.filter((entry) => entry.balanceScore !== 2)
  const averageOutput = (list: typeof thesis) =>
    list.length === 0
      ? null
      : round1FromSum(
          list.reduce((sum, entry) => sum + entry.outputScore, 0),
          list.length,
        )

  return {
    workoutAvg: averageOutput(workout),
    workoutCount: workout.length,
    restAvg: averageOutput(rest),
    restCount: rest.length,
  }
}
