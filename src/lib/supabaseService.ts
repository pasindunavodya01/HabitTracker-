import { supabase } from './supabase'

type HabitRow = {
  id: string
  title: string
  description: string | null
  kind: string
  is_archived: boolean
  created_at: string
}

type CompletionRow = {
  id: string
  habit_id: string
  completed_at: string
}

export async function getHabits(userId: string) {
  const { data, error } = await supabase
    .from('habits')
    .select('id, title, description, kind, is_archived, created_at')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getCompletions(userId: string, start: string, end: string) {
  const { data, error } = await supabase
    .from('completions')
    .select('id, habit_id, completed_at')
    .eq('user_id', userId)
    .gte('completed_at', start)
    .lt('completed_at', end)
    .order('completed_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getDateRange(days: number) {
  const today = new Date()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const current = new Date(today)
    current.setDate(today.getDate() - i)
    dates.push(formatDateKey(current))
  }
  return dates
}

export function buildDailySeries(completions: CompletionRow[], days: number) {
  const keys = getDateRange(days)
  const lookup = new Map<string, number>()
  for (const key of keys) lookup.set(key, 0)

  completions.forEach((completion) => {
    const key = completion.completed_at.slice(0, 10)
    lookup.set(key, (lookup.get(key) ?? 0) + 1)
  })

  return keys.map((date) => ({ date, count: lookup.get(date) ?? 0 }))
}

export function calculateStreaks(dailyCounts: { date: string; count: number }[]) {
  let current = 0
  let longest = 0
  let temp = 0

  dailyCounts.forEach((entry) => {
    if (entry.count > 0) {
      temp += 1
      current = temp
      longest = Math.max(longest, temp)
    } else {
      temp = 0
    }
  })

  return { current, longest }
}

export function calculateConsistency(dailyCounts: { date: string; count: number }[]) {
  const days = dailyCounts.length
  const active = dailyCounts.filter((entry) => entry.count > 0).length
  return days === 0 ? 0 : Math.round((active / days) * 100)
}
