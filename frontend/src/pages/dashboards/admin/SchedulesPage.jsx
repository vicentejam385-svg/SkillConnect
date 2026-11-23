import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  CalendarDays, CalendarClock, Plus, Search, CheckCircle2, AlertCircle, X, ChevronLeft, ChevronRight,
  ChevronDown, Clock, HardHat, User, Briefcase, Loader2, RotateCcw, Info, MapPin, Pencil, Ban,
  ClipboardCheck, Eye, Smartphone, FileText, CalendarX2, Hourglass, History,
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'
import { createPortal } from 'react-dom'

const ICON = { strokeWidth: 1.75 }

// ── Local styles ───────────────────────────────────────────────
const styles = `
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

// ── useNavigate (admin wrapper) ────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

function useEscapeAndLock(onClose, active = true) {
  useEffect(() => {
    if (!active) return
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, active])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
}

// ── Date helpers ───────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
const parseDT = str => { if (!str) return null; const d = new Date(String(str).replace(' ', 'T')); return isNaN(d) ? null : d }
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const fmtTime = d => d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'
const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => d ? d.toLocaleDateString(undefined, opts) : '—'
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const isWeekend = dateStr => { const d = new Date(dateStr + 'T00:00'); return d.getDay() === 0 || d.getDay() === 6 }
const addMinutes = (time, mins) => {
  const [h, m] = time.split(':').map(Number)
  const t = h * 60 + m + mins
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const TYPES = {
  ocular:   { label: 'Ocular inspection',   short: 'Ocular',   hint: 'Check the site before the work starts.', cls: 'bg-violet-50 text-violet-700 ring-violet-200', chip: 'bg-violet-50 text-violet-800 border-violet-400' },
  progress: { label: 'Progress inspection', short: 'Progress', hint: 'Check the work while the job is running.',                     cls: 'bg-sky-50 text-sky-700 ring-sky-200',          chip: 'bg-sky-50 text-sky-800 border-sky-400' },
  other:    { label: 'Other visit',         short: 'Visit',    hint: 'Any other reason to go to the site.',                          cls: 'bg-slate-100 text-slate-600 ring-slate-200',   chip: 'bg-slate-50 text-slate-700 border-slate-400' },
}
const typeOf = t => TYPES[t] || { label: 'Site visit', short: 'Visit', cls: 'bg-slate-100 text-slate-600 ring-slate-200', chip: 'bg-slate-50 text-slate-700 border-slate-400' }
const LENGTHS = [
  { v: 60, l: '1 hour' }, { v: 120, l: '2 hours' }, { v: 180, l: '3 hours' }, { v: 240, l: '4 hours' }, { v: 480, l: 'Whole day (8 hours)' },
]
// Job orders that can have a site visit
const VISIT_JOB_STATUSES = ['Under Review', 'Scheduled', 'In Progress', 'Active']
const OPEN = ['Pending', 'Scheduled', 'In Progress']

// ── Shared bits ────────────────────────────────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100', 'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100', 'bg-amber-50 text-amber-700 ring-amber-100', 'bg-rose-50 text-rose-700 ring-rose-100',
]
function Avatar({ name, size = 'w-7 h-7', text = 'text-[10px]' }) {
  const ini = name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'
  return <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[(name || '').charCodeAt(0) % AVATAR_TONES.length || 0]}`}>{ini}</div>
}

