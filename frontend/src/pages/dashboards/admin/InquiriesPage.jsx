import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import {
  Plus, Search, Eye, X, CheckCircle2, AlertCircle, XCircle, Inbox, Sparkles, Trophy,
  TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown,
  Mail, Phone, Smartphone, MapPin, Copy, Check, Loader2, CalendarDays, MessageSquareText,
  Info, ArrowUp, ArrowDown, ArrowUpDown, Send, Home, User,
  RefreshCw, CheckCircle,
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

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
  'Interior Design', 'Project Management', 'Other',
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
      {footer && !loading && <div className="mt-3">{footer}</div>}
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

// ── Inquiry drawer ─────────────────────────────────────────────
function InquiryDrawer({ inquiry, busy, onClose, onWon, onLost }) {
  const [confirm, setConfirm] = useState(null) // 'won' | 'lost'
  useEscapeAndLock(onClose)
  const created = parseDT(inquiry.created_at)
  const open = inquiry.status !== 'Won' && inquiry.status !== 'Lost'
  const reasonText = inquiry.reason === 'Other' ? (inquiry.description || 'Other') : inquiry.reason

  const steps = [
    { label: 'Received', done: true },
    { label: 'Under review', done: !open || true, current: open },
    { label: inquiry.status === 'Lost' ? 'Lost' : 'Won', done: !open, lost: inquiry.status === 'Lost' },
  ]

  const info = [
    { icon: Mail,       label: 'Email',   value: inquiry.email,   href: inquiry.email ? `mailto:${inquiry.email}` : null },
    { icon: Smartphone, label: 'Mobile',  value: inquiry.mobile,  href: inquiry.mobile ? `tel:${inquiry.mobile}` : null },
    { icon: MapPin,     label: 'Address', value: inquiry.address },
  ]

  return (
    <div className="fixed inset-0 z-50">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className="sc-drawer absolute right-0 top-0 h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 flex-shrink-0">
          <p className="text-sm font-medium text-slate-500">Inquiry <span className="text-slate-900 tabular-nums">{inquiry.inquiry_code}</span></p>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll">
          {/* Profile */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <Avatar name={inquiry.full_name} seed={inquiry.id} size="w-14 h-14" text="text-lg" />
              <div className="min-w-0 pt-0.5">
                <h3 className="text-lg font-semibold text-slate-900 leading-tight">{inquiry.full_name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">Submitted {fmtDate(created)} · {timeAgo(created)}</p>
                <div className="mt-2.5"><StatusBadge status={inquiry.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <a href={inquiry.email ? `mailto:${inquiry.email}` : undefined} className={`${btnSecondary} ${!inquiry.email ? 'pointer-events-none opacity-50' : ''}`}>
                <Mail size={15} {...ICON} /> Email
              </a>
              <a href={inquiry.mobile ? `tel:${inquiry.mobile}` : undefined} className={`${btnSecondary} ${!inquiry.mobile ? 'pointer-events-none opacity-50' : ''}`}>
                <Phone size={15} {...ICON} /> Call
              </a>
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Progress */}
            <ol className="flex items-center">
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                      ${s.lost && s.done ? 'bg-red-500 text-white'
                        : s.done && !s.current ? 'bg-emerald-600 text-white'
                        : s.current ? 'bg-white ring-2 ring-emerald-500 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'}`}>
                      {s.lost && s.done ? <X size={14} strokeWidth={2.5} /> : s.done && !s.current ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className={`text-xs whitespace-nowrap ${s.current ? 'font-medium text-slate-900' : 'text-slate-500'}`}>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && <span className={`flex-1 h-0.5 mx-2 -mt-5 rounded ${steps[i + 1].done || steps[i + 1].current ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </li>
              ))}
            </ol>

            {/* Request */}
            <section>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Request</h4>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <MessageSquareText size={16} {...ICON} className="text-emerald-600" />
                  {inquiry.reason || 'No reason given'}
                </div>
                {inquiry.reason === 'Other' && inquiry.description && (
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{inquiry.description}</p>
                )}
              </div>
            </section>

            {/* Contact */}
            <section>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Contact information</h4>
              <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                {info.map(({ icon: Icon, label, value, href }) => (
                  <div key={label} className="group flex items-start gap-3 px-4 py-3">
                    <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="text-sm text-slate-900 break-words mt-0.5">
                        {value ? (href ? <a href={href} className="hover:text-emerald-700 hover:underline">{value}</a> : value) : <span className="text-slate-400">Not provided</span>}
                      </dd>
                    </div>
                    <CopyButton value={value} />
                  </div>
                ))}
              </dl>
            </section>

            {open && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-800">
                <Info size={16} {...ICON} className="text-sky-500 flex-shrink-0 mt-0.5" />
                <p>Marking this as <span className="font-semibold">Won</span> creates a client account, opens a pending job order for “{reasonText}”, and emails login details to {inquiry.email || 'the client'}.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          {!open ? (
            <div className="flex items-center justify-between gap-3">
              <p className={`flex items-center gap-2 text-sm font-medium ${inquiry.status === 'Won' ? 'text-emerald-700' : 'text-red-600'}`}>
                {inquiry.status === 'Won' ? <Trophy size={16} {...ICON} /> : <XCircle size={16} {...ICON} />}
                {inquiry.status === 'Won' ? 'This inquiry was won' : 'This inquiry was lost'}
              </p>
              <button onClick={onClose} className={btnSecondary}>Close</button>
            </div>
          ) : confirm ? (
            <div className="sc-pop">
              <p className="text-sm text-slate-700 mb-3">
                {confirm === 'won'
                  ? <>Mark <span className="font-semibold">{inquiry.full_name}</span> as won and send their login details?</>
                  : <>Mark this inquiry as lost? You can’t undo this.</>}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(null)} disabled={!!busy} className={`${btnSecondary} flex-1`}>Back</button>
                {confirm === 'won' ? (
                  <button onClick={onWon} disabled={!!busy} className={`${btnPrimary} flex-1`}>
                    {busy === 'Won' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} {...ICON} />}
                    {busy === 'Won' ? 'Setting up account…' : 'Yes, mark as won'}
                  </button>
                ) : (
                  <button onClick={onLost} disabled={!!busy} className="inline-flex flex-1 items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-60">
                    {busy === 'Lost' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} {...ICON} />}
                    {busy === 'Lost' ? 'Saving…' : 'Yes, mark as lost'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setConfirm('lost')} className={`${btnDanger} flex-1`}><XCircle size={16} {...ICON} /> Mark as lost</button>
              <button onClick={() => setConfirm('won')} className={`${btnPrimary} flex-1`}><Trophy size={16} {...ICON} /> Mark as won</button>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ── Form field ─────────────────────────────────────────────────
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
}

export default function InquiriesPage() {
  const navigate = useNavigate()
  const [inquiries,    setInquiries]    = useState([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const [sort,         setSort]         = useState({ key: 'created_at', dir: 'desc' })
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [selected,     setSelected]     = useState(null)
  const [busy,         setBusy]         = useState(null)
  const [page,         setPage]         = useState(1)
  const [perPage,      setPerPage]      = useState(10)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [errors,       setErrors]       = useState({})
  const [saving,       setSaving]       = useState(false)

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
  useEffect(() => { setPage(1) }, [search, filterStatus, filterReason, perPage])

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
      (!q || [i.full_name, i.email, i.mobile, i.inquiry_code, i.reason, i.description].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = i => sort.key === 'created_at' ? (parseDT(i.created_at)?.getTime() || 0) : String(i[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => {
      const A = val(a), B = val(b)
      const r = typeof A === 'number' ? A - B : A.localeCompare(B)
      return sort.dir === 'asc' ? r : -r
    })
  }, [inquiries, search, filterStatus, filterReason, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus || filterReason
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterReason('') }

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
    if (!form.reason) e.reason = 'Please select a reason for inquiry.'
    if (form.reason === 'Other' && !form.description.trim()) e.description = 'Please specify your reason.'
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
      showToast('Inquiry submitted')
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

  const runStatus = async (inq, id, label) => {
    setBusy(label)
    await handleStatusUpdate(inq, id, label)
    setBusy(null)
  }

  const closeDrawer = useCallback(() => { if (!busy) setSelected(null) }, [busy])
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
        <button onClick={() => setShowForm(true)} className={`${btnPrimary} self-start sm:self-auto`}>
          <Plus size={16} {...ICON} /> New inquiry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MiniStat icon={Inbox}      label="Total inquiries" value={counts.all}       tone="bg-slate-100 text-slate-600"    loading={loading} delay={0}
          footer={<p className="text-xs text-slate-500"><span className="font-medium text-slate-700">{counts.thisMonth}</span> received this month</p>} />
        <MiniStat icon={Sparkles}   label="Awaiting review" value={counts.New}       tone="bg-sky-50 text-sky-600"         loading={loading} delay={50}
          footer={counts.New > 0
            ? <button onClick={() => setFilterStatus('New')} className="text-xs font-medium text-sky-700 hover:text-sky-800">Review now →</button>
            : <p className="text-xs text-slate-500">You’re all caught up</p>} />
        <MiniStat icon={Trophy}     label="Won"             value={counts.Won}       tone="bg-emerald-50 text-emerald-600" loading={loading} delay={100}
          footer={<p className="text-xs text-slate-500">Became clients</p>} />
        <MiniStat icon={TrendingUp} label="Win rate"        value={`${winRate}%`}    tone="bg-violet-50 text-violet-600"   loading={loading} delay={150}
          footer={
            <div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="sc-bar h-full bg-emerald-500" style={{ width: `${winRate}%` }} />
                <div className="sc-bar h-full bg-red-400" style={{ width: decided ? `${100 - winRate}%` : 0 }} />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">{counts.Won} won · {counts.Lost} lost</p>
            </div>
          } />
      </div>

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
          <div className="overflow-x-auto -mx-1 px-1">
            <Segmented
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: '',     label: 'All',  count: loading ? null : counts.all },
                { value: 'New',  label: 'New',  count: loading ? null : counts.New,  dot: 'bg-sky-500' },
                { value: 'Won',  label: 'Won',  count: loading ? null : counts.Won,  dot: 'bg-emerald-500' },
                { value: 'Lost', label: 'Lost', count: loading ? null : counts.Lost, dot: 'bg-red-500' },
              ]}
            />
          </div>
          <div className="flex flex-1 items-center gap-2 lg:justify-end">
            <div className="relative flex-1 lg:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Search name, email, mobile or code"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"><X size={14} {...ICON} /></button>}
            </div>
            <SelectBox value={filterReason} onChange={setFilterReason} className="w-44 flex-shrink-0">
              <option value="">All services</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </SelectBox>
          </div>
        </div>

        {hasFilters && !loading && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {search && <Chip onRemove={() => setSearch('')}>“{search}”</Chip>}
            {filterStatus && <Chip onRemove={() => setFilterStatus('')}>{filterStatus}</Chip>}
            {filterReason && <Chip onRemove={() => setFilterReason('')}>{filterReason}</Chip>}
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
              {pageItems.map((inq, i) => {
                const d = parseDT(inq.created_at)
                return (
                  <li key={inq.id}>
                    <button onClick={() => setSelected(inq)} className="sc-rise w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-slate-50" style={{ animationDelay: `${i * 30}ms` }}>
                      <Avatar name={inq.full_name} seed={inq.id} size="w-10 h-10" text="text-xs" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{inq.full_name}</p>
                          <StatusBadge status={inq.status} />
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-0.5">{inq.reason || '—'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{inq.inquiry_code} · {timeAgo(d)}</p>
                      </div>
                      <ChevronRight size={16} {...ICON} className="text-slate-300 flex-shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Inquirer"  sortKey="full_name"  sort={sort} onSort={onSort} />
                    <SortHeader label="Service"   sortKey="reason"     sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium">Mobile / email</th>
                    <SortHeader label="Received"  sortKey="created_at" sort={sort} onSort={onSort} />
                    <SortHeader label="Status"    sortKey="status"     sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((inq, i) => {
                    const d = parseDT(inq.created_at)
                    return (
                      <tr key={inq.id} className="sc-rise group hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                        <td className="px-5 py-3">
                          <button onClick={() => setSelected(inq)} className="flex items-center gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                            <Avatar name={inq.full_name} seed={inq.id} size="w-9 h-9" text="text-xs" />
                            <span>
                              <span className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">{inq.full_name}</span>
                                {inq.status === 'New' && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" title="Awaiting review" />}
                              </span>
                              <span className="block text-xs text-slate-500 tabular-nums">{inq.inquiry_code}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-5 py-3 max-w-[220px]">
                          <p className="text-slate-700 truncate">{inq.reason || '—'}</p>
                          {inq.reason === 'Other' && inq.description && <p className="text-xs text-slate-500 truncate">{inq.description}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-slate-700 tabular-nums">{inq.mobile || <span className="text-slate-400">—</span>}</p>
                          {inq.email && <p className="text-xs text-slate-500 truncate max-w-[200px]">{inq.email}</p>}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <p className="text-slate-700 tabular-nums">{fmtDate(d)}</p>
                          <p className="text-xs text-slate-500">{timeAgo(d)}</p>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={inq.status} /></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <a href={inq.email ? `mailto:${inq.email}` : undefined} title="Send email" aria-label="Send email" className={`${iconBtn} ${!inq.email ? 'pointer-events-none opacity-30' : ''}`}><Mail size={16} {...ICON} /></a>
                            <a href={inq.mobile ? `tel:${inq.mobile}` : undefined} title="Call" aria-label="Call" className={`${iconBtn} ${!inq.mobile ? 'pointer-events-none opacity-30' : ''}`}><Phone size={16} {...ICON} /></a>
                            <button onClick={() => setSelected(inq)} title="Review" aria-label="Review" className={iconBtn}><Eye size={16} {...ICON} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
          </>
        )}
      </section>

      {selected && (
        <InquiryDrawer
          inquiry={selected}
          busy={busy}
          onClose={closeDrawer}
          onWon={() => runStatus(selected, 9, 'Won')}
          onLost={() => runStatus(selected, 10, 'Lost')}
        />
      )}

      {showForm && (
        <NewInquiryModal form={form} setForm={setForm} f={f} errors={errors} saving={saving} onClose={closeForm} onSubmit={handleCreate} />
      )}
    </div>
  )
}

// ── New inquiry modal (original layout) ────────────────────────
function NewInquiryModal({ form, setForm, f, saving, onClose, onSubmit }) {
  const filteredCities    = form.province ? getMunicipalitiesByProvince(form.province) : []
  const filteredBarangays = form.city ? getBarangaysByMunicipality(form.city) : []
  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5"
  const req = <span className="text-red-500"> *</span>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
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
            <h3 className="text-2xl font-bold text-gray-900">Submit an Inquiry</h3>
            <p className="text-sm text-gray-500 mt-1">Tell us about your project and we'll get back to you right away.</p>
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
              <label className={labelCls}>Reason for Inquiry{req}</label>
              <select className={inputCls} value={form.reason} onChange={e => f('reason', e.target.value)}>
                <option value="">Select a reason...</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Description only when reason = Other */}
            {form.reason === 'Other' && (
              <div>
                <label className={labelCls}>Please specify{req}</label>
                <textarea className={`${inputCls} resize-none`} rows={3} value={form.description}
                  onChange={e => f('description', e.target.value)} placeholder="Please specify your reason..." />
              </div>
            )}

            {/* Submit */}
            <button onClick={onSubmit} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}