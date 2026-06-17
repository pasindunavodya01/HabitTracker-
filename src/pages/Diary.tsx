import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type CompletedActivity = {
  id: string
  habit_id: string
  note: string | null
  completed_at: string
  habitTitle: string
  habitKind: string
  habitDesc: string | null
}

export default function Diary() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  const [activities, setActivities] = useState<CompletedActivity[]>([])
  const [journalContent, setJournalContent] = useState('')
  const [savedJournalContent, setSavedJournalContent] = useState('')
  const [journalId, setJournalId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [savingJournal, setSavingJournal] = useState(false)

  useEffect(() => {
    if (!user) return
    async function loadDay() {
      setLoading(true)
      
      const [year, month, day] = selectedDate.split('-').map(Number)
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0)
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)

      const [completionsRes, journalRes] = await Promise.all([
        supabase
          .from('completions')
          .select('id, habit_id, note, completed_at')
          .eq('user_id', user?.id)
          .gte('completed_at', startOfDay.toISOString())
          .lte('completed_at', endOfDay.toISOString())
          .order('completed_at', { ascending: false }),
        supabase
          .from('journal_entries')
          .select('id, content')
          .eq('user_id', user?.id)
          .eq('entry_date', selectedDate)
          .maybeSingle()
      ])

      const completionRows = completionsRes.data ?? []
      const habitIds = [...new Set(completionRows.map((c) => c.habit_id))]
      const habitsById: Record<string, { title: string; kind: string; description: string | null }> = {}
      if (habitIds.length > 0) {
        const { data: habitsData } = await supabase
          .from('habits')
          .select('id, title, kind, description')
          .in('id', habitIds)
        ;(habitsData ?? []).forEach((h) => {
          habitsById[h.id] = { title: h.title, kind: h.kind, description: h.description }
        })
      }

      const fetchedActivities = completionRows.map((c) => ({
        id: c.id,
        habit_id: c.habit_id,
        note: c.note,
        completed_at: c.completed_at,
        habitTitle: habitsById[c.habit_id]?.title || 'Unknown',
        habitKind: habitsById[c.habit_id]?.kind || 'habit',
        habitDesc: habitsById[c.habit_id]?.description || null
      }))

      setActivities(fetchedActivities)

      if (journalRes.data) {
        setJournalContent(journalRes.data.content)
        setSavedJournalContent(journalRes.data.content)
        setJournalId(journalRes.data.id)
      } else {
        setJournalContent('')
        setSavedJournalContent('')
        setJournalId(null)
      }

      setLoading(false)
    }
    loadDay()
  }, [user, selectedDate])

  const handleSaveJournal = async () => {
    if (!user) return
    if (!journalId && !journalContent.trim()) return // Don't save empty entries
    if (journalContent === savedJournalContent) return // Skip if no changes
    setSavingJournal(true)
    if (journalId) {
      await supabase
        .from('journal_entries')
        .update({ content: journalContent })
        .eq('id', journalId)
    } else {
      const { data } = await supabase
        .from('journal_entries')
        .insert([{ user_id: user.id, entry_date: selectedDate, content: journalContent }])
        .select('id')
        .single()
      if (data) {
        setJournalId(data.id)
      }
    }
    setSavingJournal(false)
  }

  const navigateDay = (offset: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() + offset)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setSelectedDate(`${y}-${m}-${dd}`)
  }

  if (!user) {
    return (
      <section className="space-y-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Diary</h2>
          <p className="mt-1 text-sm text-slate-400">Sign in to view your daily completions and notes.</p>
        </div>
      </section>
    )
  }

  const hasChanges = journalContent !== savedJournalContent
  const isSaved = !hasChanges && (!!journalId || journalContent.trim() !== '')

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Diary</h2>
          <p className="mt-1 text-sm text-slate-400">Reflect on your days and view your completions.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => navigateDay(-1)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">◀</button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
          />
          <button onClick={() => navigateDay(1)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600">▶</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Journal Entry */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col min-h-[500px]">
          <h3 className="font-bold text-slate-800 mb-4">📓 Notes for {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          <textarea
            value={journalContent}
            onChange={(e) => setJournalContent(e.target.value)}
            onBlur={handleSaveJournal}
            placeholder="Write about your day, lessons learned, or anything you want..."
            className="flex-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveJournal}
              disabled={savingJournal || !hasChanges}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-colors ${
                isSaved ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {savingJournal ? 'Saving...' : isSaved ? 'All changes saved ✓' : 'Save Notes'}
            </button>
          </div>
        </div>

        {/* Activities List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-[500px]">
          <h3 className="font-bold text-slate-800 mb-4">✅ Completed Activities</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400 text-center mt-10">Loading activities...</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center mt-10">No activities logged on this day.</p>
            ) : (
              activities.map(act => (
                <div key={act.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 uppercase tracking-wider flex-shrink-0 mt-0.5">
                      {act.habitKind.replace('_', ' ')}
                    </span>
                    <p className="font-semibold text-sm text-slate-800 leading-tight break-words flex-1 min-w-0">{act.habitTitle}</p>
                  </div>
                  {act.note && (
                    <div className="mt-2 text-sm italic text-slate-600 bg-white/60 border border-slate-100 p-2.5 rounded-lg shadow-sm break-words">
                      "{act.note}"
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-slate-400 text-right font-medium">
                    {new Date(act.completed_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}