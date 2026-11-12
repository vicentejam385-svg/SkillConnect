import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus, X, CheckCircle2, AlertCircle, Search, FileSignature, Wrench, Tags, Loader2, Lock,
  Users, HardHat, UserCog, Briefcase, CalendarClock, Inbox, Hash, ChevronDown, Check,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3, .sc-page h4 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #eef2f5; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  @keyframes sc-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes sc-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-pop  { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-rise .4s cubic-bezier(.2,.7,.2,1) both; }
  .sc-fade { animation: sc-fade .2s ease both; }
  .sc-pop  { animation: sc-pop .25s cubic-bezier(.2,.7,.2,1) both; }
  @media (prefers-reduced-motion: reduce) { .sc-skel::after, .sc-rise, .sc-fade, .sc-pop { animation: none; } }
`

// ── Shared bits (same as the other pages) ──────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="sc-pop fixed top-6 right-6 z-[80] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700 max-w-sm">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 size={16} {...ICON} /> : <AlertCircle size={16} {...ICON} />}
      </span>
      {toast.msg}
    </div>
  )
}

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center px-6">
      <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center"><Icon size={22} {...ICON} /></div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-[300px]">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}


// ── Status data (unchanged) ────────────────────────────────────
const STATUSES = [
  { id: 1,  entity: 'contact',   label: 'Active'       },
  { id: 2,  entity: 'contact',   label: 'Inactive'     },
  { id: 3,  entity: 'contact',   label: 'Blacklisted'  },
  { id: 10, entity: 'contact',   label: 'Pending'      },
  { id: 11, entity: 'contact',   label: 'Under Review' },
  { id: 4,  entity: 'worker',    label: 'Active'       },
  { id: 5,  entity: 'worker',    label: 'Inactive'     },
  { id: 6,  entity: 'worker',    label: 'On Leave'     },
  { id: 7,  entity: 'user',      label: 'Active'       },
  { id: 8,  entity: 'user',      label: 'Inactive'     },
  { id: 9,  entity: 'user',      label: 'Suspended'    },
  { id: 28, entity: 'job_order', label: 'Pending'      },
  { id: 29, entity: 'job_order', label: 'Active'       },
  { id: 30, entity: 'job_order', label: 'Complete'     },
  { id: 31, entity: 'job_order', label: 'On Hold'      },
  { id: 32, entity: 'job_order', label: 'Under Review' },
  { id: 33, entity: 'job_order', label: 'Scheduled'    },
  { id: 34, entity: 'job_order', label: 'In Progress'  },
  { id: 35, entity: 'job_order', label: 'Cancelled'    },
  { id: 36, entity: 'schedule',  label: 'Pending'      },
  { id: 37, entity: 'schedule',  label: 'Scheduled'    },
  { id: 38, entity: 'schedule',  label: 'In Progress'  },
  { id: 39, entity: 'schedule',  label: 'Complete'     },
  { id: 40, entity: 'schedule',  label: 'Cancelled'    },
  { id: 41, entity: 'inquiry',   label: 'New'          },
  { id: 42, entity: 'inquiry',   label: 'Won'          },
  { id: 43, entity: 'inquiry',   label: 'Lost'         },
]

const ENTITIES = [
  { key: 'contact',   label: 'Contacts',   icon: Users,         text: 'Clients and organisations' },
  { key: 'worker',    label: 'Workers',    icon: HardHat,       text: 'Your workforce' },
  { key: 'user',      label: 'Users',      icon: UserCog,       text: 'People who sign in' },
  { key: 'job_order', label: 'Job orders', icon: Briefcase,     text: 'From review to completion' },
  { key: 'schedule',  label: 'Schedules',  icon: CalendarClock, text: 'Site visits' },
  { key: 'inquiry',   label: 'Inquiries',  icon: Inbox,         text: 'Incoming project requests' },
]

const toneFor = label =>
  ['Active', 'Complete', 'Won'].includes(label)                              ? ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500']
  : ['Scheduled'].includes(label)                                            ? ['bg-cyan-50 text-cyan-700 ring-cyan-200', 'bg-cyan-500']
  : ['Blacklisted', 'Suspended', 'Cancelled', 'Lost'].includes(label)        ? ['bg-red-50 text-red-700 ring-red-200', 'bg-red-500']
  : ['Pending'].includes(label)                                              ? ['bg-yellow-50 text-yellow-800 ring-yellow-200', 'bg-yellow-500']
  : ['New'].includes(label)                                                  ? ['bg-sky-50 text-sky-700 ring-sky-200', 'bg-sky-500']
  : ['Under Review'].includes(label)                                         ? ['bg-violet-50 text-violet-700 ring-violet-200', 'bg-violet-500']
  : ['In Progress'].includes(label)                                          ? ['bg-amber-50 text-amber-700 ring-amber-200', 'bg-amber-500']
  : ['On Hold', 'On Leave'].includes(label)                                  ? ['bg-orange-50 text-orange-700 ring-orange-200', 'bg-orange-500']
  : ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']

// ── Sections ───────────────────────────────────────────────────
const SECTIONS = [
  { key: 'org_types',       label: 'Contract types',  icon: FileSignature, title: 'Contract types',  text: 'How long a job order runs. Used to work out end dates and visit counts.', single: 'contract type',  placeholder: 'Heavy equipment', endpoint: '/api/config/org-types.php' },
  { key: 'specializations', label: 'Specializations', icon: Wrench,        title: 'Specializations', text: 'Trades your workers are skilled in. Used to match workers to job orders.',     single: 'specialization', placeholder: 'Electrician',     endpoint: '/api/config/specializations.php' },
  { key: 'statuses',        label: 'Statuses',        icon: Tags,          title: 'Statuses',        text: 'Stages each record can be in. These are built into the system.' },
]

// ── Add modal ──────────────────────────────────────────────────
function AddModal({ section, existing, saving, onClose, onSave }) {
  const [name, setName] = useState('')
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const trimmed = name.trim()
  const duplicate = trimmed && existing.some(i => (i.name || '').trim().toLowerCase() === trimmed.toLowerCase())
  const submit = () => { if (trimmed && !duplicate && !saving) onSave(trimmed) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><section.icon size={20} {...ICON} /></span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Add {section.single}</h3>
              <p className="text-sm text-slate-500 mt-0.5">It’ll be available everywhere right away.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>
        <div className="px-6 py-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Name<span className="text-red-500 ml-0.5">*</span></label>
          <input
            className={`w-full h-10 px-3 text-sm rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 transition-colors ${
              duplicate ? 'border border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20'}`}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder={section.placeholder}
            autoFocus
          />
          {duplicate
            ? <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle size={12} {...ICON} />“{trimmed}” already exists.</p>
            : <p className="text-xs text-slate-500 mt-1.5">Press Enter to add.</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={submit} disabled={!trimmed || duplicate || saving} className={btnPrimary}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} {...ICON} />}
            {saving ? 'Adding…' : `Add ${section.single}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section dropdown ───────────────────────────────────────────
