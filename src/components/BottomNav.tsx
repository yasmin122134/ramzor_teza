import { CalendarDays, ChartColumn } from 'lucide-react'
import { cn } from '../lib/cn.ts'

export type AppTab = 'week' | 'insights'

export function BottomNav({ tab, onChange }: { tab: AppTab; onChange: (tab: AppTab) => void }) {
  const items: { id: AppTab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'week', label: 'יומן שבועי', icon: CalendarDays },
    { id: 'insights', label: 'תובנות', icon: ChartColumn },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = tab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium',
                active ? 'text-teal-800' : 'text-stone-500',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
