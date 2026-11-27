import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import {
  Plus, Search, Eye, X, CheckCircle2, AlertCircle, XCircle, Inbox, Trophy,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown,
  Mail, Smartphone, MapPin, Copy, Check, Loader2, MessageSquareText,
  Info, MoreHorizontal, ArrowUp, ArrowDown, ArrowUpDown, Send, RefreshCw, CheckCircle, Store, ThumbsUp, Ban, Hourglass, MessageSquare,
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'
import { createPortal } from 'react-dom'

const ICON = { strokeWidth: 1.75 }

// ── Auth headers ───────────────────────────────────────────────
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JSON.parse(localStorage.getItem('sc_user') || 'null')?.token}`,
})

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
const parseDT = str => { if (!str) return null; const d = new Date(String(str).replace(' ', 'T')); return isNaN(d) ? null : d }
const fmtDate = d => d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
function timeAgo(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const dd = Math.floor(h / 24); if (dd < 30) return `${dd}d ago`
  const mo = Math.floor(dd / 30); if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

const REASONS = [
  'New Construction', 'Renovation & Remodeling', 'Repair & Maintenance', 'Electrical Installation',
  'Plumbing Services', 'Painting & Finishing', 'Carpentry', 'Masonry', 'Roofing', 'Landscaping',
  'Interior Design', 'Project Management',
]

// ── Shared bits ────────────────────────────────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]

function Avatar({ name, seed, size = 'w-8 h-8', text = 'text-[11px]' }) {
  const ini = (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[(Number(seed) || 0) % AVATAR_TONES.length]}`}>{ini}</div>
  )
}

const STATUS = {
  'New':          ['bg-sky-50 text-sky-700 ring-sky-200',             'bg-sky-500'],
  'Won':          ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Lost':         ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
}

function SourceBadge({ source }) {
  if (source !== 'walk_in') return null
  return <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-200 whitespace-nowrap"><Store size={11} {...ICON} />Walk-in</span>
}

// The customer's answer to the "we received your inquiry" email (Yes, proceed / No, cancel)
function AnswerBadge({ inquiry, quietWhenNone = false }) {
  if (inquiry.source === 'walk_in') return null
  if (inquiry.customer_answer === 'proceed') {
    return <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200 whitespace-nowrap"><ThumbsUp size={11} {...ICON} />Wants to proceed</span>
  }
  if (inquiry.customer_answer === 'cancel') {
    return <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-200 whitespace-nowrap"><Ban size={11} {...ICON} />Customer cancelled</span>
  }
  if (quietWhenNone || inquiry.status !== 'New' || inquiry.email_status !== 'sent') return null
  return <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium ring-1 ring-inset bg-slate-50 text-slate-500 ring-slate-200 whitespace-nowrap"><Hourglass size={11} {...ICON} />No answer yet</span>
}

const SEND_LABEL = {
  sent:    ['Sent',     'text-emerald-700'],
  failed:  ['Failed',   'text-red-600'],
  skipped: ['Not sent', 'text-slate-500'],
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
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnDanger = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-60'
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'

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
    <th className="px-5 py-2.5 font-medium">
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

// ── Inquiry details modal ────────────────────────────────────────
/* Simple read-only details. Won / Lost are done from the table. */
function InquiryDetails({ inquiry, onClose }) {
  useEscapeAndLock(onClose)
  const created = parseDT(inquiry.created_at)
  const answer = inquiry.source === 'walk_in' ? null
    : inquiry.customer_answer === 'proceed' ? 'Yes, wants to proceed'
    : inquiry.customer_answer === 'cancel'  ? 'No, cancelled the inquiry'
    : inquiry.email_status === 'sent' ? 'No answer yet' : 'Email was not sent (use “Resend confirmation email”)'
  const rows = [
    ['Inquiry no.',     inquiry.inquiry_code],
    ['Name',            inquiry.full_name],
    ['Service',         inquiry.reason],
    ['Mobile',          inquiry.mobile],
    ['Email',           inquiry.email],
    ['Project address', inquiry.address],
    ['Received',        `${fmtDate(created)} (${timeAgo(created)})`],
    ...(answer ? [['Customer answer', answer]] : []),
  ]
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="inq-details-title"
        className="sc-pop relative w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-slate-100 flex-shrink-0">
          <h3 id="inq-details-title" className="text-base font-semibold text-slate-900">Inquiry details</h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={inquiry.status} />
            <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
          </div>
        </div>
        <dl className="flex-1 overflow-y-auto custom-scroll px-5 py-2 divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[130px_1fr] gap-3 py-2.5 text-sm">
              <dt className="text-slate-500">{label}</dt>
              <dd className="text-slate-900 break-words">{value || <span className="text-slate-400">—</span>}</dd>
            </div>
          ))}
        </dl>
        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* "Are you sure?" before marking an inquiry won or lost */
