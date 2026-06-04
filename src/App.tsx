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

const pages = [
  { key: 'today', label: 'Today', component: <Today /> },
   { key: 'diary', label: 'Diary', component: <Diary /> },
  { key: 'timetable', label: 'Timetable', component: <Timetable /> },
  { key: 'habits', label: 'My Items', component: <MyHabits /> },
  { key: 'projects', label: 'Plans', component: <Projects /> },
  { key: 'progress', label: 'Analytics', component: <Progress /> },
] as const

type PageKey = (typeof pages)[number]['key']

function Nav({ activePage, onNavigate }: { activePage: PageKey; onNavigate: (page: PageKey) => void }) {
  return (
    <nav className="bg-gray-100 border-b">
      <div className="max-w-5xl mx-auto flex overflow-x-auto px-4 py-3 gap-2 sm:gap-3 hide-scrollbar">
        {pages.map((page) => (
          <button
            key={page.key}
            onClick={() => onNavigate(page.key)}
            className={`shrink-0 whitespace-nowrap rounded px-3 py-2 text-sm font-medium transition-colors ${activePage === page.key ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-600 hover:text-slate-900 hover:bg-gray-200'}`}
          >
            {page.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState<PageKey>('today')

  const pageElement = useMemo(() => pages.find((item) => item.key === page)?.component ?? <Today />, [page])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Loading session…</div>
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-slate-900">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">LifeOS</h1>
            <p className="mt-2 text-gray-600">A simple daily growth workflow for habits, routines, and progress.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <Auth />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Nav activePage={page} onNavigate={setPage} />
      <main className="max-w-5xl mx-auto p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">LifeOS</h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">A simple daily growth workflow for habits, routines, and progress.</p>
          </div>
          <div className="w-full md:w-auto">
            <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3">
              <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm text-slate-600 truncate flex-1 md:flex-initial justify-center md:justify-start max-w-[200px] md:max-w-xs" title={user.email}>{user.email}</div>
              <button
                onClick={handleSignOut}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors flex-shrink-0"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8">{pageElement}</div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