const STATUS = {
  'Pending':     ['bg-yellow-50 text-yellow-800 ring-yellow-200', 'bg-yellow-500'],
  'Scheduled':   ['bg-cyan-50 text-cyan-700 ring-cyan-200',       'bg-cyan-500'],
  'In Progress': ['bg-amber-50 text-amber-700 ring-amber-200',    'bg-amber-500'],
  'Complete':    ['bg-blue-50 text-blue-700 ring-blue-200',       'bg-blue-500'],
  'Cancelled':   ['bg-red-50 text-red-700 ring-red-200',          'bg-red-500'],
}
function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status === 'Scheduled' ? 'Planned' : status || '—'}
    </span>
  )
}
// Visits whose date is still being agreed between the customer and the worker
const WAITING = {
  customer: ['Waiting for customer', 'bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400'],
  worker:   ['Waiting for worker',   'bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400'],
  admin:    ['Pick the date',        'bg-amber-50 text-amber-700 ring-amber-200', 'bg-amber-500'],
}
function VisitBadge({ visit }) {
  const w = visit.waiting_for && WAITING[visit.waiting_for]
  if (!w) return <StatusBadge status={visit.status} />
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${w[1]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${w[2]}`} />{w[0]}
    </span>
  )
}
const WHO = { system: 'SkillConnect', customer: 'Customer', worker: 'Worker', admin: 'Admin' }
const ACTION = { propose: 'proposed', accept: 'accepted', counter: 'suggested', escalate: 'asked the admin to decide', final: 'set the final date' }

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center px-6">
      <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center"><Icon size={22} {...ICON} /></div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-[280px]">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
const inputCls = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors disabled:bg-slate-50 disabled:text-slate-400'
const selectCls = `${inputCls} appearance-none pr-9 cursor-pointer`
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'
const Chev = () => <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return createPortal(
    <div className="sc-pop fixed top-6 right-6 z-[1100] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700 max-w-sm">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 size={16} {...ICON} /> : <AlertCircle size={16} {...ICON} />}
      </span>
      {toast.msg}
    </div>,
    document.body
  )
}

function Modal({ onClose, width = 'max-w-lg', children }) {
  useEscapeAndLock(onClose)
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" />
      <div role="dialog" aria-modal="true" className={`sc-pop relative w-full ${width} bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] flex flex-col overflow-hidden`}>
        {children}
      </div>
    </div>,
    document.body
  )
}

function ModalHeader({ icon: Icon, title, subtitle, onClose, badge }) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
      <div className="flex items-start gap-4 min-w-0">
        <span className="w-11 h-11 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 bg-emerald-50 ring-emerald-100 text-emerald-600"><Icon size={20} {...ICON} /></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><h3 className="text-lg font-semibold text-slate-900">{title}</h3>{badge}</div>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
    </div>
  )
}

const errText = e => e?.message || 'Something went wrong. Please try again.'

// ── Site visits page ───────────────────────────────────────────
export default function SchedulesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const planFor  = location.state?.planVisitFor || null

  const [visits,     setVisits]     = useState([])
  const [jobOrders,  setJobOrders]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)
  const [calMonth,   setCalMonth]   = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(null)
  const [listView,   setListView]   = useState('upcoming')
  const [search,     setSearch]     = useState('')
  const [viewId,     setViewId]     = useState(null)
  const [form,       setForm]       = useState(null)   // { visit? , jobId? }

  const today = useMemo(() => new Date(), [])
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3800) }

  const load = useCallback(async () => {
    try {
      const [sData, jData] = await Promise.all([
        apiGet('/api/schedules/list.php',  { per_page: 500 }),
        apiGet('/api/job-orders/list.php', { per_page: 500 }),
      ])
      setVisits((sData.schedules || []).map(v => ({ ...v, _start: parseDT(v.start_time), _end: parseDT(v.end_time) })))
      setJobOrders(jData.job_orders || [])
    } catch { showToast('Failed to load site visits.', 'error') }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Opened from a job order ("Plan site visit")
  useEffect(() => {
    if (!planFor) return
    setForm({ jobId: String(planFor) })
    navigate('/admin/scheduling', { replace: true, state: {} })
  }, [planFor]) // eslint-disable-line react-hooks/exhaustive-deps

  const visitJobs = useMemo(() => jobOrders.filter(jo => VISIT_JOB_STATUSES.includes(jo.status)), [jobOrders])
  const viewVisit = visits.find(v => v.id === viewId) || null

  // Calendar
  const year = calMonth.getFullYear(), month = calMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const eventsByDay = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      if (!v._start || v._start.getFullYear() !== year || v._start.getMonth() !== month) return
      ;(map[v._start.getDate()] ||= []).push(v)
    })
    Object.values(map).forEach(list => list.sort((a, b) => a._start - b._start))
    return map
  }, [visits, year, month])

  // Agenda / list
  const q = search.trim().toLowerCase()
  const listed = useMemo(() => {
    const now = new Date()
    let list = visits
    if (selectedDay) list = list.filter(v => sameDay(v._start, selectedDay))
    else if (listView === 'upcoming') list = list.filter(v => OPEN.includes(v.status) && v._end && v._end >= now)
    else if (listView === 'past') list = list.filter(v => v.status === 'Complete' || (v._end && v._end < now && v.status !== 'Cancelled'))
    else if (listView === 'cancelled') list = list.filter(v => v.status === 'Cancelled')
    if (q) list = list.filter(v => [v.schedule_code, v.job_order_code, v.worker_name, v.client_name, v.address, v.service, v.description]
      .some(x => String(x || '').toLowerCase().includes(q)))
    const asc = selectedDay || listView === 'upcoming'
    return [...list].sort((a, b) => asc ? a._start - b._start : b._start - a._start)
  }, [visits, selectedDay, listView, q])

  const pendingRequests = visits.filter(v => Number(v.pending_requests) > 0).length
  const toPick = visits.filter(v => v.waiting_for === 'admin')

  const changeStatus = async (visit, status_id, msg) => {
    try {
      const res = await apiPut('/api/schedules/update.php', { id: visit.id, status_id })
      if (res?.success === false) throw new Error(res.error)
      showToast(msg); load()
      return true
    } catch (e) { showToast(errText(e), 'error'); return false }
  }

  return (
    <div className="max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Site visits</h1>
          <p className="text-sm text-slate-500 mt-1">Monday to Friday. When a worker takes a job, the ocular visit date is sent to the customer and the worker to agree on.</p>
        </div>
        <button onClick={() => setForm({})} className={`${btnPrimary} self-start sm:self-auto`}><Plus size={16} {...ICON} /> Plan site visit</button>
      </div>

      {pendingRequests > 0 && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700">
          <CalendarClock size={16} {...ICON} className="text-slate-400 flex-shrink-0" />
          <p className="flex-1">{pendingRequests} visit{pendingRequests > 1 ? 's have' : ' has'} a reschedule request from the worker. Answer it on the dashboard.</p>
          <button onClick={() => navigate('/admin/dashboard')} className="text-sm font-medium text-emerald-700 hover:underline underline-offset-2 whitespace-nowrap">Open dashboard</button>
        </div>
      )}

      {toPick.length > 0 && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700">
          <Hourglass size={16} {...ICON} className="text-amber-500 flex-shrink-0" />
          <p className="flex-1">The customer and the worker couldn't agree on {toPick.length === 1 ? 'a visit date' : `${toPick.length} visit dates`}. Please pick the date.</p>
          <button onClick={() => setViewId(toPick[0].id)} className="text-sm font-medium text-emerald-700 hover:underline underline-offset-2 whitespace-nowrap">Pick date</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        {/* Calendar */}
        <section className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 tabular-nums">{MONTH_NAMES[month]} {year}</h2>
              <button onClick={() => { setCalMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(today) }}
                className="h-8 px-3 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">Today</button>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
              <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} aria-label="Previous month" className="w-9 h-8 inline-flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} {...ICON} /></button>
              <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} aria-label="Next month" className="w-9 h-8 inline-flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronRight size={16} {...ICON} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-y border-slate-100 bg-slate-50/80">
            {WEEKDAYS.map((d, i) => <div key={d} className={`py-2 text-center text-xs font-medium ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-600'}`}>{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-100">
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDay + 1
              if (day < 1 || day > daysInMonth) return <div key={i} className="bg-slate-50/70 h-14 sm:h-24" />
              const date = new Date(year, month, day)
              const weekend = date.getDay() === 0 || date.getDay() === 6
              const isToday = sameDay(date, today)
              const isSel = sameDay(date, selectedDay)
              const events = eventsByDay[day] || []
              return (
                <button key={i} onClick={() => setSelectedDay(isSel ? null : date)} aria-pressed={isSel}
                  aria-label={`${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${events.length} visit${events.length !== 1 ? 's' : ''}`}
                  className={`relative text-left h-14 sm:h-24 p-1.5 sm:p-2 flex flex-col transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500
                    ${isSel ? 'bg-emerald-50/70 ring-2 ring-inset ring-emerald-500' : weekend ? 'bg-slate-50/60' : 'bg-white hover:bg-slate-50'}`}>
                  <span className={`w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded-full text-xs sm:text-sm tabular-nums
                    ${isToday ? 'bg-emerald-600 text-white font-semibold' : weekend ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>{day}</span>
                  <span className="hidden sm:flex flex-col gap-0.5 mt-1 min-w-0">
                    {events.slice(0, 2).map(ev => (
                      <span key={ev.id} className={`block truncate text-[11px] leading-4 px-1.5 py-px rounded border-l-2 ${typeOf(ev.visit_type).chip} ${ev.status === 'Cancelled' ? 'line-through opacity-60' : ''} ${ev.waiting_for ? 'border-dashed opacity-70' : ''}`}>
                        <span className="font-medium">{fmtTime(ev._start).replace(':00', '')}</span> {ev.worker_name?.split(' ')[0] || 'Visit'}
                      </span>
                    ))}
                    {events.length > 2 && <span className="text-[11px] text-slate-500 px-1.5">+{events.length - 2} more</span>}
                  </span>
                  {events.length > 0 && (
                    <span className="sm:hidden flex gap-0.5 mt-auto justify-center">
                      {events.slice(0, 3).map(ev => <span key={ev.id} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-400" />Ocular</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />Progress</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />Other</span>
            <span className="ml-auto hidden sm:inline">Weekends are greyed out. Select a day to see its visits.</span>
          </div>
        </section>

        {/* Agenda */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col xl:max-h-[720px]">
          <header className="px-5 pt-5 pb-3 border-b border-slate-100 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {selectedDay ? fmtDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' }) : { upcoming: 'Upcoming visits', past: 'Past visits', cancelled: 'Cancelled visits', all: 'All visits' }[listView]}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{listed.length} visit{listed.length !== 1 ? 's' : ''}</p>
              </div>
              {selectedDay
                ? <button onClick={() => setSelectedDay(null)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">Show list</button>
                : (
                  <div className="relative">
                    <select value={listView} onChange={e => setListView(e.target.value)}
                      className="appearance-none h-8 pl-2.5 pr-8 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 cursor-pointer">
                      <option value="upcoming">Upcoming</option><option value="past">Past</option>
                      <option value="cancelled">Cancelled</option><option value="all">All</option>
                    </select>
                    <ChevronDown size={14} {...ICON} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                )}
            </div>
            <div className="relative">
              <Search size={15} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job order, worker or client"
                className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scroll">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[0, 1, 2, 3].map(i => <div key={i} className="px-5 py-4 flex gap-4"><Skel className="w-12 h-12 rounded-lg" /><div className="flex-1 space-y-2"><Skel className="h-3 w-3/4" /><Skel className="h-2.5 w-1/2" /></div></div>)}
              </div>
            ) : listed.length === 0 ? (
              <EmptyState icon={CalendarDays}
                title={selectedDay ? 'No visits on this day' : 'No visits here'}
                text={selectedDay && (selectedDay.getDay() === 0 || selectedDay.getDay() === 6) ? 'Site visits are Monday to Friday only.' : 'Plan a site visit from here or from a job order.'}
                action={<button onClick={() => setForm({})} className={btnSecondary}><Plus size={16} {...ICON} /> Plan site visit</button>} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {listed.map((v, i) => (
                  <li key={v.id}>
                    <button onClick={() => setViewId(v.id)} className="sc-rise w-full text-left px-5 py-4 flex gap-4 hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                      <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center flex-shrink-0 ${sameDay(v._start, today) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                        <span className="text-[10px] font-semibold text-emerald-600 leading-none">{v._start ? MONTH_NAMES[v._start.getMonth()].slice(0, 3) : '—'}</span>
                        <span className="text-base font-semibold text-slate-900 leading-tight tabular-nums">{v._start?.getDate() ?? ''}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium text-slate-900 line-clamp-1 ${v.status === 'Cancelled' ? 'line-through text-slate-500' : ''}`}>
                            {typeOf(v.visit_type).label}{v.service ? ` · ${v.service}` : ''}
                          </p>
                          <VisitBadge visit={v} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <Clock size={12} {...ICON} />{fmtTime(v._start)} – {fmtTime(v._end)}
                          {v.job_order_code && <span className="text-emerald-700 font-medium">· {v.job_order_code}</span>}
                          {Number(v.pending_requests) > 0 && <span className="text-amber-700">· reschedule asked</span>}
                          {v.answer_late && <span className="text-amber-700">· no answer for 2+ days</span>}
                        </p>
                        <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5 min-w-0">
                          <Avatar name={v.worker_name} size="w-5 h-5" text="text-[9px]" />
                          <span className="truncate">{v.worker_name || 'No worker'}</span>
                          {v.client_name && <span className="text-slate-400 truncate">· {v.client_name}</span>}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {viewVisit && (
        <VisitDetails visit={viewVisit} onClose={() => setViewId(null)}
          onEdit={() => { setViewId(null); setForm({ visit: viewVisit }) }}
          onStatus={changeStatus} onOpenJob={() => navigate('/admin/job-orders')}
          onFinal={msg => { setViewId(null); showToast(msg); load() }} onError={msg => showToast(msg, 'error')} />
      )}

      {form && (
        <VisitForm initial={form} jobs={visitJobs} onClose={() => setForm(null)}
          onSaved={msg => { setForm(null); showToast(msg); load() }} onError={msg => showToast(msg, 'error')} />
      )}
    </div>
  )
}

