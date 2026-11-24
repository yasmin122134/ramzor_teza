import { addDays, startOfWeek, toDateKey, weekDates } from './dates.ts'
import { DEFAULT_TARGET_HOURS, weightedMix, zeroMix } from './mix.ts'
import type { DailyEntry, Light, RedFlag, SocialContext, WeeklySummary, WorkLocation, WorkMix } from '../types.ts'

export const FLAG_MESSAGES = {
  padding: '⚠️ ניפוח שעות (המון שעות בלו״ז עם מעט תפוקה)',
  passive: '⚠️ מלכודת קריאה/תחזוקה (פחות מ-30% יצירה וכתיבה)',
  burnout: '⚠️ סכנת שחיקה (0 התאוששות)',
  bottleneck: '⚠️ תקיעות טכנית (כדאי להתייעץ עם המנחה)',
  writing: '⚠️ הימנעות מכתיבה (3 שבועות ללא ניסוח טקסט חדש)',
  sleep: '⚠️ חוב שינה מצטבר (3+ ימים עם פחות מ-6 שעות שינה)',
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
  if (thesis.filter((entry) => entry.sleepHours < 6).length >= 3) {
    flags.push({ id: 'sleep', message: FLAG_MESSAGES.sleep })
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

export function cleanEfficiencyRatio(effectiveHours: number, badIdleHours: number): number | null {
  const denominator = effectiveHours + badIdleHours
  if (denominator <= 0) return null
  return effectiveHours / denominator
}

export interface LocationInsight {
  location: WorkLocation
  count: number
  averageScore: number | null
  cleanRatio: number | null
}

export interface SocialInsight {
  context: SocialContext
  count: number
  averageQuality: number | null
  averageBadIdle: number | null
  averageOutput: number | null
}

const LOCATION_ORDER: WorkLocation[] = ['matlam_my_room', 'lab', 'other_room', 'batza', 'home_other']
const SOCIAL_ORDER: SocialContext[] = ['alone', 'body_doubling', 'collaborative']

export function environmentInsights(entries: DailyEntry[]): {
  locations: LocationInsight[]
  social: SocialInsight[]
  calmest: SocialContext[]
} {
  const thesis = entries.filter(isCompleteThesisDay)
  const locations = LOCATION_ORDER.map((location) => summarizePlace(thesis.filter((entry) => entry.workLocation === location), location))
  locations.sort((a, b) => {
    if (a.averageScore === null && b.averageScore === null) return LOCATION_ORDER.indexOf(a.location) - LOCATION_ORDER.indexOf(b.location)
    if (a.averageScore === null) return 1
    if (b.averageScore === null) return -1
    return b.averageScore - a.averageScore || LOCATION_ORDER.indexOf(a.location) - LOCATION_ORDER.indexOf(b.location)
  })
  const social = SOCIAL_ORDER.map((context) => summarizeCompany(thesis.filter((entry) => entry.socialContext === context), context))
  const ranked = social.filter((item) => item.count > 0 && item.averageBadIdle !== null)
  const lowest = ranked.reduce<number | null>((best, item) => (best === null || (item.averageBadIdle ?? 0) < best ? item.averageBadIdle : best), null)
  const calmest = ranked.filter((item) => item.averageBadIdle === lowest).map((item) => item.context)
  return { locations, social, calmest }
}

function summarizePlace(list: Array<DailyEntry & { outputScore: number; balanceScore: number }>, location: WorkLocation): LocationInsight {
  if (list.length === 0) return { location, count: 0, averageScore: null, cleanRatio: null }
  const ratios = list
    .map((entry) => cleanEfficiencyRatio(entry.effectiveHours, entry.badIdleHours))
    .filter((ratio): ratio is number => ratio !== null)
  return {
    location,
    count: list.length,
    averageScore: round1FromSum(list.reduce((sum, entry) => sum + (dailyTotal(entry) ?? 0), 0), list.length),
    cleanRatio: ratios.length === 0 ? null : ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length,
  }
}

function summarizeCompany(list: Array<DailyEntry & { outputScore: number; balanceScore: number }>, context: SocialContext): SocialInsight {
  if (list.length === 0) return { context, count: 0, averageQuality: null, averageBadIdle: null, averageOutput: null }
  return {
    context,
    count: list.length,
    averageQuality: round1FromSum(
      list.reduce((sum, entry) => sum + timeQualityScore(entry.effectiveHours, entry.badIdleHours), 0),
      list.length,
    ),
    averageBadIdle: round1FromSum(list.reduce((sum, entry) => sum + entry.badIdleHours, 0), list.length),
    averageOutput: round1FromSum(list.reduce((sum, entry) => sum + entry.outputScore, 0), list.length),
  }
}

export type SleepBracket = 'under6' | 'mid' | 'rested'

export interface SleepInsight {
  bracket: SleepBracket
  count: number
  averageScore: number | null
  averageEffective: number | null
  averageBadIdle: number | null
}

const SLEEP_ORDER: SleepBracket[] = ['under6', 'mid', 'rested']

export function sleepBracket(hours: number): SleepBracket {
  if (hours < 6) return 'under6'
  if (hours >= 7.5) return 'rested'
  return 'mid'
}

export function sleepInsights(entries: DailyEntry[]): SleepInsight[] {
  const thesis = entries.filter(isCompleteThesisDay)
  return SLEEP_ORDER.map((bracket) => summarizeSleep(thesis.filter((entry) => sleepBracket(entry.sleepHours) === bracket), bracket))
}

function summarizeSleep(list: Array<DailyEntry & { outputScore: number; balanceScore: number }>, bracket: SleepBracket): SleepInsight {
  if (list.length === 0) return { bracket, count: 0, averageScore: null, averageEffective: null, averageBadIdle: null }
  return {
    bracket,
    count: list.length,
    averageScore: round1FromSum(list.reduce((sum, entry) => sum + (dailyTotal(entry) ?? 0), 0), list.length),
    averageEffective: round1FromSum(list.reduce((sum, entry) => sum + entry.effectiveHours, 0), list.length),
    averageBadIdle: round1FromSum(list.reduce((sum, entry) => sum + entry.badIdleHours, 0), list.length),
  }
}
