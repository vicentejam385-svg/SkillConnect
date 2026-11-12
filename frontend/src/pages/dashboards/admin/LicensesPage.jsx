import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, FileText, Eye, X, CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX,
  Shield, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, ArrowUp, ArrowDown, ArrowUpDown,
  Sparkles, Loader2, ExternalLink, CalendarClock, FileImage, FileCheck2,
} from 'lucide-react'
import { apiGet } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }
const API = 'https://saddlebrown-swan-877763.hostingersite.com/backend/api'

// ── Auth headers / fetch ───────────────────────────────────────
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JSON.parse(localStorage.getItem('sc_user') || 'null')?.token}`,
})
const authFetch = (url, opts = {}) => fetch(url, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } })

// Loads a license file through fetch-image.php and returns a temporary link to it
async function loadLicenseFile(path) {
  const res  = await authFetch(`${API}/licenses/fetch-image.php?path=${encodeURIComponent(path)}`)
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

function useEscapeAndLock(onClose) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
}

// ── Expiry helpers (same rules as before) ──────────────────────
const isExpired = d => !!d && new Date(d) < new Date()
const isExpiringSoon = d => { if (!d) return false; const diff = new Date(d) - new Date(); return diff > 0 && diff < 30 * 86400000 }
const stateOf = l => !l.expiry_date ? 'none' : isExpired(l.expiry_date) ? 'expired' : isExpiringSoon(l.expiry_date) ? 'expiring' : 'valid'

const STATE = {
  valid:    { label: 'Valid',         cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: ShieldCheck, text: 'text-slate-700' },
  expiring: { label: 'Expiring soon', cls: 'bg-amber-50 text-amber-700 ring-amber-200',       icon: ShieldAlert, text: 'text-amber-700' },
  expired:  { label: 'Expired',       cls: 'bg-red-50 text-red-700 ring-red-200',             icon: ShieldX,     text: 'text-red-600' },
  none:     { label: 'No expiry',     cls: 'bg-slate-50 text-slate-600 ring-slate-200',       icon: Shield,      text: 'text-slate-400' },
}

const fmtDate = s => { if (!s) return '—'; const d = new Date(String(s).slice(0, 10) + 'T00:00'); return isNaN(d) ? s : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
function relExpiry(s) {
  if (!s) return ''
  const days = Math.round((new Date(String(s).slice(0, 10) + 'T00:00') - new Date(new Date().toDateString())) / 86400000)
  if (days === 0) return 'Expires today'
  if (days > 0) return days < 60 ? `In ${days} day${days === 1 ? '' : 's'}` : days < 365 ? `In ${Math.round(days / 30)} months` : `In ${(days / 365).toFixed(1).replace('.0', '')} years`
  const ago = -days
  return ago < 60 ? `${ago} day${ago === 1 ? '' : 's'} ago` : ago < 365 ? `${Math.round(ago / 30)} months ago` : `${(ago / 365).toFixed(1).replace('.0', '')} years ago`
}

// ── Shared bits (same as the other pages) ──────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]
function Avatar({ name, size = 'w-8 h-8', text = 'text-[11px]' }) {
  const ini = (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[((name || '?').charCodeAt(0) || 0) % AVATAR_TONES.length]}`}>{ini}</div>
}