function ConfirmStatus({ inquiry, type, busy, onCancel, onConfirm }) {
  useEscapeAndLock(onCancel)
  const won = type === 'won'
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onCancel} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="inq-confirm-title"
        className="sc-pop relative w-full max-w-sm bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 p-6">
        <span className={`w-11 h-11 rounded-full flex items-center justify-center ${won ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {won ? <Trophy size={20} {...ICON} /> : <XCircle size={20} {...ICON} />}
        </span>
        <h3 id="inq-confirm-title" className="mt-4 text-base font-semibold text-slate-900">{won ? 'Mark as won?' : 'Mark as lost?'}</h3>
        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
          {won
            ? <>This creates a client account for <span className="font-medium text-slate-900">{inquiry.full_name}</span>, opens a pending job order for “{inquiry.reason}”, and emails the login details.</>
            : <>The inquiry of <span className="font-medium text-slate-900">{inquiry.full_name}</span> will be closed as lost. You can’t undo this.</>}
        </p>
        <div className="mt-5 flex gap-2">
          <button onClick={onCancel} disabled={!!busy} className={`${btnSecondary} flex-1`}>Cancel</button>
          {won ? (
            <button onClick={onConfirm} disabled={!!busy} className={`${btnPrimary} flex-1`}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} {...ICON} />}
              {busy ? 'Setting up…' : 'Mark as won'}
            </button>
          ) : (
            <button onClick={onConfirm} disabled={!!busy} className="inline-flex flex-1 items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} {...ICON} />}
              {busy ? 'Saving…' : 'Mark as lost'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const isOpen = inq => inq.status !== 'Won' && inq.status !== 'Lost'
const cancelledByCustomer = inq => inq.customer_answer === 'cancel'
/* Online inquiries wait for the customer's answer in the email. Walk-in inquiries are not affected. */
const needsAnswer = inq => inq.source !== 'walk_in' && !inq.customer_answer
const linkExpired = inq => !!inq.respond_expires_at && parseDT(inq.respond_expires_at) < new Date()
/* Why "Mark as won" is locked (null = allowed) */
const wonLockReason = inq => cancelledByCustomer(inq) ? 'Cancelled'
  : !needsAnswer(inq) ? null
  : inq.email_status === 'sent' ? 'Awaiting reply' : 'Email not sent'
/* Why "Mark as lost" is locked: only while the customer can still answer (link sent and not expired) */
const lostLockReason = inq => needsAnswer(inq) && inq.email_status === 'sent' && !linkExpired(inq) ? 'Awaiting reply' : null

/* Row actions: one "…" button that opens a small menu (drawn on top of everything, so it never hides behind the table) */
function RowActions({ inq, onView, onWon, onLost, onResend }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const W = 248, H = isOpen(inq) ? 172 : 52
    const below = window.innerHeight - r.bottom > H + 12
    setPos({ left: Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)), top: below ? r.bottom + 6 : r.top - H - 6, width: W })
  }, [inq])

  useEffect(() => {
    if (!open) return
    place()
    const close = e => {
      if (e.type === 'keydown' && e.key !== 'Escape') return
      if (e.type === 'mousedown' && (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target))) return
      setOpen(false)
    }
    const shut = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('resize', shut)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', shut, true)
      window.removeEventListener('resize', shut)
    }
  }, [open, place])

  const pick = fn => () => { setOpen(false); fn() }
  const item = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-left whitespace-nowrap transition-colors focus-visible:outline-none'
  const locked = (Icon, label, reason) => (
    <div role="menuitem" aria-disabled="true" title="Unlocks after the customer answers the confirmation email" className={`${item} text-slate-400 cursor-not-allowed`}>
      <Icon size={15} {...ICON} /> {label}
      <span className={`ml-auto text-[10px] font-medium ${reason === 'Cancelled' ? 'text-red-500' : 'text-amber-600'}`}>{reason}</span>
    </div>
  )

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} aria-label="Actions" aria-haspopup="menu" aria-expanded={open}
        className={`${iconBtn} ${open ? 'bg-slate-100 text-slate-900' : ''}`}>
        <MoreHorizontal size={18} {...ICON} />
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="sc-pop z-[1000] p-1 bg-white rounded-lg shadow-lg ring-1 ring-slate-900/10">
          <button role="menuitem" onClick={pick(onView)} className={`${item} text-slate-700 hover:bg-slate-50`}>
            <Eye size={15} {...ICON} className="text-slate-400" /> View details
          </button>
          {isOpen(inq) && <>
            <div className="my-1 h-px bg-slate-100" />
            {wonLockReason(inq) ? locked(Trophy, 'Mark as won', wonLockReason(inq)) : (
              <button role="menuitem" onClick={pick(onWon)} className={`${item} text-emerald-700 hover:bg-emerald-50`}>
                <Trophy size={15} {...ICON} /> Mark as won
              </button>
            )}
            {lostLockReason(inq) ? locked(XCircle, 'Mark as lost', lostLockReason(inq)) : (
              <button role="menuitem" onClick={pick(onLost)} className={`${item} text-red-600 hover:bg-red-50`}>
                <XCircle size={15} {...ICON} /> Mark as lost
              </button>
            )}
            {needsAnswer(inq) && <>
              <div className="my-1 h-px bg-slate-100" />
              <button role="menuitem" onClick={pick(onResend)} className={`${item} text-slate-700 hover:bg-slate-50`}>
                <Send size={15} {...ICON} className="text-slate-400" /> Resend confirmation email
              </button>
            </>}
          </>}
        </div>,
        document.body
      )}
    </>
  )
}

function Field({ label, required, error, hint, icon: Icon, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={16} {...ICON} className="absolute left-3 top-3 text-slate-400 pointer-events-none z-10" />}
        {children}
      </div>
      {error ? <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1"><AlertCircle size={12} {...ICON} />{error}</p>
        : hint ? <p className="text-xs text-slate-500 mt-1.5">{hint}</p> : null}
    </div>
  )
}

// ── Inquiries Page ─────────────────────────────────────────────
const EMPTY_FORM = {
  first_name: '', middle_initial: '', last_name: '', suffix: '', email: '', mobile: '+63',
  province: '', city: '', barangay: '', house_street: '', description: '', reason: '', status_id: '',
  source: 'walk_in',
}

export default function InquiriesPage() {
  const navigate = useNavigate()
  const [inquiries,    setInquiries]    = useState([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [sort,         setSort]         = useState({ key: 'created_at', dir: 'desc' })
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [confirm,      setConfirm]      = useState(null)   // { inq, type: 'won' | 'lost' }
  const [busy,         setBusy]         = useState(null)
  const [page,         setPage]         = useState(1)
  const [perPage,      setPerPage]      = useState(10)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [errors,       setErrors]       = useState({})
  const [saving,       setSaving]       = useState(false)
  const [services,     setServices]     = useState(REASONS)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const f = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(e => ({ ...e, [key]: undefined })) }

  const loadInquiries = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/inquiries/list.php', { per_page: 500 })
      setInquiries(data.inquiries || [])
    } catch { showToast('Failed to load inquiries.', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { loadInquiries() }, [loadInquiries])

  // Opened from Job Orders ("New walk-in inquiry")
  const location = useLocation()
  useEffect(() => {
    if (!location.state?.newWalkIn) return
    setForm({ ...EMPTY_FORM, source: 'walk_in' }); setShowForm(true)
    navigate('/admin/inquiries', { replace: true, state: {} })
  }, [location.state?.newWalkIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Services = your specializations (falls back to the built-in list)
  useEffect(() => {
    apiGet('/api/config/specializations.php')
      .then(d => {
        const names = (d.data || d.specializations || []).map(s => s.name).filter(Boolean)
        if (names.length) setServices(names)
      })
      .catch(() => {})
  }, [])
  useEffect(() => { setPage(1) }, [search, filterStatus, filterReason, filterSource, perPage])

  // ── Derived data
  const counts = useMemo(() => {
    const c = { all: inquiries.length, New: 0, Won: 0, Lost: 0, thisMonth: 0 }
    const now = new Date()
    inquiries.forEach(i => {
      if (c[i.status] != null) c[i.status]++
      const d = parseDT(i.created_at)
      if (d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) c.thisMonth++
    })
    return c
  }, [inquiries])
  const decided = counts.Won + counts.Lost
  const winRate = decided ? Math.round((counts.Won / decided) * 100) : 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = inquiries.filter(i =>
      (!filterStatus || i.status === filterStatus) &&
      (!filterReason || i.reason === filterReason) &&
      (!filterSource || (i.source || 'online') === filterSource) &&
      (!q || [i.full_name, i.email, i.mobile, i.inquiry_code, i.reason, i.description].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = i => sort.key === 'created_at' ? (parseDT(i.created_at)?.getTime() || 0) : String(i[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => {
      const A = val(a), B = val(b)
      const r = typeof A === 'number' ? A - B : A.localeCompare(B)
      return sort.dir === 'asc' ? r : -r
    })
  }, [inquiries, search, filterStatus, filterReason, filterSource, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus || filterReason || filterSource
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterReason(''); setFilterSource('') }

  // ── Create
  const validate = () => {
    const e = {}
    const nameOk = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/
    if (!form.first_name.trim()) e.first_name = 'First name is required.'
    else if (!nameOk.test(form.first_name.trim())) e.first_name = 'First name must contain letters only.'
    if (!form.middle_initial.trim()) e.middle_initial = 'Middle initial is required.'
    if (!form.last_name.trim()) e.last_name = 'Last name is required.'
    else if (!nameOk.test(form.last_name.trim())) e.last_name = 'Last name must contain letters only.'
    if (!/^\+639\d{9}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid PH mobile number (+639XXXXXXXXX).'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!form.province) e.province = 'Province is required.'
    if (!form.city) e.city = 'City / Municipality is required.'
    if (!form.barangay) e.barangay = 'Barangay is required.'
    if (!form.house_street.trim()) e.house_street = 'House No. & Street is required.'
    if (!form.reason) e.reason = 'Please choose a service.'

    return e
  }

  const handleCreate = async () => {
    if (saving) return
    const errs = validate()
    if (Object.keys(errs).length) {
      showToast(Object.values(errs)[0], 'error')
      return
    }

    const provinceName = form.province === '1300000000'
      ? 'Metro Manila'
      : getAllProvinces().find(p => p.psgcCode === form.province)?.name ?? ''
    const filteredCities = form.province ? getMunicipalitiesByProvince(form.province) : []
    const cityName = filteredCities.find(c => c.psgcCode === form.city)?.name ?? ''
    const address = [form.house_street, form.barangay, cityName, provinceName].filter(Boolean).join(', ')

    const mi        = form.middle_initial.trim().replace(/\.$/, '').toUpperCase()
    const firstFull = `${form.first_name.trim()} ${mi}.`
    const lastFull  = [form.last_name.trim(), form.suffix.trim()].filter(Boolean).join(' ')

    setSaving(true)
    try {
      const res = await fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/inquiries/create.php', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ ...form, first_name: firstFull, last_name: lastFull, address }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast(form.source === 'walk_in' ? 'Walk-in inquiry saved' : 'Inquiry saved')
      setShowForm(false)
      setForm(EMPTY_FORM)
      setErrors({})
      loadInquiries()
    } catch (err) { showToast(err.message || 'Failed to submit inquiry.', 'error') }
    finally { setSaving(false) }
  }

  // ── Won / Lost (logic unchanged)
  const handleStatusUpdate = async (inq, status_id, statusLabel) => {
    if (statusLabel !== 'Won') {
      try {
        await apiPut('/api/inquiries/update.php', { id: inq.id, status_id })
        showToast('Marked as lost')
        setSelected(null); loadInquiries()
      } catch { showToast('Update failed.', 'error') }
      return
    }

    const isDuplicate = (msg = '') => /already exists/i.test(msg)

    // The customer may have cancelled from the email a moment ago: check the latest copy first
    try {
      const fresh = (await apiGet('/api/inquiries/list.php', { per_page: 500 })).inquiries?.find(x => x.id === inq.id)
      if (fresh && (fresh.customer_answer === 'cancel' || fresh.status === 'Lost')) {
        showToast('The customer cancelled this inquiry, so it can’t be marked as won.', 'error')
        loadInquiries(); return
      }
      if (fresh && wonLockReason(fresh)) {
        showToast('Wait for the customer to click “Yes, proceed” in the email before marking it as won.', 'error')
        loadInquiries(); return
      }
    } catch { /* if the check fails, continue as before */ }

    try {
      let userId = inq.user_id || null

      if (!userId) {
        try {
          const cData = await apiGet('/api/contacts/list.php', { per_page: 100 })
          const all = cData.contacts || cData.users || []
          const existing = all.find(c =>
            c.type === 'client' &&
            ((inq.email && c.email && c.email.toLowerCase() === inq.email.toLowerCase()) ||
             (inq.mobile && c.mobile && c.mobile === inq.mobile))
          )
          if (existing) userId = existing.id
        } catch (e) { console.warn('Client lookup failed:', e) }
      }

      if (!userId) {
        const step2 = await apiPost('/api/contacts/create.php', {
          first_name: inq.first_name || inq.full_name?.split(' ')[0] || '',
          last_name:  inq.last_name  || inq.full_name?.split(' ').slice(1).join(' ') || '',
          email: inq.email || '', mobile: inq.mobile || '', address: inq.address || '',
          type: 'client', status_id: 1,
        })
        if (!step2.success) { showToast(`Client creation failed: ${step2.error}`, 'error'); return }
        userId = (step2.contact || step2.user).id
      }

      await apiPut('/api/inquiries/update.php', { id: inq.id, user_id: userId })

      try {
        const jo = await apiPost('/api/job-orders/create.php', {
          client_user_id: userId,
          inquiry_id: inq.id,
          status_id: 16,
          description: inq.reason === 'Other' ? (inq.description || inq.reason) : inq.reason,
        })
        if (!jo.success && !isDuplicate(jo.error)) { showToast(`Job order failed: ${jo.error}`, 'error'); return }
      } catch (e) {
        if (!isDuplicate(e.message)) { showToast(`Job order failed: ${e.message}`, 'error'); return }
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      const generatedPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + 'A1'

      let credMsg = 'Marked as won. Account created and login details emailed.'
      try {
        const credRes = await fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/contacts/send-credentials.php', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            email: inq.email,
            name: inq.first_name || inq.full_name?.split(' ')[0] || 'Client',
            password: generatedPassword,
          }),
        })
        const credData = await credRes.json()
        if (!credData.success) credMsg = `Won, but credentials failed to save: ${credData.error}`
        else if (credData.email_sent === false) credMsg = 'Marked as won. Account is active, but the email was not sent (check Brevo setup).'
      } catch (e) {
        console.warn('Welcome email failed:', e)
        credMsg = 'Won, but the credentials request failed.'
      }

      const won = await apiPut('/api/inquiries/update.php', { id: inq.id, status_id: 9 })
      if (!won.success) { showToast(`Could not mark as won: ${won.error}`, 'error'); return }

      showToast(credMsg)
      setSelected(null); navigate('/admin/job-orders')
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  const resendEmail = async inq => {
    try {
      const d = await apiPost('/api/inquiries/resend.php', { id: inq.id })
      if (!d.success) throw new Error(d.error)
      showToast(`Confirmation email sent again to ${inq.email}`)
      loadInquiries()
    } catch (e) { showToast(e.message || 'Could not resend the email.', 'error') }
  }

  const runStatus = async (inq, id, label) => {
    setBusy(label)
    await handleStatusUpdate(inq, id, label)
    setBusy(null)
    setConfirm(null)
  }

  const closeDrawer = useCallback(() => setSelected(null), [])
  const closeConfirm = useCallback(() => { if (!busy) setConfirm(null) }, [busy])
  const closeForm = useCallback(() => { if (!saving) { setShowForm(false); setErrors({}) } }, [saving])

  return (
    <div className="max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Inquiries</h1>
          <p className="text-sm text-slate-500 mt-1">Project requests from potential clients. Review each one and mark it won or lost.</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true) }} className={`${btnPrimary} self-start sm:self-auto`}>
          <Plus size={16} {...ICON} /> New inquiry
        </button>
      </div>

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
          <StatusDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            loading={loading}
            options={[
              { value: '',     label: 'All statuses', count: counts.all },
              { value: 'New',  label: 'New',          count: counts.New,  dot: 'bg-sky-500' },
              { value: 'Won',  label: 'Won',          count: counts.Won,  dot: 'bg-emerald-500' },
              { value: 'Lost', label: 'Lost',         count: counts.Lost, dot: 'bg-red-500' },
            ]}
          />
          <div className="flex flex-1 flex-wrap sm:flex-nowrap items-center gap-2 lg:justify-end">
            <div className="relative w-full sm:w-auto sm:flex-1 lg:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search name, email, mobile or code"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
            </div>
            <SelectBox value={filterSource} onChange={setFilterSource} className="flex-1 min-w-0 sm:flex-none sm:w-36 sm:flex-shrink-0">
              <option value="">All sources</option>
              <option value="online">Online</option>
              <option value="walk_in">Walk-in</option>
            </SelectBox>
            <SelectBox value={filterReason} onChange={setFilterReason} className="flex-1 min-w-0 sm:flex-none sm:w-44 sm:flex-shrink-0">
              <option value="">All services</option>
              {services.map(r => <option key={r} value={r}>{r}</option>)}
            </SelectBox>
          </div>
        </div>

        {hasFilters && !loading && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {search && <Chip onRemove={() => setSearch('')}>“{search}”</Chip>}
            {filterStatus && <Chip onRemove={() => setFilterStatus('')}>{filterStatus}</Chip>}
            {filterReason && <Chip onRemove={() => setFilterReason('')}>{filterReason}</Chip>}
            {filterSource && <Chip onRemove={() => setFilterSource('')}>{filterSource === 'walk_in' ? 'Walk-in' : 'Online'}</Chip>}
            <button onClick={clearFilters} className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800">Clear all</button>
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skel className="h-3 w-40" /><Skel className="h-2.5 w-24" /></div>
                <Skel className="hidden md:block h-3 w-36" />
                <Skel className="h-5 w-14 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters
            ? <EmptyState icon={Search} title="No matching inquiries" text="Try a different search or remove a filter." action={<button onClick={clearFilters} className={btnSecondary}>Clear filters</button>} />
            : <EmptyState icon={Inbox} title="No inquiries yet" text="New project requests will appear here." action={<button onClick={() => setShowForm(true)} className={btnPrimary}><Plus size={16} {...ICON} /> New inquiry</button>} />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((inq, i) => (
                <li key={inq.id} className="sc-rise px-4 py-3" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-center gap-3">
                    <Avatar name={inq.full_name} seed={inq.id} size="w-10 h-10" text="text-xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{inq.full_name}</p>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{inq.reason || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{inq.inquiry_code} · {timeAgo(parseDT(inq.created_at))}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <StatusBadge status={inq.status} />
                      <RowActions inq={inq}
                        onView={() => setSelected(inq)}
                        onWon={() => setConfirm({ inq, type: 'won' })}
                        onLost={() => setConfirm({ inq, type: 'lost' })}
                        onResend={() => resendEmail(inq)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Inquirer" sortKey="full_name"  sort={sort} onSort={onSort} />
                    <SortHeader label="Service"  sortKey="reason"     sort={sort} onSort={onSort} />
                    <SortHeader label="Received" sortKey="created_at" sort={sort} onSort={onSort} />
                    <SortHeader label="Status"   sortKey="status"     sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((inq, i) => (
                    <tr key={inq.id} className="sc-rise hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                      <td className="px-5 py-3">
                        <button onClick={() => setSelected(inq)} className="group flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                          <Avatar name={inq.full_name} seed={inq.id} size="w-9 h-9" text="text-xs" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">{inq.full_name}</span>
                              {inq.status === 'New' && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" title="Awaiting review" />}
                            </span>
                            <span className="block text-xs text-slate-500 tabular-nums">{inq.inquiry_code}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-700 max-w-[220px] truncate">{inq.reason || '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-slate-700 tabular-nums">{fmtDate(parseDT(inq.created_at))}</p>
                        <p className="text-xs text-slate-500">{timeAgo(parseDT(inq.created_at))}</p>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={inq.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          <RowActions inq={inq}
                            onView={() => setSelected(inq)}
                            onWon={() => setConfirm({ inq, type: 'won' })}
                            onLost={() => setConfirm({ inq, type: 'lost' })}
                            onResend={() => resendEmail(inq)} />
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

      {selected && <InquiryDetails inquiry={selected} onClose={closeDrawer} />}

      {confirm && (
        <ConfirmStatus
          inquiry={confirm.inq}
          type={confirm.type}
          busy={busy}
          onCancel={closeConfirm}
          onConfirm={() => confirm.type === 'won' ? runStatus(confirm.inq, 9, 'Won') : runStatus(confirm.inq, 10, 'Lost')}
        />
      )}

      {showForm && (
        <NewInquiryModal form={form} setForm={setForm} f={f} errors={errors} saving={saving} onClose={closeForm} onSubmit={handleCreate} services={services} />
      )}
    </div>
  )
}

// ── New inquiry modal (original layout) ────────────────────────
function NewInquiryModal({ form, setForm, f, saving, onClose, onSubmit, services }) {
  const filteredCities    = form.province ? getMunicipalitiesByProvince(form.province) : []
  const filteredBarangays = form.city ? getBarangaysByMunicipality(form.city) : []
  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5"
  const req = <span className="text-red-500"> *</span>

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 max-h-[92vh] overflow-y-auto custom-scroll">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="px-5 pt-8 pb-6 sm:px-8 sm:pb-8">
          {/* Title */}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">New inquiry</h3>
            <p className="text-sm text-gray-500 mt-1">Record a customer's request. You can mark it won once you agree.</p>
          </div>

          <div className="space-y-4">
            {/* First name | Middle initial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name{req}</label>
                <input className={inputCls} value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="First Name" />
              </div>
              <div>
                <label className={labelCls}>Middle Initial{req}</label>
                <input className={inputCls} value={form.middle_initial} maxLength={2} placeholder="e.g. A."
                  onChange={e => f('middle_initial', e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())} />
              </div>
            </div>

            {/* Last name + Suffix | Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid grid-cols-[1fr_88px] gap-3">
                <div>
                  <label className={labelCls}>Last Name{req}</label>
                  <input className={inputCls} value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Last Name" />
                </div>
                <div>
                  <label className={labelCls}>Suffix</label>
                  <input className={inputCls} value={form.suffix} maxLength={10} placeholder="e.g. Jr."
                    onChange={e => f('suffix', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Mobile Number{req}</label>
                <input className={inputCls} value={form.mobile} maxLength={13} placeholder="+639XXXXXXXXX"
                  onChange={e => {
                    let val = e.target.value
                    if (!val.startsWith('+63')) val = '+63'
                    let digits = val.slice(3).replace(/\D/g, '')
                    if (digits.startsWith('0')) digits = digits.slice(1)
                    f('mobile', '+63' + digits.slice(0, 10))
                  }} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>Email Address{req}</label>
              <input type="email" className={inputCls} value={form.email} onChange={e => f('email', e.target.value)} placeholder="Email" />
            </div>

            {/* Province */}
            <div>
              <label className={labelCls}>Province{req}</label>
              <select className={inputCls} value={form.province}
                onChange={e => setForm(p => ({ ...p, province: e.target.value, city: '', barangay: '' }))}>
                <option value="">Select province...</option>
                <option value="1300000000">Metro Manila</option>
              </select>
            </div>

            {/* City | Barangay */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>City / Municipality{req}</label>
                <select className={inputCls} value={form.city} disabled={!form.province}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value, barangay: '' }))}>
                  <option value="">Select city...</option>
                  {filteredCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Barangay{req}</label>
                <select className={inputCls} value={form.barangay} disabled={!form.city}
                  onChange={e => f('barangay', e.target.value)}>
                  <option value="">Select barangay...</option>
                  {filteredBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>

            {/* House & street */}
            <div>
              <label className={labelCls}>House No. &amp; Street{req}</label>
              <input className={inputCls} value={form.house_street} onChange={e => f('house_street', e.target.value)} placeholder="e.g. 123 Rizal Street" />
            </div>

            {/* Reason */}
            <div>
              <label className={labelCls}>Service{req}</label>
              <select className={inputCls} value={form.reason} onChange={e => f('reason', e.target.value)}>
                <option value="">Select a service...</option>
                {services.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>



            {/* Submit */}
            <button onClick={onSubmit} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? 'Saving...' : 'Save inquiry'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}