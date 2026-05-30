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

export default function MyHabits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [targetDate, setTargetDate] = useState('')
  const [activeTab, setActiveTab] = useState('habit')
  const [showArchived, setShowArchived] = useState(false)

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
        .eq('user_id', user?.id)
        .eq('is_archived', showArchived)
      const sorted = (data ?? []).sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999))
      setHabits(sorted)
      setLoading(false)
    }

    loadHabits()
  }, [user, showArchived])

  const handleCreateHabit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)

    const metadata = {
      order_index: habits.length,
      ...(activeTab === 'task' || activeTab === 'goal' ? { target_date: targetDate || null } : { days_of_week: daysOfWeek }),
    }

    const { error } = await supabase.from('habits').insert([
      {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        kind: activeTab,
        metadata,
      },
    ])

    setSaving(false)
    if (!error) {
      setTitle('')
      setDescription('')
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
      setTargetDate('')
      setShowArchived(false)
      const { data } = await supabase
        .from('habits')
        .select('id, title, description, kind, is_archived, metadata')
        .eq('user_id', user.id)
        .eq('is_archived', false)
      const sorted = (data ?? []).sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999))
      setHabits(sorted)
    }
  }

  const toggleArchive = async (habitId: string, currentStatus: boolean) => {
    if (!user) return
    await supabase.from('habits').update({ is_archived: !currentStatus }).eq('id', habitId)
    setHabits((current) => current.filter((habit) => habit.id !== habitId))
  }

  const filteredHabits = habits.filter(h => {
    if (activeTab === 'habit') return h.kind === 'habit' || h.kind === 'routine'
    if (activeTab === 'bad_habit') return h.kind === 'bad_habit'
    if (activeTab === 'task') return h.kind === 'task'
    if (activeTab === 'goal') return h.kind === 'goal'
    return false
  })

  const handleMove = async (habitId: string, direction: 'up' | 'down') => {
    const index = filteredHabits.findIndex(h => h.id === habitId)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === filteredHabits.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const habit = filteredHabits[index]
    const targetHabit = filteredHabits[targetIndex]

    const habitOrder = habit.metadata?.order_index ?? index
    const targetOrder = targetHabit.metadata?.order_index ?? targetIndex

    const newHabitMetadata = { ...habit.metadata, order_index: targetOrder }
    const newTargetMetadata = { ...targetHabit.metadata, order_index: habitOrder }

    setHabits(current => current.map(h => {
      if (h.id === habit.id) return { ...h, metadata: newHabitMetadata }
      if (h.id === targetHabit.id) return { ...h, metadata: newTargetMetadata }
      return h
    }).sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999)))

    await supabase.from('habits').update({ metadata: newHabitMetadata }).eq('id', habit.id)
    await supabase.from('habits').update({ metadata: newTargetMetadata }).eq('id', targetHabit.id)
  }

  const tabLabel = () => {
    switch(activeTab) {
      case 'habit': return 'Habit'
      case 'bad_habit': return 'Avoid Habit'
      case 'task': return 'Task'
      case 'goal': return 'Goal'
      default: return 'Item'
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div>
          <h2 className="text-xl font-semibold">My Items</h2>
          <p className="mt-2 text-gray-600">Create, categorize, and archive your routines, habits, and tasks.</p>
        </div>
      </div>

      <div className="flex overflow-x-auto space-x-4 border-b border-slate-200 hide-scrollbar">
        {[
          { id: 'habit', label: 'Habits' },
          { id: 'bad_habit', label: 'Avoid Habits' },
          { id: 'task', label: 'Tasks' },
          { id: 'goal', label: 'Goals' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap py-2 px-4 border-b-2 font-semibold transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{showArchived ? 'Archived' : 'Your'} {tabLabel()}s</h3>
            <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
              <span>View archived</span>
            </label>
          </div>
          {loading ? (
            <p className="mt-4 text-gray-500">Loading {tabLabel().toLowerCase()}s…</p>
          ) : filteredHabits.length === 0 ? (
            <p className="mt-4 text-gray-500">No {tabLabel().toLowerCase()}s yet. Add one to start tracking.</p>
          ) : (
            <div className="mt-4 space-y-3">
            {filteredHabits.map((habit, index) => (
                <div key={habit.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleMove(habit.id, 'up')} disabled={index === 0} className="pb-1 text-xs leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30">▲</button>
                      <button onClick={() => handleMove(habit.id, 'down')} disabled={index === filteredHabits.length - 1} className="pt-1 text-xs leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30">▼</button>
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
                      onClick={() => toggleArchive(habit.id, habit.is_archived)}
                      className="rounded-full border px-3 py-1 text-sm text-gray-600 hover:bg-slate-100"
                    >
                      {habit.is_archived ? 'Unarchive' : 'Archive'}
                    </button>
                  </div>
                  {habit.description ? <p className="mt-3 text-sm text-gray-500">{habit.description}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Add {tabLabel()}</h3>
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

            {activeTab === 'task' || activeTab === 'goal' ? (
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
              {saving ? 'Saving…' : `Create ${tabLabel()}`}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
