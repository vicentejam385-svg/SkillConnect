import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Plus, Search, Eye, X, ArrowRight, FileText, CalendarDays, HardHat, CheckCircle2, AlertCircle,
  RefreshCw, Users, ShieldAlert, ShieldCheck, ShieldX, Shield,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown,
  Mail, Phone, Smartphone, MapPin, Copy, Check, Clock, ExternalLink, Wrench,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// ── Auth headers ───────────────────────────────────────────────
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JSON.parse(localStorage.getItem('sc_user') || 'null')?.token}`,
})

// Loads a license file through fetch-image.php and returns a temporary link to it
async function loadLicenseFile(path) {
  const res  = await fetch(`https://saddlebrown-swan-877763.hostingersite.com/backend/api/licenses/fetch-image.php?path=${encodeURIComponent(path)}`, { headers: authHeaders() })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Could not load file')
  const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))
  return { url: URL.createObjectURL(new Blob([bytes], { type: data.media_type })), type: data.media_type }
}

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
  @keyframes sc-rise   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes sc-fade   { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-pop    { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes sc-drawer { from { transform: translateX(100%); } to { transform: none; } }
  .sc-rise   { animation: sc-rise .4s cubic-bezier(.2,.7,.2,1) both; }
  .sc-fade   { animation: sc-fade .2s ease both; }
  .sc-pop    { animation: sc-pop .25s cubic-bezier(.2,.7,.2,1) both; }
  .sc-drawer { animation: sc-drawer .3s cubic-bezier(.2,.8,.2,1) both; }
  .sc-bar    { transition: width .9s cubic-bezier(.2,.7,.2,1); }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-fade, .sc-pop, .sc-drawer { animation: none; }
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

function useEscapeAndLock(onClose) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
}

// ── Helpers ────────────────────────────────────────────────────
const parseDT = s => { if (!s) return null; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d }
const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => { const d = parseDT(s); return d ? d.toLocaleDateString(undefined, opts) : '—' }
const fmtTime = s => { const d = parseDT(s); return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '' }
const RUNNING = ['Active', 'Scheduled', 'In Progress']

function licenseState(l) {
  if (!l) return { key: 'none', label: 'No license', cls: 'bg-slate-50 text-slate-500 ring-slate-200', icon: Shield }
  if (!l.expiry_date) return { key: 'valid', label: 'On file', cls: 'bg-slate-50 text-slate-600 ring-slate-200', icon: ShieldCheck }
  const exp = new Date(l.expiry_date), now = new Date()
  if (exp < now) return { key: 'expired', label: 'Expired', cls: 'bg-red-50 text-red-700 ring-red-200', icon: ShieldX }
  if (exp - now < 30 * 86400000) return { key: 'expiring', label: 'Expiring soon', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: ShieldAlert }
  return { key: 'valid', label: 'Valid', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: ShieldCheck }
}

// ── Password generator (unchanged) ─────────────────────────────
function generateWorkerPassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower = 'abcdefghijklmnopqrstuvwxyz', digits = '0123456789', special = '@#$!%*?&'
  const all = upper + lower + digits + special
  const rand = str => str[Math.floor(Math.random() * str.length)]
  const required = [rand(upper), rand(lower), rand(digits), rand(special)]
  const rest = Array.from({ length: 6 }, () => rand(all))
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('')
}

// ── Shared bits (same as Contacts / Inquiries) ─────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]
function Avatar({ first, last, seed, size = 'w-8 h-8', text = 'text-[11px]' }) {
  return (
    <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[(Number(seed) || 0) % AVATAR_TONES.length]}`}>
      {(first?.[0] || '?').toUpperCase()}{(last?.[0] || '').toUpperCase()}
    </div>
  )
}

const STATUS = {
  'Active':      ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Inactive':    ['bg-gray-50 text-gray-600 ring-gray-200',          'bg-gray-400'],
  'On Leave':    ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Blacklisted': ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'Pending':     ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Scheduled':   ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500'],
  'In Progress': ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500'],
  'Complete':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Cancelled':   ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
}
function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

function LicenseBadge({ license }) {
  const s = licenseState(license)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${s.cls}`}>
      <s.icon size={12} {...ICON} />{s.label}
    </span>
  )
}

