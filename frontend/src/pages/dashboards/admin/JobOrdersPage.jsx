import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Briefcase, Plus, Search, Pencil, CheckCircle2, AlertCircle, X, AlertTriangle, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ArrowUp, ArrowDown,
  ArrowUpDown, Loader2, Clock, CalendarDays, HardHat, User, Mail, Smartphone, MapPin,
  Link2, Info, Check,
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3, .sc-page h4, .sc-page legend {
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
  .sc-bar  { transition: width .9s cubic-bezier(.2,.7,.2,1); }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-fade, .sc-pop { animation: none; }
    .sc-bar { transition: none; }
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

// ── Helpers ────────────────────────────────────────────────────
const parseDay = s => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + 'T00:00'); return isNaN(d) ? null : d }
const fmtDay = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => { const d = parseDay(s); return d ? d.toLocaleDateString(undefined, opts) : '—' }
const DAY = 86400000

function periodInfo(jo, today) {
  const s = parseDay(jo.start_date), e = parseDay(jo.end_date)
  if (!s || !e || !today) return null
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const total = Math.max(1, (e - s) / DAY)
  if (t < s) { const d = Math.round((s - t) / DAY); return { pct: 0, label: d === 0 ? 'Starts today' : `Starts in ${d}d`, tone: 'text-slate-500', bar: 'bg-slate-300' } }
  if (t > e) return { pct: 100, label: 'Ended', tone: 'text-slate-400', bar: 'bg-slate-300' }
  const left = Math.round((e - t) / DAY)
  return { pct: Math.min(100, ((t - s) / DAY / total) * 100), label: left === 0 ? 'Ends today' : `${left}d left`, tone: left <= 3 ? 'text-amber-700' : 'text-emerald-700', bar: left <= 3 ? 'bg-amber-400' : 'bg-emerald-500' }
}

// ── Shared bits ────────────────────────────────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]
function Avatar({ name, size = 'w-7 h-7', text = 'text-[10px]' }) {
  if (!name) return <div className={`${size} rounded-full border border-dashed border-slate-300 flex-shrink-0`} />
  const ini = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[(name.charCodeAt(0) || 0) % AVATAR_TONES.length]}`}>{ini}</div>
}

const STATUS = {
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500',  '#eab308'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500',  '#8b5cf6'],
  'On Hold':      ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500',  '#f97316'],
  'Active':       ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500', '#10b981'],
  'Scheduled':    ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500',    '#06b6d4'],
  'In Progress':  ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500',   '#f59e0b'],
  'Complete':     ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500',    '#3b82f6'],
  'Completed':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500',    '#3b82f6'],
  'Cancelled':    ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500',     '#ef4444'],
}

function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center px-6">
      <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center"><Icon size={22} {...ICON} /></div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-[300px]">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function Notice({ tone = 'info', icon: Icon = Info, children, action }) {
  const tones = {
    info:    'bg-sky-50 border-sky-200 text-sky-800 [&>svg]:text-sky-500',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800 [&>svg]:text-emerald-500',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 [&>svg]:text-amber-500',
    error:   'bg-red-50 border-red-200 text-red-700 [&>svg]:text-red-500',
  }
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border text-sm ${tones[tone]}`}>
      <Icon size={16} {...ICON} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
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

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className="px-5 py-2.5 font-medium whitespace-nowrap">
      <button onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 rounded hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}>
        {label}<Icon size={12} {...ICON} className={active ? 'text-emerald-600' : 'text-slate-300'} />
      </button>
    </th>
  )
}

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


function StatusDropdown({ options, value, onChange, loading }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = options.find(o => o.value === value) || options[0]

  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  return (
    <div className="relative w-full sm:w-52 flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-9 pl-3 pr-2.5 flex items-center gap-2 rounded-lg border bg-white shadow-sm text-sm text-left transition-colors focus-visible:outline-none
          ${open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${current.dot || 'bg-slate-300'}`} />
        <span className="flex-1 min-w-0 font-medium text-slate-800 truncate">{current.label}</span>
        <span className="text-xs tabular-nums px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{loading ? '·' : current.count}</span>
        <ChevronDown size={15} {...ICON} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul role="listbox" className="sc-pop absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl ring-1 ring-slate-900/5 p-1">
          {options.map(o => {
            const on = o.value === value
            return (
              <li key={o.value || 'all'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full h-9 px-2.5 flex items-center gap-2.5 rounded-lg text-sm text-left transition-colors ${on ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.dot || 'bg-slate-300'}`} />
                  <span className="flex-1 font-medium">{o.label}</span>
                  <span className={`text-xs tabular-nums ${on ? 'text-emerald-700' : 'text-slate-400'}`}>{loading ? '·' : o.count}</span>
                  <Check size={14} strokeWidth={2.25} className={on ? 'text-emerald-600' : 'invisible'} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700">
      {children}
      <button onClick={onRemove} aria-label="Remove filter" className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={12} {...ICON} /></button>
    </span>
  )
}

