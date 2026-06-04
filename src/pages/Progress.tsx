import React, { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { getCompletions, getDateRange, buildDailySeries, calculateStreaks, calculateConsistency } from '../lib/supabaseService'
import { supabase } from '../lib/supabase'

const TIME_RANGES = [
  { id: 'weekly',   label: '7 days',   days: 7  },
  { id: 'monthly',  label: '30 days',  days: 30 },
  { id: 'all_time', label: '90 days',  days: 90 },
] as const

type TimeRange = typeof TIME_RANGES[number]['id']

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

  let displayLabel = label
  if (typeof label === 'string' && label.includes('-')) {
    const parts = label.split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      displayLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-500 mb-1">{displayLabel}</p>
      <p className="font-bold text-slate-800">{payload[0].value} completions</p>
    </div>
  )
}

export default function Progress() {
  const { user } = useAuth()
  const [dailyCount, setDailyCount] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly')
  const [popularHabits, setPopularHabits] = useState<{ title: string; count: number }[]>([])
  const [bestDay, setBestDay] = useState('None')
  const [distribution, setDistribution] = useState<{ name: string; value: number; color: string }[]>([])
  const [weekdayData, setWeekdayData] = useState<{ day: string; count: number }[]>([])

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
      
      const completionsForProgress = await getCompletions(userId, startDate.toISOString(), endDate.toISOString())
      setDailyCount(buildDailySeries(completionsForProgress, rangeMeta.days))

      const [completionsRes, habitsRes] = await Promise.all([
        supabase
          .from('completions')
          .select('id, completed_at, habit_id')
          .eq('user_id', userId)
          .gte('completed_at', startDate.toISOString())
          .lte('completed_at', endDate.toISOString()),
        supabase.from('habits').select('id, title, kind').eq('user_id', userId),
      ])

      const completions = (completionsRes.data ?? []) as CompletionRow[]
      const habits = (habitsRes.data ?? []) as HabitRow[]

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

      setPopularHabits(sorted)
      setBestDay(bestDayName)
      setDistribution(distData)
      setWeekdayData(DAY_NAMES.map((day, i) => ({ day, count: dayCounts[i] })))

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
          <h2 className="text-2xl font-bold text-slate-900">Progress & Analytics</h2>
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
            <h2 className="text-2xl font-bold text-slate-900">Progress & Analytics</h2>
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
                    tickFormatter={(val) => (val && typeof val === 'string' ? val.split('-').slice(1).join('/') : '')}
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
                    tickFormatter={(val) => (val && typeof val === 'string' ? val.split('-').slice(1).join('/') : '')}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Daily Average" value={averageDaily} sub="actions per day" bg="bg-slate-50" />
            <StatCard label="Peak Output"   value={peakDay}      sub="most in one day" bg="bg-slate-50" />
            <StatCard label="Best Day"      value={bestDay}      sub="highest completion rate" bg="bg-slate-50" />
            <div className={`rounded-2xl border bg-slate-50 p-5 shadow-sm ${zeroDays > 3 ? 'border-amber-200' : 'border-slate-200'}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Rest Days</p>
              <p className={`mt-2 text-3xl font-bold ${zeroDays > 3 ? 'text-amber-500' : 'text-slate-800'}`}>{zeroDays}</p>
              <p className="mt-1 text-xs text-slate-400">days with no activity</p>
              {zeroDays > 3 && (
                <p className="mt-2 text-xs font-medium text-amber-600">Try to reduce gaps for stronger streaks.</p>
              )}
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            {/* Weekday distribution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-1">Activity by Day</h3>
              <p className="text-xs text-slate-400 mb-4">Completions per weekday</p>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mt-6">
            <h3 className="font-bold text-slate-800 mb-1">Top Habits</h3>
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
        </>
      )}
    </section>
  )
}