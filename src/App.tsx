import React, { useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Today from './pages/Today'
import MyHabits from './pages/MyHabits'
import Progress from './pages/Progress'
import Diary from './pages/Diary'
import Timetable from './pages/Timetable'
import Projects from './pages/Projects'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconToday() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconDiary() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h5" />
    </svg>
  )
}
function IconTimetable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}
function IconHabits() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
function IconProjects() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
function IconProgress() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

// ─── Page Config ──────────────────────────────────────────────────────────────

const pages = [
  { key: 'today',     label: 'Today',     shortLabel: 'Today',    icon: IconToday,     component: <Today /> },
  { key: 'diary',     label: 'Diary',     shortLabel: 'Diary',    icon: IconDiary,     component: <Diary /> },
  { key: 'timetable', label: 'Timetable', shortLabel: 'Schedule', icon: IconTimetable, component: <Timetable /> },
  { key: 'habits',    label: 'My Items',  shortLabel: 'Items',    icon: IconHabits,    component: <MyHabits /> },
  { key: 'projects',  label: 'Plans',     shortLabel: 'Plans',    icon: IconProjects,  component: <Projects /> },
  { key: 'progress',  label: 'Analytics', shortLabel: 'Stats',    icon: IconProgress,  component: <Progress /> },
] as const

type PageKey = (typeof pages)[number]['key']

// ─── Desktop Sidebar Nav ──────────────────────────────────────────────────────

function SidebarNav({ activePage, onNavigate }: { activePage: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-64 min-h-screen bg-[#0f1117] text-white border-r border-white/5 px-4 py-6 sticky top-0">
      {/* Logo */}
      <div className="px-2 mb-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight">LifeOS</span>
            <span className="block text-[10px] text-white/30 font-medium tracking-widest uppercase">by EcoMind</span>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-1">
        {pages.map(({ key, label, icon: Icon }) => {
          const active = activePage === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <span className={`transition-colors ${active ? 'text-emerald-400' : 'text-white/30 group-hover:text-white/60'}`}>
                <Icon />
              </span>
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-white/5 pt-4 mt-4">
        <div className="text-[10px] text-white/20 font-semibold tracking-widest uppercase px-2">Session active</div>
      </div>
    </aside>
  )
}

// ─── Mobile Bottom Tab Bar ────────────────────────────────────────────────────

function BottomTabBar({ activePage, onNavigate }: { activePage: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch">
        {pages.map(({ key, shortLabel, icon: Icon }) => {
          const active = activePage === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                active ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <span className={`transition-transform duration-150 ${active ? 'scale-110' : 'scale-100'}`}>
                <Icon />
              </span>
              <span className={`text-[9px] font-semibold tracking-wide ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
                {shortLabel}
              </span>
              {active && <span className="absolute bottom-0 w-6 h-0.5 rounded-full bg-emerald-500" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ─── Top Header (mobile/tablet) ───────────────────────────────────────────────

function TopHeader({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => void }) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow shadow-emerald-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-800 tracking-tight">LifeOS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 truncate max-w-[140px]">{userEmail}</span>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <IconSignOut />
          </button>
        </div>
      </div>
    </header>
  )
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col lg:flex-row font-sans text-slate-900">
      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-6 py-14 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-16 w-[500px] h-[500px] rounded-full bg-emerald-100/50 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-teal-50/80 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-lg mx-auto lg:mx-0">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold tracking-widest uppercase mb-8 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Your potential, unlocked
          </div>

          <h1 className="text-[2.6rem] sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.1] tracking-tight mb-5">
            Take control.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500">
              Don't break the chain.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-500 mb-10 leading-relaxed">
            <strong className="text-slate-700">LifeOS</strong> uses behavioural psychology to wire your brain for success — habits, goals, and daily rituals in one focused workspace.
          </p>

          <ul className="space-y-4 mb-12">
            {[
              { title: 'End Procrastination', desc: 'Clear workflows eliminate decision fatigue before it starts.' },
              { title: 'Visual Momentum',     desc: 'Leverage the Zeigarnik effect — incomplete streaks demand completion.' },
              { title: 'Compound Mastery',    desc: 'Turn 1 % daily improvements into life-changing results.' },
            ].map(({ title, desc }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">✓</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <span className="w-6 h-px bg-slate-200" />
            LifeOS · <span className="text-emerald-500 ml-1">Eco</span><span className="text-slate-600">Mind</span>
          </p>
        </div>
      </div>

      {/* Auth Panel */}
      <div className="w-full lg:w-[460px] xl:w-[520px] bg-white flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 border-t lg:border-t-0 lg:border-l border-slate-100 shadow-[-8px_0_40px_rgba(0,0,0,0.03)]">
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8">
          <div className="inline-flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow shadow-emerald-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-base font-extrabold tracking-tight text-slate-900">LifeOS</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">by EcoMind</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-slate-800">Start your journey</h2>
            <p className="text-sm text-slate-400 mt-1">Create a free account or sign in to continue.</p>
          </div>

          {/* Auth card */}
          <div className="bg-[#fafaf9] rounded-2xl border border-slate-100 p-6 shadow-sm">
            <Auth />
          </div>

          <p className="text-center text-xs text-slate-300 font-semibold mt-6">
            Trusted by high-performers worldwide
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Authenticated App Shell ──────────────────────────────────────────────────

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<PageKey>('today')

  const pageElement = useMemo(
    () => pages.find((p) => p.key === page)?.component ?? <Today />,
    [page]
  )

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 animate-pulse" />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) return <LandingPage />

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 font-sans flex">
      {/* Desktop sidebar */}
      <SidebarNav activePage={page} onNavigate={setPage} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header */}
        <TopHeader userEmail={user.email ?? ''} onSignOut={handleSignOut} />

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-5 border-b border-slate-200/60 bg-white/60 backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              {pages.find((p) => p.key === page)?.label ?? 'Today'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">A daily growth workflow for habits, routines, and progress</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 border border-slate-200 rounded-full px-3 py-1.5 bg-white truncate max-w-[220px]">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <IconSignOut />
              Sign out
            </button>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 pb-24 lg:pb-8 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            {pageElement}
          </div>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <BottomTabBar activePage={page} onNavigate={setPage} />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}