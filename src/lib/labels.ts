import type { Light, WorkType } from '../types.ts'

export const BALANCE_TAGS = ['ריצה', 'שחייה', 'כוח', 'אקרובטיקה', 'הפסקה בחוץ', 'שינה טובה'] as const

export const BALANCE_TAG_SET = new Set<string>(BALANCE_TAGS)

export const WORK_TYPES: {
  id: WorkType
  short: string
  full: string
  bar: string
  hex: string
  soft: string
  solid: string
}[] = [
  {
    id: 'builder',
    short: 'פיתוח',
    full: 'פיתוח, ניסויים והוכחות',
    bar: 'bg-indigo-500',
    hex: '#4f46e5',
    soft: 'border-indigo-200 bg-indigo-50 text-indigo-950',
    solid: 'border-indigo-700 bg-indigo-700 text-white',
  },
  {
    id: 'drafting',
    short: 'כתיבה',
    full: 'כתיבה אקדמית חדשה',
    bar: 'bg-violet-500',
    hex: '#8b5cf6',
    soft: 'border-violet-200 bg-violet-50 text-violet-950',
    solid: 'border-violet-700 bg-violet-700 text-white',
  },
  {
    id: 'research',
    short: 'מחקר',
    full: 'קריאה ומחקר',
    bar: 'bg-cyan-600',
    hex: '#0891b2',
    soft: 'border-cyan-200 bg-cyan-50 text-cyan-950',
    solid: 'border-cyan-700 bg-cyan-700 text-white',
  },
  {
    id: 'maintenance',
    short: 'תחזוקה',
    full: 'תחזוקה ועריכה',
    bar: 'bg-amber-600',
    hex: '#d97706',
    soft: 'border-amber-200 bg-amber-50 text-amber-950',
    solid: 'border-amber-700 bg-amber-700 text-white',
  },
]

export const LIGHT_TEXT: Record<Light, string> = {
  green: '🟢 ירוק',
  yellow: '🟡 צהוב',
  red: '🔴 אדום',
  neutral: 'טרם דווח',
}

const isolateLtr = (value: string) => `\u2066${value}\u2069`

export const OUTPUT_CAPTION = '0 נתקעתי/כלום · 2 התקדמות חלקית · 4 יעד הושלם'

export const REST_BALANCE_HINT = `איזון ${isolateLtr('0–1')}`

export const BALANCE_OPTIONS = [
  { score: 0, label: 'מרוח מול מסך' },
  { score: 1, label: 'הפסקה/התרעננות' },
  { score: 2, label: 'אימון/פעילות גופנית' },
] as const

export const TIME_BUCKETS = [
  { key: 'effectiveHours', label: '⚡ זמן אפקטיבי', hint: 'עבודה עמוקה ומרוכזת' },
  { key: 'qualityIdleHours', label: '🔋 זמן נבז איכותי', hint: 'הפסקה, אוויר, חשיבה או הקמה' },
  { key: 'badIdleHours', label: '🕳️ זמן נבז לא טוב', hint: 'גלילה, קפיצה בין לשוניות, בהייה' },
] as const

export function workMeta(type: WorkType) {
  const meta = WORK_TYPES.find((item) => item.id === type)
  if (!meta) throw new Error(`Unknown work type ${type}`)
  return meta
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

export function formatHours(value: number): string {
  const rounded = Math.round(value * 2) / 2
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
