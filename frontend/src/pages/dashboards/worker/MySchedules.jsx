import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, CheckCircle2, AlertCircle, Calendar, X, Clock, User, FileText, Eye, CalendarClock,
  MapPin, Briefcase, Smartphone, ChevronDown, ClipboardCheck, Hammer, Hourglass,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }
const MIN_SKELETON_MS = 800

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .ss-page, .ss-page h1, .ss-page h2, .ss-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .ss-page :focus-visible { outline: 2px solid #059669; outline-offset: 2px; border-radius: 8px; }
  @keyframes ss-shimmer { 100% { transform: translateX(100%); } }
  .ss-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .ss-skel::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); animation: ss-shimmer 1.2s infinite; }
  @keyframes ss-in     { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes ss-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ss-modal  { from { opacity: 0; transform: translateY(18px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes ss-shake  { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .ss-rise   { animation: ss-in .6s cubic-bezier(.16,1,.3,1) both; }
  .ss-fadein { animation: ss-fadein .3s ease both; }
  .ss-modal  { animation: ss-modal .35s cubic-bezier(.16,1,.3,1) both; }
  .ss-shake  { animation: ss-shake .35s ease; }
  @media (prefers-reduced-motion: reduce) { .ss-skel::after, .ss-rise, .ss-fadein, .ss-modal, .ss-shake { animation: none; } }
`

const Skel = ({ className = '' }) => <div className={`ss-skel ${className}`} />

// ── Helpers ────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
const toDate = s => { if (!s) return null; const d = new Date(String(s).slice(0, 16).replace(' ', 'T')); return isNaN(d) ? null : d }
const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => { if (!s) return '—'; const d = toDate(String(s).length === 10 ? s + ' 00:00' : s); return d ? d.toLocaleDateString('en-PH', opts) : '—' }
const fmtTime = s => { const d = toDate(s); return d ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—' }
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isWeekend = dateStr => { const d = new Date(dateStr + 'T00:00'); return d.getDay() === 0 || d.getDay() === 6 }
const addMinutes = (time, mins) => { const [h, m] = time.split(':').map(Number); const t = h * 60 + m + mins; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}` }

const TYPE_LABEL = { ocular: 'Ocular inspection', progress: 'Progress inspection', other: 'Site visit' }
const typeLabel = t => TYPE_LABEL[t] || 'Site visit'
const OPEN = ['Pending', 'Scheduled', 'In Progress']

function visitPhase(v) {
  if (v.status === 'Cancelled') return 'Cancelled'
  if (v.status === 'Complete') return 'Done'
  const s = toDate(v.start_time), e = toDate(v.end_time), now = new Date()
  if (e && now > e) return 'Past'
  if (s && now >= s) return 'Now'
  return s && s.toDateString() === now.toDateString() ? 'Today' : 'Upcoming'
}
const PHASE = {
  Now:       'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Today:     'bg-amber-50 text-amber-700 ring-amber-200',
  Upcoming:  'bg-cyan-50 text-cyan-700 ring-cyan-200',
  Past:      'bg-slate-50 text-slate-500 ring-slate-200',
  Done:      'bg-blue-50 text-blue-700 ring-blue-200',
  Cancelled: 'bg-red-50 text-red-700 ring-red-200',
}
const PhaseBadge = ({ name }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full ring-1 ring-inset text-xs font-medium whitespace-nowrap ${PHASE[name] || PHASE.Past}`}>{name}</span>
)

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return createPortal(
    <div role="status" className={`ss-fadein fixed bottom-5 right-5 z-[1100] flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg bg-white max-w-sm
      ${ok ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-700'}`}>
      {ok ? <CheckCircle2 size={18} {...ICON} className="text-emerald-600 flex-shrink-0" /> : <AlertCircle size={18} {...ICON} className="text-red-500 flex-shrink-0" />}
      {toast.msg}
    </div>,
    document.body
  )
}

function Modal({ onClose, children, maxW = 'max-w-md' }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="ss-fadein fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[1px]">
      <div role="dialog" aria-modal="true" className={`ss-modal relative w-full ${maxW} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden`}>
        {children}
      </div>
    </div>,
    document.body
  )
}

function ModalHeader({ title, sub, icon: Icon, onClose }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Icon size={20} {...ICON} /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight truncate">{title}</h2>
          {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={18} {...ICON} /></button>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="mt-0.5 w-7 h-7 rounded-lg bg-white ring-1 ring-slate-200 text-emerald-600 flex items-center justify-center flex-shrink-0"><Icon size={14} {...ICON} /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="text-[13px] font-medium text-slate-800 break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

const inputCls = 'w-full h-10 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10'

// ── MY SCHEDULE ────────────────────────────────────────────────
export default function MySchedules() {
  const navigate = useNavigate()
  const [visits,  setVisits]  = useState([])
  const [jobs,    setJobs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState('upcoming')
  const [toast,   setToast]   = useState(null)
  const [open,    setOpen]    = useState(null)   // visit details
  const [moving,  setMoving]  = useState(null)   // visit to reschedule

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3800) }

  const load = () => Promise.all([
    apiGet('/api/schedules/list.php',  { per_page: 200, mine: 1 }).then(d => setVisits(d.schedules || [])),
    apiGet('/api/job-orders/list.php', { per_page: 200, mine: 1 }).then(d => setJobs(d.job_orders || [])),
  ])

  useEffect(() => {
    const t0 = Date.now()
    load().catch(() => showToast('Could not load your schedule.', 'error'))
      .finally(() => setTimeout(() => setLoading(false), Math.max(0, MIN_SKELETON_MS - (Date.now() - t0))))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const now = new Date()
  const todayKey = dayKey(now)
  const shown = useMemo(() => {
    const up = v => OPEN.includes(v.status) && toDate(v.end_time) >= new Date()
    const list = view === 'upcoming' ? visits.filter(up) : visits.filter(v => !up(v))
    return [...list].sort((a, b) => view === 'upcoming' ? String(a.start_time).localeCompare(b.start_time) : String(b.start_time).localeCompare(a.start_time))
  }, [visits, view])

  // Work days come from the job orders assigned to this worker
  const workJobs = jobs
    .filter(j => ['Scheduled', 'In Progress', 'Active'].includes(j.status) && j.start_date && j.end_date && j.end_date.slice(0, 10) >= todayKey)
    .sort((a, b) => String(a.start_date).localeCompare(b.start_date))

  const upcomingCount = visits.filter(v => OPEN.includes(v.status) && toDate(v.end_time) >= now).length

  return (
    <div className="ss-page w-full space-y-6">
      <style>{styles}</style>
      <Toast toast={toast} />

      <div className="ss-rise">
        <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">Schedule</h1>
        <p className="text-sm text-slate-500 mt-1">Your work days and site visits. Site visits are Monday to Friday.</p>
      </div>

      {/* Work days */}
      <section className="ss-rise bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ animationDelay: '80ms' }}>
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Work days</h2>
            <p className="text-xs text-slate-500 mt-0.5">From your job orders. Ask the admin if these dates need to change.</p>
          </div>
          <button onClick={() => navigate('/worker/job-orders')} className="text-[13px] font-medium text-emerald-700 hover:underline underline-offset-2 whitespace-nowrap">My job orders</button>
        </header>
        {loading ? (
          <div className="p-5 space-y-3"><Skel className="h-12 w-full" /><Skel className="h-12 w-2/3" /></div>
        ) : workJobs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No upcoming work days.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {workJobs.map(j => {
              const active = j.start_date.slice(0, 10) <= todayKey
              return (
                <li key={j.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ${active ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-slate-50 text-slate-500 ring-slate-200'}`}><Hammer size={17} {...ICON} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{j.job_order_code} · {j.service || j.description || j.contract_type || 'Job'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtDate(j.start_date.slice(0, 10), { month: 'short', day: 'numeric' })} – {fmtDate(j.end_date.slice(0, 10))} · {j.client_address || '—'}</p>
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-emerald-700' : 'text-slate-500'}`}>{active ? 'Working now' : 'Upcoming'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Site visits */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Site visits</h2>
            <p className="text-xs text-slate-500 mt-0.5">{loading ? 'Loading…' : `${upcomingCount} upcoming`}</p>
          </div>
          <div className="relative">
            <select value={view} onChange={e => setView(e.target.value)}
              className="appearance-none h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 cursor-pointer">
              <option value="upcoming">Upcoming</option>
              <option value="past">Past and cancelled</option>
            </select>
            <ChevronDown size={14} {...ICON} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4"><Skel className="w-16 h-[72px] rounded-xl" /><div className="flex-1 space-y-3"><Skel className="h-4 w-40" /><Skel className="h-12 w-full rounded-xl" /></div></div>)}</div>
        ) : shown.length === 0 ? (
          <div className="ss-fadein bg-white rounded-2xl border border-dashed border-slate-300 py-14 flex flex-col items-center text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center"><Calendar size={24} {...ICON} /></div>
            <p className="mt-4 text-sm font-semibold text-slate-900">{view === 'upcoming' ? 'No upcoming site visits' : 'No past visits'}</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">When the admin plans a visit for you, it shows here and in your Inbox.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shown.map((v, i) => {
              const ph = visitPhase(v)
              const start = toDate(v.start_time)
              const canMove = OPEN.includes(v.status) && start > now && !Number(v.pending_requests)
              return (
                <article key={v.id} style={{ animationDelay: `${i * 80}ms` }}
                  className={`ss-rise bg-white rounded-2xl border border-slate-200 p-5 ${['Past', 'Done', 'Cancelled'].includes(ph) ? 'opacity-80' : ''}`}>
                  <div className="flex gap-4">
                    <div className="hidden sm:flex w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 h-[72px]">
                      <span className="text-[11px] font-medium leading-none">{start ? start.toLocaleDateString('en-PH', { month: 'short' }) : '—'}</span>
                      <span className="text-2xl font-semibold leading-none mt-1 tabular-nums">{start ? start.getDate() : '—'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={`text-[15px] font-semibold text-slate-900 truncate ${ph === 'Cancelled' ? 'line-through text-slate-500' : ''}`}>{typeLabel(v.visit_type)}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{v.job_order_code ? `${v.job_order_code}${v.service ? ` · ${v.service}` : ''}` : v.schedule_code}</p>
                        </div>
                        <PhaseBadge name={ph} />
                      </div>
                      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-3.5 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-3.5">
                        <InfoItem icon={Clock} label="When" value={start ? `${start.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(v.start_time)} – ${fmtTime(v.end_time)}` : '—'} />
                        <InfoItem icon={MapPin} label="Address" value={v.address} />
                      </div>
                      {Number(v.pending_requests) > 0 && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600"><Hourglass size={13} {...ICON} className="text-amber-500" />You asked to move this visit. Waiting for the admin.</p>
                      )}
                      <div className="mt-3.5 flex flex-wrap justify-end gap-2">
                        <button onClick={() => setOpen(v)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                          <Eye size={15} {...ICON} /> Details
                        </button>
                        {canMove && (
                          <button onClick={() => setMoving(v)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                            <CalendarClock size={15} {...ICON} /> Request reschedule
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {open && (
        <Modal onClose={() => setOpen(null)} maxW="max-w-lg">
          <ModalHeader icon={ClipboardCheck} title={typeLabel(open.visit_type)} sub={`${open.schedule_code || ''}${open.job_order_code ? ` · ${open.job_order_code}` : ''}`} onClose={() => setOpen(null)} />
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-4">
              <InfoItem icon={Calendar}   label="Date"   value={fmtDate(open.start_time, { weekday: 'long', month: 'long', day: 'numeric' })} />
              <InfoItem icon={Clock}      label="Time"   value={`${fmtTime(open.start_time)} – ${fmtTime(open.end_time)}`} />
              <InfoItem icon={Briefcase}  label="Job"    value={open.job_order_code ? `${open.job_order_code}${open.service ? ` · ${open.service}` : ''}` : null} />
              <InfoItem icon={User}       label="Client" value={open.client_name} />
              <InfoItem icon={Smartphone} label="Client mobile" value={open.client_mobile} />
              <InfoItem icon={MapPin}     label="Address" value={open.address} />
            </div>
            {open.description && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5"><FileText size={14} {...ICON} className="text-emerald-600" />Notes from the admin</p>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{open.description}</p>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
            <button onClick={() => setOpen(null)} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50">Close</button>
          </div>
        </Modal>
      )}

      {moving && (
        <RescheduleModal visit={moving} onClose={() => setMoving(null)}
          onSent={msg => { setMoving(null); showToast(msg); load().catch(() => {}) }} />
      )}
    </div>
  )
}

// ── Ask to move a site visit ───────────────────────────────────
function RescheduleModal({ visit, onClose, onSent }) {
  const s = toDate(visit.start_time), e = toDate(visit.end_time)
  const length = s && e ? Math.round((e - s) / 60000) : 120
  const [date,   setDate]   = useState('')
  const [time,   setTime]   = useState(s ? `${pad(s.getHours())}:${pad(s.getMinutes())}` : '09:00')
  const [reason, setReason] = useState('')
  const [error,  setError]  = useState(null)
  const [shake,  setShake]  = useState(0)
  const [busy,   setBusy]   = useState(false)
  const todayKey = dayKey(new Date())
  const endTime = addMinutes(time || '09:00', length)

  const fail = msg => { setError(msg); setShake(k => k + 1) }

  const send = async () => {
    if (!date) return fail('Pick a new date.')
    if (isWeekend(date)) return fail('Site visits are Monday to Friday only.')
    if (date < todayKey) return fail('Pick today or a later date.')
    if (!time) return fail('Pick a new start time.')
    if (endTime <= time) return fail('The visit must end on the same day.')
    if (!reason.trim()) return fail('Add a reason so the admin can review the request.')
    setBusy(true); setError(null)
    try {
      const res = await apiPost('/api/schedules/reschedule-request.php', {
        schedule_id: visit.id, new_start_time: `${date} ${time}:00`, new_end_time: `${date} ${endTime}:00`, reason: reason.trim(),
      })
      if (res?.success === false) throw new Error(res.error)
      onSent(res?.message || 'Request sent.')
    } catch (err) { fail(err?.message || 'Could not send the request.') }
    setBusy(false)
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={CalendarClock} title="Request reschedule" sub={`${typeLabel(visit.visit_type)} · ${fmtDate(visit.start_time)} ${fmtTime(visit.start_time)}`} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="rs-date" className="block text-xs font-medium text-slate-600 mb-1.5">New date</label>
            <input id="rs-date" type="date" min={todayKey} className={inputCls} value={date} onChange={ev => setDate(ev.target.value)} />
            {date && isWeekend(date) && <p className="text-xs text-red-600 mt-1.5">Weekends aren't allowed.</p>}
          </div>
          <div>
            <label htmlFor="rs-time" className="block text-xs font-medium text-slate-600 mb-1.5">New start time</label>
            <input id="rs-time" type="time" step={900} className={inputCls} value={time} onChange={ev => setTime(ev.target.value)} />
            <p className="text-xs text-slate-500 mt-1.5">Same length as before. Ends at {fmtTime(`2000-01-01 ${endTime}`)}.</p>
          </div>
        </div>
        <div>
          <label htmlFor="rs-reason" className="block text-xs font-medium text-slate-600 mb-1.5">Reason <span className="text-red-500">*</span></label>
          <textarea id="rs-reason" rows={3} maxLength={1000} placeholder="Tell the admin why you need a different time"
            className={`${inputCls} h-auto py-2.5 resize-none`} value={reason} onChange={ev => setReason(ev.target.value)} />
        </div>
        {error && (
          <p key={shake} className="ss-shake flex items-center gap-1.5 text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} {...ICON} className="flex-shrink-0" /> {error}
          </p>
        )}
      </div>
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex gap-3 justify-end">
        <button onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
        <button onClick={send} disabled={busy} className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-[13px] font-semibold">
          {busy && <RefreshCw size={14} {...ICON} className="animate-spin" />}
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </Modal>
  )
}