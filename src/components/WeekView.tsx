import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { DAY_LETTERS, formatWeekRange, startOfWeek, toDateKey, weekDates } from '../lib/dates.ts'
import { LIGHT_TEXT, thesisDayLabel, workMeta } from '../lib/labels.ts'
import { cn } from '../lib/cn.ts'
import { dailyLight, dailyTotal, summarizeWeek } from '../lib/scoring.ts'
import { useThesis } from '../store/ThesisStore.tsx'
import type { DailyEntry } from '../types.ts'
import { LIGHT_TONE, TrafficBadge } from './TrafficLight.tsx'

export function WeekView({
  weekStart,
  onPrev,
  onNext,
  onToday,
  onOpenDay,
}: {
  weekStart: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onOpenDay: (date: string) => void
}) {
  const { entries, reflections, updateReflection } = useThesis()
  const todayKey = toDateKey(new Date())
  const weekId = toDateKey(weekStart)
  const isCurrent = toDateKey(startOfWeek(new Date())) === weekId
  const days = weekDates(weekStart)
  const weekEntries = days.flatMap((day) => {
    const key = toDateKey(day)
    return key in entries && entries[key] ? [entries[key]] : []
  })
  const summary = summarizeWeek(weekEntries)

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-stone-200 bg-white px-3 py-3 shadow-sm">
        <p className="text-center text-lg font-semibold tracking-tight text-ink">{formatWeekRange(weekStart)}</p>
        {isCurrent ? <p className="mt-0.5 text-center text-xs text-teal-700">השבוע הנוכחי</p> : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex h-12 items-center justify-center gap-1 rounded-xl bg-stone-50 text-sm font-medium text-stone-800"
          >
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            <span>שבוע קודם</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-12 items-center justify-center gap-1 rounded-xl bg-stone-50 text-sm font-medium text-stone-800"
          >
            <span>שבוע הבא</span>
            <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          className={cn(
            'mt-2 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold',
            isCurrent ? 'bg-teal-50 text-teal-800' : 'bg-teal-800 text-white',
          )}
        >
          היום
        </button>
      </section>

      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className={cn('h-1.5', LIGHT_TONE[summary.light].bar)} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-stone-500">ממוצע שבועי</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-ink">
                <span dir="ltr" className="inline-block">
                  {summary.average === null ? '—' : summary.average.toFixed(1)}
                  <span className="text-base font-medium text-stone-400"> / 10</span>
                </span>
              </p>
              <p className="mt-1 text-sm text-stone-600">{thesisDayLabel(summary.thesisDaysCount)}</p>
            </div>
            <TrafficBadge light={summary.light} />
          </div>
          {summary.flags.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summary.flags.map((flag) => (
                <p
                  key={flag.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-6 font-medium text-rose-950"
                >
                  {flag.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm font-medium text-stone-500">ימי השבוע</h2>
        <div className="space-y-2">
          {days.map((day) => {
            const dateKey = toDateKey(day)
            const entry = dateKey in entries ? entries[dateKey] : undefined
            return (
              <DayCard
                key={dateKey}
                day={day}
                entry={entry}
                isToday={dateKey === todayKey}
                isFuture={dateKey > todayKey}
                onOpen={() => onOpenDay(dateKey)}
              />
            )
          })}
        </div>
      </section>

      <WeeklyReflection
        key={weekId}
        weekId={weekId}
        topAchievement={reflections[weekId]?.topAchievement ?? ''}
        bottleneck={reflections[weekId]?.bottleneck ?? ''}
        nextFirstStep={reflections[weekId]?.nextFirstStep ?? ''}
        onChange={(patch) => updateReflection(weekId, patch)}
      />
    </div>
  )
}

function DayCard({
  day,
  entry,
  isToday,
  isFuture,
  onOpen,
}: {
  day: Date
  entry: DailyEntry | undefined
  isToday: boolean
  isFuture: boolean
  onOpen: () => void
}) {
  const total = entry ? dailyTotal(entry) : null
  const light = entry ? dailyLight(entry) : 'neutral'
  const meta = entry ? workMeta(entry.workType) : null
  const goal = entry?.dailyGoal || (entry ? 'בלי יעד רשום' : isFuture ? 'עדיין לא הגיע' : 'טרם מולא · הקש לדיווח')

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white p-3 text-start shadow-sm',
        isToday ? 'border-teal-300 ring-2 ring-teal-600/15' : 'border-stone-200',
      )}
    >
      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-50">
        <span className="text-[11px] text-stone-500">{DAY_LETTERS[day.getDay()]}</span>
        <span className="text-lg leading-none font-semibold text-ink">{day.getDate()}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          {entry && !entry.isThesisDay ? (
            <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              ללא תזה
            </span>
          ) : null}
          {entry?.isThesisDay && meta ? (
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', pillClass(meta.id))}>
              {meta.short}
            </span>
          ) : null}
          {isToday ? <span className="text-[11px] font-medium text-teal-700">היום</span> : null}
        </span>
        <span className="mt-1 block truncate text-sm text-stone-600">{goal}</span>
      </span>
      <span className="flex shrink-0 flex-col items-center">
        {entry?.isThesisDay && total !== null ? (
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-full text-sm font-bold',
              LIGHT_TONE[light].solid,
            )}
          >
            <span dir="ltr">{total}</span>
          </span>
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-stone-100 text-sm text-stone-400">
            –
          </span>
        )}
        <span className="sr-only">{entry ? LIGHT_TEXT[light] : 'אין דיווח'}</span>
      </span>
    </button>
  )
}

function pillClass(type: NonNullable<ReturnType<typeof workMeta>>['id']): string {
  if (type === 'creative') return 'border-teal-200 bg-teal-50 text-teal-800'
  if (type === 'research') return 'border-sky-200 bg-sky-50 text-sky-900'
  return 'border-stone-200 bg-stone-100 text-stone-700'
}

function WeeklyReflection({
  weekId,
  topAchievement,
  bottleneck,
  nextFirstStep,
  onChange,
}: {
  weekId: string
  topAchievement: string
  bottleneck: string
  nextFirstStep: string
  onChange: (patch: { topAchievement?: string; bottleneck?: string; nextFirstStep?: string }) => void
}) {
  const [open, setOpen] = useState(Boolean(topAchievement || bottleneck || nextFirstStep))
  const fields = [
    {
      key: 'topAchievement' as const,
      label: 'מה התוצר הכי משמעותי שיצא השבוע?',
      value: topAchievement,
    },
    {
      key: 'bottleneck' as const,
      label: 'איפה נתקעתי ולמה?',
      value: bottleneck,
    },
    {
      key: 'nextFirstStep' as const,
      label: 'מה הדבר הראשון שעושים בשבוע הבא?',
      value: nextFirstStep,
    },
  ]

  return (
    <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`reflection-${weekId}`}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-start"
      >
        <span>
          <span className="block font-medium text-ink">סיכום שבועי</span>
          <span className="block text-xs text-stone-500">שלוש שאלות לסוף השבוע</span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-stone-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={`reflection-${weekId}`} className="space-y-4 px-4 pb-4">
          {fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1.5 block text-sm leading-6 font-medium text-stone-800">{field.label}</span>
              <textarea
                value={field.value}
                rows={3}
                maxLength={2000}
                onChange={(event) => onChange({ [field.key]: event.target.value })}
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base leading-6 text-ink outline-none"
                placeholder="כמה מילים מספיקות"
              />
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}
