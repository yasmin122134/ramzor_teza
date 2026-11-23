import { addDays, startOfWeek, toDateKey, weekDates } from './dates.ts'
import { DEFAULT_TARGET_HOURS, weightedMix, zeroMix } from './mix.ts'
import type { DailyEntry, Light, RedFlag, WeeklySummary, WorkMix } from '../types.ts'

export const FLAG_MESSAGES = {
  padding: '⚠️ ניפוח שעות (המון שעות בלו״ז עם מעט תפוקה)',
  passive: '⚠️ מלכודת קריאה/תחזוקה (פחות מ-30% יצירה וכתיבה)',
  burnout: '⚠️ סכנת שחיקה (0 התאוששות)',
  bottleneck: '⚠️ תקיעות טכנית (כדאי להתייעץ עם המנחה)',
  writing: '⚠️ הימנעות מכתיבה (3 שבועות ללא ניסוח טקסט חדש)',
} as const

export function round1FromSum(sum: number, count: number): number {
  if (count <= 0) return 0
  return Math.round((sum * 10) / count) / 10
}

export function timeQualityScore(effectiveHours: number, badIdleHours: number): number {
  if (effectiveHours <= 0) return 0
  const cleanRatio = effectiveHours / Math.max(0.5, effectiveHours + badIdleHours)
  if (effectiveHours >= 3.5 && cleanRatio >= 0.85) return 4
  if (effectiveHours >= 2.5 && cleanRatio >= 0.7) return 3
  if (effectiveHours >= 1.5) return 2
  return 1
}

export function scheduledHours(entry: Pick<DailyEntry, 'effectiveHours' | 'qualityIdleHours' | 'badIdleHours'>): number {
  return entry.effectiveHours + entry.qualityIdleHours + entry.badIdleHours
}

export function isCompleteThesisDay(entry: DailyEntry): entry is DailyEntry & {
  outputScore: number
  balanceScore: number
} {
  return entry.isThesisDay && entry.outputScore !== null && entry.balanceScore !== null
}

