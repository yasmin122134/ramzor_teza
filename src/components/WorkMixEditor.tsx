import { useRef } from 'react'
import { WORK_ORDER, activeTypes, nudgeMix, shiftMix, toggleType } from '../lib/mix.ts'
import { WORK_TYPES, workMeta } from '../lib/labels.ts'
import { cn } from '../lib/cn.ts'
import type { WorkMix, WorkType } from '../types.ts'

export function WorkMixEditor({ mix, onChange }: { mix: WorkMix; onChange: (mix: WorkMix) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startMix: WorkMix; right: WorkType; left: WorkType } | null>(null)
  const active = activeTypes(mix)
  const boundaries: { right: WorkType; left: WorkType; percent: number }[] = []
  let cursor = 0
  for (let index = 0; index < active.length - 1; index += 1) {
    const right = active[index]
    const left = active[index + 1]
    if (!right || !left) continue
    cursor += mix[right]
    boundaries.push({ right, left, percent: cursor })
  }

  function grow(type: WorkType) {
    onChange(nudgeMix(mix, type, 5))
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-stone-800">תמהיל העבודה</legend>
      <p className="mb-3 text-xs leading-5 text-stone-500">הפעילו את הסוגים שהיו היום. הסכום נשאר 100%, בקפיצות של 5%.</p>
      <div className="grid grid-cols-2 gap-2">
        {WORK_TYPES.map((type) => {
          const on = mix[type.id] > 0
          return (
            <button
              key={type.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleType(mix, type.id))}
              className={cn(
                'min-h-14 rounded-2xl border px-3 py-2 text-start text-sm leading-5 font-medium',
                on ? type.solid : 'border-stone-200 bg-white text-stone-700',
              )}
            >
              {type.full}
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-3xl border border-stone-200 bg-stone-50 px-3 py-4">
        <Pie mix={mix} onGrow={grow} />
        <div ref={barRef} dir="rtl" className="relative mt-4 h-12 w-full touch-none">
          <div className="flex h-full overflow-hidden rounded-full bg-stone-200">
            {active.map((type) => (
              <div key={type} className={cn('h-full', workMeta(type).bar)} style={{ width: `${mix[type]}%` }} />
            ))}
          </div>
          {boundaries.map((boundary) => (
            <button
              key={`${boundary.right}-${boundary.left}`}
              type="button"
              aria-label={`הזזת הגבול בין ${workMeta(boundary.right).short} ל${workMeta(boundary.left).short}`}
              style={{ right: `calc(${boundary.percent}% - 22px)` }}
              className="absolute top-0 z-10 flex h-12 w-11 items-center justify-center"
              onPointerDown={(event) => {
                drag.current = {
                  startX: event.clientX,
                  startMix: mix,
                  right: boundary.right,
                  left: boundary.left,
                }
                try {
                  event.currentTarget.setPointerCapture(event.pointerId)
                } catch {
                  // Some browsers reject capture; the move handler still receives events on the thumb.
                }
              }}
              onPointerMove={(event) => {
                const state = drag.current
                const bar = barRef.current
                if (!state || !bar) return
                const width = bar.getBoundingClientRect().width
                if (width <= 0) return
                const percent = (-(event.clientX - state.startX) / width) * 100
                const delta = Math.round(percent / 5) * 5
                onChange(applyDrag(state.startMix, state.right, state.left, delta))
              }}
              onPointerUp={() => {
                drag.current = null
              }}
              onPointerCancel={() => {
                drag.current = null
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  onChange(applyDrag(mix, boundary.right, boundary.left, 5))
                } else if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  onChange(applyDrag(mix, boundary.right, boundary.left, -5))
                }
              }}
            >
              <span className="h-7 w-1.5 rounded-full bg-white shadow ring-1 ring-stone-300" />
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {WORK_TYPES.map((type) => (
            <div key={type.id} className="flex items-center gap-2">
              <span className={cn('size-2.5 shrink-0 rounded-full', type.bar)} />
              <span className="min-w-0 flex-1 text-sm text-stone-700">{type.short}</span>
              <div dir="ltr" className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`הקטנת ${type.short}`}
                  disabled={mix[type.id] <= 0 || active.length <= 1}
                  onClick={() => onChange(nudgeMix(mix, type.id, -5))}
                  className="size-11 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-800 disabled:opacity-30"
                >
                  −5
                </button>
                <span className="w-10 text-center text-sm font-semibold text-ink">{mix[type.id]}%</span>
                <button
                  type="button"
                  aria-label={`הגדלת ${type.short}`}
                  disabled={mix[type.id] >= 100 || active.every((item) => item === type.id || mix[item] < 5)}
                  onClick={() => onChange(nudgeMix(mix, type.id, 5))}
                  className="size-11 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-800 disabled:opacity-30"
                >
                  +5
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  )
}

function applyDrag(start: WorkMix, right: WorkType, left: WorkType, delta: number): WorkMix {
  if (delta === 0) return start
  return delta > 0 ? shiftMix(start, left, right, delta) : shiftMix(start, right, left, -delta)
}

function Pie({ mix, onGrow }: { mix: WorkMix; onGrow: (type: WorkType) => void }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const label = WORK_ORDER.filter((type) => mix[type] > 0)
    .map((type) => `${workMeta(type).short} ${mix[type]}%`)
    .join(', ')

  return (
    <div dir="ltr" className="mx-auto w-40">
      <svg viewBox="0 0 120 120" className="h-40 w-40" role="img" aria-label={label || '100%'}>
      <g transform="rotate(-90 60 60)">
        {WORK_ORDER.map((type) => {
          const percent = mix[type]
          if (percent <= 0) return null
          const length = (percent / 100) * circumference
          const slice = (
            <circle
              key={type}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={workMeta(type).hex}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              className="cursor-pointer"
              onClick={() => onGrow(type)}
            >
              <title>
                {workMeta(type).short} {percent}%
              </title>
            </circle>
          )
          offset += length
          return slice
        })}
      </g>
      <text x="60" y="64" textAnchor="middle" fill="#44403c" fontSize="13" fontWeight="600">
        100%
      </text>
      </svg>
    </div>
  )
}
