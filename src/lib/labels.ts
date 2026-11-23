import type { Light, WorkType } from '../types.ts'

export const BALANCE_TAGS = ['ריצה', 'שחייה', 'כוח', 'אקרובטיקה', 'הפסקה בחוץ', 'שינה טובה'] as const

export const BALANCE_TAG_SET = new Set<string>(BALANCE_TAGS)

export const WORK_TYPES: { id: WorkType; short: string; full: string }[] = [
  { id: 'creative', short: 'יוצרת', full: 'עבודה יוצרת / עמוקה' },
  { id: 'research', short: 'מחקר', full: 'עבודה מעבדת / חוקרת' },
  { id: 'maintenance', short: 'תחזוקה', full: 'תחזוקה / אדמיניסטרציה' },
]

export const LIGHT_TEXT: Record<Light, string> = {
  green: '🟢 ירוק',
  yellow: '🟡 צהוב',
  red: '🔴 אדום',
  neutral: 'טרם דווח',
}

const isolateLtr = (value: string) => `\u2066${value}\u2069`

export const OUTPUT_CAPTION = '0 נתקעתי/כלום · 2 התקדמות חלקית · 4 יעד הושלם'

export const FOCUS_CAPTION = `${isolateLtr('0–1')} הסחות רבות · 2 בלוקים נקיים · ${isolateLtr('3–4')} בלוקים נקיים`

export const REST_BALANCE_HINT = `איזון ${isolateLtr('0–1')}`

export const BALANCE_OPTIONS = [
  { score: 0, label: 'מרוח מול מסך' },
  { score: 1, label: 'הפסקה/התרעננות' },
  { score: 2, label: 'אימון/פעילות גופנית' },
] as const

export function workMeta(type: WorkType | null) {
  return WORK_TYPES.find((item) => item.id === type) ?? null
}

export function thesisDayLabel(count: number): string {
  if (count === 0) return 'אין ימי תזה'
  if (count === 1) return 'יום תזה אחד'
  return `${count} ימי תזה`
}

export function dayCountLabel(count: number): string {
  if (count === 1) return 'יום אחד'
  return `${count} ימים`
}
