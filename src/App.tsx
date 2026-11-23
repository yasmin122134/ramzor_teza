import { useState } from 'react'
import { Settings } from 'lucide-react'
import { BottomNav } from './components/BottomNav.tsx'
import type { AppTab } from './components/BottomNav.tsx'
import { DaySheet } from './components/DaySheet.tsx'
import { InsightsView } from './components/InsightsView.tsx'
import { SampleBanner } from './components/SampleBanner.tsx'
import { SettingsSheet } from './components/SettingsSheet.tsx'
import { WeekView } from './components/WeekView.tsx'
import { addDays, startOfWeek } from './lib/dates.ts'
import { ThesisProvider, useThesis } from './store/ThesisStore.tsx'

export function App() {
  return (
    <ThesisProvider>
      <Shell />
    </ThesisProvider>
  )
}

function Shell() {
  const { sampleCount } = useThesis()
  const [tab, setTab] = useState<AppTab>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="min-h-dvh overflow-x-hidden bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-paper/90 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">רמזור תזה</h1>
            <p className="text-xs text-stone-500">אפקטיביות, תפוקה וקיימות</p>
          </div>
          <button
            type="button"
            aria-label="הגדרות"
            onClick={() => setSettingsOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700"
          >
            <Settings className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pt-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))]">
        {sampleCount > 0 ? <SampleBanner /> : null}
        {tab === 'week' ? (
          <WeekView
            weekStart={weekStart}
            onPrev={() => setWeekStart((current) => addDays(current, -7))}
            onNext={() => setWeekStart((current) => addDays(current, 7))}
            onToday={() => setWeekStart(startOfWeek(new Date()))}
            onOpenDay={setOpenDate}
          />
        ) : (
          <InsightsView weekStart={weekStart} onOpenDay={setOpenDate} />
        )}
      </main>
      <BottomNav tab={tab} onChange={setTab} />
      {openDate ? <DaySheet date={openDate} onClose={() => setOpenDate(null)} /> : null}
      {settingsOpen ? <SettingsSheet onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  )
}