export function dailyTotal(entry: DailyEntry): number | null {
  if (entry.outputScore === null || entry.balanceScore === null) return null
  return entry.outputScore + timeQualityScore(entry.effectiveHours, entry.badIdleHours) + entry.balanceScore
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

function emptySummary(targetWeeklyHours: number): WeeklySummary {
  return {
    light: 'neutral',
    average: null,
    rawAverage: null,
    penalized: false,
    thesisDaysCount: 0,
    averageBalance: null,
    averageOutput: null,
    stuckOutputCount: 0,
    scheduledHours: 0,
    effectiveHours: 0,
    qualityIdleHours: 0,
    badIdleHours: 0,
    targetWeeklyHours,
    schedulingCompletionPct: null,
    workMix: zeroMix(),
    flags: [],
  }
}

export function summarizeWeek(
  entries: DailyEntry[],
  options?: { targetWeeklyHours?: number; writingAvoidance?: boolean },
): WeeklySummary {
  const targetWeeklyHours = options?.targetWeeklyHours ?? DEFAULT_TARGET_HOURS
  const thesis = entries.filter(isCompleteThesisDay)
  if (thesis.length === 0) return emptySummary(targetWeeklyHours)

  const totalSum = thesis.reduce((sum, entry) => sum + (dailyTotal(entry) ?? 0), 0)
  const rawAverage = round1FromSum(totalSum, thesis.length)
  const balanceSum = thesis.reduce((sum, entry) => sum + entry.balanceScore, 0)
  const outputSum = thesis.reduce((sum, entry) => sum + entry.outputScore, 0)
  const averageBalance = round1FromSum(balanceSum, thesis.length)
  const averageOutputRaw = outputSum / thesis.length
  const scheduled = thesis.reduce((sum, entry) => sum + scheduledHours(entry), 0)
  const effective = thesis.reduce((sum, entry) => sum + entry.effectiveHours, 0)
  const quality = thesis.reduce((sum, entry) => sum + entry.qualityIdleHours, 0)
  const bad = thesis.reduce((sum, entry) => sum + entry.badIdleHours, 0)
  const schedulingCompletionPct = targetWeeklyHours > 0 ? (scheduled / targetWeeklyHours) * 100 : 0
  const penalized = thesis.length >= 2 && schedulingCompletionPct < 75
  const average = Math.max(0, Math.round((rawAverage - (penalized ? 0.5 : 0)) * 10) / 10)
  const mix = weightedMix(thesis.map((entry) => ({ mix: entry.workMix, weight: entry.effectiveHours })))
  const stuckOutputCount = thesis.filter((entry) => entry.outputScore === 0).length
  const flags: RedFlag[] = []

  if (schedulingCompletionPct >= 100 && averageOutputRaw < 2) {
    flags.push({ id: 'padding', message: FLAG_MESSAGES.padding })
  }
  if (thesis.length >= 3 && mix.raw.builder + mix.raw.drafting < 30) {
    flags.push({ id: 'passive', message: FLAG_MESSAGES.passive })
  }
  if (thesis.length >= 2 && thesis.every((entry) => entry.balanceScore === 0)) {
    flags.push({ id: 'burnout', message: FLAG_MESSAGES.burnout })
  }
  if (stuckOutputCount >= 2) {
    flags.push({ id: 'bottleneck', message: FLAG_MESSAGES.bottleneck })
  }
  if (options?.writingAvoidance) {
    flags.push({ id: 'writing', message: FLAG_MESSAGES.writing })
  }

  let light: Light
  if (average < 5 || flags.length > 0) light = 'red'
  else if (average >= 7.5 && schedulingCompletionPct >= 80 && flags.length === 0) light = 'green'
  else light = 'yellow'

  return {
    light,
    average,
    rawAverage,
    penalized,
    thesisDaysCount: thesis.length,
    averageBalance,
    averageOutput: round1FromSum(outputSum, thesis.length),
    stuckOutputCount,
    scheduledHours: scheduled,
    effectiveHours: effective,
    qualityIdleHours: quality,
    badIdleHours: bad,
    targetWeeklyHours,
    schedulingCompletionPct,
    workMix: mix.display,
    flags,
  }
}

export function summarizeStoredWeek(all: DailyEntry[], weekStart: Date, targetWeeklyHours = DEFAULT_TARGET_HOURS): WeeklySummary {
  const byDate = new Map(all.map((entry) => [entry.date, entry]))
  const weekEntries = weekDates(startOfWeek(weekStart)).flatMap((day) => {
    const entry = byDate.get(toDateKey(day))
    return entry ? [entry] : []
  })
  return summarizeWeek(weekEntries, {
    targetWeeklyHours,
    writingAvoidance: hasWritingAvoidance(all, weekStart),
  })
}

export function hasWritingAvoidance(all: DailyEntry[], weekStart: Date): boolean {
  const byDate = new Map(all.map((entry) => [entry.date, entry]))
  const anchor = startOfWeek(weekStart)
  const current = weekDates(anchor)
    .map((day) => byDate.get(toDateKey(day)))
    .filter((entry): entry is DailyEntry => Boolean(entry))
  if (current.filter(isCompleteThesisDay).length === 0) return false

  const drafting: number[] = []
  for (let index = 0; index < 30 && drafting.length < 3; index += 1) {
    const start = addDays(anchor, -7 * index)
    const week = weekDates(start)
      .map((day) => byDate.get(toDateKey(day)))
      .filter((entry): entry is DailyEntry => Boolean(entry))
    const thesis = week.filter(isCompleteThesisDay)
    if (thesis.length === 0) continue
    const mix = weightedMix(thesis.map((entry) => ({ mix: entry.workMix, weight: entry.effectiveHours })))
    drafting.push(mix.display.drafting)
  }
  return drafting.length >= 3 && drafting.every((value) => value === 0)
}

export function hoursFromLegacyFocus(focusScore: number): {
  effectiveHours: number
  qualityIdleHours: number
  badIdleHours: number
} {
  if (focusScore >= 4) return { effectiveHours: 4, qualityIdleHours: 0.5, badIdleHours: 0 }
  if (focusScore === 3) return { effectiveHours: 3, qualityIdleHours: 0.5, badIdleHours: 0.5 }
  if (focusScore === 2) return { effectiveHours: 2, qualityIdleHours: 0.5, badIdleHours: 0.5 }
  if (focusScore === 1) return { effectiveHours: 1, qualityIdleHours: 0, badIdleHours: 1 }
  return { effectiveHours: 0, qualityIdleHours: 0, badIdleHours: 0 }
}

export interface WorkoutHypothesis {
  workoutOutput: number | null
  workoutQuality: number | null
  workoutCount: number
  restOutput: number | null
  restQuality: number | null
  restCount: number
}

export function workoutHypothesis(entries: DailyEntry[]): WorkoutHypothesis {
  const thesis = entries.filter(isCompleteThesisDay)
  const workout = thesis.filter((entry) => entry.balanceScore === 2)
  const rest = thesis.filter((entry) => entry.balanceScore !== 2)
  const average = (list: typeof thesis, pick: (entry: (typeof thesis)[number]) => number) =>
    list.length === 0 ? null : round1FromSum(list.reduce((sum, entry) => sum + pick(entry), 0), list.length)
  return {
    workoutOutput: average(workout, (entry) => entry.outputScore),
    workoutQuality: average(workout, (entry) => timeQualityScore(entry.effectiveHours, entry.badIdleHours)),
    workoutCount: workout.length,
    restOutput: average(rest, (entry) => entry.outputScore),
    restQuality: average(rest, (entry) => timeQualityScore(entry.effectiveHours, entry.badIdleHours)),
    restCount: rest.length,
  }
}

export function overallMix(entries: DailyEntry[]): WorkMix {
  const thesis = entries.filter(isCompleteThesisDay)
  return weightedMix(thesis.map((entry) => ({ mix: entry.workMix, weight: entry.effectiveHours }))).display
}
