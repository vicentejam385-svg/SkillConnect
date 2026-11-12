// src/pages/dashboards/superadmin/AuditLogsPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Download, RefreshCw, X, Eye, Lock, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, AlertCircle, ScrollText, ArrowRight, Clock, Layers, Target,
  User, FileText, CheckCircle2, XCircle,
} from 'lucide-react'
import api, { apiGet } from '../../../utils/api'

const ENDPOINT = '/api/audit-logs/index.php'
const ICON = { strokeWidth: 1.75 }

const ACTIONS = [
  'PASSWORD_CHANGE', 'PASSWORD_RESET',
  'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ROLE_CHANGE', 'ACCESS_DENIED', 'EXPORT',
]
const MODULES = [
  'Auth', 'Admin Users', 'Workers Access', 'Client Access',
  'Inquiries', 'Job Orders', 'Schedules', 'Licenses', 'System',
]

// ── Local styles (same as the admin pages) ─────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3 {
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

const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
const rowBtn = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap'

// ── Helpers ────────────────────────────────────────────────────
const ROLE_LABEL = { superadmin: 'Super admin', super_admin: 'Super admin', admin: 'Admin', worker: 'Worker', client: 'Client', guest: 'Guest' }

const ACTION_TONE = {
  LOGIN: 'slate', LOGOUT: 'slate',
  LOGIN_FAILED: 'red', ACCESS_DENIED: 'red', DELETE: 'red',
  CREATE: 'emerald',
  UPDATE: 'sky', STATUS_CHANGE: 'sky',
  ROLE_CHANGE: 'violet',
  PASSWORD_CHANGE: 'amber', PASSWORD_RESET: 'amber',
  EXPORT: 'teal',
}
const TONES = {
  slate:   ['bg-slate-50 text-slate-700 ring-slate-200',       'bg-slate-400'],
  red:     ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  emerald: ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  sky:     ['bg-sky-50 text-sky-700 ring-sky-200',             'bg-sky-500'],
  violet:  ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  amber:   ['bg-amber-50 text-amber-800 ring-amber-200',       'bg-amber-500'],
  teal:    ['bg-teal-50 text-teal-700 ring-teal-200',          'bg-teal-500'],
}

