import { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Calendar, X, ChevronLeft, ChevronRight,
  Clock, User, FileText, Eye, CalendarClock, Timer,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }
const API  = 'https://saddlebrown-swan-877763.hostingersite.com/backend/api'
const SCH_PER_PAGE = 3
const MIN_SKELETON_MS = 800

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .ss-page, .ss-page h1, .ss-page h2, .ss-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .ss-page :focus-visible { outline: 2px solid #059669; outline-offset: 2px; border-radius: 8px; }

  @keyframes ss-shimmer { 100% { transform: translateX(100%); } }
  .ss-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .ss-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
    animation: ss-shimmer 1.2s infinite;
  }
  @keyframes ss-in     { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes ss-slide  { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  @keyframes ss-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ss-modal  { from { opacity: 0; transform: translateY(18px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes ss-pulse  { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.5); } 70%,100% { box-shadow: 0 0 0 7px rgba(16,185,129,0); } }
  @keyframes ss-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes ss-shake  { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  @keyframes ss-toast-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .ss-rise   { animation: ss-in .7s cubic-bezier(.16,1,.3,1) both; }
  .ss-slide  { animation: ss-slide .55s cubic-bezier(.16,1,.3,1) both; }
  .ss-fadein { animation: ss-fadein .35s ease both; }
  .ss-modal  { animation: ss-modal .4s cubic-bezier(.16,1,.3,1) both; }
  .ss-float  { animation: ss-float 3.6s ease-in-out infinite; }
  .ss-shake  { animation: ss-shake .35s ease; }
  .ss-dot-live { animation: ss-pulse 1.8s infinite; }
  .ss-toast-bar { transform-origin: left; animation: ss-toast-bar 3.5s linear forwards; }

  .ss-card { position: relative; transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .35s; }
  .ss-card::before {
    content: ''; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 0 3px 3px 0;
    background: var(--rail, #cbd5e1); transform: scaleY(.4); opacity: .6;
    transition: transform .45s cubic-bezier(.16,1,.3,1), opacity .3s;
  }
  .ss-card:hover { transform: translateY(-3px); border-color: #cbd5e1; box-shadow: 0 18px 32px -18px rgba(16,24,40,.28); }
  .ss-card:hover::before { transform: scaleY(1); opacity: 1; }

  @media (prefers-reduced-motion: reduce) {
    .ss-skel::after, .ss-rise, .ss-slide, .ss-fadein, .ss-modal, .ss-float, .ss-shake, .ss-dot-live, .ss-toast-bar { animation: none; }
    .ss-card, .ss-card::before { transition: none; }
  }
`

const Skel = ({ className = '' }) => <div className={`ss-skel ${className}`} />

// ── Helpers ────────────────────────────────────────────────────
const toDate = s => {
  if (!s) return null
  const d = new Date(String(s).slice(0, 16).replace(' ', 'T'))
  return isNaN(d) ? null : d
}
const fmtDateTime = s => {
  const d = toDate(s)
  return d ? d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
}
const fmtTime = s => {
  const d = toDate(s)
  return d ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—'
}
const duration = (a, b) => {
  const s = toDate(a), e = toDate(b)
  if (!s || !e || e <= s) return null
  const mins = Math.round((e - s) / 60000)
  const h = Math.floor(mins / 60), m = mins % 60
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} day${d > 1 ? 's' : ''}` }
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ') || null
}

// Upcoming / Today / In progress / Past, derived from times
function phase(sc) {
  const s = toDate(sc.start_time), e = toDate(sc.end_time), now = new Date()
  if (!s) return 'Scheduled'
  if (e && now > e) return 'Past'
  if (now >= s) return 'In progress'
  return s.toDateString() === now.toDateString() ? 'Today' : 'Upcoming'
}
const PHASE = {
  'In progress': ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500', '#10b981', true],
  'Today':       ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500',   '#f59e0b', false],
  'Upcoming':    ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500',    '#06b6d4', false],
  'Scheduled':   ['bg-slate-50 text-slate-600 ring-slate-200',       'bg-slate-400',   '#94a3b8', false],
  'Past':        ['bg-slate-50 text-slate-500 ring-slate-200',       'bg-slate-300',   '#cbd5e1', false],
}

function PhaseBadge({ name }) {
  const [cls, dot, , live] = PHASE[name] || PHASE.Scheduled
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${live ? 'ss-dot-live' : ''}`} />{name}
    </span>
  )
}

// ── Small UI pieces ────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div role="status" className={`ss-slide fixed bottom-5 right-5 z-[60] overflow-hidden flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_16px_40px_-10px_rgba(16,24,40,0.3)] bg-white
      ${ok ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-700'}`}>
      {ok ? <CheckCircle2 size={18} {...ICON} className="text-emerald-600" /> : <AlertCircle size={18} {...ICON} className="text-red-500" />}
      {toast.msg}
      <span className={`ss-toast-bar absolute left-0 bottom-0 h-0.5 w-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
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

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words">{value || '—'}</p>
    </div>
  )
}

function Modal({ onBackdrop, maxW = 'max-w-md', children }) {
  return (
    <div className="ss-fadein fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onMouseDown={e => { if (onBackdrop && e.target === e.currentTarget) onBackdrop() }}>
      <div role="dialog" aria-modal="true"
        className={`ss-modal relative w-full ${maxW} max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-[0_32px_80px_-20px_rgba(16,24,40,0.45)] overflow-hidden`}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, sub, mono, icon: Icon, onClose, badge }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-emerald-50/80 via-white to-white">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(5,150,105,.7)]"><Icon size={20} {...ICON} /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight truncate">{title}</h2>
          <p className={`text-xs text-slate-500 mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {badge}
        <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:rotate-90 active:scale-90 transition duration-300">
          <X size={18} {...ICON} />
        </button>
      </div>
    </div>
  )
}

const inputCls = 'w-full h-10 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10'

function SchedulesSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4">
          <Skel className="w-16 h-[72px] rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="flex justify-between"><Skel className="h-4 w-40" /><Skel className="h-6 w-20 rounded-full" /></div>
            <Skel className="h-3 w-3/4" />
            <Skel className="h-14 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MY SCHEDULES ───────────────────────────────────────────────
export default function MySchedules() {
  const { user } = useAuth()
  const [toast,            setToast]            = useState(null)
  const [schedules,        setSchedules]        = useState([])
  const [loading,          setLoading]          = useState(true)
  const [viewSchedule,     setViewSchedule]     = useState(null)
  const [rescheduleJob,    setRescheduleJob]    = useState(null)
  const [rescheduleForm,   setRescheduleForm]   = useState({ start_time: '', end_time: '', reason: '' })
  const [rescheduleSaving, setRescheduleSaving] = useState(false)
  const [formError,        setFormError]        = useState(null)
  const [shakeKey,         setShakeKey]         = useState(0)
  const [schPage,          setSchPage]          = useState(1)

  useEffect(() => {
    const t0 = Date.now()
    apiGet('/api/workers/list.php')
      .then(wData => {
        const worker = (wData.workers || []).find(w => w.id === user?.id)
        if (!worker) return setSchedules([])
        return apiGet('/api/schedules/list.php', { per_page: 100 }).then(d => {
          const mine = (d.schedules || []).filter(sc => sc.worker_contact_code === worker.contact_code)
          setSchedules(mine)
        })
      })
      .catch(() => {})
      .finally(() => setTimeout(() => setLoading(false), Math.max(0, MIN_SKELETON_MS - (Date.now() - t0))))
  }, [])

  // Esc closes modals · toast auto-hides
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { setViewSchedule(null); setRescheduleJob(null); setFormError(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  const openReschedule = sc => {
    setFormError(null)
    setRescheduleJob(sc)
    setRescheduleForm({
      start_time: sc.start_time?.slice(0, 16).replace(' ', 'T') || '',
      end_time:   sc.end_time?.slice(0, 16).replace(' ', 'T')   || '',
      reason: '',
    })
  }
  const closeReschedule = () => { setRescheduleJob(null); setFormError(null) }
  const fail = msg => { setFormError(msg); setShakeKey(k => k + 1) }

  const sendReschedule = async () => {
    if (!rescheduleForm.start_time)     return fail('Set a new start time.')
    if (!rescheduleForm.end_time)       return fail('Set a new end time.')
    if (rescheduleForm.end_time <= rescheduleForm.start_time) return fail('The end time must be after the start time.')
    if (!rescheduleForm.reason.trim())  return fail('Add a reason so your supervisor can review the request.')
    setFormError(null)
    setRescheduleSaving(true)
    try {
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res = await fetch(`${API}/schedules/reschedule-request.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          schedule_id: rescheduleJob.id,
          schedule_code: rescheduleJob.schedule_code,
          new_start_time: rescheduleForm.start_time,
          new_end_time: rescheduleForm.end_time,
          reason: rescheduleForm.reason,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Request failed')
      setRescheduleJob(null)
      setToast({ msg: 'Reschedule request sent', type: 'success' })
    } catch (err) {
      setToast({ msg: 'Could not send request: ' + err.message, type: 'error' })
    }
    setRescheduleSaving(false)
  }

  const totalSchPages = Math.ceil(schedules.length / SCH_PER_PAGE)
  const pagedSch = schedules.slice((schPage - 1) * SCH_PER_PAGE, schPage * SCH_PER_PAGE)
  const upcomingCount = schedules.filter(s => ['Upcoming', 'Today', 'In progress'].includes(phase(s))).length

  return (
    <div className="ss-page w-full space-y-6">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="ss-rise">
        <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">Schedule</h1>
        <p className="text-sm text-slate-500 mt-1">
          {loading || schedules.length === 0
            ? 'Your upcoming assignments'
            : `${upcomingCount} upcoming of ${schedules.length} assignment${schedules.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? <SchedulesSkeleton /> : schedules.length === 0 ? (
        <div className="ss-fadein bg-white rounded-2xl border border-dashed border-slate-300 py-16 flex flex-col items-center text-center px-6">
          <div className="ss-float w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center"><Calendar size={24} {...ICON} /></div>
          <p className="mt-4 text-sm font-semibold text-slate-900">No schedules assigned yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">When an assignment is scheduled for you, its date and time will show up here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedSch.map((sc, i) => {
            const ph = phase(sc)
            const start = toDate(sc.start_time)
            const dur = duration(sc.start_time, sc.end_time)
            return (
              <article key={`${schPage}-${sc.id}`} style={{ animationDelay: `${i * 120}ms`, '--rail': PHASE[ph][2] }}
                className={`ss-rise ss-card bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${ph === 'Past' ? 'opacity-80' : ''}`}>
                <div className="flex gap-4">
                  {/* Date block */}
                  <div className="hidden sm:flex w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 py-2.5 h-[72px]">
                    <span className="text-[11px] font-medium leading-none">{start ? start.toLocaleDateString('en-PH', { month: 'short' }) : '—'}</span>
                    <span className="text-2xl font-semibold leading-none mt-1 tabular-nums">{start ? start.getDate() : '—'}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-mono text-[15px] font-semibold text-slate-900 truncate">{sc.schedule_code}</h3>
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{sc.description || 'No description'}</p>
                      </div>
                      <PhaseBadge name={ph} />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-3.5">
                      <InfoItem icon={Clock}  label="Start" value={fmtDateTime(sc.start_time)} />
                      <InfoItem icon={Clock}  label="End"   value={fmtDateTime(sc.end_time)} />
                      <InfoItem icon={User}   label="Client" value={sc.client_name} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        {dur && <><Timer size={13} {...ICON} /> {fmtTime(sc.start_time)} – {fmtTime(sc.end_time)} · {dur}</>}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setViewSchedule(sc)}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[.97] transition-all">
                          <Eye size={15} {...ICON} /> View details
                        </button>
                        <button onClick={() => openReschedule(sc)} disabled={ph === 'Past'}
                          className="group inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium shadow-[0_6px_14px_-6px_rgba(245,158,11,.8)] active:scale-[.97] transition-all">
                          <CalendarClock size={15} {...ICON} className="group-hover:rotate-12 transition-transform" /> Reschedule
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}

          {/* Pagination */}
          {totalSchPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500">
                Showing {(schPage - 1) * SCH_PER_PAGE + 1}–{Math.min(schPage * SCH_PER_PAGE, schedules.length)} of {schedules.length} schedules
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setSchPage(p => Math.max(1, p - 1))} disabled={schPage === 1} aria-label="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition">
                  <ChevronLeft size={15} {...ICON} />
                </button>
                {Array.from({ length: totalSchPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setSchPage(p)} aria-current={schPage === p ? 'page' : undefined}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-[13px] font-medium tabular-nums transition-all active:scale-90
                      ${schPage === p ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setSchPage(p => Math.min(totalSchPages, p + 1))} disabled={schPage === totalSchPages} aria-label="Next page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition">
                  <ChevronRight size={15} {...ICON} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reschedule Modal ── */}
      {rescheduleJob && (
        <Modal>
          <ModalHeader icon={CalendarClock} title="Request reschedule" sub={rescheduleJob.schedule_code} mono onClose={closeReschedule} />
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-3.5 text-xs text-slate-500">
              Current slot: <span className="font-medium text-slate-700">{fmtDateTime(rescheduleJob.start_time)}</span> to <span className="font-medium text-slate-700">{fmtDateTime(rescheduleJob.end_time)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rs-start" className="block text-xs font-medium text-slate-600 mb-1.5">New start time</label>
                <input id="rs-start" type="datetime-local" className={inputCls}
                  value={rescheduleForm.start_time}
                  onChange={e => setRescheduleForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="rs-end" className="block text-xs font-medium text-slate-600 mb-1.5">New end time</label>
                <input id="rs-end" type="datetime-local" className={inputCls}
                  value={rescheduleForm.end_time}
                  onChange={e => setRescheduleForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label htmlFor="rs-reason" className="block text-xs font-medium text-slate-600 mb-1.5">Reason <span className="text-red-500">*</span></label>
              <textarea id="rs-reason" rows={3} placeholder="Tell us why you need a different time"
                className={`${inputCls} h-auto py-2.5 resize-none`}
                value={rescheduleForm.reason}
                onChange={e => setRescheduleForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
            {formError && (
              <p key={shakeKey} className="ss-shake flex items-center gap-1.5 text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={13} {...ICON} className="flex-shrink-0" /> {formError}
              </p>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex gap-3 justify-end">
            <button onClick={closeReschedule} disabled={rescheduleSaving}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-[.97] transition-all">
              Cancel
            </button>
            <button onClick={sendReschedule} disabled={rescheduleSaving}
              className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-70 text-white text-[13px] font-semibold shadow-[0_6px_14px_-6px_rgba(245,158,11,.8)] active:scale-[.97] transition-all">
              {rescheduleSaving && <RefreshCw size={14} {...ICON} className="animate-spin" />}
              {rescheduleSaving ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── View Schedule Modal ── */}
      {viewSchedule && (
        <Modal maxW="max-w-xl" onBackdrop={() => setViewSchedule(null)}>
          <ModalHeader icon={Calendar} title={viewSchedule.schedule_code} sub={viewSchedule.description || 'No description'}
            mono onClose={() => setViewSchedule(null)} badge={<PhaseBadge name={phase(viewSchedule)} />} />
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-4">
              <Field label="Client"     value={viewSchedule.client_name} />
              <Field label="Duration"   value={duration(viewSchedule.start_time, viewSchedule.end_time)} />
              <Field label="Start time" value={fmtDateTime(viewSchedule.start_time)} />
              <Field label="End time"   value={fmtDateTime(viewSchedule.end_time)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5"><FileText size={14} {...ICON} className="text-emerald-600" /> Description</p>
              <p className="text-sm text-slate-600 leading-relaxed">{viewSchedule.description || '—'}</p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
            <button onClick={() => setViewSchedule(null)} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 active:scale-[.97] transition-all">Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}