import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { dirtyWork, loadSync, mergeAccount, saveSync, withStamps, withoutSamples } from '../lib/account.ts'
import type { SyncMarks } from '../lib/account.ts'
import {
  cloudConfigured,
  fetchRemote,
  removeRemoteEntry,
  removeRemoteWeek,
  replaceRemote,
  sendMagicLink,
  signInWithGoogle,
  signOutCloud,
  subscribeUser,
  upsertRemoteEntry,
  upsertRemoteWeek,
} from '../lib/cloud.ts'
import type { CloudUser } from '../lib/cloud.ts'
import { DEFAULT_TARGET_HOURS } from '../lib/mix.ts'
import { emptyWeek, loadState, rememberAccount, saveState } from '../lib/storage.ts'
import type { DailyEntry, PersistedState, WeekRecord } from '../types.ts'

export type CloudMode = 'off' | 'checking' | 'signed-out' | 'syncing' | 'synced' | 'error'

interface ThesisStoreValue {
  entries: Record<string, DailyEntry>
  weeks: Record<string, WeekRecord>
  sampleCount: number
  cloudMode: CloudMode
  cloudEmail: string | null
  cloudNotice: string | null
  saveEntry: (entry: DailyEntry) => void
  deleteEntry: (date: string) => void
  updateWeek: (weekId: string, patch: Partial<Omit<WeekRecord, 'weekId'>>) => void
  replaceAll: (next: PersistedState) => void
  clearSamples: () => void
  sendSignInLink: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const ThesisContext = createContext<ThesisStoreValue | null>(null)
const WRITE_ERROR = 'הנתונים נשמרו במכשיר. השמירה בענן לא הצליחה.'
const READ_ERROR = 'הנתונים נשמרו במכשיר. לא הצלחנו לקרוא את הענן.'

function omitStamp(map: Record<string, string>, key: string): Record<string, string> {
  if (!(key in map)) return map
  const next = { ...map }
  delete next[key]
  return next
}

export function ThesisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState)
  const [cloudMode, setCloudMode] = useState<CloudMode>(cloudConfigured() ? 'checking' : 'off')
  const [cloudNotice, setCloudNotice] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const stateRef = useRef(state)
  const syncRef = useRef<SyncMarks>(loadSync())
  const sessionRef = useRef<CloudUser | null>(null)
  const revision = useRef(0)
  const chain = useRef(Promise.resolve())
  const kickTimer = useRef<number | null>(null)
  stateRef.current = state

  useEffect(() => {
    saveState(state)
  }, [state])

  const noteMarks = useCallback((marks: SyncMarks) => {
    revision.current += 1
    syncRef.current = marks
    saveSync(marks)
  }, [])

  const enqueue = useCallback((task: () => Promise<void>) => {
    chain.current = chain.current.then(task, task)
  }, [])

  const flushBody = useCallback(async (userId: string) => {
    setCloudMode('syncing')
    setCloudNotice(null)
    try {
      for (let pass = 0; pass < 4; pass += 1) {
        const stamped = withStamps(stateRef.current, syncRef.current, new Date().toISOString())
        if (stamped !== syncRef.current) noteMarks(stamped)
        const start = revision.current
        const marks = syncRef.current
        const snapshot = withoutSamples(stateRef.current)
        if (marks.replaceAll) {
          await replaceRemote(userId, snapshot, marks)
          if (revision.current !== start) continue
          const ackedEntries: Record<string, string> = {}
          const ackedWeeks: Record<string, string> = {}
          for (const date of Object.keys(snapshot.entries)) ackedEntries[date] = marks.entries[date] ?? ''
          for (const weekId of Object.keys(snapshot.weeks)) ackedWeeks[weekId] = marks.weeks[weekId] ?? ''
          noteMarks({
            entries: { ...marks.entries },
            weeks: { ...marks.weeks },
            ackedEntries,
            ackedWeeks,
            deletedEntries: {},
            deletedWeeks: {},
            replaceAll: false,
          })
          setCloudMode('synced')
          setCloudNotice(null)
          return
        }

        const work = dirtyWork(snapshot, marks)
        if (
          work.uploadEntries.length === 0 &&
          work.uploadWeeks.length === 0 &&
          work.deleteEntries.length === 0 &&
          work.deleteWeeks.length === 0
        ) {
          setCloudMode('synced')
          setCloudNotice(null)
          return
        }
        for (const entry of work.uploadEntries) {
          await upsertRemoteEntry(userId, entry, marks.entries[entry.date] ?? new Date().toISOString())
        }
        for (const week of work.uploadWeeks) {
          await upsertRemoteWeek(userId, week, marks.weeks[week.weekId] ?? new Date().toISOString())
        }
        for (const date of work.deleteEntries) await removeRemoteEntry(userId, date)
        for (const weekId of work.deleteWeeks) await removeRemoteWeek(userId, weekId)
        if (revision.current !== start) continue

        const ackedEntries = { ...marks.ackedEntries }
        const ackedWeeks = { ...marks.ackedWeeks }
        let deletedEntries = { ...marks.deletedEntries }
        let deletedWeeks = { ...marks.deletedWeeks }
        for (const entry of work.uploadEntries) {
          const stamp = marks.entries[entry.date]
          if (stamp && syncRef.current.entries[entry.date] === stamp) ackedEntries[entry.date] = stamp
        }
        for (const week of work.uploadWeeks) {
          const stamp = marks.weeks[week.weekId]
          if (stamp && syncRef.current.weeks[week.weekId] === stamp) ackedWeeks[week.weekId] = stamp
        }
        for (const date of work.deleteEntries) {
          if (syncRef.current.deletedEntries[date] === marks.deletedEntries[date]) deletedEntries = omitStamp(deletedEntries, date)
        }
        for (const weekId of work.deleteWeeks) {
          if (syncRef.current.deletedWeeks[weekId] === marks.deletedWeeks[weekId]) deletedWeeks = omitStamp(deletedWeeks, weekId)
        }
        noteMarks({ ...syncRef.current, ackedEntries, ackedWeeks, deletedEntries, deletedWeeks })
        setCloudMode('synced')
        setCloudNotice(null)
        return
      }
      setCloudMode('error')
      setCloudNotice(WRITE_ERROR)
    } catch {
      setCloudMode('error')
      setCloudNotice(WRITE_ERROR)
    }
  }, [noteMarks])

  const pull = useCallback(
    async (userId: string) => {
      setCloudMode('syncing')
      try {
        const remote = await fetchRemote(userId)
        let mergedMarks = syncRef.current
        setState((prev) => {
          const merged = mergeAccount(
            prev,
            remote.state,
            syncRef.current,
            remote.entryStamps,
            remote.weekStamps,
            new Date().toISOString(),
          )
          mergedMarks = merged.marks
          const next = merged.state
          stateRef.current = next
          return next
        })
        noteMarks(mergedMarks)
        await flushBody(userId)
      } catch {
        setCloudMode('error')
        setCloudNotice(READ_ERROR)
      }
    },
    [flushBody, noteMarks],
  )

  const kick = useCallback(() => {
    const user = sessionRef.current
    if (!user) return
    if (kickTimer.current !== null) window.clearTimeout(kickTimer.current)
    kickTimer.current = window.setTimeout(() => {
      kickTimer.current = null
      const current = sessionRef.current
      if (!current) return
      enqueue(() => flushBody(current.id))
    }, 400)
  }, [enqueue, flushBody])

  useEffect(() => {
    if (!cloudConfigured()) return
    let unsubscribe = () => {}
    try {
      unsubscribe = subscribeUser((user) => {
        sessionRef.current = user
        setEmail(user?.email ?? null)
        if (!user) {
          setCloudMode('signed-out')
          return
        }
        rememberAccount()
        enqueue(() => pull(user.id))
      })
    } catch {
      setCloudMode('error')
      setCloudNotice('לא הצלחנו להתחבר לענן.')
    }
    return () => {
      unsubscribe()
      if (kickTimer.current !== null) window.clearTimeout(kickTimer.current)
    }
  }, [enqueue, pull])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      const user = sessionRef.current
      if (!user) return
      enqueue(() => pull(user.id))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enqueue, pull])

  const saveEntry = useCallback(
    (entry: DailyEntry) => {
      const stored: DailyEntry = { ...entry }
      delete stored.isSample
      setState((prev) => {
        const next = { ...prev, entries: { ...prev.entries, [entry.date]: stored } }
        stateRef.current = next
        return next
      })
      const stamp = new Date().toISOString()
      const marks = syncRef.current
      noteMarks({
        ...marks,
        entries: { ...marks.entries, [entry.date]: stamp },
        deletedEntries: omitStamp(marks.deletedEntries, entry.date),
      })
      kick()
    },
    [kick, noteMarks],
  )

  const deleteEntry = useCallback(
    (date: string) => {
      const existing = stateRef.current.entries[date]
      setState((prev) => {
        const entries = { ...prev.entries }
        delete entries[date]
        const next = { ...prev, entries }
        stateRef.current = next
        return next
      })
      const marks = syncRef.current
      const stamp = new Date().toISOString()
      noteMarks({
        ...marks,
        entries: omitStamp(marks.entries, date),
        ackedEntries: omitStamp(marks.ackedEntries, date),
        deletedEntries:
          existing && !existing.isSample ? { ...marks.deletedEntries, [date]: stamp } : omitStamp(marks.deletedEntries, date),
      })
      kick()
    },
    [kick, noteMarks],
  )

  const updateWeek = useCallback(
    (weekId: string, patch: Partial<Omit<WeekRecord, 'weekId'>>) => {
      const prev = stateRef.current
      const current = prev.weeks[weekId] ?? emptyWeek(weekId)
      const nextWeek = { ...current, ...patch, weekId }
      const pristine =
        nextWeek.targetWeeklyHours === DEFAULT_TARGET_HOURS &&
        !nextWeek.topAchievement &&
        !nextWeek.bottleneck &&
        !nextWeek.nextFirstStep
      const weeks = { ...prev.weeks }
      if (pristine) delete weeks[weekId]
      else weeks[weekId] = nextWeek
      const next = { ...prev, weeks }
      stateRef.current = next
      setState(next)
      const marks = syncRef.current
      const stamp = new Date().toISOString()
      if (pristine) {
        const deletedWeeks = { ...marks.deletedWeeks }
        if (prev.weeks[weekId] || marks.ackedWeeks[weekId]) deletedWeeks[weekId] = stamp
        noteMarks({
          ...marks,
          weeks: omitStamp(marks.weeks, weekId),
          ackedWeeks: omitStamp(marks.ackedWeeks, weekId),
          deletedWeeks,
        })
      } else {
        noteMarks({
          ...marks,
          weeks: { ...marks.weeks, [weekId]: stamp },
          deletedWeeks: omitStamp(marks.deletedWeeks, weekId),
        })
      }
      kick()
    },
    [kick, noteMarks],
  )

  const replaceAll = useCallback(
    (next: PersistedState) => {
      const cleaned = { version: 2 as const, entries: next.entries, weeks: next.weeks }
      stateRef.current = cleaned
      setState(cleaned)
      const stamp = new Date().toISOString()
      const entries: Record<string, string> = {}
      const weeks: Record<string, string> = {}
      for (const date of Object.keys(withoutSamples(cleaned).entries)) entries[date] = stamp
      for (const weekId of Object.keys(cleaned.weeks)) weeks[weekId] = stamp
      noteMarks({
        entries,
        weeks,
        ackedEntries: {},
        ackedWeeks: {},
        deletedEntries: {},
        deletedWeeks: {},
        replaceAll: true,
      })
      kick()
    },
    [kick, noteMarks],
  )

  const clearSamples = useCallback(() => {
    setState((prev) => {
      const entries: Record<string, DailyEntry> = {}
      for (const [date, entry] of Object.entries(prev.entries)) {
        if (!entry.isSample) entries[date] = entry
      }
      const next = { ...prev, entries }
      stateRef.current = next
      return next
    })
  }, [])

  const sendSignInLink = useCallback(async (address: string) => {
    await sendMagicLink(address)
  }, [])

  const signInGoogle = useCallback(async () => {
    await signInWithGoogle()
  }, [])

  const signOut = useCallback(async () => {
    await signOutCloud()
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
      cloudMode,
      cloudEmail: email,
      cloudNotice,
      saveEntry,
      deleteEntry,
      updateWeek,
      replaceAll,
      clearSamples,
      sendSignInLink,
      signInWithGoogle: signInGoogle,
      signOut,
    }),
    [
      state.entries,
      state.weeks,
      sampleCount,
      cloudMode,
      email,
      cloudNotice,
      saveEntry,
      deleteEntry,
      updateWeek,
      replaceAll,
      clearSamples,
      sendSignInLink,
      signInGoogle,
      signOut,
    ],
  )

  return <ThesisContext.Provider value={value}>{children}</ThesisContext.Provider>
}

export function useThesis(): ThesisStoreValue {
  const context = useContext(ThesisContext)
  if (!context) throw new Error('useThesis must be used within ThesisProvider')
  return context
}