// ── Visit details ──────────────────────────────────────────────
function VisitDetails({ visit, onClose, onEdit, onStatus, onOpenJob, onFinal, onError }) {
  const [confirm, setConfirm] = useState(null) // 'cancel' | 'complete' | 'final'
  const [busy, setBusy] = useState(false)
  const [finalDate, setFinalDate] = useState(visit._start ? dayKey(visit._start) : '')
  const agreeing = !!visit.waiting_for

  const setFinal = async () => {
    if (!finalDate) return onError('Pick the date.')
    if (isWeekend(finalDate)) return onError('Site visits are Monday to Friday only.')
    setBusy(true)
    try {
      const res = await apiPost('/api/schedules/propose.php', { schedule_id: visit.id, action: 'final', date: finalDate })
      if (res?.success === false) throw new Error(res.error)
      onFinal('Date set. The worker and the customer have been told.')
    } catch (e) { onError(errText(e)) }
    setBusy(false)
  }
  const open = OPEN.includes(visit.status)
  const legacy = !visit.job_order_id

  const run = async (status_id, msg) => {
    setBusy(true)
    const ok = await onStatus(visit, status_id, msg)
    setBusy(false)
    if (ok) onClose()
  }

  const rows = [
    { icon: CalendarDays, label: 'Date', value: fmtDate(visit._start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) },
    { icon: Clock,        label: 'Time', value: `${fmtTime(visit._start)} – ${fmtTime(visit._end)}${visit._end && !sameDay(visit._start, visit._end) ? ` (${fmtDate(visit._end)})` : ''}` },
    { icon: Briefcase,    label: 'Job order', value: visit.job_order_code ? `${visit.job_order_code}${visit.service ? ` · ${visit.service}` : ''}${visit.job_status ? ` · ${visit.job_status}` : ''}` : null },
    { icon: HardHat,      label: 'Worker', value: visit.worker_name || null },
    { icon: User,         label: 'Client', value: visit.client_name || null },
    { icon: Smartphone,   label: 'Client mobile', value: visit.client_mobile || null },
    { icon: MapPin,       label: 'Address', value: visit.address || null },
    { icon: FileText,     label: 'Notes', value: visit.description || null },
  ].filter(r => r.value)

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={ClipboardCheck} title={typeOf(visit.visit_type).label} subtitle={visit.schedule_code} onClose={onClose} badge={<VisitBadge visit={visit} />} />
      <div className="px-6 py-5 overflow-y-auto flex-1 custom-scroll space-y-4">
        {legacy && (
          <p className="flex items-start gap-2 text-sm text-slate-600 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3.5 py-3">
            <Info size={16} {...ICON} className="text-slate-400 flex-shrink-0 mt-0.5" />
            This is an older schedule that isn't linked to a job order.
          </p>
        )}
        {Number(visit.pending_requests) > 0 && (
          <p className="flex items-start gap-2 text-sm text-slate-700 rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3.5 py-3">
            <CalendarClock size={16} {...ICON} className="text-amber-500 flex-shrink-0 mt-0.5" />
            The worker asked to move this visit. Answer the request on the dashboard.
          </p>
        )}
        {agreeing && (
          <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3.5 py-3 text-sm text-slate-700">
            <p className="flex items-start gap-2">
              <Hourglass size={16} {...ICON} className={`${visit.waiting_for === 'admin' ? 'text-amber-500' : 'text-slate-400'} flex-shrink-0 mt-0.5`} />
              <span>
                {visit.waiting_for === 'admin'
                  ? 'The customer and the worker couldn’t agree. Pick the date below.'
                  : `The date isn't final yet. Waiting for the ${visit.waiting_for} to answer${visit.answer_late ? ' (no answer for 2+ days)' : ''}. You can set the final date any time.`}
                <span className="block text-xs text-slate-500 mt-1">Another date was suggested {visit.prop_round || 0} of 3 times. Visits are 9:00–11:00 AM.</span>
              </span>
            </p>
          </div>
        )}
        <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3">
              <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-sm text-slate-900 mt-0.5 break-words whitespace-pre-line">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
        {(visit.proposals || []).length > 1 && (
          <div>
            <p className="text-sm font-medium text-slate-900 mb-2 flex items-center gap-1.5"><History size={15} {...ICON} className="text-slate-400" />Date history</p>
            <ol className="space-y-1.5">
              {visit.proposals.map((p, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-700"><span className="font-medium">{WHO[p.by] || p.by}</span> {ACTION[p.action] || p.action}
                    {p.action !== 'escalate' && p.start_time ? ` · ${fmtDate(parseDT(p.start_time), { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(parseDT(p.created_at), { month: 'short', day: 'numeric' })}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
        {confirm === 'final' ? (
          <div className="sc-pop flex flex-wrap items-center gap-x-3 gap-y-2">
            <label htmlFor="final-date" className="text-sm text-slate-700">Final date</label>
            <input id="final-date" type="date" min={dayKey(new Date(Date.now() + 86400000))} value={finalDate} onChange={e => setFinalDate(e.target.value)}
              className={`${inputCls} !w-auto flex-1 min-w-[150px]`} />
            <button onClick={() => setConfirm(null)} disabled={busy} className={btnSecondary}>Back</button>
            <button onClick={setFinal} disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} {...ICON} />}Set date
            </button>
          </div>
        ) : confirm ? (
          <div className="sc-pop flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm text-slate-700 flex-1 min-w-[180px]">
              {confirm === 'cancel' ? 'Cancel this visit? The worker will be told.' : 'Mark this visit as done?'}
            </span>
            <button onClick={() => setConfirm(null)} disabled={busy} className={btnSecondary}>Back</button>
            <button onClick={() => confirm === 'cancel' ? run(15, 'Visit cancelled. The worker has been told.') : run(14, 'Visit marked as done.')}
              disabled={busy}
              className={confirm === 'cancel' ? 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-60' : btnPrimary}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {confirm === 'cancel' ? 'Yes, cancel visit' : 'Yes, it’s done'}
            </button>
          </div>
        ) : open ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setConfirm('cancel')} className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"><Ban size={15} {...ICON} />Cancel visit</button>
            <span className="flex-1" />
            {!legacy && <button onClick={onEdit} className={btnSecondary}><Pencil size={15} {...ICON} />Edit</button>}
            {agreeing
              ? <button onClick={() => setConfirm('final')} className={btnPrimary}><CalendarDays size={16} {...ICON} />Set final date</button>
              : <button onClick={() => setConfirm('complete')} className={btnPrimary}><CheckCircle2 size={16} {...ICON} />Mark as done</button>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-end">
            {visit.job_order_code && <button onClick={onOpenJob} className={btnSecondary}><Eye size={15} {...ICON} />Job orders</button>}
            <button onClick={() => run(12, 'Visit reopened.')} disabled={busy} className={btnSecondary}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={15} {...ICON} />}Reopen
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Plan / edit a visit ────────────────────────────────────────
function VisitForm({ initial, jobs, onClose, onSaved, onError }) {
  const editing = initial.visit || null
  const startDT = editing ? parseDT(editing.start_time) : null
  const endDT   = editing ? parseDT(editing.end_time) : null

  const [jobId,  setJobId]  = useState(editing ? String(editing.job_order_id || '') : (initial.jobId || ''))
  const [type,   setType]   = useState(editing?.visit_type || '')
  const [date,   setDate]   = useState(startDT ? dayKey(startDT) : '')
  const [time,   setTime]   = useState(startDT ? `${pad(startDT.getHours())}:${pad(startDT.getMinutes())}` : '09:00')
  const [length, setLength] = useState(startDT && endDT ? Math.round((endDT - startDT) / 60000) : 120)
  const [worker, setWorker] = useState(editing ? String(editing.worker_user_id || '') : '')
  const [notes,  setNotes]  = useState(editing?.description || '')
  const [opts,   setOpts]   = useState({ workers: [], allowed_types: [], service: null, loading: false })
  const [saving, setSaving] = useState(false)
  const [tried,  setTried]  = useState(false)
  const [mode,   setMode]   = useState('auto')   // ocular on a Scheduled job: 'auto' (customer and worker agree) or 'manual'

  const job = jobs.find(j => String(j.id) === String(jobId)) || null
  const todayKey = dayKey(new Date())
  const endTime = addMinutes(time || '09:00', Number(length) || 60)
  const start = date && time ? `${date} ${time}:00` : ''
  const end   = date && time ? `${date} ${endTime}:00` : ''
  const lengths = LENGTHS.some(l => l.v === Number(length)) ? LENGTHS : [...LENGTHS, { v: Number(length), l: `${Math.round(length / 6) / 10} hours` }]

  // Workers who could go (and which visit types fit the job's status)
  useEffect(() => {
    if (!jobId) { setOpts({ workers: [], allowed_types: [], service: null, loading: false }); return }
    let alive = true
    setOpts(o => ({ ...o, loading: true }))
    apiGet('/api/schedules/workers.php', { job_order_id: jobId, start, end, exclude: editing?.id || '' })
      .then(d => { if (alive) setOpts({ workers: d.workers || [], allowed_types: d.allowed_types || [], service: d.service, loading: false }) })
      .catch(() => { if (alive) setOpts(o => ({ ...o, loading: false })) })
    return () => { alive = false }
  }, [jobId, start, end]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pick a sensible visit type and worker for the job
  useEffect(() => {
    if (editing || !opts.allowed_types.length) return
    if (!opts.allowed_types.includes(type)) setType(opts.allowed_types[0])
  }, [opts.allowed_types]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editing || worker || !job?.worker_contact_id || type === 'ocular') return
    setWorker(String(job.worker_contact_id))
  }, [job?.id, type]) // eslint-disable-line react-hooks/exhaustive-deps

  const usable = w => !w.busy_with && (type !== 'ocular' || (w.matches && w.license_ok))
  const workerNote = w => w.busy_with ? `busy (${w.busy_with})`
    : type === 'ocular' && !w.matches ? 'different specialization'
    : type === 'ocular' && !w.license_ok ? 'no valid license'
    : w.is_assigned ? 'assigned to this job' : ''
  const sortedWorkers = [...opts.workers].sort((a, b) =>
    (b.is_assigned - a.is_assigned) || (usable(b) - usable(a)) || (b.matches - a.matches) || a.full_name.localeCompare(b.full_name))
  const chosen = opts.workers.find(w => String(w.id) === String(worker))

  // Scheduled job with a worker: the ocular date can be sent to the customer automatically
  const canAuto = !editing && type === 'ocular' && job?.status === 'Scheduled' && !!job?.worker_contact_id && !!job?.start_date && !!job?.end_date
  const auto = canAuto && mode === 'auto'

  const missing = {}
  if (!jobId) missing.job = 'Choose a job order.'
  if (!type) missing.type = 'Choose the type of visit.'
  if (!date) missing.date = 'Pick a date.'
  else if (isWeekend(date)) missing.date = 'Site visits are Monday to Friday only.'
  else if (date < todayKey) missing.date = 'Pick today or a later date.'
  if (!time) missing.time = 'Pick a start time.'
  else if (endTime <= time) missing.time = 'The visit must end on the same day.'
  if (!worker) missing.worker = 'Choose who goes.'
  else if (chosen && !usable(chosen)) missing.worker = `This worker can't go: ${workerNote(chosen)}.`
  const err = k => tried ? missing[k] : null
  const errCls = '!border-red-300 bg-red-50'
  const fieldError = k => err(k) ? <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle size={12} {...ICON} />{err(k)}</p> : null

  const save = async () => {
    setTried(true)
    if (auto) {
      setSaving(true)
      try {
        const res = await apiPost('/api/schedules/auto-ocular.php', { job_order_id: Number(jobId) })
        if (res?.success === false) throw new Error(res.error)
        onSaved(res?.message || 'Date sent to the customer.')
      } catch (e) { onError(errText(e)) }
      setSaving(false)
      return
    }
    if (Object.keys(missing).length) return
    setSaving(true)
    try {
      const payload = { job_order_id: Number(jobId), visit_type: type, worker_user_id: Number(worker), start_time: start, end_time: end, description: notes.trim() }
      const res = editing
        ? await apiPut('/api/schedules/update.php', { id: editing.id, ...payload })
        : await apiPost('/api/schedules/create.php', payload)
      if (res?.success === false) throw new Error(res.error)
      onSaved(editing?.waiting_for ? 'Date set. The worker and the customer have been told.'
        : editing ? 'Visit updated. The worker has been told.' : 'Site visit planned. The worker has been notified.')
    } catch (e) { onError(errText(e)) }
    setSaving(false)
  }

  return (
    <Modal onClose={() => !saving && onClose()} width="max-w-xl">
      <ModalHeader icon={CalendarClock} title={editing ? `Edit ${editing.schedule_code || 'visit'}` : 'Plan site visit'}
        subtitle={editing?.waiting_for ? 'Saving sets this as the final date. The worker and the customer are told.' : auto ? 'Monday to Friday. The customer gets an email to confirm the date first.' : 'Monday to Friday. The worker gets an Inbox message and an email.'}
        onClose={() => !saving && onClose()} />

      <div className="px-6 py-6 overflow-y-auto flex-1 custom-scroll space-y-5">
        {/* Job order */}
        <div>
          <label className={labelCls}>Job order</label>
          <div className="relative">
            <select className={`${selectCls} ${err('job') ? errCls : ''}`} value={jobId} disabled={!!editing}
              onChange={e => { setJobId(e.target.value); setWorker(''); setType('') }}>
              <option value="">Select a job order</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.job_order_code} · {j.service || j.description || 'Job'} · {j.client_name || '—'} · {j.status}</option>
              ))}
            </select>
            <Chev />
          </div>
          {fieldError('job')}
          {!jobs.length && <p className="text-xs text-slate-500 mt-1.5">Only job orders that are Under Review, Scheduled or In Progress can have a site visit.</p>}
          {job && (
            <p className="text-xs text-slate-500 mt-1.5 flex items-start gap-1.5"><MapPin size={12} {...ICON} className="mt-0.5 flex-shrink-0" />{job.client_address || 'No address'}</p>
          )}
        </div>

        {/* Type */}
        {jobId && (
          <div>
            <p className={labelCls}>Type of visit</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(opts.allowed_types.length ? opts.allowed_types : (editing?.visit_type ? [editing.visit_type] : [])).map(t => {
                const on = type === t
                return (
                  <button key={t} type="button" onClick={() => setType(t)} aria-pressed={on}
                    className={`text-left rounded-lg border px-3.5 py-3 transition-colors ${on ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <span className="block text-sm font-medium text-slate-900">{TYPES[t].label}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{TYPES[t].hint}</span>
                  </button>
                )
              })}
            </div>
            {fieldError('type')}
          </div>
        )}

        {/* Ocular on a Scheduled job: automatic date or set it yourself */}
        {canAuto && (
          <div>
            <p className={labelCls}>Date</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ['auto', 'Automatic (recommended)', 'A free weekday between the job dates is sent to the customer, then the worker. They can suggest other dates.'],
                ['manual', 'Set the date myself', 'Pick the date, time and worker now. The worker is told right away.'],
              ].map(([k, title, hint]) => (
                <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
                  className={`text-left rounded-lg border px-3.5 py-3 transition-colors ${mode === k ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <span className="block text-sm font-medium text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>
                </button>
              ))}
            </div>
            {auto && (
              <p className="text-xs text-slate-500 mt-2 flex items-start gap-1.5">
                <Info size={13} {...ICON} className="mt-0.5 flex-shrink-0" />
                Between {fmtDate(parseDT(`${String(job.start_date).slice(0, 10)} 00:00`), { month: 'short', day: 'numeric' })} and {fmtDate(parseDT(`${String(job.end_date).slice(0, 10)} 00:00`))}, 9:00–11:00 AM, with {job.worker_name || 'the assigned worker'}.
              </p>
            )}
          </div>
        )}

        {!auto && <>
        {/* When */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" min={todayKey} className={`${inputCls} ${err('date') ? errCls : ''}`} value={date} onChange={e => setDate(e.target.value)} />
            {fieldError('date')}
            {!err('date') && date && isWeekend(date) && <p className="text-xs text-red-600 mt-1.5">Weekends aren't allowed.</p>}
          </div>
          <div>
            <label className={labelCls}>Start time</label>
            <input type="time" step={900} className={`${inputCls} ${err('time') ? errCls : ''}`} value={time} onChange={e => setTime(e.target.value)} />
            {fieldError('time')}
          </div>
          <div>
            <label className={labelCls}>Length</label>
            <div className="relative">
              <select className={selectCls} value={length} onChange={e => setLength(Number(e.target.value))}>
                {lengths.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
              </select>
              <Chev />
            </div>
            {time && <p className="text-xs text-slate-500 mt-1.5">Ends at {fmtTime(parseDT(`2000-01-01 ${endTime}`))}</p>}
          </div>
        </div>

        {/* Worker */}
        {jobId && (
          <div>
            <label className={labelCls}>Who goes</label>
            <div className="relative">
              <select className={`${selectCls} ${err('worker') ? errCls : ''}`} value={worker} onChange={e => setWorker(e.target.value)} disabled={opts.loading && !opts.workers.length}>
                <option value="">{opts.loading && !opts.workers.length ? 'Loading workers…' : 'Select a worker'}</option>
                {sortedWorkers.map(w => {
                  const note = workerNote(w)
                  return (
                    <option key={w.id} value={w.id} disabled={!usable(w) && String(w.id) !== String(worker)}>
                      {w.full_name}{w.specialization ? ` — ${w.specialization}` : ''}{note ? ` (${note})` : ''}
                    </option>
                  )
                })}
              </select>
              <Chev />
            </div>
            {fieldError('worker')}
            {!err('worker') && (
              <p className="text-xs text-slate-500 mt-1.5">
                {type === 'ocular'
                  ? <>Only Active workers who specialise in <span className="font-medium text-slate-700">{opts.service || 'this service'}</span> and have a valid license can go.</>
                  : 'Workers who already have a visit at this time are greyed out.'}
              </p>
            )}
          </div>
        )}

        </>}

        {/* Notes */}
        {!auto && <>
        <div>
          <label className={labelCls}>Notes for the worker <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea rows={3} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Measure the kitchen and check the wiring. Call the customer when you arrive."
            className={`${inputCls} h-auto py-2.5 resize-none`} />
        </div>
        </>}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
        {tried && !auto && Object.keys(missing).length
          ? <p className="hidden sm:flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={14} {...ICON} />Fill in the required fields.</p>
          : <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500"><CalendarX2 size={14} {...ICON} />No weekends</span>}
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={onClose} disabled={saving} className={`${btnSecondary} flex-1 sm:flex-none`}>Cancel</button>
          <button onClick={save} disabled={saving} className={`${btnPrimary} flex-1 sm:flex-none`}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} {...ICON} />}
            {saving ? 'Saving…' : auto ? 'Send date to customer' : editing?.waiting_for ? 'Save as final date' : editing ? 'Save changes' : 'Plan visit'}
          </button>
        </div>
      </div>
    </Modal>
  )
}