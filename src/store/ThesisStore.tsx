import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_TARGET_HOURS } from '../lib/mix.ts'
import { emptyWeek, loadState, saveState } from '../lib/storage.ts'
import type { DailyEntry, PersistedState, WeekRecord } from '../types.ts'

interface ThesisStoreValue {
  entries: Record<string, DailyEntry>
  weeks: Record<string, WeekRecord>
  sampleCount: number
  saveEntry: (entry: DailyEntry) => void
  deleteEntry: (date: string) => void
  updateWeek: (weekId: string, patch: Partial<Omit<WeekRecord, 'weekId'>>) => void
  replaceAll: (next: PersistedState) => void
  clearSamples: () => void
}

const ThesisContext = createContext<ThesisStoreValue | null>(null)

export function ThesisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const saveEntry = useCallback((entry: DailyEntry) => {
    setState((prev) => ({
      ...prev,
      entries: { ...prev.entries, [entry.date]: entry },
    }))
  }, [])

  const deleteEntry = useCallback((date: string) => {
    setState((prev) => {
      const entries = { ...prev.entries }
      delete entries[date]
      return { ...prev, entries }
    })
  }, [])

  const updateWeek = useCallback((weekId: string, patch: Partial<Omit<WeekRecord, 'weekId'>>) => {
    setState((prev) => {
      const current = prev.weeks[weekId] ?? emptyWeek(weekId)
      const next = { ...current, ...patch, weekId }
      const weeks = { ...prev.weeks }
      const pristine =
        next.targetWeeklyHours === DEFAULT_TARGET_HOURS &&
        !next.topAchievement &&
        !next.bottleneck &&
        !next.nextFirstStep
      if (pristine) delete weeks[weekId]
      else weeks[weekId] = next
      return { ...prev, weeks }
    })
  }, [])

  const replaceAll = useCallback((next: PersistedState) => {
    setState({ version: 2, entries: next.entries, weeks: next.weeks })
  }, [])

  const clearSamples = useCallback(() => {
    setState((prev) => {
      const entries: Record<string, DailyEntry> = {}
      for (const [date, entry] of Object.entries(prev.entries)) {
        if (!entry.isSample) entries[date] = entry
      }
      return { ...prev, entries }
    })
  }, [])

  const sampleCount = useMemo(
    () => Object.values(state.entries).filter((entry) => entry.isSample).length,
    [state.entries],
  )

  const value = useMemo<ThesisStoreValue>(
    () => ({
      entries: state.entries,
      weeks: state.weeks,
      sampleCount,
      saveEntry,
      deleteEntry,
      updateWeek,
      replaceAll,
      clearSamples,
    }),
    [state.entries, state.weeks, sampleCount, saveEntry, deleteEntry, updateWeek, replaceAll, clearSamples],
  )

  return <ThesisContext.Provider value={value}>{children}</ThesisContext.Provider>
}

export function useThesis(): ThesisStoreValue {
  const context = useContext(ThesisContext)
  if (!context) throw new Error('useThesis must be used within ThesisProvider')
  return context
}