function SpecBadge({ name }) {
  if (!name) return <span className="text-slate-400">—</span>
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium whitespace-nowrap">
      <Wrench size={12} {...ICON} className="text-slate-400" />{name}
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

function CopyButton({ value }) {
  const [done, setDone] = useState(false)
  if (!value) return null
  return (
    <button onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}
      title={done ? 'Copied' : 'Copy'}
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
      {done ? <Check size={14} {...ICON} className="text-emerald-600" /> : <Copy size={14} {...ICON} />}
    </button>
  )
}

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

function Chip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700">
      {children}
      <button onClick={onRemove} aria-label="Remove filter" className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={12} {...ICON} /></button>
    </span>
  )
}

// ── Worker details modal ─────────────────────────────────────────
function WorkerDrawer({ worker, jobs, license, onClose, onOpenScheduling, showToast }) {
  const [tab, setTab] = useState('overview')
  const [schedules, setSchedules] = useState([])
  const [schedLoading, setSchedLoading] = useState(false)
  const [schedLoaded, setSchedLoaded] = useState(false)
  const [file, setFile] = useState(null)
  const [fileLoading, setFileLoading] = useState(false)
  useEscapeAndLock(onClose)

  // Schedules (same source and matching as before)
  useEffect(() => {
    if (tab !== 'schedules' || schedLoaded) return
    ;(async () => {
      setSchedLoading(true)
      try {
        const data = await apiGet('/api/schedules/list.php', { per_page: 100 })
        const all = data.schedules || []
        setSchedules(all.filter(sc => sc.worker_name === worker.full_name || String(sc.worker_contact_id) === String(worker.id))
          .sort((a, b) => (parseDT(b.start_time) || 0) - (parseDT(a.start_time) || 0)))
      } catch { showToast('Failed to load schedules.', 'error') }
      setSchedLoading(false); setSchedLoaded(true)
    })()
  }, [tab, schedLoaded, worker, showToast])

  // License file preview
  useEffect(() => {
    if (tab !== 'license' || !license?.file_path || file) return
    ;(async () => {
      setFileLoading(true)
      try { setFile(await loadLicenseFile(license.file_path)) }
      catch (e) { console.warn('License file load failed:', e) }
      setFileLoading(false)
    })()
  }, [tab, license, file])

  useEffect(() => () => { if (file?.url) URL.revokeObjectURL(file.url) }, [file])

  const running = jobs.filter(j => RUNNING.includes(j.status))
  const lic = licenseState(license)
  const info = [
    { icon: Mail,       label: 'Email',   value: worker.email },
    { icon: Smartphone, label: 'Mobile',  value: worker.mobile },
    { icon: Phone,      label: 'Phone',   value: worker.phone, hideEmpty: true },
    { icon: MapPin,     label: 'Address', value: worker.address },
  ].filter(r => !(r.hideEmpty && !r.value))

  const tabs = [
    { id: 'overview',  label: 'Overview' },
    { id: 'schedules', label: 'Schedules', count: schedLoaded ? schedules.length : null },
    { id: 'license',   label: 'License' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-lg h-[85vh] max-h-[720px] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 flex-shrink-0">
          <p className="text-sm font-medium text-slate-500">Worker details</p>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        {/* Profile */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0">
          <div className="flex items-start gap-4">
            <Avatar first={worker.first_name} last={worker.last_name} seed={worker.id} size="w-14 h-14" text="text-lg" />
            <div className="min-w-0 pt-0.5">
              <h3 className="text-lg font-semibold text-slate-900 leading-tight">{worker.full_name}</h3>
              <p className="text-sm text-slate-500 mt-0.5 tabular-nums">{worker.contact_code || worker.worker_code}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <StatusBadge status={worker.status} />
                <SpecBadge name={worker.specialization} />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-slate-200 flex gap-6 flex-shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative -mb-px py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none ${tab === t.id ? 'border-emerald-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
              {t.count != null && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs tabular-nums ${tab === t.id ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll px-6 py-5">
          {tab === 'overview' && (
            <div className="space-y-6">
              <section>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Contact information</h4>
                <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {info.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="group flex items-start gap-3 px-4 py-3">
                      <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd className="text-sm text-slate-900 break-words mt-0.5">
                          {value || <span className="text-slate-400">Not provided</span>}
                        </dd>
                      </div>
                      <CopyButton value={value} />
                    </div>
                  ))}
                </dl>
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Work</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-slate-200 px-3 py-3">
                    <p className="text-xl font-semibold text-slate-900 tabular-nums">{jobs.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Job orders</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-3">
                    <p className="text-xl font-semibold text-amber-600 tabular-nums">{running.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Running now</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-3">
                    <p className={`text-sm font-semibold mt-1 ${lic.key === 'expired' ? 'text-red-600' : lic.key === 'expiring' ? 'text-amber-600' : lic.key === 'none' ? 'text-slate-400' : 'text-emerald-700'}`}>{lic.label}</p>
                    <p className="text-xs text-slate-500 mt-1">License</p>
                  </div>
                </div>
                {running.length > 0 && (
                  <ul className="mt-3 rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {running.map(j => (
                      <li key={j.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{j.job_order_code} <span className="font-normal text-slate-500">· {j.client_name || '—'}</span></p>
                          <p className="text-xs text-slate-500 mt-0.5">{j.start_date ? `${fmtDate(j.start_date, { month: 'short', day: 'numeric' })} – ${fmtDate(j.end_date)}` : 'No dates'}</p>
                        </div>
                        <StatusBadge status={j.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {tab === 'schedules' && (
            schedLoading ? (
              <div className="space-y-2.5">{[0, 1, 2].map(i => <Skel key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : schedules.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No site visits yet" text="Schedules for this worker will show up here." />
            ) : (
              <ul className="space-y-2.5">
                {schedules.map((sc, i) => {
                  const d = parseDT(sc.start_time)
                  return (
                    <li key={sc.id} className="sc-rise flex gap-3.5 rounded-xl border border-slate-200 p-3.5" style={{ animationDelay: `${i * 30}ms` }}>
                      <div className="w-12 h-12 rounded-lg border border-slate-200 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-emerald-600 leading-none">{d ? d.toLocaleDateString(undefined, { month: 'short' }) : '—'}</span>
                        <span className="text-base font-semibold text-slate-900 leading-tight tabular-nums">{d?.getDate() ?? ''}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{sc.client_name || 'Site visit'}</p>
                          {sc.status && <StatusBadge status={sc.status} />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5"><Clock size={12} {...ICON} />{fmtTime(sc.start_time)} – {fmtTime(sc.end_time)} · {sc.schedule_code}</p>
                        {sc.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{sc.description}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          )}

          {tab === 'license' && (
            !license ? (
              <EmptyState icon={FileText} title="No license on file" text="Upload this worker’s license from the Licenses page." />
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{license.document_name}</p>
                    <p className="text-xs text-slate-500 mt-1">Expires {license.expiry_date ? fmtDate(license.expiry_date) : '—'}</p>
                  </div>
                  <LicenseBadge license={license} />
                </div>
                {fileLoading ? (
                  <Skel className="h-72 w-full rounded-xl" />
                ) : file?.url ? (
                  file.type?.startsWith('image/') ? (
                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center min-h-[280px]">
                      <img src={file.url} alt={license.document_name} className="max-w-full max-h-[420px] object-contain" />
                    </div>
                  ) : file.type === 'application/pdf' ? (
                    <iframe src={file.url} title={license.document_name} className="w-full h-[440px] rounded-xl border border-slate-200" />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 bg-slate-50 rounded-xl border border-slate-200">
                      <FileText size={24} {...ICON} className="text-slate-400" />
                      <p className="text-sm text-slate-500">Preview isn’t available for this file type.</p>
                      <a href={file.url} target="_blank" rel="noreferrer" className={btnSecondary}><ExternalLink size={15} {...ICON} /> Open file</a>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <FileText size={24} {...ICON} className="text-slate-400" />
                    <p className="text-sm text-slate-500">No file attached</p>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={onOpenScheduling} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:underline">
            Open in Scheduling <ArrowRight size={14} {...ICON} />
          </button>
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Workers Page ───────────────────────────────────────────────
const EMPTY_FORM = { first_name: '', middle_name: '', last_name: '', suffix: '', email: '', mobile: '+63', phone: '', username: '', specialization_id: '', status_id: '4' }

export default function WorkersPage() {
  const navigate = useNavigate()
  const [workers,         setWorkers]         = useState([])
  const [specializations, setSpecializations] = useState([])
  const [contacts,        setContacts]        = useState([])
  const [licenses,        setLicenses]        = useState([])
  const [jobOrders,       setJobOrders]       = useState([])
  const [search,          setSearch]          = useState('')
  const [filterStatus,    setFilterStatus]    = useState('')
  const [filterSpec,      setFilterSpec]      = useState('')
  const [sort,            setSort]            = useState({ key: 'full_name', dir: 'asc' })
  const [loading,         setLoading]         = useState(true)
  const [toast,           setToast]           = useState(null)
  const [showForm,        setShowForm]        = useState(false)
  const [selected,        setSelected]        = useState(null)
  const [page,            setPage]            = useState(1)
  const [perPage,         setPerPage]         = useState(10)
  const [form,            setForm]            = useState(EMPTY_FORM)
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const [saving,          setSaving]          = useState(false)

  useEffect(() => {
    const first = form.first_name.trim().toLowerCase().replace(/\s+/g, '')
    const last  = form.last_name.trim().toLowerCase().replace(/\s+/g, '')
    if (!first || !last || form.username) { setUsernameSuggestions([]); return }
    const rand2 = () => Math.floor(10 + Math.random() * 90)
    const rand3 = () => Math.floor(100 + Math.random() * 900)
    setUsernameSuggestions([
      `${first}_${last}`, `${first}${last}`, `${first}_${last}${rand2()}`, `${first[0]}_${last}`,
      `${first[0]}${last}${rand2()}`, `${first}_${last[0]}${rand3()}`, `${first}${rand3()}`,
    ].map(s => s.replace(/[^a-z0-9_]/g, '')))
  }, [form.first_name, form.last_name, form.username])

  const showToast = useCallback((msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }, [])
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [wData, sData, cData, lData, joData] = await Promise.all([
        apiGet('/api/workers/list.php', { per_page: 500 }),
        apiGet('/api/config/specializations.php'),
        apiGet('/api/contacts/list.php', { per_page: 500 }),
        apiGet('/api/licenses/list.php', { per_page: 500 }).catch(() => ({})),
        apiGet('/api/job-orders/list.php', { per_page: 500 }).catch(() => ({})),
      ])
      setWorkers(wData.workers || [])
      setSpecializations(sData.data || sData.specializations || [])
      setContacts(cData.contacts || [])
      setLicenses(lData.licenses || [])
      setJobOrders(joData.job_orders || [])
    } catch { showToast('Failed to load workers.', 'error') }
    setLoading(false)
  }, [showToast])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, filterStatus, filterSpec, perPage])

  // ── Per-worker lookups
  const contactIdFor = useCallback(w => contacts.find(c => c.contact_code === w.contact_code)?.id || w.id, [contacts])

  const licenseFor = useCallback(w => {
    const cid = contactIdFor(w)
    return licenses.filter(l => String(l.contact_id) === String(cid)).sort((a, b) => b.id - a.id)[0] || null
  }, [licenses, contactIdFor])

  const jobsFor = useCallback(w => {
    const cid = contactIdFor(w)
    return jobOrders.filter(jo => String(jo.worker_contact_id) === String(cid) || String(jo.worker_contact_id) === String(w.id) || jo.worker_name === w.full_name)
  }, [jobOrders, contactIdFor])

  const enriched = useMemo(() => workers.map(w => {
    const jobs = jobsFor(w)
    const current = jobs.find(j => RUNNING.includes(j.status)) || null
    const license = licenseFor(w)
    return { ...w, _jobs: jobs, _current: current, _license: license, _lic: licenseState(license).key }
  }), [workers, jobsFor, licenseFor])

  const counts = useMemo(() => {
    const c = { all: enriched.length, Active: 0, Inactive: 0, 'On Leave': 0, onJob: 0, available: 0, licIssues: 0, licExpired: 0 }
    enriched.forEach(w => {
      if (c[w.status] != null) c[w.status]++
      if (w._current) c.onJob++
      if (w.status === 'Active' && !w._current) c.available++
      if (w._lic === 'expired' || w._lic === 'expiring' || w._lic === 'none') c.licIssues++
      if (w._lic === 'expired') c.licExpired++
    })
    return c
  }, [enriched])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = enriched.filter(w =>
      (!filterStatus || w.status === filterStatus) &&
      (!filterSpec || w.specialization === filterSpec) &&
      (!q || [w.full_name, w.email, w.mobile, w.contact_code, w.worker_code, w.specialization].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = w => String(w[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => { const r = val(a).localeCompare(val(b)); return sort.dir === 'asc' ? r : -r })
  }, [enriched, search, filterStatus, filterSpec, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus || filterSpec
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterSpec('') }

  // ── Create (unchanged validation + email)
  const handleCreate = async () => {
    const nameRe = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/
    if (!form.first_name.trim()) { showToast('First name is required.', 'error'); return }
    if (!nameRe.test(form.first_name.trim())) { showToast('First name must contain letters only.', 'error'); return }
    if (form.middle_name.trim() && !nameRe.test(form.middle_name.trim())) { showToast('Middle name must contain letters only.', 'error'); return }
    if (!form.last_name.trim()) { showToast('Last name is required.', 'error'); return }
    if (!nameRe.test(form.last_name.trim())) { showToast('Last name must contain letters only.', 'error'); return }
    if (!form.mobile.trim()) { showToast('Mobile number is required.', 'error'); return }
    if (!/^(09\d{9}|\+639\d{9})$/.test(form.mobile.trim())) { showToast('Enter a valid PH mobile number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).', 'error'); return }
    if (!form.email.trim()) { showToast('Email is required.', 'error'); return }
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
    const validTLDs = ['com','net','org','edu','gov','ph','io','info','biz','me','tv','us','uk','au','ca','de','fr','jp','sg','nz','in']
    if (!emailRegex.test(form.email.trim())) { showToast('Enter a valid email address (e.g. name@example.com).', 'error'); return }
    if (!validTLDs.includes(form.email.trim().split('.').pop().toLowerCase())) { showToast('Enter a valid email domain (e.g. .com, .net, .ph).', 'error'); return }
    if (!form.username.trim()) { showToast('Username is required.', 'error'); return }
    if (form.username.trim().length < 4) { showToast('Username must be at least 4 characters.', 'error'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username.trim())) { showToast('Username can only contain letters, numbers, and underscores (no dots or spaces).', 'error'); return }
    if (!form.specialization_id) { showToast('Specialization is required.', 'error'); return }
    if (saving) return
    setSaving(true)
    try {
      const generatedPassword = generateWorkerPassword()
      const data = await apiPost('/api/workers/create.php', { ...form, type: 'worker', password: generatedPassword })
      if (!data.success) throw new Error(data.error)

      let emailOk = true
      try {
        const mailRes = await fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/workers/send-welcome.php', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ email: form.email.trim(), name: `${form.first_name.trim()} ${form.last_name.trim()}`, username: form.username.trim(), password: generatedPassword }),
        })
        const mailData = await mailRes.json()
        emailOk = mailData.email_sent !== false
      } catch (e) { console.warn('Worker email failed:', e); emailOk = false }

      showToast(emailOk ? 'Worker added and login details emailed' : 'Worker added, but the email was not sent.', emailOk ? 'success' : 'error')
      setShowForm(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) { showToast(err.message || 'Failed to add worker.', 'error') }
    finally { setSaving(false) }
  }

  const closeDrawer = useCallback(() => setSelected(null), [])
  const closeForm = useCallback(() => { if (!saving) setShowForm(false) }, [saving])

  const rowActions = w => (
    <div className="flex items-center justify-end">
      <button onClick={() => setSelected(w)} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <Eye size={15} {...ICON} /> View
      </button>
    </div>
  )

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Workers</h1>
          <p className="text-sm text-slate-500 mt-1">Your workforce, their skills, availability and licenses.</p>
        </div>
        <button onClick={() => setShowForm(true)} className={`${btnPrimary} self-start sm:self-auto`}><Plus size={16} {...ICON} /> Add worker</button>
      </div>

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-100">
          <StatusDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            loading={loading}
            options={[
              { value: '',         label: 'All statuses', count: counts.all },
              { value: 'Active',   label: 'Active',       count: counts.Active,      dot: 'bg-emerald-500' },
              { value: 'On Leave', label: 'On leave',     count: counts['On Leave'], dot: 'bg-orange-500' },
              { value: 'Inactive', label: 'Inactive',     count: counts.Inactive,    dot: 'bg-gray-400' },
            ]}
          />
          <div className="flex flex-1 items-center gap-2 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search name, email, mobile or code" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
            </div>
            <SelectBox value={filterSpec} onChange={setFilterSpec} className="w-44 flex-shrink-0">
              <option value="">All specializations</option>
              {specializations.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </SelectBox>
          </div>
        </div>

        {hasFilters && !loading && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {search && <Chip onRemove={() => setSearch('')}>“{search}”</Chip>}
            {filterStatus && <Chip onRemove={() => setFilterStatus('')}>{filterStatus}</Chip>}
            {filterSpec && <Chip onRemove={() => setFilterSpec('')}>{filterSpec}</Chip>}
            <button onClick={clearFilters} className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800">Clear all</button>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skel className="h-3 w-40" /><Skel className="h-2.5 w-24" /></div>
                <Skel className="hidden md:block h-5 w-28 rounded-md" />
                <Skel className="h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters
            ? <EmptyState icon={Search} title="No matching workers" text="Try a different search or remove a filter." action={<button onClick={clearFilters} className={btnSecondary}>Clear filters</button>} />
            : <EmptyState icon={HardHat} title="Add your first worker" text="Workers get login details by email and can be assigned to job orders." action={<button onClick={() => setShowForm(true)} className={btnPrimary}><Plus size={16} {...ICON} /> Add worker</button>} />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((w, i) => (
                <li key={w.id}>
                  <button onClick={() => setSelected(w)} className="sc-rise w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-slate-50" style={{ animationDelay: `${i * 30}ms` }}>
                    <Avatar first={w.first_name} last={w.last_name} seed={w.id} size="w-10 h-10" text="text-xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{w.full_name}</p>
                        <StatusBadge status={w.status} />
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{w.specialization || 'No specialization'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{w._current ? `On ${w._current.job_order_code}` : 'Available'} · {licenseState(w._license).label}</p>
                    </div>
                    <ChevronRight size={16} {...ICON} className="text-slate-300 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Worker"         sortKey="full_name"      sort={sort} onSort={onSort} />
                    <SortHeader label="Specialization" sortKey="specialization" sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium">Mobile / email</th>
                    <th className="px-5 py-2.5 font-medium">Availability</th>
                    <th className="px-5 py-2.5 font-medium">License</th>
                    <SortHeader label="Status"         sortKey="status"         sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((w, i) => (
                    <tr key={w.id} className="sc-rise group hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                      <td className="px-5 py-3">
                        <button onClick={() => setSelected(w)} className="flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                          <Avatar first={w.first_name} last={w.last_name} seed={w.id} size="w-9 h-9" text="text-xs" />
                          <span>
                            <span className="block font-medium text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">{w.full_name}</span>
                            <span className="block text-xs text-slate-500 tabular-nums">{w.contact_code || w.worker_code}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3"><SpecBadge name={w.specialization} /></td>
                      <td className="px-5 py-3">
                        <p className="text-slate-700 tabular-nums">{w.mobile || <span className="text-slate-400">—</span>}</p>
                        {w.email && <p className="text-xs text-slate-500 truncate max-w-[200px]">{w.email}</p>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {w._current ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />On <span className="font-medium">{w._current.job_order_code}</span>
                          </span>
                        ) : w.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Available</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3"><LicenseBadge license={w._license} /></td>
                      <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                      <td className="px-5 py-3">{rowActions(w)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
          </>
        )}
      </section>

      {selected && (
        <WorkerDrawer
          worker={selected}
          jobs={selected._jobs || []}
          license={selected._license}
          onClose={closeDrawer}
          showToast={showToast}
          onOpenScheduling={() => {
            const w = selected
            setSelected(null)
            navigate('/admin/scheduling', { state: { highlightWorkerName: w.full_name, highlightWorkerId: w.id } })
          }}
        />
      )}

      {showForm && (
        <NewWorkerModal form={form} f={f} specializations={specializations} usernameSuggestions={usernameSuggestions}
          saving={saving} onClose={closeForm} onSubmit={handleCreate} />
      )}
    </div>
  )
}

// ── Add worker modal ───────────────────────────────────────────
function NewWorkerModal({ form, f, specializations, usernameSuggestions, saving, onClose, onSubmit }) {
  useEscapeAndLock(onClose)
  const inp = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors'
  const lbl = 'block text-sm font-medium text-slate-700 mb-1.5'
  const req = <span className="text-red-500 ml-0.5">*</span>
  const opt = <span className="text-xs font-normal text-slate-400"> (optional)</span>
  const Chev = () => <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  const WORKER_STATUSES = [{ id: 1, label: 'Active' }, { id: 2, label: 'Inactive' }]
  const Legend = ({ icon: Icon, children }) => (
    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3"><Icon size={16} {...ICON} className="text-slate-400" />{children}</p>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><HardHat size={20} {...ICON} /></span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Add worker</h3>
              <p className="text-sm text-slate-500 mt-0.5">They’ll get their login details by email.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1 custom-scroll space-y-6">
          <div>
            <Legend icon={Users}>Personal information</Legend>
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-6 sm:col-span-3"><label className={lbl}>First name{req}</label><input className={inp} value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="Juan" autoFocus /></div>
              <div className="col-span-6 sm:col-span-3"><label className={lbl}>Middle name{opt}</label><input className={inp} value={form.middle_name} onChange={e => f('middle_name', e.target.value)} placeholder="Santos" /></div>
              <div className="col-span-4"><label className={lbl}>Last name{req}</label><input className={inp} value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Dela Cruz" /></div>
              <div className="col-span-2"><label className={lbl}>Suffix{opt}</label><input className={inp} value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="Jr." /></div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <Legend icon={Phone}>Contact</Legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Mobile number{req}</label>
                <div className="relative">
                  <Smartphone size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input className={`${inp} pl-9`} value={form.mobile} maxLength={13} placeholder="+639XXXXXXXXX" inputMode="tel"
                    onChange={e => {
                      let val = e.target.value
                      if (!val.startsWith('+63')) val = '+63'
                      let digits = val.slice(3).replace(/\D/g, '')
                      if (digits.startsWith('0')) digits = digits.slice(1)
                      f('mobile', '+63' + digits.slice(0, 10))
                    }} />
                </div>
              </div>
              <div>
                <label className={lbl}>Phone{opt}</label>
                <div className="relative">
                  <Phone size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input className={`${inp} pl-9`} value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="02 XXXX XXXX" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Email address{req}</label>
                <div className="relative">
                  <Mail size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="email" className={`${inp} pl-9`} value={form.email} onChange={e => f('email', e.target.value)} placeholder="name@example.com" />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Login details are sent to this address.</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div>
            <Legend icon={Wrench}>Account and work</Legend>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Username{req}</label>
                <input className={inp} value={form.username} onChange={e => f('username', e.target.value)} placeholder="juan_delacruz" />
                {usernameSuggestions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-1.5">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {usernameSuggestions.map((s, i) => (
                        <button key={i} type="button" onClick={() => f('username', s)}
                          className="h-7 px-2.5 text-xs bg-white border border-slate-200 text-slate-700 rounded-full hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Specialization{req}</label>
                  <div className="relative">
                    <select className={`${inp} appearance-none pr-9 cursor-pointer`} value={form.specialization_id} onChange={e => f('specialization_id', e.target.value)}>
                      <option value="">Select a specialization</option>
                      {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <Chev />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <div className="relative">
                    <select className={`${inp} appearance-none pr-9 cursor-pointer`} value={form.status_id} onChange={e => f('status_id', e.target.value)}>
                      {WORKER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <Chev />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="hidden sm:block text-xs text-slate-500"><span className="text-red-500">*</span> Required fields</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onClose} disabled={saving} className={`${btnSecondary} flex-1 sm:flex-none`}>Cancel</button>
            <button onClick={onSubmit} disabled={saving} className={`${btnPrimary} flex-1 sm:flex-none`}>
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} {...ICON} />}
              {saving ? 'Adding…' : 'Add worker'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}