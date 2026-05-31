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

const TABS = [
  { id: 'habit',     label: 'Habits',       icon: '⚡', accent: '#3b82f6' },
  { id: 'bad_habit', label: 'Avoid',         icon: '🚫', accent: '#f59e0b' },
  { id: 'task',      label: 'Tasks',         icon: '✅', accent: '#10b981' },
  { id: 'goal',      label: 'Goals',         icon: '🎯', accent: '#8b5cf6' },
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null)
  const [milestones, setMilestones] = useState<{ id: string; title: string; done: boolean }[]>([])
  const [newMilestone, setNewMilestone] = useState('')

  const activeTabMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0]

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
      ...(activeTab === 'task' || activeTab === 'goal'
        ? { target_date: targetDate || null }
        : { days_of_week: daysOfWeek }),
      ...(activeTab === 'goal' && milestones.length > 0 ? { milestones } : {}),
    }
    const { error } = await supabase.from('habits').insert([
      { user_id: user.id, title: title.trim(), description: description.trim() || null, kind: activeTab, metadata },
    ])
    setSaving(false)
    if (!error) {
      setTitle('')
      setDescription('')
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
      setTargetDate('')
      setShowArchived(false)
      setMilestones([])
      setNewMilestone('')
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
    setHabits((c) => c.filter((h) => h.id !== habitId))
    setConfirmArchive(null)
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

  const filteredHabits = habits.filter((h) => {
    if (activeTab === 'habit') return h.kind === 'habit' || h.kind === 'routine'
    return h.kind === activeTab
  })

  const handleMove = async (habitId: string, direction: 'up' | 'down') => {
    const index = filteredHabits.findIndex((h) => h.id === habitId)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === filteredHabits.length - 1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const habit = filteredHabits[index]
    const targetHabit = filteredHabits[targetIndex]
    const habitOrder = habit.metadata?.order_index ?? index
    const targetOrder = targetHabit.metadata?.order_index ?? targetIndex
    const newHabitMeta = { ...habit.metadata, order_index: targetOrder }
    const newTargetMeta = { ...targetHabit.metadata, order_index: habitOrder }
    setHabits((c) =>
      c.map((h) => {
        if (h.id === habit.id) return { ...h, metadata: newHabitMeta }
        if (h.id === targetHabit.id) return { ...h, metadata: newTargetMeta }
        return h
      }).sort((a, b) => (a.metadata?.order_index ?? 999) - (b.metadata?.order_index ?? 999))
    )
    await supabase.from('habits').update({ metadata: newHabitMeta }).eq('id', habit.id)
    await supabase.from('habits').update({ metadata: newTargetMeta }).eq('id', targetHabit.id)
  }

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">My Items</h2>
        <p className="mt-1 text-sm text-slate-400">Manage your habits, tasks, and goals.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            style={activeTab === tab.id ? { backgroundColor: tab.accent } : {}}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-800">
                {showArchived ? 'Archived ' : ''}{activeTabMeta.icon} {activeTabMeta.label}s
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{filteredHabits.length} item{filteredHabits.length !== 1 ? 's' : ''}</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setShowArchived((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${showArchived ? 'bg-blue-500' : 'bg-slate-200'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showArchived ? 'translate-x-4' : ''}`}
                />
              </div>
              <span className="text-xs font-medium text-slate-500">Archived</span>
            </label>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : filteredHabits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-2xl mb-2">{activeTabMeta.icon}</p>
              <p className="text-sm font-medium text-slate-500">No {activeTabMeta.label.toLowerCase()}s yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the form to add your first one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHabits.map((habit, index) => (
                <div
                  key={habit.id}
                  style={{ borderLeft: `3px solid ${activeTabMeta.accent}` }}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5 mt-0.5 flex-shrink-0">
                        <button
                          onClick={() => handleMove(habit.id, 'up')}
                          disabled={index === 0}
                          className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-xs leading-none transition-colors"
                        >▲</button>
                        <button
                          onClick={() => handleMove(habit.id, 'down')}
                          disabled={index === filteredHabits.length - 1}
                          className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-xs leading-none transition-colors"
                        >▼</button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm leading-snug">{habit.title}</p>
                        {habit.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{habit.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {(habit.kind === 'task' || habit.kind === 'goal') && habit.metadata?.target_date && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              📅 {habit.metadata.target_date}
                            </span>
                          )}
                          {habit.kind !== 'task' && habit.kind !== 'goal' && Array.isArray(habit.metadata?.days_of_week) && (
                            <div className="flex gap-0.5">
                              {DAY_LABELS.map((d, i) => (
                                <span
                                  key={i}
                                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                    habit.metadata.days_of_week.includes(i)
                                      ? 'text-white'
                                      : 'bg-slate-100 text-slate-300'
                                  }`}
                                  style={habit.metadata.days_of_week.includes(i) ? { backgroundColor: activeTabMeta.accent } : {}}
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Milestones rendering */}
                        {habit.kind === 'goal' && habit.metadata?.milestones?.length > 0 && (
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
                      </div>

                    {/* Archive button */}
                    {confirmArchive === habit.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleArchive(habit.id, habit.is_archived)}
                          className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmArchive(null)}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => habit.is_archived ? toggleArchive(habit.id, habit.is_archived) : setConfirmArchive(habit.id)}
                        className="flex-shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                      >
                        {habit.is_archived ? 'Restore' : 'Archive'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-fit">
          <h3 className="font-bold text-slate-800 mb-4">
            {activeTabMeta.icon} Add {activeTabMeta.label}
          </h3>
          <form onSubmit={handleCreateHabit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                placeholder={activeTab === 'habit' ? 'Morning journaling' : activeTab === 'task' ? 'Submit report' : activeTab === 'goal' ? 'Run a 5K' : 'Avoid social media'}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description <span className="font-normal normal-case text-slate-400">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                rows={2}
                placeholder="Brief note…"
              />
            </div>

            {activeTab === 'task' || activeTab === 'goal' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Target Date <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                {activeTab === 'goal' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Milestones</label>
                    <div className="space-y-2 mb-2">
                      {milestones.map(m => (
                        <div key={m.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm">
                          <span>{m.title}</span>
                          <button type="button" onClick={() => setMilestones(ms => ms.filter(x => x.id !== m.id))} className="text-slate-400 hover:text-red-500">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newMilestone}
                        onChange={e => setNewMilestone(e.target.value)}
                        placeholder="Add a milestone..."
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newMilestone.trim()) { setMilestones(ms => [...ms, { id: crypto.randomUUID(), title: newMilestone.trim(), done: false }]); setNewMilestone(''); } } }}
                      />
                      <button
                        type="button"
                        onClick={() => { if (newMilestone.trim()) { setMilestones(ms => [...ms, { id: crypto.randomUUID(), title: newMilestone.trim(), done: false }]); setNewMilestone(''); } }}
                        className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Repeat on</label>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setDaysOfWeek((c) => c.includes(i) ? c.filter((v) => v !== i) : [...c, i])
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all"
                      style={
                        daysOfWeek.includes(i)
                          ? { backgroundColor: activeTabMeta.accent, color: '#fff' }
                          : { backgroundColor: '#f1f5f9', color: '#94a3b8' }
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: activeTabMeta.accent }}
            >
              {saving ? 'Saving…' : `Add ${activeTabMeta.label}`}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}