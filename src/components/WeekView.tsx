import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { DAY_LETTERS, formatWeekRange, startOfWeek, toDateKey, weekDates } from '../lib/dates.ts'
import { LIGHT_TEXT, environmentBadge, formatHours, formatSleep, thesisDayLabel } from '../lib/labels.ts'
import { DEFAULT_TARGET_HOURS } from '../lib/mix.ts'
import { cn } from '../lib/cn.ts'
import { dailyLight, dailyTotal, summarizeStoredWeek } from '../lib/scoring.ts'
import { useThesis } from '../store/ThesisStore.tsx'
import type { DailyEntry } from '../types.ts'
import { MixPills, StackedMix } from './MixBar.tsx'
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
  const { entries, weeks, updateWeek } = useThesis()
  const todayKey = toDateKey(new Date())
  const weekId = toDateKey(weekStart)
  const isCurrent = toDateKey(startOfWeek(new Date())) === weekId
  const days = weekDates(weekStart)
  const target = weeks[weekId]?.targetWeeklyHours ?? DEFAULT_TARGET_HOURS
  const summary = summarizeStoredWeek(Object.values(entries), weekStart, target)
  const crumb = latestBreadcrumb(entries, todayKey)
  const completion = summary.schedulingCompletionPct

  function changeTarget(delta: number) {
    const next = Math.round((target + delta) * 2) / 2
    updateWeek(weekId, { targetWeeklyHours: Math.min(60, Math.max(1, next)) })
  }

  return (
    <div className="space-y-3">
      {crumb ? (
        <section className="rounded-3xl border border-teal-200 bg-teal-50 px-4 py-3">
          <p className="text-xs font-medium text-teal-800">בוקר טוב – הצעד הבא שלך</p>
          <p className="mt-1 text-base leading-6 font-semibold break-words text-ink">{crumb}</p>
        </section>
      ) : null}

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
          {summary.penalized ? (
            <p className="mt-3 text-sm leading-6 text-amber-950">
              הופחת <bdi dir="ltr">0.5</bdi> כי שובצו פחות מ־<bdi dir="ltr">75%</bdi> מהיעד השבועי
            </p>
          ) : null}

          <div className="mt-4">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm text-stone-500">שובצו בפועל / יעד שבועי</p>
              <p className="text-sm font-semibold text-ink">
                <bdi dir="ltr">
                  {formatHours(summary.scheduledHours)} / {formatHours(summary.targetWeeklyHours)}
                </bdi>{' '}
                שעות
              </p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className={cn(
                  'h-full rounded-full',
                  completion === null ? 'bg-stone-200' : completion >= 80 ? 'bg-teal-600' : completion >= 75 ? 'bg-amber-400' : 'bg-rose-500',
                )}
                style={{ width: `${completion === null ? 0 : Math.min(100, completion)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 text-center">
              <HourStat label="אפקטיבי" value={summary.effectiveHours} tone="text-indigo-800" />
              <HourStat label="נבז איכותי" value={summary.qualityIdleHours} tone="text-teal-800" />
              <HourStat label="נבז לא טוב" value={summary.badIdleHours} tone="text-rose-800" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-stone-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">יעד שבועי</p>
              <p className="text-xs text-stone-500">שעות לשבוע</p>
            </div>
            <div dir="ltr" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="הקטנת היעד השבועי"
                onClick={() => changeTarget(-1)}
                className="size-11 rounded-xl border border-stone-200 bg-white text-lg text-stone-800"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold text-ink">{formatHours(target)}</span>
              <button
                type="button"
                aria-label="הגדלת היעד השבועי"
                onClick={() => changeTarget(1)}
                className="size-11 rounded-xl border border-stone-200 bg-white text-lg text-stone-800"
              >
                +
              </button>
            </div>
          </div>

          {summary.thesisDaysCount > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-sm text-stone-500">תמהיל השבוע</p>
              <StackedMix mix={summary.workMix} />
              <div className="mt-2">
                <MixPills mix={summary.workMix} />
              </div>
            </div>
          ) : null}

          {summary.flags.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summary.flags.map((flag) => (
                <p
                  key={flag.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm leading-6 font-medium break-words text-rose-950"
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
        topAchievement={weeks[weekId]?.topAchievement ?? ''}
        bottleneck={weeks[weekId]?.bottleneck ?? ''}
        nextFirstStep={weeks[weekId]?.nextFirstStep ?? ''}
        onChange={(patch) => updateWeek(weekId, patch)}
      />
    </div>
  )
}

function latestBreadcrumb(entries: Record<string, DailyEntry>, todayKey: string): string | null {
  const match = Object.values(entries)
    .filter((entry) => entry.isThesisDay && entry.nextStepBreadcrumb.trim() && entry.date <= todayKey)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0]
  return match ? match.nextStepBreadcrumb.trim() : null
}

function HourStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-stone-50 px-1 py-2">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className={cn('text-sm font-semibold', tone)}>
        <bdi dir="ltr">{formatHours(value)}</bdi>
      </p>
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
        <span className="flex flex-wrap items-center gap-1">
          {entry && !entry.isThesisDay ? (
            <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              ללא תזה
            </span>
          ) : null}
          {isToday ? <span className="text-[11px] font-medium text-teal-700">היום</span> : null}
        </span>
        {entry?.isThesisDay ? (
          <span className="mt-1 block">
            <MixPills mix={entry.workMix} />
            <StackedMix mix={entry.workMix} className="mt-1.5" />
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-5">
              <span className="break-words text-stone-500">{environmentBadge(entry.workLocation, entry.socialContext)}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5',
                  entry.sleepHours < 6 ? 'bg-amber-100 font-medium text-amber-950' : 'text-stone-500',
                )}
              >
                <span aria-hidden="true">😴</span>
                <bdi dir="ltr">{formatSleep(entry.sleepHours)}</bdi>
                <span>שע׳</span>
              </span>
            </span>
          </span>
        ) : null}
        <span className="mt-1 block truncate text-sm text-stone-600">{goal}</span>
      </span>
      <span className="flex shrink-0 flex-col items-center">
        {entry?.isThesisDay && total !== null ? (
          <span className={cn('flex size-11 items-center justify-center rounded-full text-sm font-bold', LIGHT_TONE[light].solid)}>
            <span dir="ltr">{total}</span>
          </span>
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-stone-100 text-sm text-stone-400">–</span>
        )}
        <span className="sr-only">{entry ? LIGHT_TEXT[light] : 'אין דיווח'}</span>
      </span>
    </button>
  )
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
