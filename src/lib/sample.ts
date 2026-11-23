import { addDays, startOfWeek, toDateKey } from './dates.ts'
import type { DailyEntry, PersistedState } from '../types.ts'

export function buildSampleEntries(today: Date): Record<string, DailyEntry> {
  const sunday = startOfWeek(today)
  const sun = toDateKey(sunday)
  const mon = toDateKey(addDays(sunday, 1))
  const tue = toDateKey(addDays(sunday, 2))

  return {
    [sun]: {
      date: sun,
      isThesisDay: true,
      workType: 'maintenance',
      dailyGoal: 'סידור ביבליוגרפיה וגיבוי קבצים',
      outputScore: 1,
      focusScore: 1,
      balanceScore: 0,
      balanceTags: [],
      notes: 'היום נמרח על סידור תיקיות. לא נגעתי בכתיבה.',
      isSample: true,
    },
    [mon]: {
      date: mon,
      isThesisDay: true,
      workType: 'research',
      dailyGoal: 'קריאת שני מאמרים על שיטות מעורבות',
      outputScore: 2,
      focusScore: 2,
      balanceScore: 1,
      balanceTags: ['הפסקה בחוץ'],
      notes: 'סיימתי מאמר אחד וסימנתי ציטוטים לשני.',
      isSample: true,
    },
    [tue]: {
      date: tue,
      isThesisDay: true,
      workType: 'creative',
      dailyGoal: 'טיוטת תרשים זרימה למתודולוגיה',
      outputScore: 4,
      focusScore: 3,
      balanceScore: 2,
      balanceTags: ['שחייה', 'שינה טובה'],
      notes: 'התרשים סגור. נשאר לנסח את שלב גיוס המשתתפים.',
      isSample: true,
    },
  }
}

export function seedState(today: Date): PersistedState {
  return {
    version: 1,
    entries: buildSampleEntries(today),
    reflections: {},
  }
}
