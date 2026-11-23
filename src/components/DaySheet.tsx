import { useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, PenLine, Wrench } from 'lucide-react'
import { FULL_DAYS, formatDayMonth, parseDateKey, toDateKey } from '../lib/dates.ts'
import {
  BALANCE_OPTIONS,
  BALANCE_TAGS,
  FOCUS_CAPTION,
  OUTPUT_CAPTION,
  WORK_TYPES,
} from '../lib/labels.ts'
import { cn } from '../lib/cn.ts'
import { lightFromTotal } from '../lib/scoring.ts'
import { useThesis } from '../store/ThesisStore.tsx'
import type { DailyEntry, DraftEntry, Light, WorkType } from '../types.ts'
import { Sheet } from './Sheet.tsx'
import { LIGHT_TONE, TrafficBadge } from './TrafficLight.tsx'

const WORK_ICONS = {
  creative: PenLine,
  research: BookOpen,
  maintenance: Wrench,
} satisfies Record<WorkType, typeof PenLine>

export function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const { entries, saveEntry, deleteEntry } = useThesis()
  const existing = date in entries ? entries[date] : undefined
  const [draft, setDraft] = useState<DraftEntry>(() => draftFromEntry(existing))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const parsed = parseDateKey(date)
  const subtitle = date === toDateKey(new Date()) ? `היום · ${formatDayMonth(parsed)}` : formatDayMonth(parsed)
  const missing = missingFields(draft)
  const total = scoreTotal(draft)
  const previewLight: Light = !draft.isThesisDay || total === null ? 'neutral' : lightFromTotal(total)
  const canSave = !draft.isThesisDay || missing.length === 0

  function update(patch: Partial<DraftEntry>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    saveEntry({
      date,
      isThesisDay: draft.isThesisDay,
      workType: draft.workType,
      dailyGoal: draft.dailyGoal.trim(),
      outputScore: draft.outputScore,
      focusScore: draft.focusScore,
      balanceScore: draft.balanceScore,
      balanceTags: draft.balanceTags,
      notes: draft.notes.trim(),
    })
    onClose()
  }

  return (
    <Sheet title={FULL_DAYS[parsed.getDay()] ?? 'יום'} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-4 pt-2 pb-6">
          <button
            type="button"
            data-autofocus
            aria-pressed={draft.isThesisDay}
            onClick={() => update({ isThesisDay: !draft.isThesisDay })}
            className={cn(
              'flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-start',
              draft.isThesisDay ? 'border-teal-700 bg-teal-50' : 'border-stone-200 bg-stone-50',
            )}
          >
            <span>
              <span className="block font-medium text-ink">{draft.isThesisDay ? 'יום תזה' : 'יום ללא תזה'}</span>
              <span className="block text-sm text-stone-500">
                {draft.isThesisDay ? 'נספר בממוצע השבועי' : 'לא נספר בממוצע השבועי'}
              </span>
            </span>
            <span
              className={cn(
                'flex h-8 w-14 shrink-0 items-center rounded-full p-1',
                draft.isThesisDay ? 'justify-end bg-teal-700' : 'justify-start bg-stone-300',
              )}
              aria-hidden="true"
            >
              <span className="size-6 rounded-full bg-white shadow-sm" />
            </span>
          </button>

          {draft.isThesisDay ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-stone-800">סוג עבודה</legend>
                <div className="space-y-2">
                  {WORK_TYPES.map((type) => {
                    const selected = draft.workType === type.id
                    const Icon = WORK_ICONS[type.id]
                    return (
                      <button
                        key={type.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => update({ workType: type.id })}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-start text-base font-medium',
                          selected
                            ? 'border-teal-800 bg-teal-800 text-white'
                            : 'border-stone-200 bg-white text-stone-800',
                        )}
                      >
                        <Icon className="size-5 shrink-0" aria-hidden="true" />
                        {type.full}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-800">יעד יומי</span>
                <input
                  value={draft.dailyGoal}
                  maxLength={140}
                  enterKeyHint="done"
                  onChange={(event) => update({ dailyGoal: event.target.value })}
                  placeholder="לדוגמה: טיוטה לפסקה הראשונה"
                  className="h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-base text-ink outline-none"
                />
              </label>

              <ScorePicker
                label="תוצר"
                caption={OUTPUT_CAPTION}
                value={draft.outputScore}
                max={4}
                onChange={(outputScore) => update({ outputScore })}
              />
              <ScorePicker
                label="ריכוז"
                caption={FOCUS_CAPTION}
                value={draft.focusScore}
                max={4}
                onChange={(focusScore) => update({ focusScore })}
              />

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-stone-800">איזון</legend>
                <div className="space-y-2">
                  {BALANCE_OPTIONS.map((option) => {
                    const selected = draft.balanceScore === option.score
                    return (
                      <button
                        key={option.score}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => update({ balanceScore: option.score })}
                        className={cn(
                          'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-start',
                          selected
                            ? 'border-teal-800 bg-teal-800 text-white'
                            : 'border-stone-200 bg-white text-stone-800',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold',
                            selected ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-700',
                          )}
                        >
                          {option.score}
                        </span>
                        <span className="text-base font-medium">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-stone-800">תגיות איזון</legend>
                <div className="flex flex-wrap gap-2">
                  {BALANCE_TAGS.map((tag) => {
                    const selected = draft.balanceTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          update({
                            balanceTags: selected
                              ? draft.balanceTags.filter((item) => item !== tag)
                              : [...draft.balanceTags, tag],
                          })
                        }
                        className={cn(
                          'inline-flex h-11 items-center rounded-full border px-3 text-sm font-medium',
                          selected
                            ? 'border-teal-700 bg-teal-50 text-teal-900'
                            : 'border-stone-200 bg-white text-stone-700',
                        )}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </>
          ) : null}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-800">
              הערות <span className="font-normal text-stone-400">לא חובה</span>
            </span>
            <textarea
              value={draft.notes}
              rows={3}
              maxLength={2000}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="מה עזר, ומה הפריע"
              className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-base leading-6 text-ink outline-none"
            />
          </label>

          {existing ? (
            confirmDelete ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-medium text-rose-950">למחוק את הרשומה של היום?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      deleteEntry(date)
                      onClose()
                    }}
                    className="h-11 rounded-xl bg-rose-700 text-sm font-medium text-white"
                  >
                    מחיקה
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="h-11 rounded-xl border border-rose-200 bg-white text-sm font-medium text-rose-900"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-11 w-full text-sm font-medium text-rose-700"
              >
                מחיקת הרשומה
              </button>
            )
          ) : null}
        </div>

        <footer
          className={cn('shrink-0 border-t border-stone-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]', LIGHT_TONE[previewLight].soft)}
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">ציון יומי</p>
              {draft.isThesisDay ? (
                total === null ? (
                  <p className="mt-0.5 text-sm leading-5">חסר: {missing.join(' · ')}</p>
                ) : (
                  <p className="text-2xl leading-none font-semibold">
                    <span dir="ltr" className="inline-block">
                      {total}
                      <span className="text-sm font-medium opacity-70"> / 10</span>
                    </span>
                  </p>
                )
              ) : (
                <p className="mt-0.5 text-sm leading-5">יום ללא תזה · לא נכלל בממוצע</p>
              )}
            </div>
            {draft.isThesisDay && total !== null ? <TrafficBadge light={previewLight} /> : null}
            <button
              type="submit"
              disabled={!canSave}
              className="h-12 shrink-0 rounded-xl bg-teal-800 px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              שמירה
            </button>
          </div>
        </footer>
      </form>
    </Sheet>
  )
}

function ScorePicker({
  label,
  caption,
  value,
  max,
  onChange,
}: {
  label: string
  caption: string
  value: number | null
  max: number
  onChange: (score: number) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-stone-800">{label}</legend>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${max + 1}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: max + 1 }, (_, score) => {
          const selected = value === score
          return (
            <button
              key={score}
              type="button"
              aria-pressed={selected}
              aria-label={`${label} ${score}`}
              onClick={() => onChange(score)}
              className={cn(
                'h-12 rounded-xl border text-base font-semibold',
                selected ? 'border-teal-800 bg-teal-800 text-white' : 'border-stone-200 bg-white text-stone-800',
              )}
            >
              {score}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-500">{caption}</p>
    </fieldset>
  )
}

function draftFromEntry(entry: DailyEntry | undefined): DraftEntry {
  if (!entry) {
    return {
      isThesisDay: true,
      workType: null,
      dailyGoal: '',
      outputScore: null,
      focusScore: null,
      balanceScore: null,
      balanceTags: [],
      notes: '',
    }
  }
  return {
    isThesisDay: entry.isThesisDay,
    workType: entry.workType,
    dailyGoal: entry.dailyGoal,
    outputScore: entry.outputScore,
    focusScore: entry.focusScore,
    balanceScore: entry.balanceScore,
    balanceTags: [...entry.balanceTags],
    notes: entry.notes,
  }
}

function missingFields(draft: DraftEntry): string[] {
  if (!draft.isThesisDay) return []
  const missing: string[] = []
  if (!draft.workType) missing.push('סוג עבודה')
  if (draft.outputScore === null) missing.push('תוצר')
  if (draft.focusScore === null) missing.push('ריכוז')
  if (draft.balanceScore === null) missing.push('איזון')
  return missing
}

function scoreTotal(draft: DraftEntry): number | null {
  if (draft.outputScore === null || draft.focusScore === null || draft.balanceScore === null) return null
  return draft.outputScore + draft.focusScore + draft.balanceScore
}
