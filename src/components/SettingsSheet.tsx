import { useRef, useState } from 'react'
import { Download, Trash, Upload } from 'lucide-react'
import { backupFilename, downloadText, parseBackup, toCsv, toJson } from '../lib/backup.ts'
import { useThesis } from '../store/ThesisStore.tsx'
import type { PersistedState } from '../types.ts'
import { Sheet } from './Sheet.tsx'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { entries, weeks, sampleCount, cloudEmail, replaceAll, clearSamples } = useThesis()
  const jsonRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PersistedState | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  function exportJson() {
    const state = { version: 2 as const, entries, weeks }
    downloadText(backupFilename('json'), toJson(state), 'application/json;charset=utf-8')
    setError(null)
    setPending(null)
    setMessage('קובץ ה־JSON ירד למכשיר.')
  }

  function exportCsv() {
    const state = { version: 2 as const, entries, weeks }
    downloadText(backupFilename('csv'), toCsv(state), 'text/csv;charset=utf-8')
    setError(null)
    setPending(null)
    setMessage('קובץ ה־CSV ירד למכשיר.')
  }

  function onPick(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = parseBackup(text)
      if (!result.ok) {
        setError(result.error)
        setMessage(null)
        setPending(null)
        return
      }
      setError(null)
      setMessage(null)
      setPending(result.state)
    }
    reader.onerror = () => {
      setError('לא הצלחנו לקרוא את הקובץ.')
      setPending(null)
    }
    reader.readAsText(file)
  }

  return (
    <Sheet title="הגדרות" subtitle="גיבוי, שחזור ונתוני דוגמה" onClose={onClose}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <CloudSection />

        <button type="button" onClick={exportJson} className={actionClass}>
          <Download className="size-5 shrink-0" aria-hidden="true" />
          ייצוא JSON
        </button>
        <button type="button" onClick={exportCsv} className={actionClass}>
          <Download className="size-5 shrink-0" aria-hidden="true" />
          ייצוא CSV
        </button>
        <button type="button" onClick={() => jsonRef.current?.click()} className={actionClass}>
          <Upload className="size-5 shrink-0" aria-hidden="true" />
          ייבוא JSON
        </button>
        <button type="button" onClick={() => csvRef.current?.click()} className={actionClass}>
          <Upload className="size-5 shrink-0" aria-hidden="true" />
          ייבוא CSV
        </button>
        <input
          ref={jsonRef}
          type="file"
          accept="application/json,.json"
          tabIndex={-1}
          className="hidden"
          onChange={(event) => {
            onPick(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <input
          ref={csvRef}
          type="file"
          accept="text/csv,.csv"
          tabIndex={-1}
          className="hidden"
          onChange={(event) => {
            onPick(event.target.files?.[0])
            event.target.value = ''
          }}
        />

        {pending ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm leading-6 font-medium text-amber-950">
              {cloudEmail ? 'ייבוא יחליף את היומן במכשיר ובחשבון.' : 'ייבוא יחליף את כל הנתונים השמורים במכשיר.'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  replaceAll(pending)
                  setPending(null)
                  setMessage('הנתונים הוחלפו מהגיבוי.')
                }}
                className="h-11 rounded-xl bg-amber-900 text-sm font-medium text-white"
              >
                החלפת הנתונים
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="h-11 rounded-xl border border-amber-200 bg-white text-sm font-medium text-amber-950"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="rounded-2xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">{message}</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-900">{error}</p> : null}

        <div className="border-t border-stone-200 pt-3">
          {sampleCount === 0 ? (
            <p className="px-1 text-sm text-stone-500">אין נתוני דוגמה.</p>
          ) : confirmClear ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm leading-6 text-rose-950">למחוק את רשומות הדוגמה?</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearSamples()
                    setConfirmClear(false)
                    setMessage('נתוני הדוגמה נמחקו.')
                  }}
                  className="h-11 rounded-xl bg-rose-700 text-sm font-medium text-white"
                >
                  נקה נתוני דוגמה
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="h-11 rounded-xl border border-rose-200 bg-white text-sm font-medium text-rose-900"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className={actionClass}>
              <Trash className="size-5 shrink-0" aria-hidden="true" />
              נקה נתוני דוגמה
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function CloudSection() {
  const { cloudMode, cloudEmail, cloudNotice, sendSignInLink, signOut } = useThesis()
  const [address, setAddress] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    const email = address.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('המייל לא נראה תקין.')
      setSentTo(null)
      return
    }
    setSending(true)
    setError(null)
    try {
      await sendSignInLink(email)
      setSentTo(email)
    } catch (caught) {
      setSentTo(null)
      setError(caught instanceof Error ? caught.message : 'לא הצלחנו לשלוח את הקישור. כדאי לנסות שוב.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-3">
      <h2 className="text-sm font-medium text-stone-800">חשבון בענן</h2>
      {cloudMode === 'off' ? (
        <p className="mt-1 text-sm leading-6 text-stone-600">
          היומן נשמר במכשיר. חיבור Supabase עדיין לא הוגדר, אז אין עדיין חשבון לסנכרן אליו.
        </p>
      ) : null}
      {cloudMode === 'checking' ? <p className="mt-1 text-sm leading-6 text-stone-600">מתחברים לחשבון…</p> : null}
      {cloudMode === 'error' && !cloudEmail ? (
        <p className="mt-1 text-sm leading-6 text-rose-800">{cloudNotice ?? 'לא הצלחנו להתחבר לענן.'}</p>
      ) : null}
      {cloudMode === 'signed-out' ? (
        <form onSubmit={(event) => void submit(event)} className="mt-2 space-y-2">
          <p className="text-sm leading-6 text-stone-600">
            כניסה עם קישור למייל שומרת את היומן בחשבון, ומשם בשאר המכשירים. רשומות הדוגמה לא עולות.
          </p>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-stone-800">מייל</span>
            <input
              type="email"
              dir="ltr"
              autoComplete="email"
              inputMode="email"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-left text-base text-ink outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="h-12 w-full rounded-xl bg-teal-800 text-sm font-medium text-white disabled:opacity-60"
          >
            {sending ? 'שולחים קישור…' : 'שליחת קישור כניסה'}
          </button>
          {sentTo ? (
            <p className="text-sm leading-6 text-emerald-900" aria-live="polite">
              שלחנו קישור אל {sentTo}. פותחים אותו במכשיר הזה.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm leading-6 text-rose-800" aria-live="polite">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      {cloudEmail ? (
        <div className="mt-2 space-y-2">
          <p dir="ltr" className="truncate text-left text-sm text-stone-800">
            {cloudEmail}
          </p>
          <p className="text-sm leading-6 text-stone-600">
            {cloudMode === 'error'
              ? cloudNotice
              : cloudMode === 'syncing'
                ? 'שומר בענן. עותק נשאר גם במכשיר.'
                : 'היומן מסונכרן לחשבון ונשמר גם במכשיר. רשומות דוגמה לא עולות.'}
          </p>
          <button
            type="button"
            disabled={leaving}
            onClick={() => {
              setError(null)
              setLeaving(true)
              void signOut()
                .catch(() => setError('לא הצלחנו לצאת. כדאי לנסות שוב.'))
                .finally(() => setLeaving(false))
            }}
            className="h-12 w-full rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-800 disabled:opacity-60"
          >
            יציאה
          </button>
          {error ? <p className="text-sm leading-6 text-rose-800">{error}</p> : null}
        </div>
      ) : null}
      <p className="mt-3 text-sm leading-6 text-stone-600">
        אפשר לייצא עותק, וגם להתקין את רמזור תזה למסך הבית דרך תפריט השיתוף.
      </p>
    </section>
  )
}

const actionClass =
  'flex h-12 w-full items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 text-start text-sm font-medium text-stone-800'
