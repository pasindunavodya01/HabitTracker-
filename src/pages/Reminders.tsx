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

function formatSchedule(schedule: string) {
  return schedule
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

      const remindersWithTitles = (reminderData ?? []).map((reminder) => ({
        ...reminder,
        habit_title: habitsWithData.find((habit) => habit.id === reminder.habit_id)?.title ?? 'Habit',
      }))
      setReminders(remindersWithTitles)
      setLoading(false)
    }

    load()
  }, [user])

  const nextReminderCount = useMemo(() => reminders.filter((item) => item.enabled).length, [reminders])

  const handleCreateReminder = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || !habitId || !schedule) return

    setSaving(true)
    const { error } = await supabase.from('reminders').insert([
      {
        user_id: user.id,
        habit_id: habitId,
        schedule,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabled: true,
      },
    ])

    setSaving(false)
    if (!error) {
      setSchedule('08:00')
      const habit = habits.find((item) => item.id === habitId)
      setReminders((current) => [
        { id: crypto.randomUUID(), habit_id: habitId, schedule, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, enabled: true, created_at: new Date().toISOString(), habit_title: habit?.title ?? 'Habit' },
        ...current,
      ])
    }
  }

  const toggleReminder = async (id: string, enabled: boolean) => {
    if (!user) return
    const { error } = await supabase.from('reminders').update({ enabled }).eq('id', id)
    if (!error) {
      setReminders((current) => current.map((reminder) => (reminder.id === id ? { ...reminder, enabled } : reminder)))
    }
  }

  const requestPermission = async () => {
    if (!isNotificationSupported()) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  if (!user) {
    return (
      <section>
        <h2 className="text-xl font-semibold">Reminders</h2>
        <p className="mt-2 text-gray-600">Sign in to set up habit reminders and schedule daily check-ins.</p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Reminders</h2>
            <p className="mt-2 text-gray-600">Schedule habit reminders and receive browser notifications while LifeOS is open.</p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">{nextReminderCount} active reminder(s)</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Browser notifications</p>
            <p className="mt-2 text-sm text-slate-700">
              {isNotificationSupported()
                ? permission === 'granted'
                  ? 'Notifications are enabled.'
                  : permission === 'denied'
                  ? 'Notifications are blocked in your browser settings.'
                  : 'Grant permission to receive reminder notifications while LifeOS is open.'
                : 'Notifications are not supported by this browser.'}
            </p>
          </div>
          {isNotificationSupported() && permission !== 'granted' ? (
            <button onClick={requestPermission} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Enable notifications
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">My reminder schedule</h3>
          {loading ? (
            <p className="mt-4 text-gray-500">Loading reminders…</p>
          ) : reminders.length === 0 ? (
            <p className="mt-4 text-gray-500">No reminders yet. Use the form to schedule habit alerts.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{reminder.habit_title}</p>
                      <p className="text-sm text-slate-500">{formatSchedule(reminder.schedule)} daily</p>
                    </div>
                    <button
                      onClick={() => toggleReminder(reminder.id, !reminder.enabled)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${reminder.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {reminder.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Add a reminder</h3>
          <form onSubmit={handleCreateReminder} className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">Habit</label>
            <select
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              value={habitId}
              onChange={(event) => setHabitId(event.target.value)}
              required
              disabled={habits.length === 0}
            >
              {habits.length === 0 ? (
                <option value="">Add a habit first</option>
              ) : (
                habits.map((habit) => (
                  <option key={habit.id} value={habit.id}>
                    {habit.title}
                  </option>
                ))
              )}
            </select>

            <label className="block text-sm font-medium text-slate-700">Time</label>
            <input
              type="time"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              required
              disabled={habits.length === 0}
            />

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save reminder'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
