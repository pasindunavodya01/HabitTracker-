import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Habit = {
  id: string
  title: string
  description: string | null
  kind: string
  is_archived: boolean
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

  useEffect(() => {
    if (!user) return

    async function loadHabits() {
      setLoading(true)
      const { data } = await supabase
        .from('habits')
        .select('id, title, description, kind, is_archived')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setHabits(data ?? [])
      setLoading(false)
    }

    loadHabits()
  }, [user])

  const handleCreateHabit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)

    const { error } = await supabase.from('habits').insert([
      {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        kind,
      },
    ])

    setSaving(false)
    if (!error) {
      setTitle('')
      setDescription('')
      setKind('habit')
      const { data } = await supabase
        .from('habits')
        .select('id, title, description, kind, is_archived')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setHabits(data ?? [])
    }
  }

  const toggleArchive = async (habitId: string) => {
    if (!user) return
    await supabase.from('habits').update({ is_archived: true }).eq('id', habitId)
    setHabits((current) => current.filter((habit) => habit.id !== habitId))
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
              {habits.map((habit) => (
                <div key={habit.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{habit.title}</p>
                      <p className="text-sm text-gray-500">{habit.kind.replace('_', ' ')}</p>
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
