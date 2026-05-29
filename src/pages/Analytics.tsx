import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type CompletionRow = {
  id: string
  completed_at: string
  habit_id: string
}

type HabitRow = {
  id: string
  title: string
  kind: string
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Analytics() {
  const { user } = useAuth()
  const [completionCount, setCompletionCount] = useState(0)
  const [activeDays, setActiveDays] = useState(0)
  const [failedDays, setFailedDays] = useState(0)
  const [popularHabits, setPopularHabits] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadAnalytics() {
      const userId = user?.id
      if (!userId) return
      setLoading(true)
      const end = new Date()
      const start = new Date(end)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)

      const [completionsRes, habitsRes] = await Promise.all([
        supabase
          .from('completions')
          .select('id, completed_at, habit_id')
          .eq('user_id', userId)
          .gte('completed_at', start.toISOString())
          .lte('completed_at', end.toISOString()),
        supabase
          .from('habits')
          .select('id, title, kind'),
      ])

      const completions = (completionsRes.data ?? []) as CompletionRow[]
      const habits = (habitsRes.data ?? []) as HabitRow[]
      const uniqueDays = new Set(completions.map((item) => item.completed_at.slice(0, 10)))
      const totalDays = 30
      const failed = totalDays - uniqueDays.size

      const counts = completions.reduce((acc, item) => {
        acc[item.habit_id] = (acc[item.habit_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const sortedHabits = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([habitId]) => habits.find((habit) => habit.id === habitId)?.title ?? 'Unknown habit')

      setCompletionCount(completions.length)
      setActiveDays(uniqueDays.size)
      setFailedDays(failed)
      setPopularHabits(sortedHabits)
      setLoading(false)
    }

    loadAnalytics()
  }, [user])

  if (!user) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Analytics</h2>
        <p className="mt-2 text-gray-600">Sign in to see your productivity trends and insights.</p>
      </div>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <p className="mt-2 text-gray-600">Insights into your past month of consistency, wins, and habits.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-gray-500">Loading analytics…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-500">Completed actions</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{completionCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-500">Active days</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{activeDays}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-500">Missed days</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{failedDays}</p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Top habits this month</h3>
          {popularHabits.length === 0 ? (
            <p className="mt-3 text-gray-500">Build more data by marking completions each day.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {popularHabits.map((habit, index) => (
                <li key={index} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-semibold">{index + 1}.</span> {habit}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
