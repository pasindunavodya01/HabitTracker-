import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type TimetableRow = {
  id: string
  activity: string
  start_time: string
  end_time: string
  days_of_week: number[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Timetable() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<TimetableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [activity, setActivity] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('timetables')
        .select('*')
        .eq('user_id', user?.id)
        .order('start_time', { ascending: true })
      setEntries(data ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !activity.trim()) return
    setSaving(true)

    const entryData = {
      user_id: user.id,
      activity: activity.trim(),
      start_time: startTime,
      end_time: endTime,
      days_of_week: daysOfWeek,
    }

    if (editingId) {
      const { error, data } = await supabase
        .from('timetables')
        .update(entryData)
        .eq('id', editingId)
        .select('*')
        .single()
      
      setSaving(false)
      if (!error && data) {
        setEntries(c => c.map(e => e.id === editingId ? data : e).sort((a, b) => a.start_time.localeCompare(b.start_time)))
        cancelEdit()
      }
    } else {
      const { error, data } = await supabase.from('timetables').insert([entryData]).select('*').single()
      
      setSaving(false)
      if (!error && data) {
        setEntries(c => [...c, data].sort((a, b) => a.start_time.localeCompare(b.start_time)))
        cancelEdit()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const { error } = await supabase.from('timetables').delete().eq('id', id)
    if (!error) {
      setEntries(c => c.filter(e => e.id !== id))
      setDeletingId(null)
    }
  }

  const handleEdit = (entry: TimetableRow) => {
    setEditingId(entry.id)
    setActivity(entry.activity)
    setStartTime(entry.start_time)
    setEndTime(entry.end_time)
    setDaysOfWeek(entry.days_of_week)
    setDeletingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setActivity('')
    setStartTime('08:00')
    setEndTime('09:00')
    setDaysOfWeek([1, 2, 3, 4, 5])
  }

  function formatTime(time: string) {
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 === 0 ? 12 : h % 12
    return `${hour}:${String(m).padStart(2, '0')} ${period}`
  }

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Timetable</h2>
        <p className="mt-1 text-sm text-slate-400">Schedule your daily activities and view them on your Today screen.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-5">Your Schedule</h3>
          {loading ? (
            <div className="flex justify-center text-slate-400 py-8">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8 border border-dashed border-slate-200 rounded-xl">No schedule added yet.</div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => (
                <div key={entry.id} className="rounded-xl border border-slate-200 p-4 flex justify-between items-center bg-slate-50">
                  <div>
                    <p className="font-semibold text-slate-800">{entry.activity}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatTime(entry.start_time)} - {formatTime(entry.end_time)}</p>
                    <div className="flex gap-1 mt-2">
                      {DAY_LABELS.map((d, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${entry.days_of_week.includes(i) ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-200 text-slate-400'}`}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {deletingId === entry.id ? (
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleDelete(entry.id)} className="text-[10px] uppercase tracking-wide bg-red-100 text-red-700 px-2 py-1.5 rounded font-bold hover:bg-red-200">Confirm</button>
                        <button onClick={() => setDeletingId(null)} className="text-[10px] uppercase tracking-wide bg-slate-200 text-slate-600 px-2 py-1.5 rounded font-bold hover:bg-slate-300">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(entry)} className="text-xs font-semibold text-slate-400 hover:text-blue-600 p-2 transition-colors">Edit</button>
                        <button onClick={() => setDeletingId(entry.id)} className="text-slate-400 hover:text-red-500 text-sm p-2 transition-colors">✕</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{editingId ? 'Edit Schedule' : 'Add Schedule'}</h3>
            {editingId && (
              <button onClick={cancelEdit} className="text-xs font-semibold text-slate-400 hover:text-slate-600">Cancel</button>
            )}
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Activity</label>
              <input required value={activity} onChange={e => setActivity(e.target.value)} placeholder="E.g. Work, Gym, Reading" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Start</label>
                <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">End</label>
                <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Repeat on</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={i} type="button"
                    onClick={() => setDaysOfWeek(c => c.includes(i) ? c.filter(v => v !== i) : [...c, i])}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${daysOfWeek.includes(i) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  >
                    {d[0]}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving || !activity.trim()} className="w-full rounded-xl bg-blue-600 mt-2 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add to Timetable'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}