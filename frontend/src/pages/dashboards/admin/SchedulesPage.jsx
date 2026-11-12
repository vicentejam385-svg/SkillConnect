import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, CalendarDays, CalendarClock, CalendarCheck2, CalendarRange, Plus, Search,
  CheckCircle2, AlertCircle, X, ArrowRight, Eye, AlertTriangle, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronDown, Clock, HardHat, User, Briefcase, Loader2,
  RotateCcw, Link2, Info, Filter,
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

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
  @keyframes sc-rise   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes sc-fade   { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-pop    { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes sc-drawer { from { transform: translateX(100%); } to { transform: none; } }
  .sc-rise   { animation: sc-rise .4s cubic-bezier(.2,.7,.2,1) both; }
  .sc-fade   { animation: sc-fade .2s ease both; }
  .sc-pop    { animation: sc-pop .25s cubic-bezier(.2,.7,.2,1) both; }
  .sc-drawer { animation: sc-drawer .3s cubic-bezier(.2,.8,.2,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-fade, .sc-pop, .sc-drawer { animation: none; }
  }
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
const parseDT = str => {
  if (!str) return null
  const d = new Date(String(str).replace(' ', 'T'))
  return isNaN(d) ? null : d
}
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const fmtTime = d => d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'
const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => d ? d.toLocaleDateString(undefined, opts) : '—'
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Shared bits ────────────────────────────────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]
const toneFor = (name = '') => AVATAR_TONES[(name.charCodeAt(0) || 0) % AVATAR_TONES.length]

function Avatar({ name, size = 'w-7 h-7', text = 'text-[10px]' }) {
  const ini = name && name !== '—' ? name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?'
  return (
    <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${toneFor(name)}`}>{ini}</div>
  )
}

const STATUS = {
  'Pending':     ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Scheduled':   ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500'],
  'In Progress': ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500'],
  'Complete':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Completed':   ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Cancelled':   ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'Active':      ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
}

function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

// Calendar event chip colour by status
const chipTone = status =>
  status === 'Complete' || status === 'Completed' ? 'bg-blue-50 text-blue-800 border-blue-400'
  : status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-400 line-through'
  : status === 'In Progress' ? 'bg-amber-50 text-amber-800 border-amber-400'
  : 'bg-emerald-50 text-emerald-800 border-emerald-500'

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

// ── Toast ──────────────────────────────────────────────────────
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

function MiniStat({ icon: Icon, label, value, tone, loading, delay }) {
  return (
    <div className="sc-rise bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex items-center gap-3.5" style={{ animationDelay: `${delay}ms` }}>
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={18} {...ICON} /></span>
      <div className="min-w-0">
        {loading ? <Skel className="h-6 w-10" /> : <p className="text-2xl font-semibold text-slate-900 leading-none tabular-nums">{value}</p>}
        <p className="text-sm text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}

function SelectBox({ value, onChange, children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none w-full h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer">
        {children}
      </select>
      <ChevronDown size={14} {...ICON} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────
function Pagination({ page, total, perPage, onPage, onPerPage }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total ? (page - 1) * perPage + 1 : 0
  const to = Math.min(page * perPage, total)
  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }
  const cell = 'h-8 min-w-[32px] px-2 inline-flex items-center justify-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 disabled:text-slate-300 disabled:cursor-not-allowed'
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows per page</span>
          <SelectBox value={perPage} onChange={v => onPerPage(Number(v))} className="w-[72px]">
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </SelectBox>
        </label>
        <span className="tabular-nums"><span className="font-medium text-slate-800">{from}–{to}</span> of <span className="font-medium text-slate-800">{total}</span></span>
      </div>
      <nav aria-label="Pagination" className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(1)} disabled={page === 1} aria-label="First page"><ChevronsLeft size={16} {...ICON} /></button>
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page"><ChevronLeft size={16} {...ICON} /></button>
        <span className={`${cell} sm:hidden text-slate-600 px-3`}>Page {page} of {totalPages}</span>
        {pages.map((p, i) => p === '…'
          ? <span key={`e${i}`} className={`${cell} hidden sm:inline-flex text-slate-400`}>…</span>
          : <button key={p} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}
              className={`${cell} hidden sm:inline-flex tabular-nums ${p === page ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>{p}</button>
        )}
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(page + 1)} disabled={page === totalPages} aria-label="Next page"><ChevronRight size={16} {...ICON} /></button>
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(totalPages)} disabled={page === totalPages} aria-label="Last page"><ChevronsRight size={16} {...ICON} /></button>
      </nav>
    </div>
  )
}

// ── Modal & drawer shells ──────────────────────────────────────
function Modal({ onClose, active = true, width = 'max-w-lg', z = 'z-50', children }) {
  useEscapeAndLock(onClose, active)
  return (
    <div className={`fixed inset-0 ${z} flex items-center justify-center p-4`}>
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`sc-pop relative w-full ${width} bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] flex flex-col overflow-hidden`}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ icon: Icon, title, subtitle, onClose, tone = 'bg-emerald-50 ring-emerald-100 text-emerald-600' }) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
      <div className="flex items-start gap-4 min-w-0">
        <span className={`w-11 h-11 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={20} {...ICON} /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
    </div>
  )
}

function Notice({ tone = 'info', icon: Icon = Info, children }) {
  const tones = {
    info:    'bg-sky-50 border-sky-200 text-sky-800 [&_svg]:text-sky-500',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 [&_svg]:text-emerald-500',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 [&_svg]:text-amber-500',
    error:   'bg-red-50 border-red-200 text-red-700 [&_svg]:text-red-500',
  }
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-sm ${tones[tone]}`}>
      <Icon size={16} {...ICON} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ── Schedule drawer ────────────────────────────────────────────
