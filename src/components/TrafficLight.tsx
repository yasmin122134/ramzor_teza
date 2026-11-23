import { LIGHT_TEXT } from '../lib/labels.ts'
import { cn } from '../lib/cn.ts'
import type { Light } from '../types.ts'

export const LIGHT_TONE: Record<Light, { soft: string; solid: string; bar: string }> = {
  green: {
    soft: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    solid: 'bg-emerald-600 text-white',
    bar: 'bg-emerald-500',
  },
  yellow: {
    soft: 'border-amber-200 bg-amber-50 text-amber-950',
    solid: 'bg-amber-400 text-amber-950',
    bar: 'bg-amber-400',
  },
  red: {
    soft: 'border-rose-200 bg-rose-50 text-rose-900',
    solid: 'bg-rose-600 text-white',
    bar: 'bg-rose-500',
  },
  neutral: {
    soft: 'border-stone-200 bg-stone-100 text-stone-600',
    solid: 'bg-stone-200 text-stone-600',
    bar: 'bg-stone-300',
  },
}

export function TrafficBadge({ light, className }: { light: Light; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-10 shrink-0 items-center rounded-full border px-3 text-sm font-medium whitespace-nowrap',
        LIGHT_TONE[light].soft,
        className,
      )}
    >
      {LIGHT_TEXT[light]}
    </span>
  )
}
