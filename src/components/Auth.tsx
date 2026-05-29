import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth({ onClose }: { onClose?: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      mounted = false
      // @ts-ignore
      sub?.subscription?.unsubscribe && sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email })
      if (error) throw error
      alert('Check your email for a magic link to sign in.')
      setEmail('')
      onClose && onClose()
    } catch (err: any) {
      alert(err.message ?? 'Error sending sign-in link')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSession(null)
  }

  if (session?.user) {
    return (
      <div className="p-4 rounded border bg-white">
        <div className="text-sm">Signed in as <strong>{session.user.email}</strong></div>
        <div className="mt-2 flex gap-2">
          <button onClick={handleSignOut} className="px-3 py-1 bg-red-500 text-white rounded">Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSignIn} className="p-4 rounded border bg-white">
      <label className="block text-sm text-gray-700">Email</label>
      <input
        className="mt-1 w-full border px-2 py-1 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        type="email"
        required
      />
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
          {loading ? 'Sending…' : 'Send Magic Link'}
        </button>
      </div>
    </form>
  )
}
