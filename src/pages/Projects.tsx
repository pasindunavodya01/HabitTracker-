import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function Celebration() {
  const [particles, setParticles] = useState<{ id: number, left: string, delay: string, duration: string, emoji: string, size: string }[]>([])
  
  useEffect(() => {
    const emojis = ['🎉', '✨', '🎊', '⭐', '🏆']
    const newParticles = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      delay: `${Math.random() * 0.5}s`,
      duration: `${Math.random() * 2 + 2}s`,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      size: `${Math.random() * 1 + 1}rem`
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <style>{`
        @keyframes celebrate-fall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(0.5); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg) scale(1.2); opacity: 0; }
        }
        .animate-celebrate {
          animation: celebrate-fall linear forwards;
        }
      `}</style>
      {particles.map(p => (
        <div key={p.id} className="absolute top-[-10vh] animate-celebrate" style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration, fontSize: p.size }}>{p.emoji}</div>
      ))}
    </div>
  )
}

type ProjectStep = {
  id: string
  title: string
  is_completed: boolean
}

type Project = {
  id: string
  title: string
  description: string | null
  target_date: string | null
  steps: ProjectStep[]
  is_archived: boolean
}

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [steps, setSteps] = useState<ProjectStep[]>([])
  const [newStep, setNewStep] = useState('')
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const stepInputRef = useRef<HTMLInputElement>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_archived', showArchived)
        .order('created_at', { ascending: false })
      setProjects(data ?? [])
      setLoading(false)
    }
    load()
  }, [user, showArchived])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)

    const projectData = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      target_date: targetDate || null,
      steps,
      is_archived: false,
    }

    if (editingId) {
      const { error, data } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', editingId)
        .select('*')
        .single()
      
      if (!error && data) {
        setProjects(c => c.map(p => p.id === editingId ? data : p))
        cancelEdit()
      }
    } else {
      const { error, data } = await supabase
        .from('projects')
        .insert([projectData])
        .select('*')
        .single()
      
      if (!error && data) {
        setProjects(c => [data, ...c])
        cancelEdit()
      }
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (!error) {
      setProjects(c => c.filter(p => p.id !== id))
      setDeletingId(null)
    }
  }

  const toggleStep = async (projectId: string, stepId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const newSteps = project.steps.map(s => s.id === stepId ? { ...s, is_completed: !s.is_completed } : s)
    setProjects(c => c.map(p => p.id === projectId ? { ...p, steps: newSteps } : p))
    await supabase.from('projects').update({ steps: newSteps }).eq('id', projectId)
  }

  const handleCompletePlan = async (projectId: string) => {
    if (!user) return
    const { error } = await supabase
        .from('projects')
        .update({ is_archived: true })
        .eq('id', projectId)
    
    if (!error) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 4000)
        setProjects(c => c.filter(p => p.id !== projectId))
    }
  }

  const handleRestorePlan = async (projectId: string) => {
    if (!user) return
    const { error } = await supabase
        .from('projects')
        .update({ is_archived: false })
        .eq('id', projectId)
    if (!error) setProjects(c => c.filter(p => p.id !== projectId))
  }

  const handleEdit = (project: Project) => {
    setEditingId(project.id)
    setTitle(project.title)
    setDescription(project.description || '')
    setTargetDate(project.target_date || '')
    setSteps(project.steps || [])
    setNewStep('')
    setDeletingId(null)
    setExpandedId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setTargetDate('')
    setSteps([])
    setNewStep('')
  }

  const addStep = () => {
    if (newStep.trim()) {
      setSteps(s => [...s, { id: crypto.randomUUID(), title: newStep.trim(), is_completed: false }])
      setNewStep('')
      stepInputRef.current?.focus()
    }
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setSteps(s => {
      const newS = [...s]
      if (direction === 'up' && index > 0) {
        const temp = newS[index - 1]
        newS[index - 1] = newS[index]
        newS[index] = temp
      } else if (direction === 'down' && index < newS.length - 1) {
        const temp = newS[index + 1]
        newS[index + 1] = newS[index]
        newS[index] = temp
      }
      return newS
    })
  }

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {showConfetti && <Celebration />}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Plans</h2>
        <p className="mt-1 text-sm text-slate-400">Plan big things by dividing them into smaller, manageable parts.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-800">{showArchived ? 'Archived' : 'Your'} Plans</h3>
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
            <div className="flex justify-center text-slate-400 py-8">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-8 border border-dashed border-slate-200 rounded-xl">No projects added yet.</div>
          ) : (
            <div className="space-y-4">
              {projects.map(project => {
                const totalSteps = project.steps.length
                const completedSteps = project.steps.filter(s => s.is_completed).length
                const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
                const isExpanded = expandedId === project.id
                const isAllDone = totalSteps > 0 && progress === 100

                return (
                  <div key={project.id} className={`rounded-xl border transition-colors overflow-hidden ${isAllDone ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-start">
                      <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                        <div className="flex items-center justify-between">
                          <h4 className={`font-bold text-lg ${isAllDone ? 'text-emerald-800' : 'text-slate-800'}`}>{project.title}</h4>
                          <div className="flex items-center gap-2">
                            {project.target_date && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${isAllDone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                📅 {project.target_date}
                              </span>
                            )}
                            <span className="text-slate-400 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {project.description && (
                          <p className="text-sm text-slate-500 mt-1">{project.description}</p>
                        )}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full transition-all duration-300 ${isAllDone ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-8 text-right ${isAllDone ? 'text-emerald-600' : 'text-slate-500'}`}>{progress}%</span>
                        </div>
                      </div>
                    </div>

                    {isAllDone && !showArchived && (
                      <div className="p-4 pt-0">
                        <button
                            onClick={() => handleCompletePlan(project.id)}
                            className="w-full rounded-xl bg-purple-100 px-4 py-2 text-sm font-bold text-purple-700 hover:bg-purple-200 transition-colors flex items-center gap-2 justify-center"
                        >
                            <span>🏆</span> Complete Plan
                        </button>
                      </div>
                    )}
                    
                    {isExpanded && (
                      <div className="p-4">
                        {project.steps.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center">No parts added to this project.</p>
                        ) : (
                          <div className="space-y-2">
                            {project.steps.map(step => (
                              <label key={step.id} className="flex items-start gap-3 cursor-pointer group bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${step.is_completed ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-100 border-slate-300 group-hover:border-slate-400'}`}>
                                  {step.is_completed && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className={`text-sm select-none flex-1 pt-0.5 ${step.is_completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>{step.title}</span>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={step.is_completed}
                                  onChange={() => toggleStep(project.id, step.id)}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-slate-200/60 flex justify-end">
                          {deletingId === project.id ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleDelete(project.id)} className="text-xs uppercase tracking-wide bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold hover:bg-red-200">Confirm Delete</button>
                              <button onClick={() => setDeletingId(null)} className="text-xs uppercase tracking-wide bg-slate-200 text-slate-600 px-3 py-1.5 rounded font-bold hover:bg-slate-300">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {showArchived ? (
                                <button onClick={() => handleRestorePlan(project.id)} className="text-xs font-semibold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200">Restore</button>
                              ) : (
                                <button onClick={() => handleEdit(project)} className="text-xs font-semibold text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200">Edit</button>
                              )}
                              <button onClick={() => setDeletingId(project.id)} className="text-xs font-semibold text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-red-200">Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm h-fit sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{editingId ? 'Edit Plan' : 'New Plan'}</h3>
            {editingId && (
              <button onClick={cancelEdit} className="text-xs font-semibold text-slate-400 hover:text-slate-600">Cancel</button>
            )}
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Plan Title</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g. Launch New Website" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1" />
            </div>
            
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description <span className="lowercase font-normal text-slate-400">(optional)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this about?" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1 resize-none" rows={2} />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Target Date <span className="lowercase font-normal text-slate-400">(optional)</span></label>
              <div className="flex items-center gap-2">
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-1" />
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

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Plan Parts</label>
              <div className="space-y-2 mb-3">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <span className={`truncate mr-2 ${step.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{step.title}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => moveStep(index, 'up')} disabled={index === 0} className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1 text-xs transition-colors">▲</button>
                      <button type="button" onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1} className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1 text-xs transition-colors">▼</button>
                      <button type="button" onClick={() => setSteps(s => s.filter(x => x.id !== step.id))} className="text-slate-400 hover:text-red-500 p-1 ml-1 transition-colors">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  ref={stepInputRef}
                  value={newStep}
                  onChange={e => setNewStep(e.target.value)}
                  placeholder="Add a step..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
                />
                <button
                  type="button"
                  onClick={addStep}
                  disabled={!newStep.trim()}
                  className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            <button type="submit" disabled={saving || !title.trim()} className="w-full rounded-xl bg-blue-600 mt-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Plan'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}