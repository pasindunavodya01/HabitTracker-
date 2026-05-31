import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Habit = {
  id: string
  title: string
  description: string | null
  kind: string
  is_archived: boolean
  metadata?: any
}

function todayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

const KIND_META: Record<string, { label: string; icon: string; accent: string; completeLabel: string; doneLabel: string }> = {
  habit:     { label: 'Habit',        icon: '⚡', accent: '#3b82f6', completeLabel: 'Mark Done',      doneLabel: 'Done' },
  routine:   { label: 'Routine',      icon: '🔄', accent: '#6366f1', completeLabel: 'Mark Done',      doneLabel: 'Done' },
  bad_habit: { label: 'Avoid',        icon: '🚫', accent: '#f59e0b', completeLabel: 'Stayed Clean',   doneLabel: 'Clean' },
  task:      { label: 'Task',         icon: '✅', accent: '#10b981', completeLabel: 'Complete Task',   doneLabel: 'Done' },
  goal:      { label: 'Goal',         icon: '🎯', accent: '#8b5cf6', completeLabel: 'Log Progress',   doneLabel: 'Logged' },
}

export default function Today() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [completedHabitIds, setCompletedHabitIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingHabitIds, setSavingHabitIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { start, end } = todayRange()
      const [{ data: habitsData }, { data: completionData }] = await Promise.all([
        supabase
          .from('habits')
          .select('id, title, description, kind, is_archived, metadata')
          .eq('user_id', user?.id)
          .eq('is_archived', false),
        supabase
          .from('completions')
          .select('habit_id')
          .eq('user_id', user?.id)
          .gte('completed_at', start)
          .lt('completed_at', end),
      ])

      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const todayLocalStr = `${year}-${month}-${day}`
      const todayDayOfWeek = now.getDay()

      const filteredHabits = (habitsData ?? [])
        .filter((h) => {
          if (h.kind === 'task') {
            if (h.metadata?.target_date && h.metadata.target_date !== todayLocalStr) return false
          } else if (h.kind !== 'goal') {
            const days = h.metadata?.days_of_week
            if (Array.isArray(days) && !days.includes(todayDayOfWeek)) return false
          }
          return true
        })
        .sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999))

      setHabits(filteredHabits)
      setCompletedHabitIds(new Set((completionData ?? []).map((item) => item.habit_id)))
      setLoading(false)
    }
    load()
  }, [user])

  const completedCount = completedHabitIds.size
  const totalCount = habits.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleComplete = async (habitId: string) => {
    if (!user) return
    setSavingHabitIds((c) => new Set(c).add(habitId))
    const habit = habits.find((h) => h.id === habitId)
    const isCompleted = completedHabitIds.has(habitId)
    let error
    if (isCompleted) {
      const { start, end } = todayRange()
      const { error: deleteError } = await supabase.from('completions').delete()
        .eq('user_id', user.id).eq('habit_id', habitId).gte('completed_at', start).lt('completed_at', end)
      error = deleteError
      if (!error && habit?.kind === 'task') {
        await supabase.from('habits').update({ is_archived: false }).eq('id', habitId)
      }
    } else {
      const { error: insertError } = await supabase.from('completions').insert([
        { user_id: user.id, habit_id: habitId, completed_at: new Date().toISOString() },
      ])
      error = insertError
      if (!error && habit?.kind === 'task') {
        await supabase.from('habits').update({ is_archived: true }).eq('id', habitId)
      }
    }
    setSavingHabitIds((c) => { const n = new Set(c); n.delete(habitId); return n })
    if (!error) {
      if (isCompleted) {
        setCompletedHabitIds((c) => { const n = new Set(c); n.delete(habitId); return n })
      } else {
        setCompletedHabitIds((c) => new Set(c).add(habitId))
      }
    }
  }

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'Nothing scheduled'
    if (completedCount === totalCount) return 'All done! 🎉'
    return `${completedCount} / ${totalCount} complete`
  }, [completedCount, totalCount])

  const now = new Date()
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const groups = [
    { label: 'Habits & Routines', items: habits.filter((h) => h.kind === 'habit' || h.kind === 'routine') },
    { label: 'Avoid',             items: habits.filter((h) => h.kind === 'bad_habit') },
    { label: 'Tasks',             items: habits.filter((h) => h.kind === 'task') },
    { label: 'Goals',             items: habits.filter((h) => h.kind === 'goal') },
  ].filter((g) => g.items.length > 0)

  const renderCard = (habit: Habit) => {
    const isCompleted = completedHabitIds.has(habit.id)
    const saving = savingHabitIds.has(habit.id)
    const meta = KIND_META[habit.kind] ?? KIND_META.habit

    let badgeText = meta.label
    if (habit.kind === 'goal' && habit.metadata?.target_date) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const target = new Date(habit.metadata.target_date)
      const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000)
      badgeText += diff > 0 ? ` · ${diff}d left` : diff === 0 ? ' · Today' : ' · Overdue'
    }

    return (
      <div
        key={habit.id}
        style={{
          transition: 'all 0.2s ease',
          borderLeft: `3px solid ${isCompleted ? '#d1fae5' : meta.accent}`,
        }}
        className={`group relative rounded-2xl border p-4 flex items-center gap-4 ${
          isCompleted
            ? 'border-emerald-100 bg-emerald-50/40'
            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        {/* Checkbox */}
        <button
          onClick={() => handleComplete(habit.id)}
          disabled={saving}
          aria-label={isCompleted ? 'Undo' : meta.completeLabel}
          style={{ borderColor: isCompleted ? '#10b981' : meta.accent }}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            isCompleted ? 'bg-emerald-500' : 'bg-white hover:bg-slate-50'
          } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          {saving ? (
            <span className="block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          ) : isCompleted ? (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm leading-snug ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {habit.title}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: isCompleted ? '#f0fdf4' : `${meta.accent}18`,
                color: isCompleted ? '#6ee7b7' : meta.accent,
              }}
            >
              {meta.icon} {badgeText}
            </span>
          </div>
          {habit.description && (
            <p className="mt-0.5 text-xs text-slate-400 truncate">{habit.description}</p>
          )}
        </div>

        {/* Undo hint on hover when completed */}
        {isCompleted && !saving && (
          <button
            onClick={() => handleComplete(habit.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            ⟲ Undo
          </button>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{dateLabel}</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Today</h2>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-slate-500">{summaryText}</span>
            {totalCount > 0 && (
              <span className="text-sm font-bold text-slate-700">{progress}%</span>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto mb-3 w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading today's items…</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-500 font-medium">Nothing scheduled today</p>
          <p className="mt-1 text-sm text-slate-400">Add habits in My Habits to start tracking.</p>
        </div>
      ) : (
        <>
          <div className="space-y-7">
            {groups.map(({ label, items }) => (
              <div key={label} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">{label}</h3>
                <div className="space-y-2">{items.map(renderCard)}</div>
              </div>
            ))}
          </div>

          {/* Motivation footer */}
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Motivation</p>
            <p className="mt-2 font-semibold text-slate-700">
              {completedCount === 0
                ? 'Start small — one completion builds momentum.'
                : completedCount === totalCount
                ? 'Excellent! You crushed every item today. 🎉'
                : `${completedCount} down, ${totalCount - completedCount} to go — keep it up!`}
            </p>
          </div>
        </>
      )}
    </section>
  )
}