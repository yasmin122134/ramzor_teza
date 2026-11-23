import { WORK_ORDER } from '../lib/mix.ts'
import { workMeta } from '../lib/labels.ts'
import { cn } from '../lib/cn.ts'
import type { WorkMix } from '../types.ts'

export function StackedMix({ mix, className }: { mix: WorkMix; className?: string }) {
  return (
    <div className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100', className)}>
      {WORK_ORDER.map((type) =>
        mix[type] > 0 ? (
          <div key={type} className={cn('h-full', workMeta(type).bar)} style={{ width: `${mix[type]}%` }} />
        ) : null,
      )}
    </div>
  )
}

export function MixPills({ mix }: { mix: WorkMix }) {
  const active = WORK_ORDER.filter((type) => mix[type] > 0)
  if (active.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {active.map((type) => (
        <span
          key={type}
          className={cn('rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium', workMeta(type).soft)}
        >
          {workMeta(type).short} <bdi dir="ltr">{mix[type]}%</bdi>
        </span>
      ))}
    </span>
  )
}
