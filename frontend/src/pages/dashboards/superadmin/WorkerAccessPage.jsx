import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search, KeyRound, X, Loader2, CheckCircle2, AlertCircle, Check, Copy, Eye, EyeOff, RefreshCw,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown,
  Users, HardHat, Wrench, MapPin,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

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

// ── Avatar & status ────────────────────────────────────────────
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

const STATUS = {
  'Active':       ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Inactive':     ['bg-gray-50 text-gray-600 ring-gray-200',          'bg-gray-400'],
  'Suspended':    ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'Blacklisted':  ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'On Leave':     ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
}
const dotFor = s => (STATUS[s] || [null, 'bg-gray-400'])[1]
function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type !== 'error'
  return (
    <div className="sc-pop fixed top-6 right-6 z-[80] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700 max-w-sm">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 size={16} {...ICON} /> : <AlertCircle size={16} {...ICON} />}
      </span>
      {toast.msg}
    </div>
  )
}

// ── Status dropdown (same as the admin pages) ──────────────────
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
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={`w-full h-9 pl-3 pr-2.5 flex items-center gap-2 rounded-lg border bg-white shadow-sm text-sm text-left transition-colors focus-visible:outline-none
          ${open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
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
                <button type="button" role="option" aria-selected={on} onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full h-9 px-2.5 flex items-center gap-2.5 rounded-lg text-sm text-left transition-colors ${on ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}>
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

// ── Reset password modal ───────────────────────────────────────
function makePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower = 'abcdefghijkmnpqrstuvwxyz', digits = '23456789', special = '@#$!%*?&'
  const all = upper + lower + digits + special
  const pick = s => s[Math.floor(Math.random() * s.length)]
  return [pick(upper), pick(lower), pick(digits), pick(special), ...Array.from({ length: 8 }, () => pick(all))]
    .sort(() => Math.random() - 0.5).join('')
}

function ResetPasswordModal({ person, subtitle, onClose, onReset }) {
  const [password, setPassword] = useState(makePassword)
  const [show, setShow]         = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && !saving && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, saving])

  const tooShort = password.length < 8
  const copy = () => { navigator.clipboard?.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  const submit = async () => {
    if (tooShort || saving) return
    setSaving(true); setError('')
    try { await onReset(password); setDone(true) }
    catch (err) { setError(err?.response?.data?.error || err?.message || 'Could not reset the password. Try again.') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => !saving && onClose()} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-4 min-w-0">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><KeyRound size={20} {...ICON} /></span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">{done ? 'Password reset' : 'Reset password'}</h3>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{person}{subtitle ? ` · ${subtitle}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
              <AlertCircle size={16} {...ICON} className="flex-shrink-0 mt-0.5 text-red-500" />{error}
            </div>
          )}

          {done ? (
            <>
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
                <CheckCircle2 size={16} {...ICON} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                <p>The new password is active. Share it with {person} securely; it won’t be shown again.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 h-11">
                <code className="flex-1 font-mono text-sm text-slate-900 tracking-wide truncate">{password}</code>
                <button onClick={copy} className={iconBtn} aria-label="Copy password" title={copied ? 'Copied' : 'Copy'}>
                  {copied ? <Check size={16} {...ICON} className="text-emerald-600" /> : <Copy size={16} {...ICON} />}
                </button>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    className={`w-full h-10 pl-3 pr-10 text-sm font-mono rounded-lg bg-white text-slate-900 shadow-sm focus:outline-none focus:ring-2 transition-colors
                      ${tooShort && password ? 'border border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20'}`}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-700">
                    {show ? <EyeOff size={16} {...ICON} /> : <Eye size={16} {...ICON} />}
                  </button>
                </div>
                <button type="button" onClick={() => { setPassword(makePassword()); setError('') }} className={btnSecondary} title="Generate a new password">
                  <RefreshCw size={15} {...ICON} /> Generate
                </button>
              </div>
              <p className={`text-xs mt-1.5 ${tooShort && password ? 'text-red-600' : 'text-slate-500'}`}>
                {tooShort ? 'Use at least 8 characters.' : 'A strong password is filled in for you. You can change it.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          {done ? (
            <button onClick={onClose} className={btnPrimary}>Done</button>
          ) : (
            <>
              <button onClick={onClose} disabled={saving} className={btnSecondary}>Cancel</button>
              <button onClick={submit} disabled={saving || tooShort} className={btnPrimary}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} {...ICON} />}
                {saving ? 'Resetting…' : 'Reset password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Worker Access Page ─────────────────────────────────────────
export default function WorkerAccessPage() {
  const [workers,      setWorkers]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sort,         setSort]         = useState({ key: 'full_name', dir: 'asc' })
  const [page,         setPage]         = useState(1)
  const [perPage,      setPerPage]      = useState(10)
  const [resetFor,     setResetFor]     = useState(null)
  const [toast,        setToast]        = useState(null)
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    try { const d = await apiGet('/api/workers/list.php'); setWorkers(d.workers || []) }
    catch { showToast('Failed to load workers.', 'error') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [search, filterStatus, perPage])

  const statuses = useMemo(() => {
    const m = {}
    workers.forEach(w => { if (w.status) m[w.status] = (m[w.status] || 0) + 1 })
    return m
  }, [workers])

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase()
    const list = workers.filter(w =>
      (!filterStatus || w.status === filterStatus) &&
      (!t || [w.full_name, w.username, w.worker_code, w.specialization].some(v => String(v || '').toLowerCase().includes(t)))
    )
    const val = w => String(w[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => { const r = val(a).localeCompare(val(b), undefined, { numeric: true }); return sort.dir === 'asc' ? r : -r })
  }, [workers, search, filterStatus, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus
  const closeReset = useCallback(() => setResetFor(null), [])

  const resetBtn = w => (
    <button onClick={() => setResetFor(w)} className={rowBtn}><KeyRound size={14} {...ICON} /> Reset password</button>
  )

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Worker access</h1>
        <p className="text-sm text-slate-500 mt-1">Workers who sign in to the worker portal. Reset a password when someone is locked out.</p>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-100">
          <StatusDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            loading={loading}
            options={[
              { value: '', label: 'All statuses', count: workers.length },
              ...Object.keys(statuses).sort().map(s => ({ value: s, label: s, count: statuses[s], dot: dotFor(s) })),
            ]}
          />
          <div className="flex flex-1 items-center gap-2 sm:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search name, username or ID" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skel className="h-3 w-40" /><Skel className="h-2.5 w-24" /></div>
                <Skel className="hidden md:block h-5 w-28 rounded-md" />
                <Skel className="h-8 w-32 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center">
              {hasFilters ? <Search size={22} {...ICON} /> : <HardHat size={22} {...ICON} />}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">{hasFilters ? 'No matching workers' : 'No workers yet'}</p>
            <p className="text-sm text-slate-500 mt-1 max-w-[300px]">{hasFilters ? 'Try a different search or status.' : 'Workers added by admins will show up here.'}</p>
            {hasFilters && <button onClick={() => { setSearch(''); setFilterStatus('') }} className={`${btnSecondary} mt-4`}>Clear filters</button>}
          </div>
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((w, i) => (
                <li key={w.id} className="sc-rise px-4 py-3.5 flex items-start gap-3" style={{ animationDelay: `${i * 30}ms` }}>
                  <Avatar name={w.full_name} size="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{w.full_name}</p>
                      <StatusBadge status={w.status} />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{w.worker_code} · {w.username ? `@${w.username}` : 'No username'}</p>
                    <div className="mt-2">{resetBtn(w)}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Worker"         sortKey="full_name"      sort={sort} onSort={onSort} />
                    <SortHeader label="Username"       sortKey="username"       sort={sort} onSort={onSort} />
                    <SortHeader label="Specialization" sortKey="specialization" sort={sort} onSort={onSort} />
                    <SortHeader label="Status"         sortKey="status"         sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((w, i) => (
                    <tr key={w.id} className="sc-rise hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={w.full_name} />
                          <span>
                            <span className="block font-medium text-slate-900 whitespace-nowrap">{w.full_name}</span>
                            <span className="block text-xs text-slate-500 tabular-nums">{w.worker_code}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{w.username ? `@${w.username}` : <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-3">
                        {w.specialization
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium whitespace-nowrap"><Wrench size={12} {...ICON} className="text-slate-400" />{w.specialization}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                      <td className="px-5 py-3 text-right">{resetBtn(w)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
          </>
        )}
      </section>

      {resetFor && (
        <ResetPasswordModal
          person={resetFor.full_name}
          subtitle={resetFor.username ? `@${resetFor.username}` : resetFor.worker_code}
          onClose={closeReset}
          onReset={async (pwd) => {
            await apiPost('/api/workers/reset-password.php', { worker_id: resetFor.id, password: pwd })
            showToast(`Password reset for ${resetFor.full_name}`)
          }}
        />
      )}
    </div>
  )
}