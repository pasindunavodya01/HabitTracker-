import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Habit = {
  id: string
  title: string
}

type Reminder = {
  id: string
  habit_id: string
  schedule: string
  timezone: string | null
  enabled: boolean
  created_at: string
  habit_title?: string
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export default function Reminders() {
  const { user } = useAuth()
  const [habits, setHabits] = useState<Habit[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schedule, setSchedule] = useState('08:00')
  const [habitId, setHabitId] = useState('')
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    async function load() {
      const userId = user?.id
      if (!userId) return
      setLoading(true)
      const [{ data: habitData }, { data: reminderData }] = await Promise.all([
        supabase.from('habits').select('id, title').eq('user_id', userId).eq('is_archived', false),
        supabase.from('reminders').select('id, habit_id, schedule, timezone, enabled, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      const habitsWithData = habitData ?? []
      setHabits(habitsWithData)
      setHabitId(habitsWithData[0]?.id ?? '')
      setReminders(
        (reminderData ?? []).map((r) => ({
          ...r,
          habit_title: habitsWithData.find((h) => h.id === r.habit_id)?.title ?? 'Habit',
        }))
      )
      setLoading(false)
    }
    load()
  }, [user])

  const activeCount = useMemo(() => reminders.filter((r) => r.enabled).length, [reminders])

  const handleCreateReminder = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !habitId || !schedule) return
    setSaving(true)
    const { error } = await supabase.from('reminders').insert([
      { user_id: user.id, habit_id: habitId, schedule, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, enabled: true },
    ])
    setSaving(false)
    if (!error) {
      setSchedule('08:00')
      const habit = habits.find((h) => h.id === habitId)
      setReminders((c) => [
        { id: crypto.randomUUID(), habit_id: habitId, schedule, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, enabled: true, created_at: new Date().toISOString(), habit_title: habit?.title ?? 'Habit' },
        ...c,
      ])
    }
  }

  const toggleReminder = async (id: string, enabled: boolean) => {
    if (!user) return
    const { error } = await supabase.from('reminders').update({ enabled }).eq('id', id)
    if (!error) setReminders((c) => c.map((r) => (r.id === id ? { ...r, enabled } : r)))
  }

  const deleteReminder = async (id: string) => {
    if (!user) return
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (!error) {
      setReminders((c) => c.filter((r) => r.id !== id))
      setDeletingId(null)
    }
  }

  const requestPermission = async () => {
    if (!isNotificationSupported()) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  if (!user) {
    return (
      <section className="space-y-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Reminders</h2>
          <p className="mt-1 text-sm text-slate-400">Sign in to set up habit reminders and schedule daily check-ins.</p>
        </div>
      </section>
    )
  }

  const notifStatus = !isNotificationSupported()
    ? { icon: '🚫', text: 'Notifications not supported by this browser.', type: 'neutral' }
    : permission === 'granted'
    ? { icon: '🔔', text: 'Browser notifications are enabled.', type: 'success' }
    : permission === 'denied'
    ? { icon: '⛔', text: 'Notifications are blocked in your browser settings.', type: 'error' }
    : { icon: '🔕', text: 'Grant permission to receive reminders while the app is open.', type: 'warning' }

  const notifColors: Record<string, string> = {
    success: 'border-emerald-100 bg-emerald-50',
    error:   'border-red-100 bg-red-50',
    warning: 'border-amber-100 bg-amber-50',
    neutral: 'border-slate-200 bg-slate-50',
  }

  return (
    <section className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reminders</h2>
          <p className="mt-1 text-sm text-slate-400">Schedule daily habit alerts delivered right to your browser.</p>
        </div>
        <div className="flex-shrink-0 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600">
          {activeCount} active
        </div>
      </div>

      {/* Notification permission banner */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${notifColors[notifStatus.type]}`}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{notifStatus.icon}</span>
          <p className="text-sm font-medium text-slate-700">{notifStatus.text}</p>
        </div>
        {isNotificationSupported() && permission === 'default' && (
          <button
            onClick={requestPermission}
            className="flex-shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Enable
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Reminder list */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">Your Schedule</h3>
          <p className="text-xs text-slate-400 mb-5">Toggle reminders on/off or remove them anytime.</p>

          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : reminders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-2xl mb-2">⏰</p>
              <p className="text-sm font-medium text-slate-500">No reminders set</p>
              <p className="text-xs text-slate-400 mt-1">Use the form to schedule your first alert.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`rounded-xl border p-4 flex items-center gap-4 transition-colors ${
                    reminder.enabled ? 'border-blue-100 bg-blue-50/40' : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  {/* Time badge */}
                  <div
                    className={`flex-shrink-0 rounded-xl px-3 py-2 text-center ${
                      reminder.enabled ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <p className="text-sm font-bold leading-none">{formatTime(reminder.schedule)}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">daily</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${reminder.enabled ? 'text-slate-800' : 'text-slate-400'}`}>
                      {reminder.habit_title}
                    </p>
                    {reminder.timezone && (
                      <p className="text-xs text-slate-400 truncate">{reminder.timezone}</p>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleReminder(reminder.id, !reminder.enabled)}
                      title={reminder.enabled ? 'Disable' : 'Enable'}
                      className={`relative w-9 h-5 rounded-full transition-colors ${reminder.enabled ? 'bg-blue-500' : 'bg-slate-200'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${reminder.enabled ? 'translate-x-4' : ''}`}
                      />
                    </button>

                    {/* Delete */}
                    {deletingId === reminder.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => deleteReminder(reminder.id)} className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
                          Remove
                        </button>
                        <button onClick={() => setDeletingId(null)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(reminder.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-sm px-1"
                        title="Delete"
                      >
                        ✕
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
          <h3 className="font-bold text-slate-800 mb-4">⏰ Add Reminder</h3>
          <form onSubmit={handleCreateReminder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Habit</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                value={habitId}
                onChange={(e) => setHabitId(e.target.value)}
                required
                disabled={habits.length === 0}
              >
                {habits.length === 0 ? (
                  <option value="">Add a habit first</option>
                ) : (
                  habits.map((h) => (
                    <option key={h.id} value={h.id}>{h.title}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Time</label>
              <input
                type="time"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                required
                disabled={habits.length === 0}
              />
              {schedule && (
                <p className="mt-1 text-xs text-slate-400">Fires daily at {formatTime(schedule)}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || habits.length === 0}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save Reminder'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}