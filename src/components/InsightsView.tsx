import { formatChartLabel, recentWeekStarts, toDateKey, weekDates } from '../lib/dates.ts'
import { dayCountLabel, LIGHT_TEXT, REST_BALANCE_HINT, WORK_TYPES } from '../lib/labels.ts'
import { cn } from '../lib/cn.ts'
import { isCompleteThesisDay, summarizeWeek, workTypeBreakdown, workoutCorrelation } from '../lib/scoring.ts'
import { useThesis } from '../store/ThesisStore.tsx'
import type { WorkType } from '../types.ts'
import { LIGHT_TONE } from './TrafficLight.tsx'

const WORK_BAR: Record<WorkType, string> = {
  creative: 'bg-teal-600',
  research: 'bg-sky-600',
  maintenance: 'bg-stone-400',
}

export function InsightsView({ weekStart }: { weekStart: Date }) {
  const { entries } = useThesis()
  const all = Object.values(entries)
  const thesisCount = all.filter(isCompleteThesisDay).length
  const weeks = recentWeekStarts(weekStart, 8).map((start) => {
    const weekEntries = weekDates(start).flatMap((day) => {
      const key = toDateKey(day)
      return key in entries && entries[key] ? [entries[key]] : []
    })
    return { id: toDateKey(start), start, summary: summarizeWeek(weekEntries) }
  })
  const selectedId = toDateKey(weekStart)
  const breakdown = workTypeBreakdown(all)
  const correlation = workoutCorrelation(all)

  return (
    <div className="space-y-3">
      <h2 className="px-1 text-lg font-semibold text-ink">מגמות ותובנות</h2>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">מגמת הציון השבועי</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">שמונה שבועות עד השבוע המוצג, מהישן משמאל אל החדש. אפור: אין דיווח.</p>
        <div dir="ltr" className="mt-4 flex h-44 items-end gap-1">
          {weeks.map((week) => {
            const average = week.summary.average
            const height = average === null ? 8 : Math.max(8, (average / 10) * 100)
            return (
              <div key={week.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-stone-500" dir="ltr">
                  {average === null ? '–' : average.toFixed(1)}
                </span>
                <div className="flex h-28 w-full items-end">
                  <div
                    role="img"
                    aria-label={`${formatChartLabel(week.start)}, ${average === null ? 'טרם דווח' : average.toFixed(1)}, ${LIGHT_TEXT[week.summary.light]}`}
                    className={cn(
                      'w-full rounded-t-md',
                      LIGHT_TONE[week.summary.light].bar,
                      week.id === selectedId && 'ring-2 ring-teal-700 ring-offset-1',
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] text-stone-500',
                    week.id === selectedId && 'font-semibold text-teal-800',
                  )}
                >
                  {formatChartLabel(week.start)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">סוג העבודה</h3>
        <p className="mt-1 text-sm text-stone-500">
          {thesisCount === 0 ? 'עוד אין ימי תזה לחישוב.' : `מתוך ${thesisCount === 1 ? 'יום תזה אחד' : `${thesisCount} ימי תזה`}`}
        </p>
        {thesisCount > 0 ? (
          <>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-stone-100">
              {breakdown.map((slice) =>
                slice.percent > 0 ? (
                  <div
                    key={slice.type}
                    className={cn('h-full', WORK_BAR[slice.type])}
                    style={{ width: `${slice.percent}%` }}
                  />
                ) : null,
              )}
            </div>
            <ul className="mt-4 space-y-3">
              {breakdown.map((slice) => {
                const meta = WORK_TYPES.find((item) => item.id === slice.type)
                return (
                  <li key={slice.type} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn('size-2.5 shrink-0 rounded-full', WORK_BAR[slice.type])} />
                      <span className="truncate">{meta?.full}</span>
                    </span>
                    <span dir="ltr" className="shrink-0 font-medium text-stone-700">
                      {slice.percent}% · {slice.count}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">אימון ותפוקה</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">ממוצע ציון התוצר בימי אימון מול ימים ללא אימון.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <CorrelationCard
            title="ימי אימון"
            hint="איזון 2"
            value={correlation.workoutAvg}
            count={correlation.workoutCount}
            tone="bg-emerald-50 border-emerald-200"
          />
          <CorrelationCard
            title="ללא אימון"
            hint={REST_BALANCE_HINT}
            value={correlation.restAvg}
            count={correlation.restCount}
            tone="bg-stone-50 border-stone-200"
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">{correlationSentence(correlation.workoutAvg, correlation.restAvg)}</p>
      </section>
    </div>
  )
}

function CorrelationCard({
  title,
  hint,
  value,
  count,
  tone,
}: {
  title: string
  hint: string
  value: number | null
  count: number
  tone: string
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border p-3', tone)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-[11px] text-stone-500">{hint}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">
        <span dir="ltr" className="inline-block">
          {value === null ? '—' : value.toFixed(1)}
        </span>
      </p>
      <p className="text-xs text-stone-500">{count === 0 ? 'אין נתונים' : dayCountLabel(count)}</p>
    </div>
  )
}

function correlationSentence(workoutAvg: number | null, restAvg: number | null): string {
  if (workoutAvg === null || restAvg === null) {
    return 'כדי לראות קשר, צריך לפחות יום אימון אחד ויום בלי אימון.'
  }
  const diff = Math.round((workoutAvg - restAvg) * 10) / 10
  const amount = `\u2066${formatDiff(Math.abs(diff))}\u2069`
  if (diff > 0) return `בימי אימון ציון התוצר גבוה ב־${amount}`
  if (diff < 0) return `בימים ללא אימון ציון התוצר גבוה ב־${amount}`
  return 'ציון התוצר זהה בימי אימון ובימים ללא אימון.'
}

function formatDiff(value: number): string {
  return value.toFixed(1)
}
