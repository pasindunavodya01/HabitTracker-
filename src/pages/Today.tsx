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

type TimetableRow = {
  id: string
  activity: string
  start_time: string
  end_time: string
}

export default function Today() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [completedLogs, setCompletedLogs] = useState<Record<string, { id: string; note: string | null }[]>>({})
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingHabitIds, setSavingHabitIds] = useState<Set<string>>(new Set())
  const [timetable, setTimetable] = useState<TimetableRow[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { start, end } = todayRange()
      const [{ data: habitsData }, { data: completionData }, { data: timetableData }] = await Promise.all([
        supabase
          .from('habits')
          .select('id, title, description, kind, is_archived, metadata')
          .eq('user_id', user?.id)
          .eq('is_archived', false),
        supabase
          .from('completions')
        .select('id, habit_id, note')
          .eq('user_id', user?.id)
          .gte('completed_at', start)
          .lt('completed_at', end),
        supabase
          .from('timetables')
          .select('id, activity, start_time, end_time, days_of_week')
          .eq('user_id', user?.id)
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
      const logs: Record<string, { id: string; note: string | null }[]> = {}
      ;(completionData ?? []).forEach((item) => {
        if (!logs[item.habit_id]) logs[item.habit_id] = []
        logs[item.habit_id].push({ id: item.id, note: item.note })
      })
      setCompletedLogs(logs)

      const filteredTimetable = (timetableData ?? [])
        .filter((t: any) => t.days_of_week.includes(todayDayOfWeek))
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
      setTimetable(filteredTimetable)

      setLoading(false)
    }
    load()
  }, [user])

  const trackableHabits = habits.filter(h => h.kind !== 'goal')
  const totalCount = trackableHabits.length
  const completedCount = trackableHabits.filter(h => completedLogs[h.id]?.length > 0).length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleToggleCompletion = async (habitId: string) => {
    if (!user) return
    setSavingHabitIds((c) => new Set(c).add(habitId))
    const habit = habits.find((h) => h.id === habitId)
    const isCompleted = !!completedLogs[habitId]?.length
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
      const { error: insertError, data } = await supabase.from('completions').insert([
        { user_id: user.id, habit_id: habitId, completed_at: new Date().toISOString(), note: null },
      ]).select('id').single()
      error = insertError
      if (!error && data) {
        setCompletedLogs((c) => ({ ...c, [habitId]: [{ id: data.id, note: null }] }))
        if (habit?.kind === 'task') {
          await supabase.from('habits').update({ is_archived: true }).eq('id', habitId)
        }
      }
    }
    setSavingHabitIds((c) => { const n = new Set(c); n.delete(habitId); return n })
    if (!error && isCompleted) {
      setCompletedLogs((c) => { const n = { ...c }; delete n[habitId]; return n })
    }
  }

  const handleAddGoalLog = async (habitId: string, note: string) => {
    if (!user || !note.trim()) return
    setSavingHabitIds((c) => new Set(c).add(habitId))
    const { error, data } = await supabase.from('completions').insert([
      { user_id: user.id, habit_id: habitId, completed_at: new Date().toISOString(), note },
    ]).select('id').single()

    if (!error && data) {
      setCompletedLogs((c) => ({ ...c, [habitId]: [...(c[habitId] || []), { id: data.id, note }] }))
      setGoalInputs((c) => { const n = { ...c }; delete n[habitId]; return n })
    }
    setSavingHabitIds((c) => { const n = new Set(c); n.delete(habitId); return n })
  }

  const handleRemoveGoalLog = async (habitId: string, completionId: string) => {
    if (!user) return
    setSavingHabitIds((c) => new Set(c).add(habitId))
    const { error } = await supabase.from('completions').delete().eq('id', completionId)
    if (!error) {
      setCompletedLogs((c) => {
        const current = c[habitId] || []
        const next = current.filter((x) => x.id !== completionId)
        const n = { ...c }
        if (next.length === 0) delete n[habitId]
        else n[habitId] = next
        return n
      })
    }
    setSavingHabitIds((c) => { const n = new Set(c); n.delete(habitId); return n })
  }

  const toggleMilestone = async (habitId: string, milestoneId: string) => {
    const habit = habits.find((h) => h.id === habitId)
    if (!habit) return
    const newMilestones = habit.metadata?.milestones?.map((m: any) =>
      m.id === milestoneId ? { ...m, done: !m.done } : m
    )
    const newMeta = { ...habit.metadata, milestones: newMilestones }
    setHabits((c) => c.map((h) => (h.id === habitId ? { ...h, metadata: newMeta } : h)))
    await supabase.from('habits').update({ metadata: newMeta }).eq('id', habitId)
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
    const isCompleted = !!completedLogs[habit.id]?.length
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
        className={`group relative rounded-2xl border p-4 flex gap-4 ${
          isCompleted
            ? 'border-emerald-100 bg-emerald-50/40'
            : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm'
        } ${habit.kind === 'goal' ? 'flex-col' : 'items-center'}`}
      >
        <div className="flex items-center gap-4 w-full">
          {/* Checkbox for non-goals */}
          {habit.kind !== 'goal' && (
            <button
              onClick={() => handleToggleCompletion(habit.id)}
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
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-sm leading-snug ${isCompleted && habit.kind !== 'goal' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
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

          {/* Undo hint on hover when completed for non-goals */}
          {isCompleted && !saving && habit.kind !== 'goal' && (
            <button
              onClick={() => handleToggleCompletion(habit.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              ⟲ Undo
            </button>
          )}
        </div>

        {/* Goal specific features */}
        {habit.kind === 'goal' && (
          <div className="mt-1 w-full space-y-3">
            {/* Render Existing Logs */}
            {completedLogs[habit.id]?.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-4 rounded-xl bg-emerald-50/70 p-3 border border-emerald-100">
                <div className="text-sm text-emerald-800"><span className="font-semibold mr-1">Update:</span><span className="italic">"{log.note}"</span></div>
                <button onClick={() => handleRemoveGoalLog(habit.id, log.id)} disabled={saving} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex-shrink-0 mt-0.5">Undo</button>
              </div>
            ))}

            {/* Text Input Log for Goals */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Log today's progress (e.g. read 10 pages, ran 2 miles)..."
                value={goalInputs[habit.id] || ''}
                onChange={(e) => setGoalInputs((prev) => ({ ...prev, [habit.id]: e.target.value }))}
                disabled={saving}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (goalInputs[habit.id]?.trim()) { handleAddGoalLog(habit.id, goalInputs[habit.id]); } } }}
              />
              <button onClick={() => handleAddGoalLog(habit.id, goalInputs[habit.id] || '')} disabled={saving || !goalInputs[habit.id]?.trim()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap">
                {saving ? 'Saving...' : 'Log Progress'}
              </button>
            </div>

            {/* Milestones rendering */}
            {habit.metadata?.milestones?.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Milestones:</p>
                {habit.metadata.milestones.map((m: any) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer group w-fit">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${m.done ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                      {m.done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={`text-sm select-none ${m.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.title}</span>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={m.done || false}
                      onChange={() => toggleMilestone(habit.id, m.id)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
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
      ) : habits.length === 0 && timetable.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-500 font-medium">Nothing scheduled today</p>
          <p className="mt-1 text-sm text-slate-400">Add habits in My Habits to start tracking.</p>
        </div>
      ) : (
        <>
          {timetable.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Today's Schedule</h3>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2">
                {timetable.map(t => {
                   const [h, m] = t.start_time.split(':').map(Number)
                   const period = h >= 12 ? 'PM' : 'AM'
                   const hour = h % 12 === 0 ? 12 : h % 12
                   const formattedStart = `${hour}:${String(m).padStart(2, '0')} ${period}`
                   
                   const [eh, em] = t.end_time.split(':').map(Number)
                   const eperiod = eh >= 12 ? 'PM' : 'AM'
                   const ehour = eh % 12 === 0 ? 12 : eh % 12
                   const formattedEnd = `${ehour}:${String(em).padStart(2, '0')} ${eperiod}`

                   const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
                   const startMinutes = h * 60 + m
                   const endMinutes = eh * 60 + em
                   
                   const isActive = startMinutes <= endMinutes 
                     ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
                     : nowMinutes >= startMinutes || nowMinutes <= endMinutes

                   return (
                     <div key={t.id} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0">
                       <div className={`text-xs font-bold w-32 flex-shrink-0 tabular-nums whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                         {formattedStart} <span className={`${isActive ? 'text-blue-300' : 'text-slate-300'} font-normal mx-0.5`}>-</span> {formattedEnd}
                       </div>
                       <div className="relative flex items-center justify-center flex-shrink-0 w-1.5 h-1.5">
                         {isActive && <span className="absolute w-3 h-3 rounded-full bg-blue-400 animate-ping opacity-75" />}
                         <div className={`w-1.5 h-1.5 rounded-full z-10 ${isActive ? 'bg-blue-600' : 'bg-blue-400'}`} />
                       </div>
                       <div className={`font-semibold text-sm flex-1 truncate ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                         {t.activity}
                         {isActive && <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">Now</span>}
                       </div>
                     </div>
                   )
                })}
              </div>
            </div>
          )}

          <div className={`space-y-7 ${timetable.length > 0 ? 'mt-6' : ''}`}>
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