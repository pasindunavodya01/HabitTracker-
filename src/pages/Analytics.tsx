import React, { useEffect, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DIST_COLORS: Record<string, string> = {
  Habits: '#3b82f6',
  'Avoid Habits': '#f59e0b',
  Tasks: '#10b981',
  Goals: '#8b5cf6',
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p
        className="mt-2 text-3xl font-bold"
        style={{ color: accent ?? '#0f172a' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  const [completionCount, setCompletionCount] = useState(0)
  const [activeDays, setActiveDays] = useState(0)
  const [failedDays, setFailedDays] = useState(0)
  const [popularHabits, setPopularHabits] = useState<{ title: string; count: number }[]>([])
  const [bestDay, setBestDay] = useState('None')
  const [distribution, setDistribution] = useState<{ name: string; value: number; color: string }[]>([])
  const [weekdayData, setWeekdayData] = useState<{ day: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState(0)

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
        supabase.from('habits').select('id, title, kind'),
      ])

      const completions = (completionsRes.data ?? []) as CompletionRow[]
      const habits = (habitsRes.data ?? []) as HabitRow[]
      const uniqueDays = new Set(completions.map((c) => c.completed_at.slice(0, 10)))
      const totalDays = 30
      const failed = totalDays - uniqueDays.size

      // Streak calc
      let streakCount = 0
      const today = new Date()
      for (let i = 0; i < 30; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        if (uniqueDays.has(key)) streakCount++
        else break
      }

      // Popular habits
      const counts = completions.reduce((acc, c) => {
        acc[c.habit_id] = (acc[c.habit_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([habitId, count]) => ({
          title: habits.find((h) => h.id === habitId)?.title ?? 'Unknown',
          count,
        }))

      // Weekday bar chart
      const dayCounts = [0, 0, 0, 0, 0, 0, 0]
      const kindCounts: Record<string, number> = {}
      completions.forEach((c) => {
        const d = new Date(c.completed_at)
        dayCounts[d.getDay()]++
        const habit = habits.find((h) => h.id === c.habit_id)
        if (habit) kindCounts[habit.kind] = (kindCounts[habit.kind] || 0) + 1
      })

      const maxDay = Math.max(...dayCounts)
      const bestDayName = maxDay > 0 ? DAY_NAMES[dayCounts.indexOf(maxDay)] : 'None'

      const distData = [
        { name: 'Habits',      value: (kindCounts.habit || 0) + (kindCounts.routine || 0), color: DIST_COLORS.Habits },
        { name: 'Avoid Habits', value: kindCounts.bad_habit || 0,                          color: DIST_COLORS['Avoid Habits'] },
        { name: 'Tasks',        value: kindCounts.task || 0,                               color: DIST_COLORS.Tasks },
        { name: 'Goals',        value: kindCounts.goal || 0,                               color: DIST_COLORS.Goals },
      ].filter((d) => d.value > 0)

      setCompletionCount(completions.length)
      setActiveDays(uniqueDays.size)
      setFailedDays(failed)
      setPopularHabits(sorted)
      setBestDay(bestDayName)
      setDistribution(distData)
      setStreak(streakCount)
      setWeekdayData(DAY_NAMES.map((day, i) => ({ day, count: dayCounts[i] })))
      setLoading(false)
    }
    loadAnalytics()
  }, [user])

  if (!user) {
    return (
      <section className="space-y-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
          <p className="mt-1 text-sm text-slate-400">Sign in to see your productivity trends and insights.</p>
        </div>
      </section>
    )
  }

  const consistencyRate = `${Math.round((activeDays / 30) * 100)}%`

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Analytics</h2>
        <p className="mt-1 text-sm text-slate-400">Your last 30 days of consistency, streaks, and patterns.</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-3 w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Crunching your data…</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Completions" value={completionCount} sub="in the last 30 days" accent="#3b82f6" />
            <StatCard label="Active Days"  value={activeDays}       sub={`${consistencyRate} consistency`} accent="#10b981" />
            <StatCard label="Current Streak" value={`${streak}d`}  sub="consecutive days" accent="#f59e0b" />
            <StatCard label="Best Day"      value={bestDay}          sub="most completions" accent="#8b5cf6" />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Weekday distribution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-1">Activity by Day</h3>
              <p className="text-xs text-slate-400 mb-4">Completions per weekday this month</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v) => [`${v} completions`, '']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {weekdayData.map((entry, i) => (
                        <Cell key={i} fill={entry.day === bestDay ? '#3b82f6' : '#dbeafe'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribution donut */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-1">Action Distribution</h3>
              <p className="text-xs text-slate-400 mb-4">Breakdown by habit type</p>
              {distribution.length === 0 ? (
                <div className="h-44 flex items-center justify-center">
                  <p className="text-sm text-slate-400">No data yet — start completing habits!</p>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="h-36 w-36 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={distribution} dataKey="value" cx="50%" cy="50%" innerRadius={36} outerRadius={62} paddingAngle={3} stroke="none">
                          {distribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                          formatter={(v) => [`${v} logs`, '']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5 flex-1">
                    {distribution.map((d) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-sm text-slate-600">{d.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top habits */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-1">Top Habits This Month</h3>
            <p className="text-xs text-slate-400 mb-4">Your most consistently completed items</p>
            {popularHabits.length === 0 ? (
              <p className="text-sm text-slate-400">Keep completing habits daily to build up data here.</p>
            ) : (
              <div className="space-y-3">
                {popularHabits.map((habit, i) => {
                  const maxCount = popularHabits[0].count
                  const pct = Math.round((habit.count / maxCount) * 100)
                  const colors = ['#3b82f6', '#6366f1', '#8b5cf6']
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-sm font-bold text-slate-300 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-700">{habit.title}</span>
                          <span className="text-xs font-bold text-slate-400">{habit.count}×</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Missed days nudge */}
          {failedDays > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 flex items-start gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">
                  {failedDays} day{failedDays !== 1 ? 's' : ''} with no completions this month
                </p>
                <p className="text-sm text-amber-600 mt-0.5">
                  Try setting a daily reminder to build stronger momentum.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}