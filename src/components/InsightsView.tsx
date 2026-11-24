import { DAY_LETTERS, addDays, formatChartLabel, formatDayMonth, recentWeekStarts, toDateKey } from '../lib/dates.ts'
import { LIGHT_TEXT, REST_BALANCE_HINT, SLEEP_BRACKET_LABELS, WORK_TYPES, dayCountLabel, formatHours, locationMeta, socialMeta } from '../lib/labels.ts'
import { DEFAULT_TARGET_HOURS, WORK_ORDER } from '../lib/mix.ts'
import { cn } from '../lib/cn.ts'
import { dailyLight, environmentInsights, isCompleteThesisDay, overallMix, sleepInsights, summarizeStoredWeek, workoutHypothesis } from '../lib/scoring.ts'
import type { SleepInsight } from '../lib/scoring.ts'
import { useThesis } from '../store/ThesisStore.tsx'
import type { DailyEntry, Light, SocialContext } from '../types.ts'
import { StackedMix } from './MixBar.tsx'
import { LIGHT_TONE } from './TrafficLight.tsx'

export function InsightsView({ weekStart, onOpenDay }: { weekStart: Date; onOpenDay: (date: string) => void }) {
  const { entries, weeks } = useThesis()
  const all = Object.values(entries)
  const thesisCount = all.filter(isCompleteThesisDay).length
  const scoreWeeks = recentWeekStarts(weekStart, 8).map((start) => {
    const id = toDateKey(start)
    return {
      id,
      start,
      summary: summarizeStoredWeek(all, start, weeks[id]?.targetWeeklyHours ?? DEFAULT_TARGET_HOURS),
    }
  })
  const heatWeeks = recentWeekStarts(weekStart, 15)
  const selectedId = toDateKey(weekStart)
  const mix = overallMix(all)
  const hypothesis = workoutHypothesis(all)
  const environment = environmentInsights(all)
  const sleep = sleepInsights(all)
  const hourMax = Math.max(1, ...scoreWeeks.map((week) => week.summary.scheduledHours))

  return (
    <div className="space-y-3">
      <h2 className="px-1 text-lg font-semibold text-ink">מגמות ותובנות</h2>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">מפת חום של הסמסטר</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">15 שבועות עד השבוע המוצג. כל משבצת היא יום, לפי הרמזור היומי.</p>
        <div dir="ltr" className="mt-4">
          <div
            className="grid items-center gap-[3px]"
            style={{ gridTemplateColumns: `18px repeat(${heatWeeks.length}, minmax(0, 1fr))` }}
          >
            <span />
            {heatWeeks.map((start) => (
              <span key={toDateKey(start)} className="truncate text-center text-[9px] text-stone-400">
                {start.getDate()}
              </span>
            ))}
            {DAY_LETTERS.map((letter, row) => (
              <HeatRow key={letter} letter={letter} row={row} weeks={heatWeeks} entries={entries} onOpenDay={onOpenDay} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-600">
          <Legend swatch="bg-emerald-500" label="ירוק" />
          <Legend swatch="bg-amber-400" label="צהוב" />
          <Legend swatch="bg-rose-500" label="אדום" />
          <Legend swatch="bg-stone-300" label="ללא תזה" />
          <Legend swatch="bg-stone-100 ring-1 ring-stone-200" label="אין דיווח" />
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">מגמת הציון השבועי</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">שמונה שבועות עד השבוע המוצג, מהישן משמאל אל החדש. אפור: אין דיווח.</p>
        <div dir="ltr" className="mt-4 flex h-44 items-end gap-1">
          {scoreWeeks.map((week) => {
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
                <span className={cn('text-[10px] text-stone-500', week.id === selectedId && 'font-semibold text-teal-800')}>
                  {formatChartLabel(week.start)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">שעות שובצו מול שעות אפקטיביות</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">אותם שמונה שבועות. העמודה הכהה היא כל מה ששובץ, והבהירה היא הזמן האפקטיבי.</p>
        <div className="mt-3 flex gap-3 text-[11px] text-stone-600">
          <Legend swatch="bg-teal-700" label="שובצו" />
          <Legend swatch="bg-indigo-500" label="אפקטיבי" />
        </div>
        <div dir="ltr" className="mt-4 flex h-40 items-end gap-1">
          {scoreWeeks.map((week) => {
            const scheduled = week.summary.scheduledHours
            const effective = week.summary.effectiveHours
            return (
              <div key={week.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-28 w-full items-end justify-center gap-0.5">
                  <div
                    role="img"
                    aria-label={`${formatChartLabel(week.start)}: שובצו ${formatHours(scheduled)}, אפקטיבי ${formatHours(effective)}`}
                    className="flex h-full w-full items-end justify-center gap-0.5"
                  >
                    <div className="w-1/2 rounded-t bg-teal-700" style={{ height: `${Math.max(scheduled > 0 ? 6 : 0, (scheduled / hourMax) * 100)}%` }} />
                    <div className="w-1/2 rounded-t bg-indigo-500" style={{ height: `${Math.max(effective > 0 ? 6 : 0, (effective / hourMax) * 100)}%` }} />
                  </div>
                </div>
                <span className={cn('text-[10px] text-stone-500', week.id === selectedId && 'font-semibold text-teal-800')}>
                  {formatChartLabel(week.start)}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">סוג העבודה</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">
          {thesisCount === 0
            ? 'עוד אין ימי תזה לחישוב.'
            : `משוקלל לפי שעות אפקטיביות, מתוך ${thesisCount === 1 ? 'יום תזה אחד' : `${thesisCount} ימי תזה`}`}
        </p>
        {thesisCount > 0 ? (
          <>
            <StackedMix mix={mix} className="mt-4 h-4" />
            <ul className="mt-4 space-y-3">
              {WORK_ORDER.map((type) => {
                const meta = WORK_TYPES.find((item) => item.id === type)
                return (
                  <li key={type} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn('size-2.5 shrink-0 rounded-full', meta?.bar)} />
                      <span className="truncate">{meta?.full}</span>
                    </span>
                    <span dir="ltr" className="shrink-0 font-medium text-stone-700">
                      {mix[type]}%
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </section>

      <h2 className="px-1 pt-2 text-base font-semibold text-ink">סביבה ומיקוד</h2>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">ביצועים לפי מיקום</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">ממוצע הציון היומי ויחס היעילות הנקייה. המיקום לא משנה את הציון עצמו.</p>
        <ul className="mt-4 space-y-4">
          {environment.locations.map((item) => {
            const meta = locationMeta(item.location)
            const width = item.averageScore === null ? 0 : Math.max(6, (item.averageScore / 10) * 100)
            return (
              <li key={item.location}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-ink">{meta.full}</p>
                  <p className="shrink-0 text-sm font-semibold text-ink">
                    <bdi dir="ltr">{item.averageScore === null ? '—' : item.averageScore.toFixed(1)}</bdi>
                  </p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                  {item.averageScore !== null ? (
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${width}%` }} />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {item.count === 0 ? (
                    'אין נתונים'
                  ) : (
                    <>
                      יעילות{' '}
                      <bdi dir="ltr">{item.cleanRatio === null ? '—' : `${Math.round(item.cleanRatio * 1000) / 10}%`}</bdi>
                      {' · '}
                      {dayCountLabel(item.count)}
                    </>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">אפקט החברה</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">תוצר, איכות זמן ונבז לא טוב. המודגש הוא המקום עם הכי מעט הסחות.</p>
        <div className="mt-4 space-y-2">
          {environment.social.map((item) => {
            const meta = socialMeta(item.context)
            const calm = environment.calmest.includes(item.context)
            return (
              <div
                key={item.context}
                className={cn('rounded-2xl border p-3', calm ? 'border-teal-300 bg-teal-50' : 'border-stone-200 bg-stone-50')}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{meta.full}</p>
                  <p className="text-xs text-stone-500">{item.count === 0 ? 'אין נתונים' : dayCountLabel(item.count)}</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                  <MiniStat label="תפוקה" value={item.averageOutput === null ? '—' : item.averageOutput.toFixed(1)} />
                  <MiniStat label="איכות זמן" value={item.averageQuality === null ? '—' : item.averageQuality.toFixed(1)} />
                  <MiniStat label="נבז לא טוב" value={item.averageBadIdle === null ? '—' : formatHours(item.averageBadIdle)} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">{calmSentence(environment.calmest)}</p>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">השפעת השינה</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">ציון יומי, שעות אפקטיביות ונבז לא טוב לפי שעות השינה בלילה שלפני.</p>
        <div className="mt-4 space-y-2">
          {sleep.map((item) => (
            <div key={item.bracket} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{SLEEP_BRACKET_LABELS[item.bracket]}</p>
                <p className="text-xs text-stone-500">{item.count === 0 ? 'אין נתונים' : dayCountLabel(item.count)}</p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                <MiniStat label="ציון" value={item.averageScore === null ? '—' : item.averageScore.toFixed(1)} />
                <MiniStat label="אפקטיבי" value={item.averageEffective === null ? '—' : formatHours(item.averageEffective)} />
                <MiniStat label="נבז לא טוב" value={item.averageBadIdle === null ? '—' : formatHours(item.averageBadIdle)} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          <SleepSentence rows={sleep} />
        </p>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-ink">השערת אימון</h3>
        <p className="mt-1 text-sm leading-6 text-stone-500">ממוצע תוצר ואיכות זמן בימי אימון מול ימים ללא אימון.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <HypothesisCard
            title="ימי אימון"
            hint="איזון 2"
            output={hypothesis.workoutOutput}
            quality={hypothesis.workoutQuality}
            count={hypothesis.workoutCount}
            tone="border-emerald-200 bg-emerald-50"
          />
          <HypothesisCard
            title="ללא אימון"
            hint={REST_BALANCE_HINT}
            output={hypothesis.restOutput}
            quality={hypothesis.restQuality}
            count={hypothesis.restCount}
            tone="border-stone-200 bg-stone-50"
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">{hypothesisSentence(hypothesis)}</p>
      </section>
    </div>
  )
}

function HeatRow({
  letter,
  row,
  weeks,
  entries,
  onOpenDay,
}: {
  letter: string
  row: number
  weeks: Date[]
  entries: Record<string, DailyEntry>
  onOpenDay: (date: string) => void
}) {
  return (
    <>
      <span className="text-[10px] text-stone-400">{letter}</span>
      {weeks.map((start) => {
        const date = addDays(start, row)
        const key = toDateKey(date)
        const entry = entries[key]
        const light: Light | 'empty' = entry ? (entry.isThesisDay ? dailyLight(entry) : 'neutral') : 'empty'
        const tone =
          light === 'empty' ? 'bg-stone-100' : light === 'neutral' ? 'bg-stone-300' : LIGHT_TONE[light].bar
        return (
          <button
            key={key}
            type="button"
            aria-label={`${formatDayMonth(date)} ${entry ? LIGHT_TEXT[entry.isThesisDay ? dailyLight(entry) : 'neutral'] : 'אין דיווח'}`}
            onClick={() => onOpenDay(key)}
            className={cn('aspect-square w-full rounded-[3px]', tone)}
          />
        )
      })}
    </>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn('size-2.5 rounded-[3px]', swatch)} />
      {label}
    </span>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="text-sm font-semibold text-ink">
        <bdi dir="ltr">{value}</bdi>
      </p>
    </div>
  )
}

function calmSentence(calmest: SocialContext[]): string {
  if (calmest.length === 0) return 'כדי להשוות, צריך לפחות יום תזה אחד עם שעות.'
  const names = calmest.map((context) => socialMeta(context).pill)
  if (names.length === 1) return `הכי פחות נבז לא טוב: ${names[0]}.`
  return `הכי פחות נבז לא טוב: ${names.join(' ו')}.`
}

function SleepSentence({ rows }: { rows: SleepInsight[] }) {
  const low = rows.find((item) => item.bracket === 'under6')
  const high = rows.find((item) => item.bracket === 'rested')
  if (!low?.count || !high?.count || low.averageScore === null || high.averageScore === null) {
    return <>כדי לראות את הקשר, צריך ימי תזה גם עם פחות מ-6 שעות שינה וגם עם 7.5+.</>
  }
  const lowScore = low.averageScore.toFixed(1)
  const highScore = high.averageScore.toFixed(1)
  if (high.averageScore > low.averageScore) {
    return (
      <>
        בימים עם 7.5+ שעות שינה הציון הממוצע <bdi dir="ltr">{highScore}</bdi>, לעומת <bdi dir="ltr">{lowScore}</bdi> בימים עם פחות מ-6.
      </>
    )
  }
  if (low.averageScore > high.averageScore) {
    return (
      <>
        בימים עם פחות מ-6 שעות שינה הציון הממוצע <bdi dir="ltr">{lowScore}</bdi>, לעומת <bdi dir="ltr">{highScore}</bdi> בימים עם 7.5+.
      </>
    )
  }
  return (
    <>
      הציון הממוצע <bdi dir="ltr">{highScore}</bdi> זהה בימים עם שינה קצרה ובימים עם 7.5+ שעות.
    </>
  )
}

function HypothesisCard({
  title,
  hint,
  output,
  quality,
  count,
  tone,
}: {
  title: string
  hint: string
  output: number | null
  quality: number | null
  count: number
  tone: string
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border p-3', tone)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-[11px] text-stone-500">{hint}</p>
      <p className="mt-2 text-[11px] text-stone-500">תפוקה</p>
      <p className="text-2xl font-semibold tracking-tight text-ink">
        <span dir="ltr" className="inline-block">
          {output === null ? '—' : output.toFixed(1)}
        </span>
      </p>
      <p className="mt-1 text-[11px] text-stone-500">איכות זמן</p>
      <p className="text-2xl font-semibold tracking-tight text-ink">
        <span dir="ltr" className="inline-block">
          {quality === null ? '—' : quality.toFixed(1)}
        </span>
      </p>
      <p className="text-xs text-stone-500">{count === 0 ? 'אין נתונים' : dayCountLabel(count)}</p>
    </div>
  )
}

function hypothesisSentence(hypothesis: ReturnType<typeof workoutHypothesis>): string {
  if (hypothesis.workoutOutput === null || hypothesis.restOutput === null) {
    return 'כדי לראות קשר, צריך לפחות יום אימון אחד ויום בלי אימון.'
  }
  const outputDiff = Math.round((hypothesis.workoutOutput - hypothesis.restOutput) * 10) / 10
  const output = sideSentence('ציון התוצר', 'גבוה', outputDiff)
  if (hypothesis.workoutQuality === null || hypothesis.restQuality === null) return output
  const qualityDiff = Math.round((hypothesis.workoutQuality - hypothesis.restQuality) * 10) / 10
  return `${output} ${sideSentence('איכות הזמן', 'גבוהה', qualityDiff)}`
}

function sideSentence(subject: string, higher: string, diff: number): string {
  const amount = `\u2066${Math.abs(diff).toFixed(1)}\u2069`
  if (diff > 0) return `בימי אימון ${subject} ${higher} ב־${amount}.`
  if (diff < 0) return `בימים ללא אימון ${subject} ${higher} ב־${amount}.`
  return `${subject} זהה בימי אימון ובימים ללא אימון.`
}
