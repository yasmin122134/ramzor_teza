import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  bundleEntries,
  bundleWeeks,
  entryToRow,
  weekToRow,
  type SyncMarks,
} from './account.ts'
import type { DailyEntry, PersistedState, WeekRecord } from '../types.ts'

export interface CloudUser {
  id: string
  email: string
}

export interface RemoteJournal {
  state: PersistedState
  entryStamps: Record<string, string>
  weekStamps: Record<string, string>
}

let client: SupabaseClient | null = null

export function cloudConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

function requireClient(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('supabase is not configured')
  client = createClient(url, key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return client
}

function authMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('rate') || lower.includes('once every') || lower.includes('security purposes')) {
    return 'נשלח קישור לפני רגע. כדאי לבדוק את תיבת המייל.'
  }
  if (lower.includes('email')) return 'המייל לא נראה תקין.'
  return 'לא הצלחנו לשלוח את הקישור. כדאי לנסות שוב.'
}

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw new Error(authMessage(error.message))
}

export async function signOutCloud(): Promise<void> {
  const { error } = await requireClient().auth.signOut()
  if (error) throw new Error('לא הצלחנו לצאת. כדאי לנסות שוב.')
}

export function subscribeUser(listener: (user: CloudUser | null) => void): () => void {
  const { data } = requireClient().auth.onAuthStateChange((_event, session) => {
    if (!session?.user.id) {
      listener(null)
      return
    }
    listener({ id: session.user.id, email: session.user.email ?? '' })
  })
  return () => data.subscription.unsubscribe()
}

async function fetchPage(table: 'daily_entries' | 'week_records', userId: string, column: 'date' | 'week_id'): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await requireClient()
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(column, { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

export async function fetchRemote(userId: string): Promise<RemoteJournal> {
  const [entryRows, weekRows] = await Promise.all([
    fetchPage('daily_entries', userId, 'date'),
    fetchPage('week_records', userId, 'week_id'),
  ])
  const entries = bundleEntries(entryRows)
  const weeks = bundleWeeks(weekRows)
  return {
    state: { version: 2, entries: entries.entries, weeks: weeks.weeks },
    entryStamps: entries.stamps,
    weekStamps: weeks.stamps,
  }
}

export async function upsertRemoteEntry(userId: string, entry: DailyEntry, updatedAt: string): Promise<void> {
  const { error } = await requireClient().from('daily_entries').upsert(entryToRow(userId, entry, updatedAt), {
    onConflict: 'user_id,date',
  })
  if (error) throw error
}

export async function upsertRemoteWeek(userId: string, week: WeekRecord, updatedAt: string): Promise<void> {
  const { error } = await requireClient().from('week_records').upsert(weekToRow(userId, week, updatedAt), {
    onConflict: 'user_id,week_id',
  })
  if (error) throw error
}

export async function removeRemoteEntry(userId: string, date: string): Promise<void> {
  const { error } = await requireClient().from('daily_entries').delete().eq('user_id', userId).eq('date', date)
  if (error) throw error
}

export async function removeRemoteWeek(userId: string, weekId: string): Promise<void> {
  const { error } = await requireClient().from('week_records').delete().eq('user_id', userId).eq('week_id', weekId)
  if (error) throw error
}

async function deleteMissing(table: 'daily_entries' | 'week_records', column: 'date' | 'week_id', keep: string[], userId: string): Promise<void> {
  const { data, error } = await requireClient().from(table).select(column).eq('user_id', userId)
  if (error) throw error
  const present = Array.isArray(data) ? data : []
  const keepSet = new Set(keep)
  const extra: string[] = []
  for (const row of present) {
    if (typeof row !== 'object' || row === null || !(column in row)) continue
    const value = (row as Record<string, unknown>)[column]
    if (typeof value === 'string' && !keepSet.has(value.slice(0, 10))) extra.push(value.slice(0, 10))
  }
  if (extra.length === 0) return
  const { error: deleteError } = await requireClient().from(table).delete().eq('user_id', userId).in(column, extra)
  if (deleteError) throw deleteError
}

export async function replaceRemote(userId: string, state: PersistedState, marks: SyncMarks): Promise<void> {
  const entries = Object.values(state.entries).filter((entry) => !entry.isSample)
  const entryRows = entries.map((entry) => entryToRow(userId, entry, marks.entries[entry.date] ?? new Date().toISOString()))
  const weekRows = Object.values(state.weeks).map((week) =>
    weekToRow(userId, week, marks.weeks[week.weekId] ?? new Date().toISOString()),
  )
  if (entryRows.length > 0) {
    const { error } = await requireClient().from('daily_entries').upsert(entryRows, { onConflict: 'user_id,date' })
    if (error) throw error
  }
  if (weekRows.length > 0) {
    const { error } = await requireClient().from('week_records').upsert(weekRows, { onConflict: 'user_id,week_id' })
    if (error) throw error
  }
  await deleteMissing(
    'daily_entries',
    'date',
    entries.map((entry) => entry.date),
    userId,
  )
  await deleteMissing(
    'week_records',
    'week_id',
    Object.keys(state.weeks),
    userId,
  )
}