function SectionDropdown({ sections, value, onChange, counts, loading }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = sections.find(s => s.key === value)

  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  const countOf = key => (loading && key !== 'statuses' ? '·' : counts[key])

  return (
    <div className="relative w-full sm:w-72" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-11 pl-2 pr-3 flex items-center gap-3 rounded-lg border bg-white shadow-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
          ${open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <current.icon size={15} {...ICON} />
        </span>
        <span className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">{current.label}</span>
        <span className="text-xs tabular-nums px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{countOf(current.key)}</span>
        <ChevronDown size={16} {...ICON} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul role="listbox" aria-label="Configuration sections"
          className="sc-pop absolute right-0 left-0 sm:left-auto sm:w-80 top-full mt-2 z-30 bg-white rounded-xl border border-slate-200 shadow-xl ring-1 ring-slate-900/5 p-1.5">
          {sections.map(s => {
            const on = s.key === value
            return (
              <li key={s.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { onChange(s.key); setOpen(false) }}
                  className={`w-full flex items-start gap-3 px-2.5 py-2.5 rounded-lg text-left transition-colors ${on ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? 'bg-white text-emerald-600 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'}`}>
                    <s.icon size={15} {...ICON} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${on ? 'text-emerald-800' : 'text-slate-900'}`}>{s.label}</span>
                      <span className="text-xs tabular-nums text-slate-400">{countOf(s.key)}</span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{s.text}</span>
                  </span>
                  {on && <Check size={16} strokeWidth={2.25} className="text-emerald-600 mt-1.5 flex-shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Config Page ────────────────────────────────────────────────
export default function ConfigPage() {
  const [activeTab,       setActiveTab]       = useState('org_types')
  const [orgTypes,        setOrgTypes]        = useState([])
  const [specializations, setSpecializations] = useState([])
  const [workers,         setWorkers]         = useState([])
  const [jobOrders,       setJobOrders]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [toast,           setToast]           = useState(null)
  const [showModal,       setShowModal]       = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [query,           setQuery]           = useState('')

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sData, oData, wData, joData] = await Promise.all([
        apiGet('/api/config/specializations.php'),
        apiGet('/api/config/org-types.php'),
        apiGet('/api/workers/list.php', { per_page: 500 }).catch(() => ({})),
        apiGet('/api/job-orders/list.php', { per_page: 500 }).catch(() => ({})),
      ])
      setSpecializations(sData.data || sData.specializations || [])
      setOrgTypes(oData.data || oData.org_types || [])
      setWorkers(wData.workers || [])
      setJobOrders(joData.job_orders || [])
    } catch { showToast('Failed to load configuration.', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setQuery('') }, [activeTab])

  const section = SECTIONS.find(s => s.key === activeTab)
  const items = activeTab === 'org_types' ? orgTypes : activeTab === 'specializations' ? specializations : []

  // How many records use each entry (helps admins see what matters)
  const usage = useMemo(() => {
    const m = {}
    if (activeTab === 'specializations') workers.forEach(w => { if (w.specialization) m[w.specialization] = (m[w.specialization] || 0) + 1 })
    if (activeTab === 'org_types') jobOrders.forEach(j => { if (j.contract_type) m[j.contract_type] = (m[j.contract_type] || 0) + 1 })
    return m
  }, [activeTab, workers, jobOrders])
  const maxUse = Math.max(1, ...Object.values(usage))
  const usageNoun = activeTab === 'specializations' ? 'worker' : 'job order'

  const visible = items.filter(i => !query.trim() || (i.name || '').toLowerCase().includes(query.trim().toLowerCase()))

  const handleAdd = async (name) => {
    setSaving(true)
    try {
      const data = await apiPost(section.endpoint, { name })
      if (!data.success) throw new Error(data.error)
      showToast(`${section.single[0].toUpperCase() + section.single.slice(1)} added`)
      setShowModal(false)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to add.', 'error')
    }
    setSaving(false)
  }

  const closeModal = useCallback(() => { if (!saving) setShowModal(false) }, [saving])
  const counts = { org_types: orgTypes.length, specializations: specializations.length, statuses: STATUSES.length }

  return (
    <div className="sc-page max-w-6xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">The lists your team picks from across SkillConnect.</p>
        </div>
        <SectionDropdown sections={SECTIONS} value={activeTab} onChange={setActiveTab} counts={counts} loading={loading} />
      </div>

      <div>
        {/* Content */}
        <section key={activeTab} className="sc-rise bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <header className="px-5 sm:px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <span className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><section.icon size={18} {...ICON} /></span>
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900">{section.title}</h2>
                <p className="text-sm text-slate-500 mt-0.5 max-w-md">{section.text}</p>
              </div>
            </div>
            {activeTab !== 'statuses' && (
              <button onClick={() => setShowModal(true)} className={`${btnPrimary} self-start flex-shrink-0`}><Plus size={16} {...ICON} /> Add {section.single}</button>
            )}
          </header>

          {activeTab !== 'statuses' ? (
            <>
              {/* Toolbar */}
              <div className="px-5 sm:px-6 py-3 flex items-center justify-between gap-3 border-b border-slate-100">
                <div className="relative flex-1 max-w-xs">
                  <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder={`Search ${section.label.toLowerCase()}`} value={query} onChange={e => setQuery(e.target.value)} />
                  {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
                </div>
                {!loading && <span className="text-sm text-slate-500 tabular-nums">{visible.length} of {items.length}</span>}
              </div>

              {loading ? (
                <div className="divide-y divide-slate-100">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-6 py-3.5 flex items-center gap-3"><Skel className="w-8 h-8 rounded-lg" /><Skel className="h-3 w-40" /><Skel className="h-2 w-32 ml-auto rounded-full" /></div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyState icon={section.icon} title={`Add your first ${section.single}`} text={section.text}
                  action={<button onClick={() => setShowModal(true)} className={btnPrimary}><Plus size={16} {...ICON} /> Add {section.single}</button>} />
              ) : visible.length === 0 ? (
                <EmptyState icon={Search} title="Nothing matches" text={`No ${section.label.toLowerCase()} match “${query}”.`}
                  action={<button onClick={() => setQuery('')} className={btnSecondary}>Clear search</button>} />
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_200px_72px] gap-4 px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 text-xs font-medium text-slate-500">
                    <span>Name</span><span>Used by</span><span className="text-right">ID</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {visible.map((item, i) => {
                      const n = usage[item.name] || 0
                      return (
                        <li key={item.id} className="sc-rise grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_200px_72px] items-center gap-4 px-5 sm:px-6 py-3 hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-slate-500 flex items-center justify-center flex-shrink-0"><section.icon size={15} {...ICON} /></span>
                            <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
                          </div>
                          <div className="hidden sm:flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(n / maxUse) * 100}%` }} />
                            </div>
                            <span className={`text-xs tabular-nums whitespace-nowrap w-20 ${n ? 'text-slate-700' : 'text-slate-400'}`}>{n ? `${n} ${usageNoun}${n === 1 ? '' : 's'}` : 'Not used'}</span>
                          </div>
                          <span className="inline-flex items-center justify-end gap-0.5 text-xs text-slate-400 tabular-nums"><Hash size={11} {...ICON} />{item.id}</span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </>
          ) : (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600">
                <Lock size={16} {...ICON} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p>Statuses drive how records move through SkillConnect, so they can’t be edited here.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ENTITIES.map((e, idx) => {
                  const list = STATUSES.filter(s => s.entity === e.key)
                  return (
                    <div key={e.key} className="sc-rise rounded-xl border border-slate-200 overflow-hidden" style={{ animationDelay: `${idx * 40}ms` }}>
                      <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 bg-slate-50/60">
                        <span className="w-8 h-8 rounded-lg bg-white ring-1 ring-slate-200 text-slate-500 flex items-center justify-center"><e.icon size={15} {...ICON} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{e.label}</p>
                          <p className="text-xs text-slate-500">{e.text}</p>
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">{list.length}</span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {list.map(s => {
                          const [cls, dot] = toneFor(s.label)
                          return (
                            <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium ${cls}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{s.label}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-xs text-slate-400 tabular-nums"><Hash size={11} {...ICON} />{s.id}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {showModal && section && activeTab !== 'statuses' && (
        <AddModal section={section} existing={items} saving={saving} onClose={closeModal} onSave={handleAdd} />
      )}
    </div>
  )
}