function ScheduleDrawer({ schedule, onClose, onToggleStatus, toggling }) {
  useEscapeAndLock(onClose)
  const start = parseDT(schedule.start_time)
  const end = parseDT(schedule.end_time)
  const done = schedule.status === 'Complete' || schedule.status === 'Completed'
  const rows = [
    { icon: CalendarDays, label: 'Date',      value: start ? fmtDate(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null },
    { icon: Clock,        label: 'Time',      value: start ? `${fmtTime(start)} – ${fmtTime(end)}${end && !sameDay(start, end) ? ` (${fmtDate(end)})` : ''}` : null },
    { icon: Briefcase,    label: 'Job order', value: schedule.job_order_code !== '—' ? schedule.job_order_code : null, sub: schedule.jo_description !== '—' ? schedule.jo_description : null },
    { icon: HardHat,      label: 'Worker',    value: schedule.worker_name, avatar: true },
    { icon: User,         label: 'Client',    value: schedule.client_name },
  ].filter(r => r.value)

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className="sc-drawer absolute right-0 top-0 h-full w-full max-w-[440px] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 flex-shrink-0">
          <p className="text-sm font-medium text-slate-500">Site visit</p>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={schedule.status} />
            <span className="text-xs text-slate-500 tabular-nums">{schedule.schedule_code}</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 leading-snug">{schedule.inquiry_reason || 'Site visit'}</h3>
          {start && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-semibold text-emerald-600 leading-none">{MONTH_NAMES[start.getMonth()].slice(0, 3)}</span>
                <span className="text-lg font-semibold text-slate-900 leading-tight tabular-nums">{start.getDate()}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{fmtDate(start, { weekday: 'long' })}</p>
                <p className="text-sm text-slate-500">{fmtTime(start)} – {fmtTime(end)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll px-6 py-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-2">Details</h4>
          <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {rows.map(({ icon: Icon, label, value, sub, avatar }) => (
              <div key={label} className="flex items-start gap-3 px-4 py-3">
                <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm text-slate-900 mt-0.5 break-words flex items-center gap-2">
                    {avatar && <Avatar name={value} size="w-5 h-5" text="text-[9px]" />}
                    {value}
                  </dd>
                  {sub && <p className="text-sm text-slate-500 mt-1 break-words">{sub}</p>}
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={() => onToggleStatus(schedule)} disabled={toggling} className={`${done ? btnSecondary : btnPrimary} flex-1`}>
            {toggling ? <Loader2 size={16} className="animate-spin" /> : done ? <RotateCcw size={16} {...ICON} /> : <CheckCircle2 size={16} {...ICON} />}
            {done ? 'Reopen visit' : 'Mark as complete'}
          </button>
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>
      </aside>
    </div>
  )
}

// ── Schedules Page ─────────────────────────────────────────────
const EMPTY_FORM = { start_time: '', end_time: '', description: '', worker_contact_id: '', client_contact_id: '', status_id: '11', _job_order_code: '', _job_order_id: '', duration_hours: '', priority: '' }

export default function SchedulesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromJobOrder        = location.state?.fromJobOrder        || null
  const highlightWorkerName = location.state?.highlightWorkerName || null
  const highlightWorkerId   = location.state?.highlightWorkerId   || null

  const [schedules,    setSchedules]    = useState([])
  const [jobOrders,    setJobOrders]    = useState([])
  const [contacts,     setContacts]     = useState([])
  const [inquiries,    setInquiries]    = useState([])
  const [contracts,    setContracts]    = useState([])
  const [search]                        = useState('')
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState(null)
  const [calMonth,     setCalMonth]     = useState(null)
  const [today,        setToday]        = useState(null)
  const [selectedDay,  setSelectedDay]  = useState(null)
  const [showFullList, setShowFullList] = useState(false)
  const [listSearch,   setListSearch]   = useState('')
  const [listStatus,   setListStatus]   = useState('all')
  const [viewSchedule, setViewSchedule] = useState(null)
  const [toggling,     setToggling]     = useState(false)
  const [listPage,     setListPage]     = useState(1)
  const [listPerPage,  setListPerPage]  = useState(10)
  const [form, setForm] = useState(EMPTY_FORM)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const load = async () => {
    setLoading(true)
    try {
      const [schData, cData, joData, inqData, ctData] = await Promise.all([
        apiGet('/api/schedules/list.php',  { search, per_page: 100 }),
        apiGet('/api/contacts/list.php',   { per_page: 100 }),
        apiGet('/api/job-orders/list.php', { per_page: 100 }),
        apiGet('/api/inquiries/list.php',  { per_page: 100 }),
        apiGet('/api/config/contract-types.php'),
      ])
      setSchedules(schData.schedules     || [])
      setContacts(cData.contacts         || [])
      setJobOrders(joData.job_orders     || [])
      setInquiries(inqData.inquiries     || [])
      setContracts(ctData.contract_types || [])
    } catch { showToast('Failed to load schedules.', 'error') }
    setLoading(false)
  }

  useEffect(() => {
    if (fromJobOrder) {
      setForm(p => ({
        ...p,
        worker_contact_id: fromJobOrder.worker_contact_id || '',
        client_contact_id: fromJobOrder.client_contact_id || '',
        description:       fromJobOrder.description       || '',
        start_time: fromJobOrder.start_date ? `${fromJobOrder.start_date}T08:00` : '',
        end_time:   fromJobOrder.end_date   ? `${fromJobOrder.end_date}T17:00`   : '',
      }))
      setShowForm(true)
    }
  }, [])

  useEffect(() => {
    if (today && !fromJobOrder && showForm) {
      if (today.getFullYear() < 2026) return
      const y = today.getFullYear(), m = pad(today.getMonth() + 1), d = pad(today.getDate())
      setForm(p => ({ ...p, start_time: `${y}-${m}-${d}T08:00`, end_time: `${y}-${m}-${d}T17:00` }))
    }
  }, [today, showForm])

  useEffect(() => {
    fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/time/now.php')
      .then(r => r.json())
      .then(data => {
        if (!data?.datetime) throw new Error('No datetime')
        const realToday = new Date(data.datetime)
        setToday(realToday); setCalMonth(realToday)
      })
      .catch(() => { const fb = new Date(); setToday(fb); setCalMonth(fb) })
  }, [])

  useEffect(() => { load() }, [search])
  useEffect(() => { setListPage(1) }, [listSearch, listStatus, listPerPage])

  const clients = contacts.filter(c => c.type === 'client' || c.type === 'organisation')
  const workers = contacts.filter(c => c.type === 'worker')

  const isWeekday = (dateStr) => {
    if (!dateStr) return true
    const day = new Date(dateStr).getDay()
    return day !== 0 && day !== 6
  }

  const handleCreate = async () => {
    if (!form.start_time || !form.end_time) { showToast('Start and end time are required.', 'error'); return }

    if (!fromJobOrder) {
      if (!isWeekday(form.start_time)) { showToast('Start time cannot be on a weekend. Please select a weekday.', 'error'); return }
      if (!isWeekday(form.end_time))   { showToast('End time cannot be on a weekend. Please select a weekday.', 'error'); return }
    }

    const contractName = fromJobOrder?.contract_name || contracts.find(c => String(c.id) === String(form.contract_type_id))?.name || ''

    const countWeekdaysBetween = (start, end) => {
      const days = []
      const cur = new Date(start)
      while (cur <= end) {
        const d = cur.getDay()
        if (d !== 0 && d !== 6) days.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
      }
      return days
    }

    const getScheduleDays = (contractName, startDate, endDate) => {
      const fixedLimits = { '1 Day': 1, '2 Days': 2, '3 Days': 3, '1 Week': 5, '2 Weeks': 10 }
      if (fixedLimits[contractName] !== undefined) {
        const limit = fixedLimits[contractName]
        const days = []
        const cur = new Date(startDate)
        while (days.length < limit) {
          const d = cur.getDay()
          if (d !== 0 && d !== 6) days.push(new Date(cur))
          cur.setDate(cur.getDate() + 1)
        }
        return days
      }
      return countWeekdaysBetween(startDate, endDate)
    }

    setSaving(true)
    try {
      const startDate = new Date(form.start_time.slice(0, 10))
      const endDate   = form.end_time ? new Date(form.end_time.slice(0, 10)) : new Date(startDate)
      const startTime = form.start_time.slice(11) || '08:00'
      const endTime   = form.end_time?.slice(11)  || '17:00'
      const days      = getScheduleDays(contractName, startDate, endDate)

      if (days.length === 0) { showToast('No weekdays found in the selected range.', 'error'); setSaving(false); return }

      let lastScheduleId = null
      for (const day of days) {
        const dayStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
        const data = await apiPost('/api/schedules/create.php', {
          ...form,
          start_time: `${dayStr} ${startTime}:00`,
          end_time:   `${dayStr} ${endTime}:00`,
        })
        if (!data.success) throw new Error(data.error)
        if (data.schedule?.id) lastScheduleId = data.schedule.id
      }

      if (fromJobOrder?.id && lastScheduleId) {
        try { await apiPut('/api/job-orders/update.php', { id: fromJobOrder.id, schedule_id: lastScheduleId }) }
        catch (e) { console.warn('Could not link schedule:', e) }
      }

      showToast(`${days.length} site visit${days.length > 1 ? 's' : ''} scheduled${fromJobOrder ? ' and linked' : ''}`)
      setShowForm(false)
      setForm(EMPTY_FORM)
      navigate('/admin/scheduling', { replace: true, state: {} }); load()
    } catch (err) { showToast(err.message || 'Failed to create schedule.', 'error') }
    setSaving(false)
  }

  const handleStatusToggle = async (sc) => {
    const next = sc.status === 'Complete' ? 11 : 14
    setToggling(true)
    try {
      await apiPut('/api/schedules/update.php', { id: sc.id, status_id: next })
      showToast(next === 14 ? 'Visit marked as complete' : 'Visit reopened')
      setViewSchedule(p => p && p.id === sc.id ? { ...p, status: next === 14 ? 'Complete' : 'Pending' } : p)
      load()
    } catch { showToast('Update failed.', 'error') }
    setToggling(false)
  }

  // ── Enrich schedules with job order + inquiry info
  const enrich = useCallback(sc => {
    let linkedJO = jobOrders.find(jo =>
      sc.client_contact_id && sc.worker_contact_id &&
      String(jo.worker_contact_id) === String(sc.worker_contact_id) &&
      String(jo.client_contact_id) === String(sc.client_contact_id)
    )
    if (!linkedJO && sc.description) linkedJO = jobOrders.find(jo => jo.description && jo.description.trim() === sc.description.trim())
    if (!linkedJO && sc.client_contact_id) linkedJO = jobOrders.find(jo => String(jo.client_contact_id) === String(sc.client_contact_id))
    if (!linkedJO && sc.worker_contact_id) linkedJO = jobOrders.find(jo => String(jo.worker_contact_id) === String(sc.worker_contact_id))

    const linkedInquiry = linkedJO?.inquiry_id ? inquiries.find(inq => String(inq.id) === String(linkedJO.inquiry_id)) : null

    const inquiryReason = linkedInquiry
      ? (linkedInquiry.reason === 'Other' ? (linkedInquiry.description || 'Other') : (linkedInquiry.reason || '—'))
      : (linkedJO?.description || sc.description || '—')
    const joDescription = linkedInquiry
      ? (linkedInquiry.description || linkedInquiry.reason || '—')
      : (linkedJO?.description || '—')

    return { ...sc, job_order_code: linkedJO?.job_order_code || '—', jo_description: joDescription, inquiry_reason: inquiryReason, _start: parseDT(sc.start_time), _end: parseDT(sc.end_time) }
  }, [jobOrders, inquiries])

  const enriched = useMemo(() => schedules.map(enrich).sort((a, b) => (a._start || 0) - (b._start || 0)), [schedules, enrich])

  const fullList = highlightWorkerName
    ? enriched.filter(sc => sc.worker_name === highlightWorkerName || String(sc.worker_contact_id) === String(highlightWorkerId))
    : enriched

  const listStatuses = [...new Set(enriched.map(s => s.status).filter(Boolean))]
  const listFiltered = fullList.filter(sc =>
    (listStatus === 'all' || sc.status === listStatus) &&
    (!listSearch || [sc.description, sc.inquiry_reason, sc.worker_name, sc.client_name, sc.job_order_code, sc.schedule_code]
      .some(v => v?.toLowerCase().includes(listSearch.toLowerCase())))
  )
  const listTotalPages = Math.max(1, Math.ceil(listFiltered.length / listPerPage))
  const safeListPage = Math.min(listPage, listTotalPages)
  const listPaginated = listFiltered.slice((safeListPage - 1) * listPerPage, safeListPage * listPerPage)

  // ── Calendar
  const base = calMonth || today || new Date()
  const year = base.getFullYear()
  const month = base.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const eventsByDay = useMemo(() => {
    const m = {}
    enriched.forEach(s => {
      if (s._start && s._start.getFullYear() === year && s._start.getMonth() === month) {
        (m[s._start.getDate()] ||= []).push(s)
      }
    })
    return m
  }, [enriched, year, month])

  // ── Stats
  const stats = useMemo(() => {
    if (!today) return { today: 0, week: 0, upcoming: 0, done: 0 }
    const ws = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    const we = new Date(ws); we.setDate(we.getDate() + 7)
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return {
      today:    enriched.filter(s => sameDay(s._start, today)).length,
      week:     enriched.filter(s => s._start && s._start >= ws && s._start < we).length,
      upcoming: enriched.filter(s => s._start && s._start >= startOfToday && s.status !== 'Complete' && s.status !== 'Cancelled').length,
      done:     enriched.filter(s => s.status === 'Complete' || s.status === 'Completed').length,
    }
  }, [enriched, today])

  // ── Agenda (right column)
  const agenda = useMemo(() => {
    if (selectedDay) return enriched.filter(s => sameDay(s._start, selectedDay))
    if (!today) return []
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return enriched.filter(s => s._start && s._start >= startOfToday).slice(0, 8)
  }, [enriched, selectedDay, today])

  const goToday = () => { if (today) { setCalMonth(today); setSelectedDay(today) } }
  const openNew = () => setShowForm(true)
  const closeForm = useCallback(() => setShowForm(false), [])
  const closeFullList = useCallback(() => setShowFullList(false), [])
  const closeView = useCallback(() => setViewSchedule(null), [])

  const getPriorityLimit = (contractName) => {
    if (!contractName) return 5
    if (contractName === '1 Day')  return 1
    if (contractName === '2 Days') return 2
    if (contractName === '3 Days') return 3
    return 5
  }

  const inputCls = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors disabled:bg-slate-50'
  const selectCls = `${inputCls} appearance-none pr-9 cursor-pointer`
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'
  const addHours = (startStr, hours) => {
    const start = new Date(startStr)
    start.setHours(start.getHours() + Number(hours))
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
  }
  const todayMin = today ? `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00` : undefined

  return (
    <div className="max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Site visit scheduling</h1>
          <p className="text-sm text-slate-500 mt-1">Plan when workers visit client sites. Visits run Monday to Friday.</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => setShowFullList(true)} className={btnSecondary}><ClipboardList size={16} {...ICON} /> All schedules</button>
          <button onClick={openNew} className={btnPrimary}><Plus size={16} {...ICON} /> New schedule</button>
        </div>
      </div>

      {highlightWorkerName && (
        <Notice tone="info" icon={Filter}>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Showing schedules for <span className="font-semibold">{highlightWorkerName}</span> in the full list.
            <button onClick={() => navigate('/admin/scheduling', { replace: true, state: {} })} className="font-medium underline underline-offset-2">Show everyone</button>
          </span>
        </Notice>
      )}



      {/* Calendar + agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 items-start">
        {/* Calendar */}
        <section className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 tabular-nums">{MONTH_NAMES[month]} {year}</h2>
              <button onClick={goToday} className="h-8 px-3 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">Today</button>
            </div>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
              <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} aria-label="Previous month" className="w-9 h-8 inline-flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} {...ICON} /></button>
              <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} aria-label="Next month" className="w-9 h-8 inline-flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronRight size={16} {...ICON} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-y border-slate-100 bg-slate-50/80">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-medium ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-600'}`}>{d}</div>
            ))}
          </div>

          {!today ? (
            <div className="grid grid-cols-7 gap-px bg-slate-100">
              {Array.from({ length: 35 }).map((_, i) => <div key={i} className="bg-white h-14 sm:h-24 p-2"><Skel className="h-4 w-5" /></div>)}
            </div>
          ) : (
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
                  <button
                    key={i}
                    onClick={() => setSelectedDay(isSel ? null : date)}
                    aria-pressed={isSel}
                    aria-label={`${fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}, ${events.length} visit${events.length !== 1 ? 's' : ''}`}
                    className={`relative text-left h-14 sm:h-24 p-1.5 sm:p-2 flex flex-col transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500
                      ${isSel ? 'bg-emerald-50/70 ring-2 ring-inset ring-emerald-500' : weekend ? 'bg-slate-50/60 hover:bg-slate-100/60' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <span className={`w-6 h-6 sm:w-7 sm:h-7 inline-flex items-center justify-center rounded-full text-xs sm:text-sm tabular-nums
                      ${isToday ? 'bg-emerald-600 text-white font-semibold' : weekend ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                      {day}
                    </span>

                    {/* Desktop chips */}
                    <span className="hidden sm:flex flex-col gap-0.5 mt-1 min-w-0">
                      {events.slice(0, 2).map(ev => (
                        <span key={ev.id} className={`block truncate text-[11px] leading-4 px-1.5 py-px rounded border-l-2 ${chipTone(ev.status)}`}>
                          <span className="font-medium">{fmtTime(ev._start).replace(':00', '')}</span> {ev.worker_name?.split(' ')[0] || 'Visit'}
                        </span>
                      ))}
                      {events.length > 2 && <span className="text-[11px] text-slate-500 px-1.5">+{events.length - 2} more</span>}
                    </span>

                    {/* Mobile dots */}
                    {events.length > 0 && (
                      <span className="sm:hidden flex gap-0.5 mt-auto justify-center">
                        {events.slice(0, 3).map(ev => <span key={ev.id} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />Planned</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />In progress</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />Complete</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />Cancelled</span>
            <span className="ml-auto hidden sm:inline">Select a day to see its visits</span>
          </div>
        </section>

        {/* Agenda */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col xl:max-h-[680px]">
          <header className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-slate-100">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                {selectedDay ? fmtDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Upcoming visits'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedDay ? `${agenda.length} visit${agenda.length !== 1 ? 's' : ''} on this day` : 'The next scheduled site visits'}
              </p>
            </div>
            {selectedDay ? (
              <button onClick={() => setSelectedDay(null)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">Show upcoming</button>
            ) : (
              <button onClick={() => setShowFullList(true)} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">
                View all <ArrowRight size={14} {...ICON} />
              </button>
            )}
          </header>

          <div className="flex-1 overflow-y-auto custom-scroll">
            {loading || !today ? (
              <div className="divide-y divide-slate-100">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="px-5 py-4 flex gap-4"><Skel className="w-12 h-12 rounded-lg" /><div className="flex-1 space-y-2"><Skel className="h-3 w-3/4" /><Skel className="h-2.5 w-1/2" /></div></div>
                ))}
              </div>
            ) : agenda.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={selectedDay ? 'No visits on this day' : 'No upcoming visits'}
                text={selectedDay ? 'Pick another day, or schedule a visit.' : 'Create a schedule to plan the next site visit.'}
                action={<button onClick={openNew} className={btnSecondary}><Plus size={16} {...ICON} /> New schedule</button>}
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {agenda.map((sc, i) => (
                  <li key={sc.id}>
                    <button onClick={() => setViewSchedule(sc)} className="sc-rise w-full text-left px-5 py-4 flex gap-4 hover:bg-slate-50/70 transition-colors focus-visible:outline-none focus-visible:bg-slate-50" style={{ animationDelay: `${i * 30}ms` }}>
                      <div className={`w-12 h-12 rounded-lg border flex flex-col items-center justify-center flex-shrink-0 ${sameDay(sc._start, today) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                        <span className="text-[10px] font-semibold text-emerald-600 leading-none">{sc._start ? MONTH_NAMES[sc._start.getMonth()].slice(0, 3) : '—'}</span>
                        <span className="text-base font-semibold text-slate-900 leading-tight tabular-nums">{sc._start?.getDate() ?? ''}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 line-clamp-1">{sc.inquiry_reason !== '—' ? sc.inquiry_reason : 'Site visit'}</p>
                          <StatusBadge status={sc.status} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Clock size={12} {...ICON} />{fmtTime(sc._start)} – {fmtTime(sc._end)}
                          {sc.job_order_code !== '—' && <span className="text-emerald-700 font-medium">· {sc.job_order_code}</span>}
                        </p>
                        <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5 min-w-0">
                          <Avatar name={sc.worker_name} size="w-5 h-5" text="text-[9px]" />
                          <span className="truncate">{sc.worker_name || 'Unassigned'}</span>
                          {sc.client_name && <span className="text-slate-400 truncate">· {sc.client_name}</span>}
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

      {/* ── Full list modal ── */}
      {showFullList && (
        <Modal onClose={closeFullList} active={!viewSchedule} width="max-w-6xl">
          <ModalHeader icon={ClipboardList} title="All schedules" subtitle={`${fullList.length} site visit${fullList.length !== 1 ? 's' : ''}${highlightWorkerName ? ` for ${highlightWorkerName}` : ''}`} onClose={closeFullList} />

          <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 sm:max-w-sm">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search project, worker, client or code"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                autoFocus
              />
              {listSearch && (
                <button onClick={() => setListSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>
              )}
            </div>
            <SelectBox value={listStatus} onChange={setListStatus} className="sm:w-40">
              <option value="all">All statuses</option>
              {listStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </SelectBox>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll">
            {listFiltered.length === 0 ? (
              <EmptyState icon={Search} title="No schedules found" text="Try a different search or status." />
            ) : (
              <>
                <ul className="sm:hidden divide-y divide-slate-100">
                  {listPaginated.map(sc => (
                    <li key={sc.id}>
                      <button onClick={() => setViewSchedule(sc)} className="w-full text-left px-4 py-3.5 flex items-start gap-3 active:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 line-clamp-1">{sc.inquiry_reason}</p>
                            <StatusBadge status={sc.status} />
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{fmtDate(sc._start)} · {fmtTime(sc._start)} – {fmtTime(sc._end)}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{sc.worker_name || '—'} · {sc.client_name || '—'}</p>
                        </div>
                        <ChevronRight size={16} {...ICON} className="text-slate-300 mt-1 flex-shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                        {['Project', 'Job order', 'Worker', 'Client', 'Date & time', 'Status', ''].map((h, i) => (
                          <th key={i} className="px-5 py-2.5 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {listPaginated.map((sc, i) => (
                        <tr key={sc.id} className="sc-rise hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 20}ms` }}>
                          <td className="px-5 py-3 max-w-[220px]">
                            <p className="font-medium text-slate-900 line-clamp-2">{sc.inquiry_reason}</p>
                            <p className="text-xs text-slate-500 tabular-nums">{sc.schedule_code}</p>
                          </td>
                          <td className="px-5 py-3 max-w-[220px]">
                            {sc.job_order_code !== '—' ? <p className="font-medium text-emerald-700 whitespace-nowrap">{sc.job_order_code}</p> : <p className="text-slate-400">Not linked</p>}
                            {sc.jo_description !== '—' && <p className="text-xs text-slate-500 line-clamp-1">{sc.jo_description}</p>}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={sc.worker_name} />
                              <span className="text-slate-900 whitespace-nowrap">{sc.worker_name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{sc.client_name || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <p className="text-slate-900 tabular-nums">{fmtDate(sc._start)}</p>
                            <p className="text-xs text-slate-500 tabular-nums">{fmtTime(sc._start)} – {fmtTime(sc._end)}</p>
                          </td>
                          <td className="px-5 py-3"><StatusBadge status={sc.status} /></td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => setViewSchedule(sc)} title="View details" aria-label="View details" className={iconBtn}><Eye size={16} {...ICON} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {listFiltered.length > 0 && (
            <Pagination page={safeListPage} total={listFiltered.length} perPage={listPerPage} onPage={setListPage} onPerPage={setListPerPage} />
          )}
        </Modal>
      )}

      {/* ── New schedule modal ── */}
      {showForm && (
        <Modal onClose={closeForm} width="max-w-2xl">
          <ModalHeader icon={CalendarClock} title="New schedule" subtitle="Plan a site visit for a worker and client." onClose={closeForm} />

          <div className="px-6 py-6 overflow-y-auto flex-1 custom-scroll space-y-6">
            {fromJobOrder && (
              <Notice tone="warning" icon={Link2}>
                <p className="font-medium">Filled in from a job order</p>
                <p className="text-amber-700 mt-0.5">{fromJobOrder.description || 'Job order details are loaded below.'}</p>
              </Notice>
            )}

            {/* Assignment */}
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900 mb-3">Who</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Worker</label>
                  <div className="relative">
                    <select className={selectCls} value={form.worker_contact_id} onChange={e => {
                      const workerId = e.target.value
                      const linked = jobOrders.find(jo =>
                        String(jo.worker_contact_id) === String(workerId) &&
                        (form.client_contact_id ? String(jo.client_contact_id) === String(form.client_contact_id) : true)
                      )
                      setForm(p => ({
                        ...p,
                        worker_contact_id: workerId,
                        description:  linked?.description || p.description || '',
                        start_time:   linked?.start_date  ? `${linked.start_date}T08:00` : p.start_time,
                        end_time:     linked?.end_date    ? `${linked.end_date}T17:00`   : p.end_time,
                        _job_order_code: linked?.job_order_code || '',
                        _job_order_id:   linked?.id            || '',
                      }))
                    }}>
                      <option value="">Select a worker</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                    </select>
                    <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Client or organisation</label>
                  <div className="relative">
                    <select className={selectCls} value={form.client_contact_id} onChange={e => {
                      const clientId = e.target.value
                      const linked = jobOrders.find(jo =>
                        String(jo.client_contact_id) === String(clientId) &&
                        (form.worker_contact_id ? String(jo.worker_contact_id) === String(form.worker_contact_id) : true)
                      )
                      setForm(p => ({
                        ...p,
                        client_contact_id: clientId,
                        description:  linked?.description || p.description || '',
                        start_time:   linked?.start_date  ? `${linked.start_date}T08:00` : p.start_time,
                        end_time:     linked?.end_date    ? `${linked.end_date}T17:00`   : p.end_time,
                        _job_order_code: linked?.job_order_code || '',
                        _job_order_id:   linked?.id            || '',
                      }))
                    }}>
                      <option value="">Select a client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                    <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {form._job_order_code && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5">
                  <span className="w-8 h-8 rounded-lg bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center"><Briefcase size={15} {...ICON} /></span>
                  <div>
                    <p className="text-xs text-emerald-700">Linked job order</p>
                    <p className="text-sm font-semibold text-emerald-900">{form._job_order_code}</p>
                  </div>
                </div>
              )}
            </fieldset>

            <div className="h-px bg-slate-100" />

            {/* Timing */}
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900 mb-3">When</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.start_time}
                    min={fromJobOrder
                      ? fromJobOrder.is_long_contract ? `${fromJobOrder.jo_start_date}T00:00` : `${fromJobOrder.start_date}T00:00`
                      : todayMin}
                    max={fromJobOrder?.is_long_contract ? `${fromJobOrder.jo_end_date}T23:59` : undefined}
                    onChange={e => {
                      const newStart = e.target.value
                      if (form.duration_hours && newStart) f('end_time', addHours(newStart, form.duration_hours))
                      if (fromJobOrder && !fromJobOrder.is_long_contract) {
                        const pickedTime = newStart?.slice(11) || '08:00'
                        f('start_time', `${fromJobOrder.start_date}T${pickedTime}`)
                      } else if (fromJobOrder?.is_long_contract) {
                        f('start_time', newStart)
                        if (newStart) {
                          const startD = new Date(newStart)
                          startD.setDate(startD.getDate() + 3)
                          f('end_time', `${startD.toISOString().slice(0, 10)}T17:00`)
                        }
                      } else {
                        f('start_time', newStart)
                      }
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>End</label>
                  <input
                    type="datetime-local"
                    className={`${inputCls} ${fromJobOrder?.is_long_contract ? 'bg-slate-50 text-slate-500' : ''}`}
                    value={form.end_time}
                    readOnly={!!fromJobOrder?.is_long_contract}
                    min={fromJobOrder?.is_long_contract
                      ? form.start_time?.slice(0, 10) ? `${form.start_time.slice(0, 10)}T00:00` : undefined
                      : fromJobOrder ? `${fromJobOrder.end_date}T00:00` : todayMin}
                    max={fromJobOrder?.is_long_contract ? `${fromJobOrder.jo_end_date}T23:59` : undefined}
                    onChange={e => {
                      if (fromJobOrder && !fromJobOrder.is_long_contract) {
                        const pickedTime = e.target.value?.slice(11) || '17:00'
                        f('end_time', `${fromJobOrder.end_date}T${pickedTime}`)
                      } else if (!fromJobOrder?.is_long_contract) {
                        f('end_time', e.target.value)
                      }
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {!fromJobOrder && form.start_time && !isWeekday(form.start_time) && (
                  <Notice tone="error" icon={AlertTriangle}>The start date is on a weekend. Choose a weekday (Mon–Fri).</Notice>
                )}
                {!fromJobOrder && form.end_time && !isWeekday(form.end_time) && (
                  <Notice tone="error" icon={AlertTriangle}>The end date is on a weekend. Choose a weekday (Mon–Fri).</Notice>
                )}
                {fromJobOrder?.is_long_contract && (
                  <Notice tone="warning" icon={AlertTriangle}>
                    This is a long contract ({fromJobOrder.contract_name}), so this schedule is a <span className="font-semibold">site visit</span>. You can move the start date anywhere within the job order period.
                  </Notice>
                )}
                {(() => {
                  const cn = fromJobOrder?.contract_name || contracts.find(c => String(c.id) === String(form.contract_type_id))?.name || ''
                  if (!cn || !form.start_time) return null
                  const fixedLimits = { '1 Day': 1, '2 Days': 2, '3 Days': 3, '1 Week': 5, '2 Weeks': 10 }
                  let previewCount = 0
                  if (fixedLimits[cn] !== undefined) previewCount = fixedLimits[cn]
                  else if (form.end_time) {
                    const s = new Date(form.start_time.slice(0, 10))
                    const e = new Date(form.end_time.slice(0, 10))
                    const cur = new Date(s)
                    while (cur <= e) { const d = cur.getDay(); if (d !== 0 && d !== 6) previewCount++; cur.setDate(cur.getDate() + 1) }
                  }
                  if (previewCount === 0) return null
                  return (
                    <Notice tone="success" icon={CheckCircle2}>
                      <span className="font-semibold">{cn}</span> contract: this will create <span className="font-semibold">{previewCount}</span> site visit{previewCount > 1 ? 's' : ''}, Monday to Friday only.
                    </Notice>
                  )
                })()}
              </div>
            </fieldset>

            <div className="h-px bg-slate-100" />

            {/* Duration + preferred days */}
            <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Visit length</label>
                {form.duration_hours === 'custom' ? (
                  <div className="relative">
                    <input
                      type="number" min="1" max="999" placeholder="Number of hours"
                      className={`${inputCls} pr-16`} autoFocus
                      onChange={e => {
                        const val = e.target.value
                        if (!val) return
                        if (form.start_time) f('end_time', addHours(form.start_time, val))
                        f('duration_hours', val)
                      }}
                      onBlur={e => { if (!e.target.value) f('duration_hours', '') }}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">hours</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      className={selectCls}
                      value={form.duration_hours}
                      onChange={e => {
                        const val = e.target.value
                        if (val === 'custom') { f('duration_hours', 'custom'); return }
                        f('duration_hours', val)
                        if (val && form.start_time) f('end_time', addHours(form.start_time, val))
                      }}
                    >
                      <option value="">Select hours</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 24].map(h => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
                      <option value="custom">Custom…</option>
                    </select>
                    <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                )}
                {form.duration_hours && form.duration_hours !== 'custom'
                  ? <p className="text-xs text-emerald-700 mt-1.5">End time is set {form.duration_hours} hour{Number(form.duration_hours) > 1 ? 's' : ''} after the start.</p>
                  : <p className="text-xs text-slate-500 mt-1.5">Sets the end time for you.</p>}
              </div>

              {(() => {
                const priorityLimit = getPriorityLimit(fromJobOrder?.contract_name)
                const contractName = fromJobOrder?.contract_name || contracts.find(c => String(c.id) === String(form.contract_type_id))?.name || ''
                const isWeeklyOrLonger = ['1 Week', '2 Weeks', '1 Month', '3 Months', '6 Months', '1 Year', '5 Years ++'].includes(contractName)
                const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => isWeeklyOrLonger ? `Every ${d}` : d)
                const selectedPriorities = form.priority ? form.priority.split(',').filter(Boolean) : []
                const handlePriorityChange = (label) => {
                  if (selectedPriorities.includes(label)) f('priority', selectedPriorities.filter(p => p !== label).join(','))
                  else if (selectedPriorities.length < priorityLimit) f('priority', [...selectedPriorities, label].join(','))
                }
                return (
                  <div>
                    <label className={labelCls}>Preferred days</label>
                    <div className="flex gap-1.5" role="group" aria-label="Preferred days">
                      {labels.map(label => {
                        const on = selectedPriorities.includes(label)
                        const clickable = on || selectedPriorities.length < priorityLimit
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => handlePriorityChange(label)}
                            disabled={!clickable}
                            aria-pressed={on}
                            title={label}
                            className={`flex-1 h-10 rounded-lg text-sm font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                              ${on ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : clickable ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                          >
                            {label.replace('Every ', '')}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {isWeeklyOrLonger ? 'Repeats every week. ' : ''}Pick up to {priorityLimit} day{priorityLimit > 1 ? 's' : ''} · {selectedPriorities.length} selected
                    </p>
                  </div>
                )
              })()}
            </fieldset>

            <div>
              <label className={labelCls}>Description</label>
              <textarea className={`${inputCls} h-auto py-2.5 resize-none bg-slate-50 text-slate-600 cursor-not-allowed`} rows={3} value={form.description} readOnly placeholder="Filled in from the linked job order" />
              <p className="text-xs text-slate-500 mt-1.5">Comes from the linked job order and can’t be edited here.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            <button onClick={closeForm} className={btnSecondary}>Cancel</button>
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck2 size={16} {...ICON} />}
              {saving ? 'Creating…' : 'Create schedule'}
            </button>
          </div>
        </Modal>
      )}

      {viewSchedule && (
        <ScheduleDrawer schedule={viewSchedule} onClose={closeView} onToggleStatus={handleStatusToggle} toggling={toggling} />
      )}
    </div>
  )
}