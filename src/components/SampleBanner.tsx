import { useState } from 'react'
import { useThesis } from '../store/ThesisStore.tsx'

export function SampleBanner() {
  const { clearSamples } = useThesis()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm leading-6 text-amber-950">
        מוצגות רשומות דוגמה כדי שהיומן לא ייפתח ריק. מחיקה מסירה רק אותן, לא רשומות שמילאתם.
      </p>
      {confirming ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={clearSamples}
            className="h-11 rounded-xl bg-amber-900 text-sm font-medium text-white"
          >
            נקה נתוני דוגמה
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-11 rounded-xl border border-amber-200 bg-white text-sm font-medium text-amber-950"
          >
            ביטול
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 h-11 w-full rounded-xl border border-amber-300 bg-white text-sm font-medium text-amber-950"
        >
          נקה נתוני דוגמה
        </button>
      )}
    </div>
  )
}
