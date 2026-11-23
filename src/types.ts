export type WorkType = 'creative' | 'research' | 'maintenance'

export type Light = 'green' | 'yellow' | 'red' | 'neutral'

export interface DailyEntry {
  date: string
  isThesisDay: boolean
  workType: WorkType | null
  dailyGoal: string
  outputScore: number | null
  focusScore: number | null
  balanceScore: number | null
  balanceTags: string[]
  notes: string
  isSample?: boolean
}

export interface WeeklyReflection {
  weekId: string
  topAchievement: string
  bottleneck: string
  nextFirstStep: string
}

export interface PersistedState {
  version: 1
  entries: Record<string, DailyEntry>
  reflections: Record<string, WeeklyReflection>
}

export interface RedFlag {
  id: 'maintenance' | 'burnout' | 'bottleneck'
  message: string
}

export interface WeeklySummary {
  light: Light
  average: number | null
  thesisDaysCount: number
  creativeDaysCount: number
  averageBalance: number | null
  stuckOutputCount: number
  flags: RedFlag[]
}

export interface DraftEntry {
  isThesisDay: boolean
  workType: WorkType | null
  dailyGoal: string
  outputScore: number | null
  focusScore: number | null
  balanceScore: number | null
  balanceTags: string[]
  notes: string
}
