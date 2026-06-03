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

type ProjectStep = {
  id: string
  title: string
  is_completed: boolean
}

type Project = {
  id: string
  title: string
  description: string | null
  target_date: string | null
  steps: ProjectStep[]
}

export default function Today() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [completedLogs, setCompletedLogs] = useState<Record<string, { id: string; note: string | null }[]>>({})
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingHabitIds, setSavingHabitIds] = useState<Set<string>>(new Set())
  const [timetable, setTimetable] = useState<TimetableRow[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [expandedTimetableId, setExpandedTimetableId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const [year, month, day] = selectedDate.split('-').map(Number)
      const targetDateObj = new Date(year, month - 1, day, 0, 0, 0, 0)
      const targetDayOfWeek = targetDateObj.getDay()
      const start = targetDateObj.toISOString()
      const endObj = new Date(targetDateObj)
      endObj.setDate(endObj.getDate() + 1)
      const end = endObj.toISOString()
      
      const [{ data: habitsData }, { data: completionData }, { data: timetableData }, { data: projectsData }] = await Promise.all([
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
          .eq('user_id', user?.id),
        supabase
          .from('projects')
          .select('*')
          .eq('user_id', user?.id)
      ])

      const filteredHabits = (habitsData ?? [])
        .filter((h) => {
          if (h.kind === 'task') {
            if (h.metadata?.target_date && h.metadata.target_date !== selectedDate) return false
          } else if (h.kind !== 'goal') {
            const days = h.metadata?.days_of_week
            if (Array.isArray(days) && !days.includes(targetDayOfWeek)) return false
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
        .filter((t: any) => t.days_of_week.includes(targetDayOfWeek))
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
      setTimetable(filteredTimetable)
      setProjects(projectsData ?? [])

      setLoading(false)
    }
    load()
  }, [user, selectedDate])

  const trackableHabits = habits.filter(h => h.kind !== 'goal')
  const totalCount = trackableHabits.length
  const completedCount = trackableHabits.filter(h => completedLogs[h.id]?.length > 0).length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const now = new Date()
  const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = selectedDate === todayLocalStr

  const handleToggleCompletion = async (habitId: string) => {
    if (!user) return
    setSavingHabitIds((c) => new Set(c).add(habitId))
    const habit = habits.find((h) => h.id === habitId)
    const isCompleted = !!completedLogs[habitId]?.length
    let error
    if (isCompleted) {
      const [year, month, day] = selectedDate.split('-').map(Number)
      const start = new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
      const endObj = new Date(year, month - 1, day, 0, 0, 0, 0)
      endObj.setDate(endObj.getDate() + 1)
      const end = endObj.toISOString()
      const { error: deleteError } = await supabase.from('completions').delete()
        .eq('user_id', user.id).eq('habit_id', habitId).gte('completed_at', start).lt('completed_at', end)
      error = deleteError
      if (!error && habit?.kind === 'task') {
        await supabase.from('habits').update({ is_archived: false }).eq('id', habitId)
      }
    } else {
      const dateToSave = isToday ? new Date().toISOString() : new Date(`${selectedDate}T12:00:00`).toISOString()
      const { error: insertError, data } = await supabase.from('completions').insert([
        { user_id: user.id, habit_id: habitId, completed_at: dateToSave, note: null },
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
    const dateToSave = isToday ? new Date().toISOString() : new Date(`${selectedDate}T12:00:00`).toISOString()
    const { error, data } = await supabase.from('completions').insert([
      { user_id: user.id, habit_id: habitId, completed_at: dateToSave, note },
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

  const handleToggleProjectStep = async (projectId: string, stepId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const newSteps = project.steps.map(s => s.id === stepId ? { ...s, is_completed: !s.is_completed } : s)
    setProjects(c => c.map(p => p.id === projectId ? { ...p, steps: newSteps } : p))
    await supabase.from('projects').update({ steps: newSteps }).eq('id', projectId)
  }

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'Nothing scheduled'
    if (completedCount === totalCount) return 'All done! 🎉'
    return `${completedCount} / ${totalCount} complete`
  }, [completedCount, totalCount])

  const navigateDay = (offset: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() + offset)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${dd}`)
  }

  const targetDateObj = new Date(selectedDate + 'T00:00:00')
  const dateLabel = targetDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  
  const getRelativeDayName = () => {
    if (isToday) return 'Today'
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterdayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (selectedDate === yesterdayStr) return 'Yesterday'
    const tmrw = new Date()
    tmrw.setDate(tmrw.getDate() + 1)
    const tmrwStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`
    if (selectedDate === tmrwStr) return 'Tomorrow'
    return 'Dashboard'
  }

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

  const activeProjects = projects.filter((p) => {
    const total = p.steps.length
    if (total === 0) return true // Show empty plans so users remember to add steps
    const completed = p.steps.filter((s) => s.is_completed).length
    return completed < total // Only show if not 100% finished
  })

  return (
    <section className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{dateLabel}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{getRelativeDayName()}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => navigateDay(-1)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">◀</button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
            />
            <button onClick={() => navigateDay(1)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">▶</button>
            {!isToday && (
              <button onClick={() => setSelectedDate(todayLocalStr)} className="ml-1 text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider transition-colors">
                Today
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div>
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
      ) : habits.length === 0 && timetable.length === 0 && activeProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-500 font-medium">Nothing scheduled</p>
          <p className="mt-1 text-sm text-slate-400">Add habits in My Habits to start tracking.</p>
        </div>
      ) : (
        <>
          {timetable.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Daily Schedule</h3>
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
                   
                   const isActive = isToday && (startMinutes <= endMinutes 
                     ? nowMinutes >= startMinutes && nowMinutes <= endMinutes
                     : nowMinutes >= startMinutes || nowMinutes <= endMinutes)

                   return (
                     <div key={t.id} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0">
                       <div className={`text-xs font-bold w-32 flex-shrink-0 tabular-nums whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                         {formattedStart} <span className={`${isActive ? 'text-blue-300' : 'text-slate-300'} font-normal mx-0.5`}>-</span> {formattedEnd}
                       </div>
                       <div className="relative flex items-center justify-center flex-shrink-0 w-1.5 h-1.5">
                         {isActive && <span className="absolute w-3 h-3 rounded-full bg-blue-400 animate-ping opacity-75" />}
                         <div className={`w-1.5 h-1.5 rounded-full z-10 ${isActive ? 'bg-blue-600' : 'bg-blue-400'}`} />
                       </div>
                       <div
                         onClick={() => setExpandedTimetableId(expandedTimetableId === t.id ? null : t.id)}
                         className={`font-semibold text-sm flex-1 cursor-pointer transition-all ${expandedTimetableId === t.id ? 'whitespace-normal break-words' : 'truncate'} ${isActive ? 'text-blue-900' : 'text-slate-800'}`}
                       >
                         {t.activity}
                         {isActive && <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">Now</span>}
                       </div>
                     </div>
                   )
                })}
              </div>
            </div>
          )}

          {activeProjects.length > 0 && (
            <div className={`space-y-2 ${timetable.length > 0 ? 'mt-6' : ''}`}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Active Plans</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeProjects.map(project => {
                  const totalSteps = project.steps.length
                  const completedSteps = project.steps.filter(s => s.is_completed).length
                  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
                  const nextStep = project.steps.find(s => !s.is_completed)

                  return (
                    <div key={project.id} style={{ borderLeft: '3px solid #f43f5e' }} className="rounded-2xl border border-slate-200/80 bg-white p-4 flex flex-col hover:border-slate-300 hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <h4 className="font-semibold text-sm text-slate-800 leading-snug">{project.title}</h4>
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">{progress}%</span>
                      </div>
                      
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-3">
                        <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                      </div>
                      
                      {nextStep ? (
                        <div className="mt-auto flex items-start gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <button
                            onClick={() => handleToggleProjectStep(project.id, nextStep.id)}
                            className="w-4 h-4 mt-0.5 rounded border-2 border-slate-300 bg-white hover:border-rose-400 flex-shrink-0 flex items-center justify-center transition-colors"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Next Step</p>
                            <p className="text-xs text-slate-700 font-medium truncate">{nextStep.title}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto flex items-center justify-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">No steps added yet.</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className={`space-y-7 ${(timetable.length > 0 || activeProjects.length > 0) ? 'mt-6' : ''}`}>
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
                ? (isToday ? 'Start small — one completion builds momentum.' : 'No items completed on this day.')
                : completedCount === totalCount
                ? 'Excellent! You crushed every item! 🎉'
                : `${completedCount} down, ${totalCount - completedCount} to go — keep it up!`}
            </p>
          </div>
        </>
      )}
    </section>
  )
}