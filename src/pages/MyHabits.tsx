import React, { useEffect, useState } from 'react'
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

const kinds = [
  { value: 'habit', label: 'Habit' },
  { value: 'routine', label: 'Routine' },
  { value: 'task', label: 'Task' },
  { value: 'bad_habit', label: 'Bad Habit' },
  { value: 'goal', label: 'Goal' },
]

export default function MyHabits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('habit')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [targetDate, setTargetDate] = useState('')

  const DAYS = [
    { label: 'S', value: 0 },
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
  ]

  useEffect(() => {
    if (!user) return

    async function loadHabits() {
      setLoading(true)
      const { data } = await supabase
        .from('habits')
        .select('id, title, description, kind, is_archived, metadata')
        .eq('user_id', user.id)
        .eq('is_archived', false)
      const sorted = (data ?? []).sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999))
      setHabits(sorted)
      setLoading(false)
    }

    loadHabits()
  }, [user])

  const handleCreateHabit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)

    const metadata = {
      order_index: habits.length,
      ...(kind === 'task' || kind === 'goal' ? { target_date: targetDate || null } : { days_of_week: daysOfWeek }),
    }

    const { error } = await supabase.from('habits').insert([
      {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        kind,
        metadata,
      },
    ])

    setSaving(false)
    if (!error) {
      setTitle('')
      setDescription('')
      setKind('habit')
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
      setTargetDate('')
      const { data } = await supabase
        .from('habits')
        .select('id, title, description, kind, is_archived, metadata')
        .eq('user_id', user.id)
        .eq('is_archived', false)
      const sorted = (data ?? []).sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999))
      setHabits(sorted)
    }
  }

  const toggleArchive = async (habitId: string) => {
    if (!user) return
    await supabase.from('habits').update({ is_archived: true }).eq('id', habitId)
    setHabits((current) => current.filter((habit) => habit.id !== habitId))
  }

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === habits.length - 1) return

    const newHabits = [...habits]
    const targetIndex = direction === 'up' ? index - 1 : index + 1

    const temp = newHabits[index]
    newHabits[index] = newHabits[targetIndex]
    newHabits[targetIndex] = temp

    const updates = newHabits.map((h, i) => ({
      ...h,
      metadata: { ...(h.metadata || {}), order_index: i },
    }))

    setHabits(updates)

    updates.forEach(async (h) => {
      await supabase.from('habits').update({ metadata: h.metadata }).eq('id', h.id)
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div>
          <h2 className="text-xl font-semibold">My Habits</h2>
          <p className="mt-2 text-gray-600">Create, categorize, and archive your routines, habits, and tasks.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Your habits</h3>
          {loading ? (
            <p className="mt-4 text-gray-500">Loading habits…</p>
          ) : habits.length === 0 ? (
            <p className="mt-4 text-gray-500">No habits yet. Add one to start tracking.</p>
          ) : (
            <div className="mt-4 space-y-3">
            {habits.map((habit, index) => (
                <div key={habit.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="pb-1 text-xs leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30">▲</button>
                      <button onClick={() => handleMove(index, 'down')} disabled={index === habits.length - 1} className="pt-1 text-xs leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30">▼</button>
                    </div>
                    <div>
                      <p className="font-semibold">{habit.title}</p>
                      <p className="text-sm text-gray-500">
                        {habit.kind.replace('_', ' ')}
                        {(habit.kind === 'task' || habit.kind === 'goal') && habit.metadata?.target_date ? ` • ${habit.metadata.target_date}` : ''}
                        {(habit.kind !== 'task' && habit.kind !== 'goal') && Array.isArray(habit.metadata?.days_of_week) && habit.metadata.days_of_week.length < 7 ? ` • ${habit.metadata.days_of_week.length} days/wk` : ''}
                      </p>
                    </div>
                  </div>
                    <button
                      onClick={() => toggleArchive(habit.id)}
                      className="rounded-full border px-3 py-1 text-sm text-gray-600 hover:bg-slate-100"
                    >
                      Archive
                    </button>
                  </div>
                  {habit.description ? <p className="mt-3 text-sm text-gray-500">{habit.description}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Add habit</h3>
          <form onSubmit={handleCreateHabit} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Morning journaling"
              required
            />

            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Write a quick reflection after breakfast"
              rows={3}
            />

            <label className="block text-sm font-medium text-slate-700">Kind</label>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {kinds.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {kind === 'task' || kind === 'goal' ? (
              <>
                <label className="block text-sm font-medium text-slate-700">Scheduled Date (Optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700">Repeat on days</label>
                <div className="flex gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDaysOfWeek((curr) => (curr.includes(d.value) ? curr.filter((v) => v !== d.value) : [...curr, d.value]))}
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                        daysOfWeek.includes(d.value) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Create habit'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
