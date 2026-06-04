import { type MutableRefObject, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type ReminderRow = {
  id: string
  habit_id: string
  schedule: string
  enabled: boolean
}

type HabitRow = {
  id: string
  title: string
}

function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function getNextOccurrence(schedule: string) {
  const [hours, minutes] = schedule.split(':').map(Number)
  const now = new Date()
  const next = new Date(now)
  next.setHours(hours, minutes, 0, 0)
  if (next <= now) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

function scheduleReminder(reminder: ReminderRow, habitTitle: string, timers: MutableRefObject<number[]>) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const next = getNextOccurrence(reminder.schedule)
  const delay = next.getTime() - Date.now()
  if (delay <= 0) return

  const timer = window.setTimeout(async () => {
    if (Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(`Reminder: ${habitTitle}`, {
            body: `Time to complete ${habitTitle}`,
            icon: '/icon-192.png'
          })
        })
      } else {
        new Notification(`Reminder: ${habitTitle}`, {
          body: `Time to complete ${habitTitle}`,
        })
      }
    }
    scheduleReminder(reminder, habitTitle, timers)
  }, delay)

  timers.current.push(timer)
}

export default function ReminderScheduler() {
  const { user } = useAuth()
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!user || !isNotificationSupported() || Notification.permission !== 'granted') {
      return
    }

    let mounted = true

    async function loadReminders() {
      const userId = user?.id
      if (!userId) return
      const { data: reminders } = await supabase
        .from('reminders')
        .select('id, habit_id, schedule, enabled')
        .eq('user_id', userId)
        .eq('enabled', true)

      const habitIds = (reminders ?? []).map((item) => item.habit_id)
      const { data: habits } = await supabase
        .from('habits')
        .select('id, title')
        .in('id', habitIds)

      if (!mounted) return

      const habitMap = new Map(habits?.map((habit) => [habit.id, habit.title]) ?? [])
      ;(reminders ?? []).forEach((reminder) => {
        const title = habitMap.get(reminder.habit_id) ?? 'Your habit'
        scheduleReminder(reminder, title, timers)
      })
    }

    loadReminders()

    return () => {
      mounted = false
      timers.current.forEach((timer: number) => window.clearTimeout(timer))
      timers.current = []
    }
  }, [user])

  return null
}