function StateBadge({ state }) {
  const s = STATE[state]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${s.cls}`}>
      <s.icon size={12} {...ICON} />{s.label}
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

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40 disabled:pointer-events-none'

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

function MiniStat({ icon: Icon, label, value, tone, loading, delay, footer }) {
  return (
    <div className="sc-rise bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex flex-col" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3.5">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={18} {...ICON} /></span>
        <div className="min-w-0">
          {loading ? <Skel className="h-6 w-10" /> : <p className="text-2xl font-semibold text-slate-900 leading-none tabular-nums">{value}</p>}
          <p className="text-sm text-slate-500 mt-1 truncate">{label}</p>
        </div>
      </div>
      <div className="mt-3 min-h-[20px]">{loading ? <Skel className="h-3 w-28" /> : footer}</div>
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex p-1 rounded-lg bg-slate-100 gap-0.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {o.dot && <span className={`w-1.5 h-1.5 rounded-full ${o.dot}`} />}
          {o.label}
          {o.count != null && <span className={`text-xs tabular-nums ${value === o.value ? 'text-emerald-700' : 'text-slate-400'}`}>{o.count}</span>}
        </button>
      ))}
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

// ── File viewer ────────────────────────────────────────────────
function FileViewer({ file, onClose }) {
  useEscapeAndLock(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col overflow-hidden max-h-[92vh]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><FileImage size={18} {...ICON} /></span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-slate-900 truncate">{file.name}</p>
              <p className="text-sm text-slate-500 truncate">{file.worker}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {file.url && <a href={file.url} target="_blank" rel="noreferrer" className={iconBtn} title="Open in new tab" aria-label="Open in new tab"><ExternalLink size={16} {...ICON} /></a>}
            <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 min-h-[320px] sm:min-h-[440px] flex">
          {file.loading ? (
            <div className="m-auto flex flex-col items-center gap-3 py-20">
              <Loader2 size={22} className="animate-spin text-emerald-600" />
              <p className="text-sm text-slate-500">Loading file…</p>
            </div>
          ) : file.type?.startsWith('image/') ? (
            <div className="m-auto p-4 sm:p-6"><img src={file.url} alt={file.name} className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-sm bg-white" /></div>
          ) : file.type === 'application/pdf' ? (
            <iframe src={file.url} title={file.name} className="w-full min-h-[520px] border-0" />
          ) : (
            <div className="m-auto flex flex-col items-center gap-3 py-16">
              <FileText size={28} {...ICON} className="text-slate-400" />
              <p className="text-sm text-slate-500">Preview isn’t available for this file type.</p>
              {file.url && <a href={file.url} target="_blank" rel="noreferrer" className={btnSecondary}><ExternalLink size={15} {...ICON} /> Open file</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Scan result ────────────────────────────────────────────────
function ScanResultModal({ result, license, onClose }) {
  useEscapeAndLock(onClose)
  const found = result.data.is_valid
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-xl bg-violet-50 ring-1 ring-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0"><Sparkles size={20} {...ICON} /></span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">AI scan result</h3>
              <p className="text-sm text-slate-500 mt-0.5">{license ? `${license.document_name} · ${license.worker_name || license.contact_name || ''}` : 'Read from the license document'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${found ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
            <span className={`w-11 h-11 rounded-lg bg-white border flex items-center justify-center flex-shrink-0 ${found ? 'border-emerald-200 text-emerald-600' : 'border-amber-200 text-amber-600'}`}>
              {found ? <CalendarClock size={20} {...ICON} /> : <AlertTriangle size={20} {...ICON} />}
            </span>
            <div>
              <p className={`text-xs ${found ? 'text-emerald-700' : 'text-amber-700'}`}>{found ? 'Expiry date found' : 'No expiry date found'}</p>
              <p className="text-lg font-semibold text-slate-900">{found ? fmtDate(result.data.expiry_date) : 'Check the document manually'}</p>
              {found && <p className="text-xs text-slate-500">{relExpiry(result.data.expiry_date)}</p>}
            </div>
          </div>
          <p className="text-sm text-slate-600">{found ? 'The license’s expiry date was updated from the scan.' : 'The scan couldn’t read an expiry date from this file, so nothing was changed.'}</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button onClick={onClose} className={btnPrimary}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Licenses Page ──────────────────────────────────────────────
export default function LicensesPage() {
  const [licenses,     setLicenses]     = useState([])
  const [contacts,     setContacts]     = useState([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDoc,    setFilterDoc]    = useState('')
  const [sort,         setSort]         = useState({ key: 'expiry_date', dir: 'asc' })
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [viewFile,     setViewFile]     = useState(null)
  const [scanningId,   setScanningId]   = useState(null)
  const [scanResult,   setScanResult]   = useState(null)
  const [page,         setPage]         = useState(1)
  const [perPage,      setPerPage]      = useState(10)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lData, cData] = await Promise.all([
        apiGet('/api/licenses/list.php', { per_page: 500 }),
        apiGet('/api/contacts/list.php', { per_page: 500 }),
      ])
      setLicenses(lData.licenses || [])
      setContacts(cData.contacts || [])
    } catch { showToast('Failed to load licenses.', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, filterStatus, filterDoc, perPage])

  const openFile = async (l) => {
    const worker = l.worker_name || l.contact_name
    setViewFile({ loading: true, name: l.document_name, worker })
    try {
      const file = await loadLicenseFile(l.file_path)
      setViewFile({ ...file, name: l.document_name, worker })
    } catch (err) {
      setViewFile(null)
      showToast('Could not open file: ' + err.message, 'error')
    }
  }

  useEffect(() => () => { if (viewFile?.url?.startsWith('blob:')) URL.revokeObjectURL(viewFile.url) }, [viewFile])

  // ── AI scan (unchanged requests)
  const handleAiScan = async (license) => {
    setScanningId(license.id)
    setScanResult(null)
    try {
      const proxyResp = await authFetch(`${API}/licenses/fetch-image.php?path=${encodeURIComponent(license.file_path)}`)
      const proxyData = await proxyResp.json()
      if (!proxyData.success) throw new Error(proxyData.error || 'Failed to fetch image')

      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const scanResp = await fetch(`${API}/licenses/scan.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image: proxyData.base64, mime_type: proxyData.media_type || 'image/jpeg' }),
      })
      const scanData = await scanResp.json()
      if (!scanData.success) throw new Error(scanData.error || 'Scan failed')

      await fetch(`${API}/licenses/update.php`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          id: license.id,
          ai_scan_result: JSON.stringify({ expiry_date: scanData.expiry_date }),
          expiry_date: scanData.expiry_date || license.expiry_date,
        }),
      })

      setScanResult({
        licenseId: license.id,
        data: { expiry_date: scanData.expiry_date || '—', is_valid: !!scanData.expiry_date },
      })
      showToast('AI scan complete')
      load()
    } catch (err) {
      showToast('AI scan failed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setScanningId(null)
    }
  }

  // ── Derived
  const rows = useMemo(() => licenses.map(l => ({ ...l, _state: stateOf(l), _name: l.worker_name || l.contact_name || '—' })), [licenses])

  const counts = useMemo(() => {
    const c = { all: rows.length, valid: 0, expiring: 0, expired: 0, none: 0 }
    rows.forEach(r => c[r._state]++)
    return c
  }, [rows])

  const docTypes = useMemo(() => [...new Set(rows.map(r => r.document_name).filter(Boolean))].sort(), [rows])
  const workersCovered = useMemo(() => new Set(rows.filter(r => r._state === 'valid').map(r => r.contact_id)).size, [rows])
  const totalWorkers = contacts.filter(c => c.type === 'worker').length
  const nextToExpire = useMemo(() => rows.filter(r => r._state === 'expiring').sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0], [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter(r =>
      (!filterStatus || r._state === filterStatus) &&
      (!filterDoc || r.document_name === filterDoc) &&
      (!q || [r._name, r.document_name, String(r.id)].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = r => sort.key === 'expiry_date' ? (r.expiry_date ? new Date(r.expiry_date).getTime() : Infinity)
      : sort.key === '_name' ? r._name.toLowerCase() : String(r[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => {
      const A = val(a), B = val(b)
      const r = typeof A === 'number' ? A - B : A.localeCompare(B)
      return sort.dir === 'asc' ? r : -r
    })
  }, [rows, search, filterStatus, filterDoc, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus || filterDoc
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterDoc('') }
  const validRate = counts.all ? Math.round((counts.valid / counts.all) * 100) : 0
  const statusLabel = { valid: 'Valid', expiring: 'Expiring soon', expired: 'Expired', none: 'No expiry' }

  const closeViewer = useCallback(() => setViewFile(null), [])
  const closeScan = useCallback(() => setScanResult(null), [])

  const actions = l => (
    <div className="flex items-center justify-end gap-0.5">
      <button
        onClick={() => handleAiScan(l)}
        disabled={!l.file_path || scanningId != null}
        title={l.file_path ? 'Read expiry date with AI' : 'No file to scan'}
        aria-label="Scan with AI"
        className={`${iconBtn} hover:text-violet-700 hover:bg-violet-50`}
      >
        {scanningId === l.id ? <Loader2 size={16} className="animate-spin text-violet-600" /> : <Sparkles size={16} {...ICON} />}
      </button>
      <button onClick={() => openFile(l)} disabled={!l.file_path} title={l.file_path ? 'View file' : 'No file attached'} aria-label="View file" className={iconBtn}>
        <Eye size={16} {...ICON} />
      </button>
    </div>
  )

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Licenses</h1>
        <p className="text-sm text-slate-500 mt-1">Worker licenses and certifications. Keep them current before assigning jobs.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MiniStat icon={FileCheck2} label="Total licenses" value={counts.all} tone="bg-slate-100 text-slate-600" loading={loading} delay={0}
          footer={<p className="text-xs text-slate-500"><span className="font-medium text-slate-700">{workersCovered}</span>{totalWorkers ? ` of ${totalWorkers}` : ''} workers covered</p>} />
        <MiniStat icon={ShieldCheck} label="Valid" value={counts.valid} tone="bg-emerald-50 text-emerald-600" loading={loading} delay={50}
          footer={
            <div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="sc-bar h-full bg-emerald-500" style={{ width: `${validRate}%` }} />
                <div className="sc-bar h-full bg-amber-400" style={{ width: `${counts.all ? (counts.expiring / counts.all) * 100 : 0}%` }} />
                <div className="sc-bar h-full bg-red-500" style={{ width: `${counts.all ? (counts.expired / counts.all) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">{validRate}% of all licenses</p>
            </div>
          } />
        <MiniStat icon={ShieldAlert} label="Expiring in 30 days" value={counts.expiring} tone="bg-amber-50 text-amber-600" loading={loading} delay={100}
          footer={nextToExpire
            ? <button onClick={() => setFilterStatus('expiring')} className="text-xs font-medium text-amber-700 hover:text-amber-800 truncate max-w-full">Next: {nextToExpire._name}, {relExpiry(nextToExpire.expiry_date).toLowerCase()} →</button>
            : <p className="text-xs text-slate-500">Nothing expiring soon</p>} />
        <MiniStat icon={ShieldX} label="Expired" value={counts.expired} tone="bg-red-50 text-red-600" loading={loading} delay={150}
          footer={counts.expired
            ? <button onClick={() => setFilterStatus('expired')} className="text-xs font-medium text-red-700 hover:text-red-800">Needs renewal →</button>
            : <p className="text-xs text-slate-500">No expired licenses</p>} />
      </div>

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
          <div className="overflow-x-auto -mx-1 px-1">
            <Segmented
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: '',         label: 'All',           count: loading ? null : counts.all },
                { value: 'valid',    label: 'Valid',         count: loading ? null : counts.valid,    dot: 'bg-emerald-500' },
                { value: 'expiring', label: 'Expiring soon', count: loading ? null : counts.expiring, dot: 'bg-amber-400' },
                { value: 'expired',  label: 'Expired',       count: loading ? null : counts.expired,  dot: 'bg-red-500' },
              ]}
            />
          </div>
          <div className="flex flex-1 items-center gap-2 lg:justify-end">
            <div className="relative flex-1 lg:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search worker or document" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
            </div>
            <SelectBox value={filterDoc} onChange={setFilterDoc} className="w-44 flex-shrink-0">
              <option value="">All documents</option>
              {docTypes.map(d => <option key={d} value={d}>{d}</option>)}
            </SelectBox>
          </div>
        </div>

        {hasFilters && !loading && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {search && <Chip onRemove={() => setSearch('')}>“{search}”</Chip>}
            {filterStatus && <Chip onRemove={() => setFilterStatus('')}>{statusLabel[filterStatus]}</Chip>}
            {filterDoc && <Chip onRemove={() => setFilterDoc('')}>{filterDoc}</Chip>}
            <button onClick={clearFilters} className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800">Clear all</button>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skel className="h-3 w-40" /><Skel className="h-2.5 w-24" /></div>
                <Skel className="hidden md:block h-3 w-28" />
                <Skel className="h-5 w-20 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters
            ? <EmptyState icon={Search} title="No matching licenses" text="Try a different search or remove a filter." action={<button onClick={clearFilters} className={btnSecondary}>Clear filters</button>} />
            : <EmptyState icon={FileText} title="No licenses yet" text="Licenses that workers upload will appear here." />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((l, i) => (
                <li key={l.id} className="sc-rise px-4 py-3.5 flex items-start gap-3" style={{ animationDelay: `${i * 30}ms` }}>
                  <Avatar name={l._name} size="w-10 h-10" text="text-xs" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{l._name}</p>
                      <StateBadge state={l._state} />
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-0.5">{l.document_name}</p>
                    <p className={`text-xs mt-0.5 ${STATE[l._state].text}`}>{l.expiry_date ? `${fmtDate(l.expiry_date)} · ${relExpiry(l.expiry_date)}` : 'No expiry date'}</p>
                  </div>
                  {actions(l)}
                </li>
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Worker"   sortKey="_name"         sort={sort} onSort={onSort} />
                    <SortHeader label="Document" sortKey="document_name" sort={sort} onSort={onSort} />
                    <SortHeader label="Expires"  sortKey="expiry_date"   sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((l, i) => (
                    <tr key={l.id} className="sc-rise group hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={l._name} size="w-9 h-9" text="text-xs" />
                          <span>
                            <span className="block font-medium text-slate-900 whitespace-nowrap">{l._name}</span>
                            <span className="block text-xs text-slate-500 tabular-nums">License #{l.id}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => l.file_path && openFile(l)} disabled={!l.file_path}
                          className="flex items-center gap-3 text-left rounded-md disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                          <span className="w-9 h-9 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-slate-500 flex items-center justify-center flex-shrink-0"><FileText size={16} {...ICON} /></span>
                          <span className="min-w-0">
                            <span className={`block font-medium text-slate-900 truncate max-w-[220px] ${l.file_path ? 'group-hover:text-emerald-700' : ''}`}>{l.document_name}</span>
                            <span className="block text-xs text-slate-500">{l.file_path ? 'File attached' : 'No file'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-slate-900 tabular-nums">{fmtDate(l.expiry_date)}</p>
                        <p className={`text-xs ${STATE[l._state].text}`}>{relExpiry(l.expiry_date) || 'No expiry date'}</p>
                      </td>
                      <td className="px-5 py-3"><StateBadge state={l._state} /></td>
                      <td className="px-5 py-3">{actions(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
          </>
        )}
      </section>

      {scanResult && <ScanResultModal result={scanResult} license={licenses.find(l => l.id === scanResult.licenseId)} onClose={closeScan} />}
      {viewFile && <FileViewer file={viewFile} onClose={closeViewer} />}
    </div>
  )
}