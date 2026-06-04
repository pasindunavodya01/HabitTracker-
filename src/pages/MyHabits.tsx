import React, { useEffect, useState, useRef } from 'react'
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
  const [repeatType, setRepeatType] = useState<'days_of_week' | 'interval'>('days_of_week')
  const [intervalValue, setIntervalValue] = useState<number>(1)
  const [intervalUnit, setIntervalUnit] = useState<'days' | 'weeks'>('weeks')
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [milestones, setMilestones] = useState<{ id: string; title: string; done: boolean }[]>([])
  const [newMilestone, setNewMilestone] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const milestoneInputRef = useRef<HTMLInputElement>(null)

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

  const handleSaveHabit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)

    let error = null
    if (editingId) {
      const existingHabit = habits.find((h) => h.id === editingId)
      const metadata: any = {
        ...existingHabit?.metadata,
        target_date: (activeTab === 'task' || activeTab === 'goal') ? (targetDate || null) : null,
        repeat_type: (activeTab === 'task' || activeTab === 'goal') ? null : repeatType,
        days_of_week: (activeTab === 'task' || activeTab === 'goal') ? null : (repeatType === 'days_of_week' ? daysOfWeek : null),
        interval_value: (activeTab === 'task' || activeTab === 'goal') ? null : (repeatType === 'interval' ? intervalValue : null),
        interval_unit: (activeTab === 'task' || activeTab === 'goal') ? null : (repeatType === 'interval' ? intervalUnit : null),
        start_date: (activeTab === 'task' || activeTab === 'goal') ? null : (repeatType === 'interval' ? startDate : null),
        milestones: activeTab === 'goal' ? milestones : null,
      }
      Object.keys(metadata).forEach(k => { if (metadata[k] === null) delete metadata[k] })

      const kind = existingHabit?.kind === 'routine' && activeTab === 'habit' ? 'routine' : activeTab
      const { error: updateError } = await supabase.from('habits').update({
        title: title.trim(),
        description: description.trim() || null,
        kind,
        metadata
      }).eq('id', editingId)
      error = updateError
    } else {
      const metadata = {
        order_index: habits.length,
        ...(activeTab === 'task' || activeTab === 'goal' 
            ? { target_date: targetDate || null } 
            : { 
                repeat_type: repeatType,
                ...(repeatType === 'days_of_week' ? { days_of_week: daysOfWeek } : { interval_value: intervalValue, interval_unit: intervalUnit, start_date: startDate })
              }),
        ...(activeTab === 'goal' && milestones.length > 0 ? { milestones } : {}),
      }
      const { error: insertError } = await supabase.from('habits').insert([
        { user_id: user.id, title: title.trim(), description: description.trim() || null, kind: activeTab, metadata },
      ])
      error = insertError
    }

    setSaving(false)
    if (!error) {
      setEditingId(null)
      setTitle('')
      setDescription('')
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
      setRepeatType('days_of_week')
      setIntervalValue(1)
      setIntervalUnit('weeks')
      const today = new Date()
      setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
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

  const handleEdit = (habit: Habit) => {
    setEditingId(habit.id)
    setTitle(habit.title)
    setDescription(habit.description || '')
    
    let newTab = habit.kind
    if (newTab === 'routine') newTab = 'habit'
    setActiveTab(newTab)

    if (newTab === 'task' || newTab === 'goal') setTargetDate(habit.metadata?.target_date || '')
    else {
      setRepeatType(habit.metadata?.repeat_type || 'days_of_week')
      setDaysOfWeek(habit.metadata?.days_of_week || [0, 1, 2, 3, 4, 5, 6])
      setIntervalValue(habit.metadata?.interval_value || 1)
      setIntervalUnit(habit.metadata?.interval_unit || 'weeks')
      const today = new Date()
      setStartDate(habit.metadata?.start_date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
    }
    
    if (newTab === 'goal') setMilestones(habit.metadata?.milestones || [])
    else setMilestones([])
    setNewMilestone('')
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
    setRepeatType('days_of_week')
    setIntervalValue(1)
    setIntervalUnit('weeks')
    const today = new Date()
    setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
    setTargetDate('')
    setMilestones([])
    setNewMilestone('')
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

  const moveMilestone = (index: number, direction: 'up' | 'down') => {
    setMilestones(ms => {
      const newMs = [...ms]
      if (direction === 'up' && index > 0) {
        const temp = newMs[index - 1]
        newMs[index - 1] = newMs[index]
        newMs[index] = temp
      } else if (direction === 'down' && index < newMs.length - 1) {
        const temp = newMs[index + 1]
        newMs[index + 1] = newMs[index]
        newMs[index] = temp
      }
      return newMs
    })
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
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-3">
                    <div className="flex items-start gap-3 w-full sm:w-auto flex-1 min-w-0">
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
                        <p className="font-semibold text-slate-800 text-sm leading-snug break-words">{habit.title}</p>
                        {habit.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 break-words">{habit.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {(habit.kind === 'task' || habit.kind === 'goal') && habit.metadata?.target_date && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              📅 {habit.metadata.target_date}
                            </span>
                          )}
                          {habit.kind !== 'task' && habit.kind !== 'goal' && (!habit.metadata?.repeat_type || habit.metadata?.repeat_type === 'days_of_week') && Array.isArray(habit.metadata?.days_of_week) && (
                            <div className="flex flex-wrap gap-0.5">
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
                          {habit.kind !== 'task' && habit.kind !== 'goal' && habit.metadata?.repeat_type === 'interval' && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              🔄 Every {habit.metadata.interval_value} {habit.metadata.interval_unit} (from {habit.metadata.start_date})
                            </span>
                          )}
                        </div>
                        
                        {/* Milestones rendering */}
                        {habit.kind === 'goal' && habit.metadata?.milestones?.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-3">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Milestones:</p>
                            {habit.metadata.milestones.map((m: any) => (
                              <label key={m.id} className="flex items-start gap-2 cursor-pointer group max-w-full">
                                <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${m.done ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}>
                                  {m.done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className={`text-sm select-none break-words flex-1 min-w-0 ${m.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{m.title}</span>
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
                      <div className="flex items-center justify-end w-full sm:w-auto gap-1 flex-shrink-0 mt-1 sm:mt-0">
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
                      <div className="flex items-center justify-end w-full sm:w-auto gap-2 flex-shrink-0 mt-1 sm:mt-0">
                        <button
                          onClick={() => handleEdit(habit)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => habit.is_archived ? toggleArchive(habit.id, habit.is_archived) : setConfirmArchive(habit.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                        >
                          {habit.is_archived ? 'Restore' : 'Archive'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">
              {activeTabMeta.icon} {editingId ? 'Edit' : 'Add'} {activeTabMeta.label}
            </h3>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">Cancel</button>
            )}
          </div>
          <form onSubmit={handleSaveHabit} className="space-y-4">
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
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    {targetDate && (
                      <button
                        type="button"
                        onClick={() => setTargetDate('')}
                        className="rounded-xl px-4 py-2.5 bg-slate-100 text-sm font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {activeTab === 'goal' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Milestones</label>
                    <div className="space-y-2 mb-2">
                      {milestones.map((m, index) => (
                        <div key={m.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm gap-2">
                          <span className="flex-1 min-w-0 break-words line-clamp-2">{m.title}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button type="button" onClick={() => moveMilestone(index, 'up')} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1 text-xs transition-colors">▲</button>
                            <button type="button" onClick={() => moveMilestone(index, 'down')} disabled={index === milestones.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1 text-xs transition-colors">▼</button>
                            <button type="button" onClick={() => setMilestones(ms => ms.filter(x => x.id !== m.id))} className="text-slate-400 hover:text-red-500 p-1 ml-1 transition-colors">✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={milestoneInputRef}
                        value={newMilestone}
                        onChange={e => setNewMilestone(e.target.value)}
                        placeholder="Add a milestone..."
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newMilestone.trim()) { setMilestones(ms => [...ms, { id: crypto.randomUUID(), title: newMilestone.trim(), done: false }]); setNewMilestone(''); milestoneInputRef.current?.focus(); } } }}
                      />
                      <button
                        type="button"
                        onClick={() => { if (newMilestone.trim()) { setMilestones(ms => [...ms, { id: crypto.randomUUID(), title: newMilestone.trim(), done: false }]); setNewMilestone(''); milestoneInputRef.current?.focus(); } }}
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
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value as 'days_of_week' | 'interval')}
                  className="w-full mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="days_of_week">Specific Days of the Week</option>
                  <option value="interval">Custom Interval</option>
                </select>

                {repeatType === 'days_of_week' ? (
                  <div className="flex flex-wrap gap-1.5">
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
                ) : (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Every</span>
                      <input
                        type="number"
                        min="1"
                        value={intervalValue}
                        onChange={(e) => setIntervalValue(Number(e.target.value))}
                        className="w-16 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
                      />
                      <select
                        value={intervalUnit}
                        onChange={(e) => setIntervalUnit(e.target.value as 'days' | 'weeks')}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 bg-white"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-sm text-slate-600">Starting on</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 bg-white flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: activeTabMeta.accent }}
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : `Add ${activeTabMeta.label}`}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}