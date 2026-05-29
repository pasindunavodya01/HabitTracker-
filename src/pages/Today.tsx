import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Habit = {
  id: string
  title: string
  description: string | null
  kind: string
  is_archived: boolean
}

type Completion = {
  id: string
  habit_id: string
}

function todayRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
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
          .select('id, title, description, kind, is_archived')
          .eq('user_id', user.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: true }),
        supabase
          .from('completions')
          .select('habit_id')
          .eq('user_id', user.id)
          .gte('completed_at', start)
          .lt('completed_at', end),
      ])

      setHabits(habitsData ?? [])
      setCompletedHabitIds(new Set((completionData ?? []).map((item) => item.habit_id)))
      setLoading(false)
    }

    load()
  }, [user])

  const completedCount = completedHabitIds.size
  const totalCount = habits.length

  const handleComplete = async (habitId: string) => {
    if (!user || completedHabitIds.has(habitId)) return
    setSavingHabitIds((current) => new Set(current).add(habitId))

    const { error } = await supabase.from('completions').insert([
      {
        user_id: user.id,
        habit_id: habitId,
        completed_at: new Date().toISOString(),
      },
    ])

    setSavingHabitIds((current) => {
      const next = new Set(current)
      next.delete(habitId)
      return next
    })

    if (!error) {
      setCompletedHabitIds((current) => new Set(current).add(habitId))
    }
  }

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'No habits or routines added yet.'
    return `${completedCount} of ${totalCount} done today`
  }, [completedCount, totalCount])

  const motivationText = completedCount === 0
    ? 'Start small: complete one habit to build momentum today.'
    : completedCount === totalCount
    ? 'Great work! You completed every item on today’s checklist.'
    : `Nice progress — you’ve completed ${completedCount} of ${totalCount} habits today.`

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Today</h2>
            <p className="mt-2 text-gray-600">Daily checklist, quick logging, and streak tracking.</p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">{summaryText}</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-gray-500">Loading today's items…</div>
      ) : totalCount === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-gray-500">
          Add habits in My Habits to start tracking today.
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {habits.map((habit) => {
              const isCompleted = completedHabitIds.has(habit.id)
              const saving = savingHabitIds.has(habit.id)
              return (
                <div key={habit.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{habit.title}</p>
                      {habit.description ? <p className="mt-1 text-sm text-gray-500">{habit.description}</p> : null}
                      <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{habit.kind.replace('_', ' ')}</p>
                    </div>
                    <button
                      onClick={() => handleComplete(habit.id)}
                      disabled={isCompleted || saving}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'} ${saving ? 'opacity-70' : ''}`}
                    >
                      {isCompleted ? 'Completed' : saving ? 'Saving...' : 'Complete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm uppercase tracking-wide text-slate-500">Motivation</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{motivationText}</p>
            <p className="mt-4 text-sm text-gray-600">Track progress consistently and turn today’s small wins into long-term habits.</p>
          </div>
        </>
      )}
    </section>
  )
}