function PeriodCell({ jo, today }) {
  if (!jo.start_date || !jo.end_date) return <span className="text-slate-400">No dates</span>
  const info = ['Complete', 'Completed', 'Cancelled'].includes(jo.status) ? null : periodInfo(jo, today)
  return (
    <div className="min-w-[160px]">
      <p className="text-slate-700 tabular-nums whitespace-nowrap">{fmtDay(jo.start_date, { month: 'short', day: 'numeric' })} – {fmtDay(jo.end_date)}</p>
      {info && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden"><div className={`sc-bar h-full rounded-full ${info.bar}`} style={{ width: `${info.pct}%` }} /></div>
          <span className={`text-[11px] font-medium whitespace-nowrap ${info.tone}`}>{info.label}</span>
        </div>
      )}
    </div>
  )
}

// ── Status groups for the tabs ─────────────────────────────────
const GROUPS = {
  review:    ['Pending', 'Under Review'],
  hold:      ['On Hold'],
  running:   ['Active', 'Scheduled', 'In Progress'],
  done:      ['Complete', 'Completed'],
  cancelled: ['Cancelled'],
}

// ── Job statuses & flow (unchanged) ────────────────────────────
const JO_STATUSES = [
  { id: 16, l: 'Pending',      next: [20] },
  { id: 20, l: 'Under Review', next: [17, 23, 19] },
  { id: 19, l: 'On Hold',      next: [17] },
  { id: 17, l: 'Active',       next: [21] },
  { id: 21, l: 'Scheduled',    next: [22] },
  { id: 22, l: 'In Progress',  next: [18] },
  { id: 18, l: 'Complete',     next: [] },
  { id: 23, l: 'Cancelled',    next: [] },
]

