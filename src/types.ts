export type WorkType = 'builder' | 'drafting' | 'research' | 'maintenance'

export type WorkMix = Record<WorkType, number>

export type Light = 'green' | 'yellow' | 'red' | 'neutral'

export interface DailyEntry {
  date: string
  isThesisDay: boolean
  workMix: WorkMix
  dailyGoal: string
  outputScore: number | null
  effectiveHours: number
  qualityIdleHours: number
  badIdleHours: number
  balanceScore: number | null
  balanceTags: string[]
  notes: string
  nextStepBreadcrumb: string
  isSample?: boolean
}

export interface WeekRecord {
  weekId: string
  targetWeeklyHours: number
  topAchievement: string
  bottleneck: string
  nextFirstStep: string
}

export interface PersistedState {
  version: 2
  entries: Record<string, DailyEntry>
  weeks: Record<string, WeekRecord>
}

export type FlagId = 'padding' | 'passive' | 'burnout' | 'bottleneck' | 'writing'

export interface RedFlag {
  id: FlagId
  message: string
}

export interface WeeklySummary {
  light: Light
  average: number | null
  rawAverage: number | null
  penalized: boolean
  thesisDaysCount: number
  averageBalance: number | null
  averageOutput: number | null
  stuckOutputCount: number
  scheduledHours: number
  effectiveHours: number
  qualityIdleHours: number
  badIdleHours: number
  targetWeeklyHours: number
  schedulingCompletionPct: number | null
  workMix: WorkMix
  flags: RedFlag[]
}

export interface DraftEntry {
  isThesisDay: boolean
  workMix: WorkMix
  dailyGoal: string
  outputScore: number | null
  effectiveHours: number
  qualityIdleHours: number
  badIdleHours: number
  balanceScore: number | null
  balanceTags: string[]
  notes: string
  nextStepBreadcrumb: string
}
