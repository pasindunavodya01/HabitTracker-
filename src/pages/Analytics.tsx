import React, { useEffect, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
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
  const [bestDay, setBestDay] = useState('None')
  const [distribution, setDistribution] = useState<{ name: string; value: number; color: string }[]>([])
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

      const dayCounts = [0, 0, 0, 0, 0, 0, 0]
      const kindCounts: Record<string, number> = {}

      completions.forEach((c) => {
        const d = new Date(c.completed_at)
        dayCounts[d.getDay()]++
        const habit = habits.find((h) => h.id === c.habit_id)
        if (habit) {
          kindCounts[habit.kind] = (kindCounts[habit.kind] || 0) + 1
        }
      })

      const maxDay = Math.max(...dayCounts)
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const bestDayName = maxDay > 0 ? days[dayCounts.indexOf(maxDay)] : 'None'

      const sortedHabits = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([habitId]) => habits.find((habit) => habit.id === habitId)?.title ?? 'Unknown habit')

      const distData = [
        { name: 'Habits', value: (kindCounts.habit || 0) + (kindCounts.routine || 0), color: '#3b82f6' },
        { name: 'Avoid Habits', value: kindCounts.bad_habit || 0, color: '#f59e0b' },
        { name: 'Tasks', value: kindCounts.task || 0, color: '#10b981' },
        { name: 'Goals', value: kindCounts.goal || 0, color: '#8b5cf6' },
      ].filter((d) => d.value > 0)

      setCompletionCount(completions.length)
      setActiveDays(uniqueDays.size)
      setFailedDays(failed)
      setPopularHabits(sortedHabits)
      setBestDay(bestDayName)
      setDistribution(distData)
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
        <div className="grid gap-6 lg:grid-cols-4">
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
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-500">Most Productive</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{bestDay}</p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <h3 className="text-lg font-semibold mb-4">Top habits this month</h3>
            {popularHabits.length === 0 ? (
              <p className="text-gray-500 flex-grow">Build more data by marking completions each day.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700 flex-grow">
                {popularHabits.map((habit, index) => (
                  <li key={index} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center">
                    <span className="font-semibold text-slate-400 mr-3">{index + 1}.</span> <span className="font-medium">{habit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Action Distribution</h3>
            {distribution.length === 0 ? (
              <p className="text-gray-500">No data to display yet.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6 mt-2">
                <div className="h-40 w-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} stroke="none">
                        {distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} logs`, 'Total']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 w-full max-w-[180px]">
                  {distribution.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-sm font-medium text-slate-700">{d.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-600">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