// ── Job Orders Page ────────────────────────────────────────────
export default function JobOrdersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const highlightInquiryCode = location.state?.highlightInquiryCode || null
  const highlightClientName  = location.state?.highlightClientName  || null
  const highlightClientId    = location.state?.highlightClientId    || null

  const [jobOrders,      setJobOrders]      = useState([])
  const [contacts,       setContacts]       = useState([])
  const [contracts,      setContracts]      = useState([])
  const [inquiries,      setInquiries]      = useState([])
  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterContract, setFilterContract] = useState('')
  const [sort,           setSort]           = useState({ key: 'job_order_code', dir: 'desc' })
  const [loading,        setLoading]        = useState(true)
  const [showForm,       setShowForm]       = useState(false)
  const [editTarget,     setEditTarget]     = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [toast,          setToast]          = useState(null)
  const [page,           setPage]           = useState(1)
  const [perPage,        setPerPage]        = useState(10)
  const [today,          setToday]          = useState(null)
  const emptyForm = { worker_contact_id: '', client_contact_id: '', inquiry_id: '', contract_type_id: '', description: '', start_date: '', end_date: '', status_id: '16', _usedStatuses: [16] }
  const [form, setForm] = useState(emptyForm)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  // ── Availability helpers (unchanged)
  const ACTIVE = ['Pending', 'Under Review', 'Active', 'Scheduled', 'In Progress']

  const isWorkerAvailable = (workerId, startDate, endDate, excludeJobOrderId = null) => {
    if (!workerId || !startDate || !endDate) return true
    const newStart = new Date(startDate), newEnd = new Date(endDate)
    return !jobOrders.some(jo => {
      if (excludeJobOrderId && jo.id === excludeJobOrderId) return false
      if (!ACTIVE.includes(jo.status)) return false
      if (String(jo.worker_contact_id) !== String(workerId)) return false
      if (!jo.start_date || !jo.end_date) return false
      return newStart <= new Date(jo.end_date) && newEnd >= new Date(jo.start_date)
    })
  }

  const getConflictingJobOrder = (workerId, startDate, endDate, excludeJobOrderId = null) => {
    if (!workerId || !startDate || !endDate) return null
    const newStart = new Date(startDate), newEnd = new Date(endDate)
    return jobOrders.find(jo => {
      if (excludeJobOrderId && jo.id === excludeJobOrderId) return false
      if (!ACTIVE.includes(jo.status)) return false
      if (String(jo.worker_contact_id) !== String(workerId)) return false
      if (!jo.start_date || !jo.end_date) return false
      return newStart <= new Date(jo.end_date) && newEnd >= new Date(jo.start_date)
    })
  }

  const getWorkerBusyRanges = (workerId, excludeJobOrderId = null) =>
    jobOrders
      .filter(jo => {
        if (excludeJobOrderId && jo.id === excludeJobOrderId) return false
        if (!ACTIVE.includes(jo.status)) return false
        if (String(jo.worker_contact_id) !== String(workerId)) return false
        return !!(jo.start_date && jo.end_date)
      })
      .map(jo => ({ start: jo.start_date, end: jo.end_date, code: jo.job_order_code }))

  const getWorkerNextAvailable = (workerId, excludeJobOrderId = null) => {
    const ranges = getWorkerBusyRanges(workerId, excludeJobOrderId)
    if (ranges.length === 0) return null
    const sorted = [...ranges].sort((a, b) => new Date(a.end) - new Date(b.end))
    const next = new Date(sorted[sorted.length - 1].end)
    next.setDate(next.getDate() + 1)
    return next.toISOString().slice(0, 10)
  }

  // ── Load (all job orders, so conflict checks see every worker booking)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [joData, cData, ctData, inqData] = await Promise.all([
        apiGet('/api/job-orders/list.php', { per_page: 500 }),
        apiGet('/api/contacts/list.php',   { per_page: 500 }),
        apiGet('/api/config/contract-types.php'),
        apiGet('/api/inquiries/list.php',  { per_page: 500 }),
      ])
      setJobOrders(joData.job_orders     || [])
      setContacts(cData.contacts         || [])
      setContracts(ctData.contract_types || [])
      setInquiries(inqData.inquiries     || [])
    } catch { showToast('Failed to load job orders.', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/time/now.php')
      .then(r => r.json())
      .then(data => { if (data?.datetime) setToday(new Date(data.datetime)); else throw new Error('No datetime') })
      .catch(() => setToday(new Date()))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, filterStatus, filterContract, perPage])

  const workers = contacts.filter(c => c.type === 'worker')
  const clients = contacts.filter(c => c.type === 'client' || c.type === 'organisation')

  // ── Derived list
  const scoped = useMemo(() => highlightInquiryCode
    ? jobOrders.filter(jo => jo.inquiry_code === highlightInquiryCode)
    : highlightClientName
      ? jobOrders.filter(jo => jo.client_name === highlightClientName || String(jo.client_contact_id) === String(highlightClientId))
      : jobOrders,
  [jobOrders, highlightInquiryCode, highlightClientName, highlightClientId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = scoped.filter(jo =>
      (!filterStatus || GROUPS[filterStatus]?.includes(jo.status)) &&
      (!filterContract || jo.contract_type === filterContract) &&
      (!q || [jo.job_order_code, jo.worker_name, jo.client_name, jo.description, jo.contract_type, jo.inquiry_code].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = jo => sort.key === 'start_date' ? (parseDay(jo.start_date)?.getTime() || 0) : String(jo[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => {
      const A = val(a), B = val(b)
      const r = typeof A === 'number' ? A - B : A.localeCompare(B, undefined, { numeric: true })
      return sort.dir === 'asc' ? r : -r
    })
  }, [scoped, search, filterStatus, filterContract, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus || filterContract
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterContract('') }

  // ── Form helpers (unchanged logic)
  const handleClientChange = (clientId) => {
    f('client_contact_id', clientId)
    if (!clientId) { f('description', ''); f('_client_mobile', ''); f('_client_email', ''); f('_client_address', ''); return }
    const client = clients.find(c => String(c.id) === String(clientId))
    if (client) {
      const linked = inquiries.find(inq => String(inq.contact_id) === String(clientId) && inq.status === 'Won')
      f('description', (linked?.reason === 'Other' ? linked?.description : linked?.reason) || linked?.description || '')
      f('inquiry_id',  linked?.id || '')
      f('_client_mobile',  client.mobile  || '')
      f('_client_email',   client.email   || '')
      f('_client_address', client.address || '')
    }
  }

  const calcEndDate = (startDate, contractName) => {
    if (!startDate || !contractName) return ''
    const start = new Date(startDate)
    if (isNaN(start)) return ''
    const map = {
      '1 Day':      () => { const d = new Date(start); d.setDate(d.getDate() + 1); return d },
      '2 Days':     () => { const d = new Date(start); d.setDate(d.getDate() + 2); return d },
      '3 Days':     () => { const d = new Date(start); d.setDate(d.getDate() + 3); return d },
      '1 Week':     () => { const d = new Date(start); d.setDate(d.getDate() + 7); return d },
      '2 Weeks':    () => { const d = new Date(start); d.setDate(d.getDate() + 14); return d },
      '1 Month':    () => { const d = new Date(start); d.setMonth(d.getMonth() + 1); return d },
      '3 Months':   () => { const d = new Date(start); d.setMonth(d.getMonth() + 3); return d },
      '6 Months':   () => { const d = new Date(start); d.setMonth(d.getMonth() + 6); return d },
      '1 Year':     () => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d },
      '5 Years ++': () => { const d = new Date(start); d.setFullYear(d.getFullYear() + 5); return d },
    }
    const fn = map[contractName]
    return fn ? fn().toISOString().slice(0, 10) : ''
  }

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setShowForm(true) }

  const openEdit = (jo) => {
    setEditTarget(jo)
    const worker   = contacts.find(c => c.type === 'worker' && (c.full_name === jo.worker_name || c.contact_code === jo.worker_contact_code))
    const client   = clients.find(c => (c.full_name === jo.client_name || c.contact_code === jo.client_contact_code))
    const contract = contracts.find(ct => ct.name === jo.contract_type)
    const status   = JO_STATUSES.find(s => s.l === jo.status)
    const linkedInquiry = inquiries.find(inq => String(inq.id) === String(jo.inquiry_id))
    setForm({
      worker_contact_id: worker?.id    || '',
      client_contact_id: client?.id    || '',
      inquiry_id:        jo.inquiry_id  || '',
      contract_type_id:  contract?.id   || '',
      description: jo.description || (linkedInquiry?.reason === 'Other' ? linkedInquiry?.description : linkedInquiry?.reason) || linkedInquiry?.description || '',
      start_date:        jo.start_date  || '',
      end_date:          jo.end_date    || '',
      status_id:         status?.id     || '16',
      _client_mobile:    client?.mobile  || '',
      _client_email:     client?.email   || '',
      _client_address:   client?.address || '',
      _inquiry_code:     linkedInquiry?.inquiry_code || '',
      _inquiry_reason:   linkedInquiry?.reason || '',
      _inquiry_description: linkedInquiry?.reason === 'Other' ? (linkedInquiry?.description || '') : '',
    })
    setShowForm(true)
  }

  const closeForm = useCallback(() => { if (!saving) { setShowForm(false); setEditTarget(null) } }, [saving])

  const handleSave = async () => {
    if (form.worker_contact_id && form.start_date && form.end_date) {
      if (!isWorkerAvailable(form.worker_contact_id, form.start_date, form.end_date, editTarget?.id)) {
        const conflict = getConflictingJobOrder(form.worker_contact_id, form.start_date, form.end_date, editTarget?.id)
        showToast(`Worker is not available. Conflict with ${conflict?.job_order_code || 'another job order'}`, 'error')
        return
      }
    }

    const token = JSON.parse(localStorage.getItem('sc_user'))?.token
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    const base = 'https://saddlebrown-swan-877763.hostingersite.com/backend/api'
    setSaving(true)
    try {
      const res = editTarget
        ? await apiPut('/api/job-orders/update.php', { id: editTarget.id, ...form })
        : await apiPost('/api/job-orders/create.php', form)
      if (!res.success) throw new Error(res.error)
      if (!editTarget && form.start_date && form.end_date) {
        try {
          await fetch(`${base}/schedules/create.php`, {
            method: 'POST', headers,
            body: JSON.stringify({ worker_contact_id: form.worker_contact_id || null, client_contact_id: form.client_contact_id || null, start_time: `${form.start_date} 08:00:00`, end_time: `${form.end_date} 17:00:00`, description: form.description || '', status_id: 11 }),
          })
        } catch (e) { console.warn('Schedule auto-create failed:', e) }
      }
      showToast(editTarget ? 'Job order updated' : 'Job order created')
      const wasEdit = editTarget
      setSaving(false); setShowForm(false); setEditTarget(null); setForm(emptyForm); load()

      if (Number(form.status_id) === 21 && wasEdit) {
        const selectedContract = contracts.find(c => String(c.id) === String(form.contract_type_id))
        const contractName = selectedContract?.name || ''
        const isLongContract = ['3 Months', '6 Months', '1 Year', '5 Years ++'].includes(contractName)
        let schedStart = form.start_date
        let schedEnd   = form.end_date
        if (isLongContract && form.start_date) {
          const joStart = new Date(form.start_date)
          const joEnd   = new Date(form.end_date)
          const rangeDays = Math.floor((joEnd - joStart) / (1000 * 60 * 60 * 24))
          const maxOffset = Math.max(0, rangeDays - 4)
          const randStart = new Date(joStart)
          randStart.setDate(randStart.getDate() + Math.floor(Math.random() * (maxOffset + 1)))
          const randEnd = new Date(randStart)
          randEnd.setDate(randEnd.getDate() + (Math.random() < 0.5 ? 3 : 4) - 1)
          schedStart = randStart.toISOString().slice(0, 10)
          schedEnd   = randEnd.toISOString().slice(0, 10)
        }
        navigate('/admin/scheduling', { state: { fromJobOrder: {
          id: wasEdit.id,
          worker_contact_id: form.worker_contact_id,
          client_contact_id: form.client_contact_id,
          description: form.description,
          start_date: schedStart,
          end_date:   schedEnd,
          contract_name: contractName,
          is_long_contract: isLongContract,
          jo_start_date: form.start_date,
          jo_end_date:   form.end_date,
        } } })
      }
    } catch (err) { showToast(err.message || 'Failed to save job order.', 'error'); setSaving(false) }
  }

  const groupCount = g => scoped.filter(jo => GROUPS[g].includes(jo.status)).length
  const groupLabel = { review: 'Needs review', hold: 'On hold', running: 'Running', done: 'Completed', cancelled: 'Cancelled' }

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Job orders</h1>
          <p className="text-sm text-slate-500 mt-1">Assign workers to client projects and track each job from review to completion.</p>
        </div>
        <button onClick={openCreate} className={`${btnPrimary} self-start sm:self-auto`}><Plus size={16} {...ICON} /> New job order</button>
      </div>

      {(highlightInquiryCode || highlightClientName) && (
        <Notice tone="info" icon={Filter}
          action={<button onClick={() => navigate('/admin/job-orders', { replace: true, state: {} })} className="text-sm font-medium text-sky-800 hover:underline underline-offset-2 whitespace-nowrap">Show all</button>}>
          {highlightInquiryCode
            ? <>Showing the job order for inquiry <span className="font-semibold">{highlightInquiryCode}</span>.</>
            : <>Showing job orders for <span className="font-semibold">{highlightClientName}</span>.</>}
        </Notice>
      )}

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-100">
          <StatusDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            loading={loading}
            options={[
              { value: '',          label: 'All statuses', count: scoped.length },
              { value: 'review',    label: 'Needs review', count: groupCount('review'),    dot: 'bg-violet-500' },
              { value: 'running',   label: 'Running',      count: groupCount('running'),   dot: 'bg-amber-500' },
              { value: 'hold',      label: 'On hold',      count: groupCount('hold'),      dot: 'bg-orange-500' },
              { value: 'done',      label: 'Completed',    count: groupCount('done'),      dot: 'bg-blue-500' },
              { value: 'cancelled', label: 'Cancelled',    count: groupCount('cancelled'), dot: 'bg-red-500' },
            ]}
          />
          <div className="flex flex-1 items-center gap-2 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search code, client, worker or project"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
            </div>
            <SelectBox value={filterContract} onChange={setFilterContract} className="w-40 flex-shrink-0">
              <option value="">All contracts</option>
              {contracts.map(ct => <option key={ct.id} value={ct.name}>{ct.name}</option>)}
            </SelectBox>
          </div>
        </div>

        {hasFilters && !loading && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {search && <Chip onRemove={() => setSearch('')}>“{search}”</Chip>}
            {filterStatus && <Chip onRemove={() => setFilterStatus('')}>{groupLabel[filterStatus]}</Chip>}
            {filterContract && <Chip onRemove={() => setFilterContract('')}>{filterContract}</Chip>}
            <button onClick={clearFilters} className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800">Clear all</button>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-lg" />
                <div className="w-40 space-y-2"><Skel className="h-3 w-20" /><Skel className="h-2.5 w-28" /></div>
                <Skel className="w-7 h-7 rounded-full" /><Skel className="h-3 w-24" />
                <Skel className="hidden md:block h-3 w-28 ml-auto" /><Skel className="h-5 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters
            ? <EmptyState icon={Search} title="No matching job orders" text="Try a different search or remove a filter." action={<button onClick={clearFilters} className={btnSecondary}>Clear filters</button>} />
            : <EmptyState icon={Briefcase}
                title={highlightInquiryCode ? 'No job order for this inquiry yet' : highlightClientName ? `No job orders for ${highlightClientName}` : 'No job orders yet'}
                text="Job orders are created when an inquiry is won, or you can add one yourself."
                action={<button onClick={openCreate} className={btnPrimary}><Plus size={16} {...ICON} /> New job order</button>} />
        ) : (
          <>
            {/* Mobile list */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((jo, i) => (
                <li key={jo.id}>
                  <button onClick={() => openEdit(jo)} className="sc-rise w-full text-left px-4 py-3.5 flex items-start gap-3 active:bg-slate-50" style={{ animationDelay: `${i * 30}ms` }}>
                    <span className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0"><Briefcase size={17} {...ICON} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{jo.job_order_code}</p>
                        <StatusBadge status={jo.status} />
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{jo.description || 'No description'} · {jo.client_name || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{jo.worker_name || 'No worker yet'} · {jo.start_date && jo.end_date ? `${fmtDay(jo.start_date, { month: 'short', day: 'numeric' })} – ${fmtDay(jo.end_date)}` : 'Not scheduled'}</p>
                    </div>
                    <ChevronRight size={16} {...ICON} className="text-slate-300 mt-3 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Job order" sortKey="job_order_code" sort={sort} onSort={onSort} />
                    <SortHeader label="Client"    sortKey="client_name"    sort={sort} onSort={onSort} />
                    <SortHeader label="Worker"    sortKey="worker_name"    sort={sort} onSort={onSort} />
                    <SortHeader label="Contract"  sortKey="contract_type"  sort={sort} onSort={onSort} />
                    <SortHeader label="Period"    sortKey="start_date"     sort={sort} onSort={onSort} />
                    <SortHeader label="Status"    sortKey="status"         sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((jo, i) => (
                    <tr key={jo.id} className="sc-rise group hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                      <td className="px-5 py-3">
                        <button onClick={() => openEdit(jo)} className="flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                          <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0"><Briefcase size={16} {...ICON} /></span>
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-900 group-hover:text-emerald-700 transition-colors tabular-nums">{jo.job_order_code}</span>
                            <span className="block text-xs text-slate-500 truncate max-w-[190px]">{jo.description || 'No description'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        {jo.client_name ? (
                          <span className="flex items-center gap-2.5">
                            <Avatar name={jo.client_name} size="w-8 h-8" text="text-[11px]" />
                            <span className="text-slate-900 font-medium whitespace-nowrap">{jo.client_name}</span>
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {jo.worker_name ? (
                          <span className="flex items-center gap-2.5">
                            <Avatar name={jo.worker_name} size="w-8 h-8" text="text-[11px]" />
                            <span className="text-slate-700 whitespace-nowrap">{jo.worker_name}</span>
                          </span>
                        ) : (
                          <button onClick={() => openEdit(jo)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors whitespace-nowrap">
                            <Plus size={13} {...ICON} /> Assign worker
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">{jo.contract_type ? <span className="text-slate-700">{jo.contract_type}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-3">{jo.start_date && jo.end_date ? <PeriodCell jo={jo} today={today} /> : <span className="text-slate-400 whitespace-nowrap">Not scheduled</span>}</td>
                      <td className="px-5 py-3"><StatusBadge status={jo.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end">
                          <button onClick={() => openEdit(jo)} aria-label={`Edit ${jo.job_order_code}`} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                            <Pencil size={14} {...ICON} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
          </>
        )}
      </section>

      {showForm && (
        <JobOrderModal
          {...{ form, f, editTarget, saving, contacts, clients, contracts, inquiries, today, closeForm, handleSave, handleClientChange, calcEndDate,
                isWorkerAvailable, getWorkerBusyRanges, getWorkerNextAvailable }}
        />
      )}
    </div>
  )
}

// ── Create / edit modal ────────────────────────────────────────
function JobOrderModal({
  form, f, editTarget, saving, contacts, clients, contracts, inquiries, today, closeForm, handleSave, handleClientChange,
  calcEndDate, isWorkerAvailable, getWorkerBusyRanges, getWorkerNextAvailable,
}) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && closeForm()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [closeForm])

  const inputCls = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors'
  const selectCls = `${inputCls} appearance-none pr-9 cursor-pointer`
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'
  const Chev = () => <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

  // Worker list (unchanged matching logic)
  const linked = inquiries.find(inq =>
    String(inq.id) === String(form.inquiry_id) ||
    (form.client_contact_id && String(inq.contact_id) === String(form.client_contact_id) && inq.status === 'Won')
  )
  const inquiryReason = linked?.reason === 'Other' ? (linked?.description || 'Other') : (linked?.reason || '')
  const allWorkers = contacts.filter(c => c.type === 'worker')
  const matched = inquiryReason ? allWorkers.filter(w => w.specialization === inquiryReason) : []
  const hasDates = !!(form.start_date && form.end_date)
  const renderOption = (w) => {
    const available = !hasDates || isWorkerAvailable(w.id, form.start_date, form.end_date, editTarget?.id)
    const nextAvail = getWorkerNextAvailable(w.id, editTarget?.id)
    return (
      <option key={w.id} value={w.id} disabled={hasDates && !available}>
        {w.full_name}{w.specialization ? ` — ${w.specialization}` : ''}{hasDates && !available ? ` (Busy until ${nextAvail || '?'})` : ''}
      </option>
    )
  }

  // Worker availability
  const busyRanges = form.worker_contact_id ? getWorkerBusyRanges(form.worker_contact_id, editTarget?.id) : []
  const nextAvail = form.worker_contact_id ? getWorkerNextAvailable(form.worker_contact_id, editTarget?.id) : null
  const hasConflict = hasDates && form.worker_contact_id && !isWorkerAvailable(form.worker_contact_id, form.start_date, form.end_date, editTarget?.id)
  const busyDates = new Set()
  busyRanges.forEach(r => {
    const cur = new Date(r.start), end = new Date(r.end)
    while (cur <= end) { busyDates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1) }
  })
  const startBusy = form.start_date && busyDates.has(form.start_date)
  const endBusy   = form.end_date && busyDates.has(form.end_date)

  // Status options (unchanged rules)
  const savedStatus = editTarget ? JO_STATUSES.find(s => s.l === editTarget.status) : JO_STATUSES.find(s => s.id === 16)
  const savedId = savedStatus?.id ?? 16
  const statusOptions = JO_STATUSES.filter(s => s.id === savedId || (savedStatus?.next || []).includes(s.id))
  const selectedContract = contracts.find(c => String(c.id) === String(form.contract_type_id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={closeForm} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              {editTarget ? <Pencil size={20} {...ICON} /> : <Briefcase size={20} {...ICON} />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-slate-900">{editTarget ? `Edit ${editTarget.job_order_code}` : 'New job order'}</h3>
                {editTarget && <StatusBadge status={editTarget.status} />}
              </div>
              {editTarget?.inquiry_code
                ? <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1"><Link2 size={14} {...ICON} />Linked to inquiry <span className="font-medium text-slate-700">{editTarget.inquiry_code}</span></p>
                : <p className="text-sm text-slate-500 mt-0.5">Assign a worker to a client project.</p>}
            </div>
          </div>
          <button onClick={closeForm} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1 custom-scroll space-y-6">
          {/* Client */}
          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3"><User size={16} {...ICON} className="text-slate-400" />Client</legend>
            <label className={labelCls}>Client or subcontractor</label>
            <div className="relative">
              <select className={selectCls} value={form.client_contact_id} onChange={e => handleClientChange(e.target.value)}>
                <option value="">Select a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <Chev />
            </div>

            {form.client_contact_id && (
              <div className="sc-pop mt-3 grid grid-cols-1 sm:grid-cols-3 gap-px rounded-lg border border-slate-200 bg-slate-200 overflow-hidden text-sm">
                {[{ icon: Smartphone, label: 'Mobile', value: form._client_mobile }, { icon: Mail, label: 'Email', value: form._client_email }, { icon: MapPin, label: 'Address', value: form._client_address }].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-slate-50/80 px-3 py-2.5 min-w-0">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5"><Icon size={12} {...ICON} />{label}</p>
                    <p className="text-slate-900 mt-0.5 truncate" title={value}>{value || '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {form._inquiry_code && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
                <span className="w-8 h-8 rounded-lg bg-white border border-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0"><Link2 size={15} {...ICON} /></span>
                <div className="min-w-0">
                  <p className="text-xs text-amber-700">Linked inquiry · {form._inquiry_code}</p>
                  <p className="text-sm font-medium text-amber-900 truncate">{form._inquiry_reason || '—'}</p>
                </div>
              </div>
            )}
          </fieldset>

          <div className="h-px bg-slate-100" />

          {/* Worker */}
          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3"><HardHat size={16} {...ICON} className="text-slate-400" />Worker</legend>
            <label className={labelCls}>Assigned worker</label>
            <div className="relative">
              <select className={selectCls} value={form.worker_contact_id} onChange={e => f('worker_contact_id', e.target.value)}>
                <option value="">Select a worker</option>
                {inquiryReason ? matched.map(renderOption) : allWorkers.map(renderOption)}
              </select>
              <Chev />
            </div>
            {inquiryReason && (
              <p className="text-xs text-slate-500 mt-1.5">
                {matched.length
                  ? <>Showing workers who specialise in <span className="font-medium text-slate-700">{inquiryReason}</span>.</>
                  : <span className="text-amber-700">No workers specialise in “{inquiryReason}” yet. Add one in Workers first.</span>}
                {hasDates && ' Busy workers are greyed out.'}
              </p>
            )}

            {form.worker_contact_id && (
              <div className="mt-3">
                {busyRanges.length === 0 ? (
                  <Notice tone="success" icon={CheckCircle2}>This worker is free, with no other active job orders.</Notice>
                ) : (
                  <Notice tone={hasConflict ? 'error' : 'warning'} icon={AlertTriangle}>
                    <p className="font-medium">{hasConflict ? 'This worker is busy on the dates you picked' : 'This worker has other active job orders'}</p>
                    <ul className="mt-2 space-y-1">
                      {busyRanges.map((r, i) => (
                        <li key={i} className="flex items-center gap-2 text-[13px]">
                          <span className={`w-1.5 h-1.5 rounded-full ${hasConflict ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <span className="font-semibold tabular-nums">{r.code}</span>
                          <span className="tabular-nums">{fmtDay(r.start, { month: 'short', day: 'numeric' })} – {fmtDay(r.end)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[13px]">Next free from <span className="font-semibold">{nextAvail ? fmtDay(nextAvail) : 'unknown'}</span></p>
                  </Notice>
                )}
              </div>
            )}
          </fieldset>

          <div className="h-px bg-slate-100" />

          {/* Contract & dates */}
          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3"><CalendarDays size={16} {...ICON} className="text-slate-400" />Contract period</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Contract type</label>
                <div className="relative">
                  <select className={selectCls} value={form.contract_type_id} onChange={e => {
                    const id = e.target.value
                    f('contract_type_id', id)
                    const ct = contracts.find(c => String(c.id) === String(id))
                    if (ct && form.start_date) { const end = calcEndDate(form.start_date, ct.name); if (end) f('end_date', end) }
                  }}>
                    <option value="">Select</option>
                    {contracts.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                  </select>
                  <Chev />
                </div>
              </div>
              <div>
                <label className={labelCls}>Start date</label>
                <input type="date"
                  className={`${inputCls} ${startBusy ? '!border-red-300 bg-red-50' : ''}`}
                  value={form.start_date}
                  min={nextAvail || (today ? today.toISOString().slice(0, 10) : undefined)}
                  onChange={e => {
                    f('start_date', e.target.value)
                    const ct = contracts.find(c => String(c.id) === String(form.contract_type_id))
                    if (ct && e.target.value) { const end = calcEndDate(e.target.value, ct.name); if (end) f('end_date', end) }
                  }} />
                {startBusy && <p className="text-xs text-red-600 mt-1.5">Worker is busy on this date.</p>}
              </div>
              <div>
                <label className={labelCls}>End date</label>
                <input type="date"
                  className={`${inputCls} ${endBusy ? '!border-red-300 bg-red-50' : ''}`}
                  value={form.end_date}
                  min={form.start_date || (today ? today.toISOString().slice(0, 10) : undefined)}
                  onChange={e => f('end_date', e.target.value)} />
                {endBusy && <p className="text-xs text-red-600 mt-1.5">Worker is busy on this date.</p>}
              </div>
            </div>
            {selectedContract && form.start_date && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                <Clock size={12} {...ICON} />End date is set from the {selectedContract.name} contract. You can still change it.
              </p>
            )}
            {nextAvail && form.worker_contact_id && (
              <p className="text-xs text-slate-500 mt-1.5">Earliest start for this worker: <span className="font-medium text-emerald-700">{fmtDay(nextAvail)}</span></p>
            )}
          </fieldset>

          <div className="h-px bg-slate-100" />

          {/* Status */}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900 mb-1">Status</legend>
            <p className="text-xs text-slate-500 mb-3">
              {statusOptions.length > 1 ? 'Move this job to its next stage.' : 'This job is at its final stage.'}
              {editTarget && Number(form.status_id) === 21 && ' Saving as Scheduled opens Scheduling so you can plan the site visit.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(s => {
                const on = Number(form.status_id) === s.id
                const current = s.id === savedId
                return (
                  <button key={s.id} type="button" onClick={() => f('status_id', s.id)} aria-pressed={on}
                    className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                      ${on ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <span className={`w-2 h-2 rounded-full ${STATUS[s.l]?.[1]}`} />
                    {s.l}
                    {current && <span className="text-[11px] font-normal text-slate-500">(current)</span>}
                    {on && <Check size={14} strokeWidth={2.5} className="text-emerald-600" />}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {/* Description */}
          <div>
            <label className={labelCls}>Project description</label>
            {editTarget ? (
              <textarea className={`${inputCls} h-auto py-2.5 resize-none bg-slate-50 text-slate-600 cursor-not-allowed`} rows={3} value={form.description} readOnly />
            ) : (
              <textarea className={`${inputCls} h-auto py-2.5 resize-none`} rows={3} value={form.description} onChange={e => f('description', e.target.value)} placeholder="What work will be done?" />
            )}
            {editTarget && <p className="text-xs text-slate-500 mt-1.5">The description can’t be changed after the job order is created.</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          {hasConflict
            ? <p className="hidden sm:flex items-center gap-1.5 text-xs text-red-600"><AlertTriangle size={14} {...ICON} />Fix the date conflict to save.</p>
            : <span className="hidden sm:block" />}
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={closeForm} disabled={saving} className={`${btnSecondary} flex-1 sm:flex-none`}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className={`${btnPrimary} flex-1 sm:flex-none`}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} {...ICON} />}
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Create job order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}