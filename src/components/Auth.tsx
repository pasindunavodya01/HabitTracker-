import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

type AuthMode = 'login' | 'register' | 'forgot'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then((result) => {
      if (!mounted) return
      setSession(result.data?.session ?? null)
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

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)
    setStatusMessage(null)

    const emailTrimmed = email.trim().toLowerCase()
    if (!emailTrimmed) {
      setErrorMessage('Please enter a valid email address.')
      setLoading(false)
      return
    }

    if (!isForgot && !password) {
      setErrorMessage('Please enter a password.')
      setLoading(false)
      return
    }

    if (isRegister) {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.')
        setLoading(false)
        return
      }
    }

    try {
      if (isForgot) {
        const resetResult = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
          redirectTo: window.location.origin,
        })

        if (resetResult.error) {
          throw resetResult.error
        }

        setStatusMessage('Password reset email sent. Check your inbox to continue.')
        setMode('login')
      } else {
        const authResult = isRegister
          ? await supabase.auth.signUp({ email: emailTrimmed, password })
          : await supabase.auth.signInWithPassword({ email: emailTrimmed, password })

        if (authResult.error) {
          throw authResult.error
        }

        if (!authResult.data?.session) {
          setStatusMessage(isRegister ? 'Check your email to confirm your new account.' : 'Signed in successfully.')
        }
      }

      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setErrorMessage(err.message ?? 'Unable to complete the request. Please try again.')
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
      <div className="space-y-4">
        <div className="text-sm">Signed in as <strong>{session.user.email}</strong></div>
        <div className="mt-2 flex gap-2">
          <button onClick={handleSignOut} className="px-3 py-1 bg-red-500 text-white rounded">Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 rounded px-4 py-2 text-sm font-semibold ${!isRegister && !isForgot ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 rounded px-4 py-2 text-sm font-semibold ${isRegister ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Register
        </button>
        <button
          type="button"
          onClick={() => setMode('forgot')}
          className={`flex-1 rounded px-4 py-2 text-sm font-semibold ${isForgot ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          Forgot Password
        </button>
      </div>

      <div>
        <label className="block text-sm text-gray-700">Email</label>
        <input
          className="mt-1 w-full border px-2 py-1 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          required
        />
      </div>

      {!isForgot && (
        <div>
          <label className="block text-sm text-gray-700">Password</label>
          <input
            className="mt-1 w-full border px-2 py-1 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            type="password"
            required={!isForgot}
          />
        </div>
      )}

      {isRegister && (
        <div>
          <label className="block text-sm text-gray-700">Confirm Password</label>
          <input
            className="mt-1 w-full border px-2 py-1 rounded"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            type="password"
            required
          />
        </div>
      )}

      {errorMessage ? <div className="rounded bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div> : null}
      {statusMessage ? <div className="rounded bg-green-50 p-3 text-sm text-green-700">{statusMessage}</div> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
          {loading ? 'Submitting…' : isForgot ? 'Send reset email' : isRegister ? 'Register' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
