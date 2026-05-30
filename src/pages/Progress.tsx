import React, { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { getCompletions, getDateRange, buildDailySeries, calculateStreaks, calculateConsistency } from '../lib/supabaseService'

export default function Progress() {
  const { user } = useAuth()
  const [dailyCount, setDailyCount] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'all_time'>('weekly')

  useEffect(() => {
    if (!user) return

    async function loadProgress() {
      const userId = user?.id
      if (!userId) return
      setLoading(true)
      const days = timeRange === 'weekly' ? 7 : timeRange === 'monthly' ? 30 : 90
      const dates = getDateRange(days)
      const startDate = new Date(dates[0])
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(dates[dates.length - 1])
      endDate.setDate(endDate.getDate() + 1)

      const completions = await getCompletions(userId, startDate.toISOString(), endDate.toISOString())
      setDailyCount(buildDailySeries(completions, days))
      setLoading(false)
    }

    loadProgress()
  }, [user, timeRange])

  const { current, longest } = useMemo(() => calculateStreaks(dailyCount), [dailyCount])
  const consistency = useMemo(() => calculateConsistency(dailyCount), [dailyCount])
  const totalCompleted = useMemo(() => dailyCount.reduce((sum, item) => sum + item.count, 0), [dailyCount])

  if (!user) {
    return (
      <section>
        <h2 className="text-xl font-semibold">Progress</h2>
        <p className="mt-2 text-gray-600">Sign in to view streaks, consistency, and progress analytics.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Progress</h2>
            <p className="mt-2 text-gray-600">Track your habit streaks, task completions, and goal progress.</p>
          </div>
          <div className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm self-start md:self-auto">Consistency {consistency}%</div>
        </div>
        
        <div className="mt-6 flex overflow-x-auto space-x-2 hide-scrollbar pb-2 md:pb-0">
          {[
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'all_time', label: 'All Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as any)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${timeRange === tab.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Habit Streaks</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{current}d</p>
          <p className="mt-1 text-sm text-gray-500">Current average</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Clean Streaks</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{longest}d</p>
          <p className="mt-1 text-sm text-gray-500">Avoid habits</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Task Completion</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalCompleted}</p>
          <p className="mt-1 text-sm text-gray-500">Tasks done</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Goal Progress</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{consistency}%</p>
          <p className="mt-1 text-sm text-gray-500">Average progress</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-gray-500">Loading progress…</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Activity trend</h3>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyCount}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Daily focus</h3>
            <p className="mt-3 text-sm text-gray-600">Track your daily completion volume and show progress across the last 14 days.</p>
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyCount}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
