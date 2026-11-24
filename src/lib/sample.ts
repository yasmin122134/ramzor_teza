import { addDays, startOfWeek, toDateKey } from './dates.ts'
import type { DailyEntry, PersistedState, SocialContext, WorkLocation, WorkMix } from '../types.ts'

function entry(
  date: string,
  fields: {
    workMix: WorkMix
    dailyGoal: string
    outputScore: number
    effectiveHours: number
    qualityIdleHours: number
    badIdleHours: number
    balanceScore: number
    balanceTags: string[]
    notes: string
    nextStepBreadcrumb: string
    workLocation: WorkLocation
    socialContext: SocialContext
    sleepHours: number
  },
): DailyEntry {
  return {
    date,
    isThesisDay: true,
    isSample: true,
    ...fields,
  }
}

export function buildSampleEntries(today: Date): Record<string, DailyEntry> {
  const sunday = startOfWeek(today)
  const sun = toDateKey(sunday)
  const mon = toDateKey(addDays(sunday, 1))
  const tue = toDateKey(addDays(sunday, 2))

  return {
    [sun]: entry(sun, {
      workMix: { builder: 0, drafting: 0, research: 10, maintenance: 90 },
      dailyGoal: 'סידור ביבליוגרפיה וגיבוי קבצים',
      outputScore: 1,
      effectiveHours: 1.5,
      qualityIdleHours: 0.5,
      badIdleHours: 2,
      balanceScore: 0,
      balanceTags: [],
      notes: 'היום נמרח על סידור תיקיות. לא נגעתי בכתיבה.',
      nextStepBreadcrumb: 'לפתוח את קובץ הביבליוגרפיה ולסמן שלושה מקורות חסרים',
      workLocation: 'home_other',
      socialContext: 'alone',
      sleepHours: 5.5,
    }),
    [mon]: entry(mon, {
      workMix: { builder: 0, drafting: 0, research: 80, maintenance: 20 },
      dailyGoal: 'קריאת שני מאמרים על שיטות מעורבות',
      outputScore: 2,
      effectiveHours: 2.5,
      qualityIdleHours: 1,
      badIdleHours: 0.5,
      balanceScore: 1,
      balanceTags: ['הפסקה בחוץ'],
      notes: 'סיימתי מאמר אחד וסימנתי ציטוטים לשני.',
      nextStepBreadcrumb: 'לסכם את המאמר השני בפסקה אחת',
      workLocation: 'matlam_my_room',
      socialContext: 'body_doubling',
      sleepHours: 6.5,
    }),
    [tue]: entry(tue, {
      workMix: { builder: 70, drafting: 20, research: 10, maintenance: 0 },
      dailyGoal: 'טיוטת תרשים זרימה למתודולוגיה',
      outputScore: 4,
      effectiveHours: 4,
      qualityIdleHours: 0.5,
      badIdleHours: 0,
      balanceScore: 2,
      balanceTags: ['שחייה', 'שינה טובה'],
      notes: 'התרשים סגור. נשאר לנסח את שלב גיוס המשתתפים.',
      nextStepBreadcrumb: 'לנסח את פסקת שיטת הגיוס מתחת לתרשים',
      workLocation: 'lab',
      socialContext: 'collaborative',
      sleepHours: 8,
    }),
  }
}

export function seedState(today: Date): PersistedState {
  return {
    version: 2,
    entries: buildSampleEntries(today),
    weeks: {},
  }
}
