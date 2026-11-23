import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { loadState, saveState } from '../lib/storage.ts'
import type { DailyEntry, PersistedState, WeeklyReflection } from '../types.ts'

interface ThesisStoreValue {
  entries: Record<string, DailyEntry>
  reflections: Record<string, WeeklyReflection>
  sampleCount: number
  saveEntry: (entry: DailyEntry) => void
  deleteEntry: (date: string) => void
  updateReflection: (weekId: string, patch: Partial<Omit<WeeklyReflection, 'weekId'>>) => void
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

  const updateReflection = useCallback((weekId: string, patch: Partial<Omit<WeeklyReflection, 'weekId'>>) => {
    setState((prev) => {
      const current = prev.reflections[weekId] ?? {
        weekId,
        topAchievement: '',
        bottleneck: '',
        nextFirstStep: '',
      }
      const next = { ...current, ...patch, weekId }
      const reflections = { ...prev.reflections }
      if (!next.topAchievement && !next.bottleneck && !next.nextFirstStep) delete reflections[weekId]
      else reflections[weekId] = next
      return { ...prev, reflections }
    })
  }, [])

  const replaceAll = useCallback((next: PersistedState) => {
    setState({ version: 1, entries: next.entries, reflections: next.reflections })
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
      reflections: state.reflections,
      sampleCount,
      saveEntry,
      deleteEntry,
      updateReflection,
      replaceAll,
      clearSamples,
    }),
    [state.entries, state.reflections, sampleCount, saveEntry, deleteEntry, updateReflection, replaceAll, clearSamples],
  )

  return <ThesisContext.Provider value={value}>{children}</ThesisContext.Provider>
}

export function useThesis(): ThesisStoreValue {
  const context = useContext(ThesisContext)
  if (!context) throw new Error('useThesis must be used within ThesisProvider')
  return context
}
