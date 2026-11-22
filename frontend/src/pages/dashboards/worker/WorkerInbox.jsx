import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Inbox, Briefcase, CheckCircle2, AlertCircle, ChevronDown, ChevronLeft, CalendarDays, MapPin,
  FileText, Hammer, User, Smartphone, Hourglass, XCircle, CheckCheck, Loader2, RefreshCw, ClipboardList, Bell,
  CalendarClock, Clock,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }
const POLL_MS = 60000

const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .sc-page :focus-visible { outline: 2px solid #059669; outline-offset: 2px; border-radius: 8px; }
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .sc-skel::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); animation: sc-shimmer 1.2s infinite; }
  @keyframes sc-in   { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes sc-pop  { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-in .55s cubic-bezier(.16,1,.3,1) both; }
  .sc-pop  { animation: sc-pop .25s cubic-bezier(.16,1,.3,1) both; }
  @media (prefers-reduced-motion: reduce) { .sc-rise, .sc-pop, .sc-skel::after { animation: none; } }
`

// Server times are Asia/Manila
const parseServerTime = s => (s ? new Date(String(s).replace(' ', 'T') + '+08:00') : null)
const parseDay = s => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00'); return isNaN(d) ? null : d }
const fmtDay = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => { const d = parseDay(s); return d ? d.toLocaleDateString(undefined, opts) : '—' }

function timeAgo(s) {
  const d = parseServerTime(s)
  if (!d) return ''
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function hoursLeft(s) {
  const d = parseServerTime(s)
  if (!d) return null
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 3600000))
}

// Live state of a message, as shown to the worker
const STATE = {
  open:       { label: 'Open',            cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  accepted:   { label: 'Accepted',        cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  assigned:   { label: 'Assigned to you', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  declined:   { label: 'Not interested',  cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  taken:      { label: 'Taken',           cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  expired:    { label: 'Ended',           cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  withdrawn:  { label: 'No longer available', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  reassigned: { label: 'Reassigned',      cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  info:       { label: 'Update',          cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  visit:      { label: 'Site visit',      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  visit_done: { label: 'Visit done',      cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
}
const VISIT_TYPES = { ocular: 'Ocular inspection', progress: 'Progress inspection', other: 'Site visit' }
const isVisitMsg = m => m.type === 'site_visit' || m.type === 'visit_update'
const fmtSlot = v => {
  const s = parseServerTime(v?.start_time), e = parseServerTime(v?.end_time)
  if (!s) return null
  return `${s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}${e ? ` – ${e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}`
}

function StateChip({ msg }) {
  const s = STATE[msg.state] || STATE.withdrawn
  const left = msg.state === 'open' ? hoursLeft(msg.expires_at) : null
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${s.cls}`}>
      {msg.state === 'open' && <Hourglass size={11} {...ICON} />}
      {s.label}{left !== null ? ` · ${left <= 1 ? 'under 1h' : `${left}h`} left` : ''}
    </span>
  )
}

const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="sc-pop fixed top-6 right-6 z-[1000] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700 max-w-sm">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 size={16} {...ICON} /> : <AlertCircle size={16} {...ICON} />}
      </span>
      {toast.msg}
    </div>
  )
}

const btnPrimary   = 'inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors disabled:opacity-60'

const FILTERS = [
  { v: 'all',      l: 'All messages' },
  { v: 'unread',   l: 'Unread' },
  { v: 'offers',   l: 'Job offers' },
  { v: 'assigned', l: 'Assignments' },
  { v: 'visits',   l: 'Site visits' },
  { v: 'updates',  l: 'Updates' },
]

export default function WorkerInbox() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState('all')
  const [selId,    setSelId]    = useState(null)
  const [busy,     setBusy]     = useState('')        // 'accept' | 'decline' | 'all'
  const [confirm,  setConfirm]  = useState(false)
  const [toast,    setToast]    = useState(null)
  const toastTimer = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }
  const notifyBadge = () => window.dispatchEvent(new Event('sc-inbox-changed'))

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await apiGet('/api/inbox/list.php')
      if (res?.success === false) throw new Error(res.error)
      setMessages(res?.messages || [])
      setError('')
    } catch (e) {
      if (!quiet) setError(e?.message || 'Could not load your inbox.')
    }
    if (!quiet) setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), POLL_MS)
    return () => { clearInterval(id); clearTimeout(toastTimer.current) }
  }, [load])

  const visible = useMemo(() => messages.filter(m =>
    filter === 'unread'   ? !m.read_at :
    filter === 'offers'   ? m.type === 'job_offer' :
    filter === 'assigned' ? m.type === 'job_assigned' :
    filter === 'visits'   ? isVisitMsg(m) :
    filter === 'updates'  ? m.type === 'job_update' : true
  ), [messages, filter])

  const unread = messages.filter(m => !m.read_at).length
  const selected = messages.find(m => m.id === selId) || null

  const markRead = async (msg) => {
    if (!msg || msg.read_at) return
    const now = new Date().toISOString()
    setMessages(list => list.map(m => (m.id === msg.id ? { ...m, read_at: now } : m)))
    try { await apiPost('/api/inbox/read.php', { id: msg.id }); notifyBadge() } catch { /* keep going */ }
  }

  const open = (msg) => { setSelId(msg.id); setConfirm(false); markRead(msg) }

  const markAllRead = async () => {
    setBusy('all')
    try {
      await apiPost('/api/inbox/read.php', { all: true })
      const now = new Date().toISOString()
      setMessages(list => list.map(m => (m.read_at ? m : { ...m, read_at: now })))
      notifyBadge()
    } catch { showToast('Could not mark messages as read.', 'error') }
    setBusy('')
  }

  const respond = async (action) => {
    if (!selected) return
    setBusy(action)
    try {
      const res = await apiPost('/api/inbox/respond.php', { id: selected.id, action })
      if (res?.success === false) throw new Error(res.error)
      showToast(res?.message || (action === 'accept' ? 'The job is yours.' : 'Got it.'))
    } catch (e) {
      showToast(e?.message || 'Something went wrong. Please try again.', 'error')
    }
    setBusy(''); setConfirm(false)
    await load(true)
    notifyBadge()
  }

  return (
    <div className="sc-page w-full space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="sc-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">Job offers, assignments, site visits and updates from the admin.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select value={filter} onChange={e => setFilter(e.target.value)}
              className="w-full sm:w-44 h-10 pl-3 pr-9 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20">
              {FILTERS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <button onClick={markAllRead} disabled={!unread || busy === 'all'} className={btnSecondary}>
            {busy === 'all' ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} {...ICON} />}
            <span className="hidden sm:inline">Mark all as read</span>
            <span className="sm:hidden">Read all</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-start gap-3 p-4">
              <Skel className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-2"><Skel className="h-4 w-2/3" /><Skel className="h-3 w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-14 flex flex-col items-center text-center px-6">
          <AlertCircle size={22} {...ICON} className="text-red-500" />
          <p className="mt-3 text-sm font-medium text-slate-900">{error}</p>
          <button onClick={() => load()} className={`${btnSecondary} mt-4`}><RefreshCw size={15} {...ICON} />Try again</button>
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 flex flex-col items-center text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center"><Inbox size={24} {...ICON} /></div>
          <p className="mt-4 text-sm font-semibold text-slate-900">Your inbox is empty</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">When a job matches your specialization, it will show up here. You'll also get an email.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-4 items-start">
          {/* List */}
          <section className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${selected ? 'hidden lg:block' : ''}`}>
            {visible.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No messages in this view.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((m, i) => {
                  const isOffer = m.type === 'job_offer'
                  const Icon = isOffer ? Briefcase : m.type === 'job_assigned' ? CheckCircle2 : isVisitMsg(m) ? CalendarClock : Bell
                  const on = m.id === selId
                  return (
                    <li key={m.id}>
                      <button onClick={() => open(m)}
                        className={`sc-rise w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors ${on ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                        style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                        <span className={`relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ${isOffer ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                          <Icon size={17} {...ICON} />
                          {!m.read_at && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-label="Unread" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-start justify-between gap-2">
                            <span className={`text-sm truncate ${m.read_at ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{m.title}</span>
                            <span className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">{timeAgo(m.created_at)}</span>
                          </span>
                          {m.body && <span className="block text-xs text-slate-500 truncate mt-0.5">{m.body}</span>}
                          <span className="block mt-1.5"><StateChip msg={m} /></span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Detail */}
          <section className={`bg-white rounded-2xl border border-slate-200 ${selected ? '' : 'hidden lg:flex'} lg:min-h-[320px]`}>
            {!selected ? (
              <div className="w-full flex flex-col items-center justify-center text-center px-6 py-16">
                <Inbox size={22} {...ICON} className="text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">Select a message to see the details.</p>
              </div>
            ) : (
              <Detail
                key={selected.id}
                msg={selected}
                busy={busy}
                confirm={confirm}
                setConfirm={setConfirm}
                onBack={() => setSelId(null)}
                onAccept={() => respond('accept')}
                onDecline={() => respond('decline')}
                onOpenJobs={() => navigate('/worker/job-orders')}
                onOpenSchedule={() => navigate('/worker/schedules')}
              />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Detail({ msg, busy, confirm, setConfirm, onBack, onAccept, onDecline, onOpenJobs, onOpenSchedule }) {
  const job = msg.job || {}
  const isOffer = msg.type === 'job_offer'
  const left = msg.state === 'open' ? hoursLeft(msg.expires_at) : null

  const visit = msg.visit
  const rows = visit ? [
    { icon: CalendarClock, label: 'Visit',   value: VISIT_TYPES[visit.type] || 'Site visit' },
    { icon: Clock,         label: 'When',    value: fmtSlot(visit) },
    { icon: MapPin,        label: visit.is_mine ? 'Address' : 'Area', value: visit.is_mine ? (job.address || job.area) : job.area },
    { icon: Hammer,        label: 'Job',     value: job.code ? `${job.code}${job.service ? ` · ${job.service}` : ''}` : null },
    { icon: Briefcase,     label: 'Visit status', value: visit.status === 'Scheduled' ? 'Planned' : visit.status },
  ].filter(r => r.value) : [
    { icon: Hammer,       label: 'Service',  value: job.service },
    { icon: FileText,     label: 'Contract', value: job.contract_type },
    { icon: CalendarDays, label: 'Dates',    value: job.start_date && job.end_date ? `${fmtDay(job.start_date, { month: 'short', day: 'numeric' })} – ${fmtDay(job.end_date)}` : null },
    { icon: MapPin,       label: job.is_mine ? 'Address' : 'Area', value: job.is_mine ? (job.address || job.area) : job.area },
    ...(job.is_mine ? [
      { icon: User,       label: 'Client', value: job.client_name },
      { icon: Smartphone, label: 'Mobile', value: job.client_mobile },
    ] : []),
  ].filter(r => r.value)

  const note = {
    open:       `The first worker to accept gets this job.${left !== null ? ` This offer is open for ${left <= 1 ? 'less than an hour' : `${left} more hours`}.` : ''} The full address and client details are shown once the job is yours.`,
    accepted:   'You accepted this job. It is now in My Job Orders.',
    assigned:   'The admin assigned this job to you. It is now in My Job Orders.',
    declined:   'You said you are not interested in this job.',
    taken:      'Another worker accepted this job first.',
    expired:    'This offer has ended. The admin will choose a worker.',
    withdrawn:  'This job is no longer available.',
    reassigned: msg.type === 'site_visit' ? 'This visit was given to another worker. You no longer need to go.' : 'This job is now assigned to another worker.',
    visit:      'Please be on time. If you can\'t make it, ask to move the visit from your Schedule page.',
    visit_done: 'This visit is marked as done.',
  }[msg.state]

  return (
    <div className="sc-pop w-full flex flex-col">
      <div className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
        <button onClick={onBack} aria-label="Back to inbox" className="lg:hidden -ml-1 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
          <ChevronLeft size={18} {...ICON} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{isOffer ? 'Job offer' : msg.type === 'job_assigned' ? 'Assignment' : msg.type === 'site_visit' ? 'Site visit' : 'Update'} · {timeAgo(msg.created_at)}{job.code ? ` · ${job.code}` : ''}</p>
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mt-0.5">{msg.title}</h2>
          <div className="mt-2"><StateChip msg={msg} /></div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5 flex-1">
        {rows.length > 0 && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden text-sm">
            {rows.map(({ icon: Icon, label, value }, i) => (
              <div key={label} className={`bg-slate-50/80 px-3.5 py-2.5 min-w-0 ${i === rows.length - 1 && rows.length % 2 ? 'sm:col-span-2' : ''}`}>
                <dt className="text-xs text-slate-500 flex items-center gap-1.5"><Icon size={12} {...ICON} />{label}</dt>
                <dd className="text-slate-900 mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {(msg.state === 'info' || isVisitMsg(msg)) && msg.body && (
          <p className="text-sm text-slate-700 leading-relaxed rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3.5 py-3 whitespace-pre-line">{msg.body}</p>
        )}
        {note && <p className="text-sm text-slate-600 leading-relaxed">{note}</p>}
      </div>

      {(msg.state === 'open' || job.is_mine || visit?.is_mine) && (
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          {msg.state === 'open' ? (
            confirm ? (
              <div className="sc-pop flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="text-sm text-slate-700 flex-1">Accept this job? It will be assigned to you right away.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirm(false)} disabled={!!busy} className={`${btnSecondary} flex-1 sm:flex-none`}>Cancel</button>
                  <button onClick={onAccept} disabled={!!busy} className={`${btnPrimary} flex-1 sm:flex-none`}>
                    {busy === 'accept' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} {...ICON} />}
                    Yes, accept
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button onClick={onDecline} disabled={!!busy} className={btnSecondary}>
                  {busy === 'decline' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} {...ICON} />}
                  Not interested
                </button>
                <button onClick={() => setConfirm(true)} disabled={!!busy} className={btnPrimary}>
                  <CheckCircle2 size={16} {...ICON} />Accept job
                </button>
              </div>
            )
          ) : (
            <div className="flex justify-end">
              {visit?.is_mine
                ? <button onClick={onOpenSchedule} className={btnSecondary}><CalendarClock size={16} {...ICON} />Open my schedule</button>
                : <button onClick={onOpenJobs} className={btnSecondary}><ClipboardList size={16} {...ICON} />Open My Job Orders</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}