const prettyAction = (s = '') => {
  const t = s.split('_').map(w => w.toLowerCase()).join(' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const prettyField = (s = '') => { const t = s.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1) }
const isEmpty = v => v === null || v === undefined || v === ''
const valueText = v => isEmpty(v) ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

function parseDT(s) { if (!s) return null; const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? null : d }
function fmtDate(s) {
  const d = parseDT(s)
  return d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}
function fmtTime(s) {
  const d = parseDT(s)
  return d ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : ''
}
function timeAgo(s) {
  const d = parseDT(s); if (!d) return ''
  const sec = Math.floor((Date.now() - d) / 1000)
  if (sec < 60) return 'just now'
  const m = Math.floor(sec / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`
  return fmtDate(s)
}

// Turns old_values / new_values into a list of { field, old, new }
function getChanges(log) {
  const parse = v => {
    if (!v) return null
    if (typeof v === 'object') return v
    try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : null } catch { return null }
  }
  const oldV = parse(log.old_values), newV = parse(log.new_values)
  const keys = Array.from(new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]))
  return keys.map(k => ({ field: k, old: oldV?.[k], new: newV?.[k] }))
}
const MAX_FIELDS = 3

// ── Small pieces ───────────────────────────────────────────────
const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]
function Avatar({ name, size = 'w-9 h-9', text = 'text-xs' }) {
  const ini = (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[((name || '?').charCodeAt(0) || 0) % AVATAR_TONES.length]}`}>{ini}</div>
}

function ActionBadge({ action }) {
  const [cls, dot] = TONES[ACTION_TONE[action] || 'slate']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{prettyAction(action)}
    </span>
  )
}

function ResultBadge({ status }) {
  const failed = status === 'failed'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${failed ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
      {failed ? <XCircle size={12} {...ICON} /> : <CheckCircle2 size={12} {...ICON} />}
      {failed ? 'Failed' : 'Success'}
    </span>
  )
}

function ValueChip({ value, tone }) {
  if (isEmpty(value)) return <span className="text-slate-300">—</span>
  const text = valueText(value)
  return (
    <span title={text} className={`inline-block max-w-[150px] truncate align-middle rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset
      ${tone === 'old' ? 'bg-red-50 text-red-700 ring-red-100 line-through decoration-red-300' : 'bg-emerald-50 text-emerald-800 ring-emerald-100'}`}>
      {text}
    </span>
  )
}

function ChangeList({ log, onMore }) {
  const all = getChanges(log)
  if (!all.length) return <span className="text-slate-400 text-sm">{log.description || 'No field changes'}</span>
  const shown = all.slice(0, MAX_FIELDS)
  const extra = all.length - shown.length
  return (
    <div className="space-y-1.5 min-w-0">
      {shown.map(c => (
        <div key={c.field} className="flex items-center gap-1.5 text-xs min-w-0">
          <span className="font-medium text-slate-700 whitespace-nowrap">{prettyField(c.field)}</span>
          <ValueChip value={c.old} tone="old" />
          <ArrowRight size={12} {...ICON} className="text-slate-400 flex-shrink-0" />
          <ValueChip value={c.new} tone="new" />
        </div>
      ))}
      {extra > 0 && <button onClick={onMore} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">+{extra} more</button>}
    </div>
  )
}

function SelectBox({ value, onChange, children, className = '', label }) {
  return (
    <div className={`relative ${className}`}>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
        className="appearance-none w-full h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer">
        {children}
      </select>
      <ChevronDown size={14} {...ICON} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

// ── Pagination (server-side) ───────────────────────────────────
function Pagination({ page, pages, total, perPage, onPage, onPerPage }) {
  const totalPages = Math.max(1, pages || 1)
  const from = total ? (page - 1) * perPage + 1 : 0
  const to = Math.min(page * perPage, total)
  const list = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) list.push(i)
    else if (list[list.length - 1] !== '…') list.push('…')
  }
  const cell = 'h-8 min-w-[32px] px-2 inline-flex items-center justify-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 disabled:text-slate-300 disabled:cursor-not-allowed'
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows per page</span>
          <SelectBox value={perPage} onChange={v => onPerPage(Number(v))} className="w-[76px]" label="Rows per page">
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </SelectBox>
        </label>
        <span className="tabular-nums"><span className="font-medium text-slate-800">{from}–{to}</span> of <span className="font-medium text-slate-800">{total.toLocaleString()}</span></span>
      </div>
      <nav aria-label="Pagination" className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page"><ChevronsLeft size={16} {...ICON} /></button>
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} {...ICON} /></button>
        <span className={`${cell} sm:hidden text-slate-600 px-3`}>Page {page} of {totalPages}</span>
        {list.map((p, i) => p === '…'
          ? <span key={`e${i}`} className={`${cell} hidden sm:inline-flex text-slate-400`}>…</span>
          : <button key={p} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined}
              className={`${cell} hidden sm:inline-flex tabular-nums ${p === page ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>{p}</button>
        )}
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page"><ChevronRight size={16} {...ICON} /></button>
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(totalPages)} disabled={page >= totalPages} aria-label="Last page"><ChevronsRight size={16} {...ICON} /></button>
      </nav>
    </div>
  )
}

// ── Log details modal ──────────────────────────────────────────
function DetailModal({ log, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const changes = getChanges(log)
  const rows = [
    { icon: Clock,    label: 'When',        value: `${fmtDate(log.created_at)} at ${fmtTime(log.created_at)}` },
    { icon: Layers,   label: 'Module',      value: log.module },
    { icon: FileText, label: 'Description', value: log.description },
    { icon: Target,   label: 'Target',      value: log.target_label ? `${log.target_label}${log.target_type ? ` (${log.target_type})` : ''}` : null },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><ScrollText size={20} {...ICON} /></span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">Log details</h3>
              <p className="text-sm text-slate-500 mt-0.5 tabular-nums">{log.log_code}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll px-6 py-5 space-y-5">
          {/* Who + what */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <Avatar name={log.actor_name} size="w-11 h-11" text="text-sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{log.actor_name || 'Unknown user'}</p>
              <p className="text-xs text-slate-500">{ROLE_LABEL[log.actor_type] ?? log.actor_type ?? '—'}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <ActionBadge action={log.action} />
              <ResultBadge status={log.status} />
            </div>
          </div>

          <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 px-4 py-3">
                <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm text-slate-900 mt-0.5 break-words">{value || <span className="text-slate-400">—</span>}</dd>
                </div>
              </div>
            ))}
          </dl>

          {changes.length > 0 && (
            <section>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Changes <span className="font-normal text-slate-500">· {changes.length} field{changes.length !== 1 ? 's' : ''}</span></h4>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Before</th>
                      <th className="px-3 py-2 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {changes.map(c => (
                      <tr key={c.field}>
                        <td className="px-3 py-2.5 font-medium text-slate-700 align-top whitespace-nowrap">{prettyField(c.field)}</td>
                        <td className="px-3 py-2.5 align-top text-red-700 bg-red-50/40 break-words">{valueText(c.old)}</td>
                        <td className="px-3 py-2.5 align-top text-emerald-800 bg-emerald-50/40 break-words">{valueText(c.new)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Lock size={12} {...ICON} />Read-only record</p>
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
const EMPTY_FILTERS = { q: '', action: '', module: '', status: '' }

export default function AuditLogsPage() {
  const [group]                     = useState('all')
  const [search, setSearch]         = useState('')
  const [filters, setFilters]       = useState(EMPTY_FILTERS)
  const [page, setPage]             = useState(1)
  const [perPage, setPerPage]       = useState(20)
  const [rows, setRows]             = useState([])
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [selected, setSelected]     = useState(null)
  const [exporting, setExporting]   = useState(false)
  const reqId = useRef(0)

  // Debounce the search box so we don't hit the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => (f.q === search.trim() ? f : { ...f, q: search.trim() }))
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const buildParams = useCallback(() => {
    const p = { group, ...filters }
    Object.keys(p).forEach(k => { if (p[k] === '' || p[k] == null) delete p[k] })
    return p
  }, [group, filters])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    setError('')
    try {
      const res = await apiGet(ENDPOINT, { ...buildParams(), page, per_page: perPage })
      if (id !== reqId.current) return
      if (!res?.success) throw new Error(res?.error || 'Failed to load audit logs.')
      setRows(res.data.rows)
      setPagination(res.data.pagination)
    } catch (err) {
      if (id !== reqId.current) return
      setError(err?.response?.data?.error || err.message || 'Failed to load audit logs.')
      setRows([])
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [buildParams, page, perPage])

  useEffect(() => { load() }, [load])

  const updateFilter = (key, value) => { setFilters(f => ({ ...f, [key]: value })); setPage(1) }
  const clearFilters = () => { setSearch(''); setFilters(EMPTY_FILTERS); setPage(1) }
  const hasFilters = Object.values(filters).some(Boolean) || search !== ''

  const exportCsv = async () => {
    setExporting(true)
    setError('')
    try {
      const res = await api.get(ENDPOINT, { params: { ...buildParams(), export: 'csv' }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      a.href = url
      a.download = `audit_logs_${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      load() // the export itself is logged, so refresh to show it
    } catch {
      setError('Export failed. Try again.')
    } finally {
      setExporting(false)
    }
  }

  const closeDetail = useCallback(() => setSelected(null), [])
  const showSkeleton = loading && rows.length === 0

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Audit logs</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Lock size={13} {...ICON} className="flex-shrink-0" />
            A permanent, read-only record of activity. Entries can’t be edited or deleted.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={load} disabled={loading} className={btnSecondary}>
            <RefreshCw size={15} {...ICON} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={exportCsv} disabled={exporting} className={btnPrimary}>
            <Download size={15} {...ICON} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          <AlertCircle size={16} {...ICON} className="flex-shrink-0 mt-0.5 text-red-500" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="font-medium underline underline-offset-2">Try again</button>
        </div>
      )}

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Filters */}
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-2 border-b border-slate-100">
          <div className="relative flex-1 lg:max-w-sm">
            <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search user, description, target or log ID"
              className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
          </div>
          <div className="grid grid-cols-3 lg:flex gap-2 lg:ml-auto">
            <SelectBox value={filters.action} onChange={v => updateFilter('action', v)} className="lg:w-40" label="Action">
              <option value="">All actions</option>
              {ACTIONS.map(a => <option key={a} value={a}>{prettyAction(a)}</option>)}
            </SelectBox>
            <SelectBox value={filters.module} onChange={v => updateFilter('module', v)} className="lg:w-40" label="Module">
              <option value="">All modules</option>
              {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
            </SelectBox>
            <SelectBox value={filters.status} onChange={v => updateFilter('status', v)} className="lg:w-36" label="Result">
              <option value="">All results</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </SelectBox>
          </div>
        </div>

        {hasFilters && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{loading ? 'Searching…' : `${pagination.total.toLocaleString()} result${pagination.total !== 1 ? 's' : ''}`}</span>
            <button onClick={clearFilters} className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800">Clear all</button>
          </div>
        )}

        {showSkeleton ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="w-40 space-y-2"><Skel className="h-3 w-28" /><Skel className="h-2.5 w-16" /></div>
                <Skel className="h-5 w-24 rounded-md" />
                <Skel className="hidden md:block h-3 w-56 ml-4" />
                <Skel className="h-3 w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          !error && (
            <div className="py-16 flex flex-col items-center justify-center text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center">
                {hasFilters ? <Search size={22} {...ICON} /> : <ScrollText size={22} {...ICON} />}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">{hasFilters ? 'No logs match your filters' : 'No activity yet'}</p>
              <p className="text-sm text-slate-500 mt-1 max-w-[300px]">{hasFilters ? 'Try a different search, action, module or result.' : 'Actions across SkillConnect will be recorded here.'}</p>
              {hasFilters && <button onClick={clearFilters} className={`${btnSecondary} mt-4`}>Clear filters</button>}
            </div>
          )
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {/* Mobile */}
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((r, i) => (
                <li key={r.id} className="sc-rise px-4 py-4" style={{ animationDelay: `${i * 20}ms` }}>
                  <div className="flex items-center gap-3">
                    <Avatar name={r.actor_name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.actor_name}</p>
                      <p className="text-xs text-slate-500">{ROLE_LABEL[r.actor_type] ?? r.actor_type} · {timeAgo(r.created_at)}</p>
                    </div>
                    <button onClick={() => setSelected(r)} className={rowBtn}><Eye size={14} {...ICON} /> View</button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <ActionBadge action={r.action} />
                    <span className="text-xs text-slate-500">{r.module}</span>
                    {r.status === 'failed' && <ResultBadge status="failed" />}
                  </div>
                  <div className="mt-3"><ChangeList log={r} onMore={() => setSelected(r)} /></div>
                </li>
              ))}
            </ul>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">User</th>
                    <th className="px-5 py-2.5 font-medium">Action</th>
                    <th className="px-5 py-2.5 font-medium">Changes</th>
                    <th className="px-5 py-2.5 font-medium">When</th>
                    <th className="px-5 py-2.5 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={r.id} className="sc-rise hover:bg-slate-50/70 transition-colors align-top" style={{ animationDelay: `${i * 15}ms` }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.actor_name} />
                          <span className="min-w-0">
                            <span className="block font-medium text-slate-900 whitespace-nowrap">{r.actor_name}</span>
                            <span className="block text-xs text-slate-500">{ROLE_LABEL[r.actor_type] ?? r.actor_type}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <ActionBadge action={r.action} />
                          <span className="text-xs text-slate-500">{r.module}</span>
                          {r.status === 'failed' && <ResultBadge status="failed" />}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 max-w-[420px]"><ChangeList log={r} onMore={() => setSelected(r)} /></td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-slate-700 tabular-nums">{fmtDate(r.created_at)}</p>
                        <p className="text-xs text-slate-500 tabular-nums">{fmtTime(r.created_at)} · {r.log_code}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setSelected(r)} className={rowBtn}><Eye size={14} {...ICON} /> View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            perPage={pagination.per_page || perPage}
            onPage={p => setPage(Math.min(Math.max(1, p), Math.max(1, pagination.pages)))}
            onPerPage={n => { setPerPage(n); setPage(1) }}
          />
        )}
      </section>

      {selected && <DetailModal log={selected} onClose={closeDetail} />}
    </div>
  )
}