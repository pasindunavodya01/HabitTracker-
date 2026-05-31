import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { getCompletions, getDateRange, buildDailySeries, calculateStreaks, calculateConsistency } from '../lib/supabaseService'

const TIME_RANGES = [
  { id: 'weekly',   label: '7 days',   days: 7  },
  { id: 'monthly',  label: '30 days',  days: 30 },
  { id: 'all_time', label: '90 days',  days: 90 },
] as const

type TimeRange = typeof TIME_RANGES[number]['id']

function StatCard({
  label, value, sub, accent = '#0f172a', bg = 'bg-white',
}: {
  label: string; value: string | number; sub?: string; accent?: string; bg?: string
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 ${bg} p-5 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-500 mb-1">{label}</p>
      <p className="font-bold text-slate-800">{payload[0].value} completions</p>
    </div>
  )
}

export default function Progress() {
  const { user } = useAuth()
  const [dailyCount, setDailyCount] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly')

  useEffect(() => {
    if (!user) return
    async function loadProgress() {
      const userId = user?.id
      if (!userId) return
      setLoading(true)
      const rangeMeta = TIME_RANGES.find((r) => r.id === timeRange)!
      const dates = getDateRange(rangeMeta.days)
      const startDate = new Date(dates[0]); startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(dates[dates.length - 1]); endDate.setDate(endDate.getDate() + 1)
      const completions = await getCompletions(userId, startDate.toISOString(), endDate.toISOString())
      setDailyCount(buildDailySeries(completions, rangeMeta.days))
      setLoading(false)
    }
    loadProgress()
  }, [user, timeRange])

  const { current, longest } = useMemo(() => calculateStreaks(dailyCount), [dailyCount])
  const consistency   = useMemo(() => calculateConsistency(dailyCount), [dailyCount])
  const totalCompleted = useMemo(() => dailyCount.reduce((s, d) => s + d.count, 0), [dailyCount])
  const averageDaily  = useMemo(() => dailyCount.length > 0 ? (totalCompleted / dailyCount.length).toFixed(1) : '0.0', [dailyCount, totalCompleted])
  const peakDay       = useMemo(() => dailyCount.length > 0 ? Math.max(...dailyCount.map((d) => d.count)) : 0, [dailyCount])
  const zeroDays      = useMemo(() => dailyCount.filter((d) => d.count === 0).length, [dailyCount])
  const avgLine       = useMemo(() => parseFloat(averageDaily), [averageDaily])

  if (!user) {
    return (
      <section className="space-y-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Progress</h2>
          <p className="mt-1 text-sm text-slate-400">Sign in to view streaks, consistency, and progress analytics.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Progress</h2>
            <p className="mt-1 text-sm text-slate-400">Streaks, consistency, and completion trends over time.</p>
          </div>
          <div className="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600">
            {consistency}% consistent
          </div>
        </div>

        {/* Time range pills */}
        <div className="mt-4 flex gap-2">
          {TIME_RANGES.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id)}
              className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition-all ${
                timeRange === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current Streak"  value={`${current}d`}    sub="consecutive active days" accent="#3b82f6" />
        <StatCard label="Longest Streak"  value={`${longest}d`}    sub="personal best"           accent="#8b5cf6" />
        <StatCard label="Total Done"      value={totalCompleted}    sub="in selected period"      accent="#10b981" />
        <StatCard label="Consistency"     value={`${consistency}%`} sub="days with any activity"  accent="#f59e0b" />
      </div>

      {/* Charts */}
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-3 w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading progress…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            {/* Line chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-0.5">Activity Trend</h3>
              <p className="text-xs text-slate-400 mb-5">Daily completions over the selected range</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyCount}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                      interval={timeRange === 'all_time' ? 13 : timeRange === 'monthly' ? 5 : 0}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<CustomTooltip />} />
                    {avgLine > 0 && (
                      <ReferenceLine y={avgLine} stroke="#e2e8f0" strokeDasharray="4 4" label={{ value: 'avg', fill: '#cbd5e1', fontSize: 10 }} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#2563eb' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-0.5">Daily Volume</h3>
              <p className="text-xs text-slate-400 mb-5">Completion count per day</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyCount} barSize={timeRange === 'weekly' ? 32 : timeRange === 'monthly' ? 12 : 6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      axisLine={false} tickLine={false}
                      interval={timeRange === 'all_time' ? 13 : timeRange === 'monthly' ? 5 : 0}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      radius={[5, 5, 0, 0]}
                      fill="#dbeafe"
                      activeBar={{ fill: '#3b82f6' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Daily Average" value={averageDaily} sub="actions per day" bg="bg-slate-50" />
            <StatCard label="Peak Output"   value={peakDay}      sub="most in one day" bg="bg-slate-50" />
            <div className={`rounded-2xl border bg-slate-50 p-5 shadow-sm ${zeroDays > 3 ? 'border-amber-200' : 'border-slate-200'}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Rest Days</p>
              <p className={`mt-2 text-3xl font-bold ${zeroDays > 3 ? 'text-amber-500' : 'text-slate-800'}`}>{zeroDays}</p>
              <p className="mt-1 text-xs text-slate-400">days with no activity</p>
              {zeroDays > 3 && (
                <p className="mt-2 text-xs font-medium text-amber-600">Try to reduce gaps for stronger streaks.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}