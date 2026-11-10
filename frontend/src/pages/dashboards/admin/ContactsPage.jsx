import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, UserPlus, Search, CheckCircle2, AlertCircle, X, ArrowRight,
  Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown,
  Mail, Phone, Smartphone, MapPin, Users, Briefcase, Building2, BadgeCheck,
  LayoutGrid, List, Copy, Check, ArrowUp, ArrowDown, ArrowUpDown, Loader2,
  HardHat, CalendarDays, User,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

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

function useEscapeAndLock(onClose) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
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

function Avatar({ first, last, seed, size = 'w-8 h-8', text = 'text-[11px]' }) {
  const tone = AVATAR_TONES[(Number(seed) || 0) % AVATAR_TONES.length]
  return (
    <div className={`${size} ${text} rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${tone}`}>
      {(first?.[0] || '?').toUpperCase()}{(last?.[0] || '').toUpperCase()}
    </div>
  )
}

const STATUS = {
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Active':       ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Complete':     ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Completed':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'On Hold':      ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  'Scheduled':    ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500'],
  'In Progress':  ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500'],
  'Cancelled':    ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'New':          ['bg-sky-50 text-sky-700 ring-sky-200',             'bg-sky-500'],
  'Won':          ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Lost':         ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'Inactive':     ['bg-gray-50 text-gray-600 ring-gray-200',          'bg-gray-400'],
  'On Leave':     ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Blacklisted':  ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
}

function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status || '—'}
    </span>
  )
}

function TypeBadge({ type }) {
  const org = type === 'organisation'
  const Icon = org ? Building2 : User
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium capitalize bg-slate-100 text-slate-600 whitespace-nowrap">
      <Icon size={12} {...ICON} />{type || '—'}
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
    <button
      onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}
      title={done ? 'Copied' : 'Copy'}
      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
    >
      {done ? <Check size={14} {...ICON} className="text-emerald-600" /> : <Copy size={14} {...ICON} />}
    </button>
  )
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'
const iconBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'

// ── Toast ──────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="sc-pop fixed top-6 right-6 z-[70] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 size={16} {...ICON} /> : <AlertCircle size={16} {...ICON} />}
      </span>
      {toast.msg}
    </div>
  )
}

// ── Summary stat ───────────────────────────────────────────────
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

// ── Segmented tabs ─────────────────────────────────────────────
function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex p-1 rounded-lg bg-slate-100 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.icon && <o.icon size={14} {...ICON} />}
          {o.label}
          {o.count != null && (
            <span className={`text-xs tabular-nums ${value === o.value ? 'text-emerald-700' : 'text-slate-400'}`}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

function SelectBox({ value, onChange, children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown size={14} {...ICON} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  )
}

function SortHeader({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={`px-5 py-2.5 font-medium ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? 'text-slate-900' : ''}`}
      >
        {label}<Icon size={12} {...ICON} className={active ? 'text-emerald-600' : 'text-slate-300'} />
      </button>
    </th>
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
        <span className="tabular-nums">
          <span className="font-medium text-slate-800">{from}–{to}</span> of <span className="font-medium text-slate-800">{total}</span>
        </span>
      </div>

      <nav aria-label="Pagination" className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(1)} disabled={page === 1} aria-label="First page">
          <ChevronsLeft size={16} {...ICON} />
        </button>
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft size={16} {...ICON} />
        </button>
        <span className={`${cell} sm:hidden text-slate-600 px-3`}>Page {page} of {totalPages}</span>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className={`${cell} hidden sm:inline-flex text-slate-400`}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${cell} hidden sm:inline-flex tabular-nums ${p === page ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {p}
            </button>
          )
        )}
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(page + 1)} disabled={page === totalPages} aria-label="Next page">
          <ChevronRight size={16} {...ICON} />
        </button>
        <button className={`${cell} text-slate-500 hover:bg-slate-50`} onClick={() => onPage(totalPages)} disabled={page === totalPages} aria-label="Last page">
          <ChevronsRight size={16} {...ICON} />
        </button>
      </nav>
    </div>
  )
}

// ── Contact drawer ─────────────────────────────────────────────
function ContactDrawer({ contact, jobOrders, onClose, onOpenJobOrders }) {
  const [tab, setTab] = useState('overview')
  useEscapeAndLock(onClose)

  const active = jobOrders.filter(j => ['Active', 'In Progress'].includes(j.status)).length
  const done = jobOrders.filter(j => ['Complete', 'Completed'].includes(j.status)).length

  const info = [
    { icon: Mail,       label: 'Email',   value: contact.email,   href: contact.email ? `mailto:${contact.email}` : null },
    { icon: Smartphone, label: 'Mobile',  value: contact.mobile,  href: contact.mobile ? `tel:${contact.mobile}` : null },
    { icon: Phone,      label: 'Phone',   value: contact.phone,   href: contact.phone ? `tel:${contact.phone}` : null, hideEmpty: true },
    { icon: MapPin,     label: 'Address', value: contact.address },
  ].filter(r => !(r.hideEmpty && !r.value))

  return (
    <div className="fixed inset-0 z-50">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={`${contact.full_name} details`}
        className="sc-drawer absolute right-0 top-0 h-full w-full max-w-[460px] bg-white shadow-2xl flex flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-slate-100 flex-shrink-0">
          <p className="text-sm font-medium text-slate-500">Contact details</p>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        {/* Profile */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0">
          <div className="flex items-start gap-4">
            <Avatar first={contact.first_name} last={contact.last_name} seed={contact.id} size="w-14 h-14" text="text-lg" />
            <div className="min-w-0 pt-0.5">
              <h3 className="text-lg font-semibold text-slate-900 leading-tight">{contact.full_name}</h3>
              <p className="text-sm text-slate-500 mt-0.5 tabular-nums">{contact.contact_code}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <TypeBadge type={contact.type} />
                <StatusBadge status={contact.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-5">
            <a href={contact.email ? `mailto:${contact.email}` : undefined}
              className={`${btnSecondary} px-2 ${!contact.email ? 'pointer-events-none opacity-50' : ''}`}>
              <Mail size={15} {...ICON} /> Email
            </a>
            <a href={contact.mobile ? `tel:${contact.mobile}` : undefined}
              className={`${btnSecondary} px-2 ${!contact.mobile ? 'pointer-events-none opacity-50' : ''}`}>
              <Phone size={15} {...ICON} /> Call
            </a>
            <button onClick={() => setTab('jobs')} className={`${btnSecondary} px-2`}>
              <Briefcase size={15} {...ICON} /> Jobs
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-slate-200 flex gap-6 flex-shrink-0">
          {[{ id: 'overview', label: 'Overview' }, { id: 'jobs', label: 'Job orders', count: jobOrders.length }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative -mb-px py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none ${
                tab === t.id ? 'border-emerald-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs tabular-nums ${tab === t.id ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll px-6 py-5">
          {tab === 'overview' ? (
            <div className="space-y-6">
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

              <section>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Job order summary</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total',     value: jobOrders.length, cls: 'text-slate-900' },
                    { label: 'Active',    value: active,           cls: 'text-amber-600' },
                    { label: 'Completed', value: done,             cls: 'text-emerald-700' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-slate-200 px-3 py-3">
                      <p className={`text-xl font-semibold tabular-nums ${s.cls}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : jobOrders.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No job orders yet" text="Job orders created for this client will appear here." />
          ) : (
            <ul className="space-y-2.5">
              {jobOrders.map((jo, i) => (
                <li key={jo.id} className="sc-rise rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-emerald-700 tabular-nums">{jo.job_order_code}</span>
                    <StatusBadge status={jo.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <p className="flex items-center gap-2 text-slate-700 min-w-0">
                      <HardHat size={14} {...ICON} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{jo.worker_name || 'Unassigned'}</span>
                    </p>
                    <p className="flex items-center gap-2 text-slate-700 min-w-0">
                      <Briefcase size={14} {...ICON} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{jo.contract_type || '—'}</span>
                    </p>
                    <p className="col-span-2 flex items-center gap-2 text-slate-500">
                      <CalendarDays size={14} {...ICON} className="text-slate-400 flex-shrink-0" />
                      {jo.start_date && jo.end_date ? `${jo.start_date} – ${jo.end_date}` : 'No dates set'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button onClick={onOpenJobOrders}
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:underline">
            Open in Job orders <ArrowRight size={14} {...ICON} />
          </button>
          <button onClick={onClose} className={btnSecondary}>Close</button>
        </div>
      </aside>
    </div>
  )
}

// ── New contact modal ──────────────────────────────────────────
function Field({ label, required, error, icon: Icon, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={16} {...ICON} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />}
        {children}
      </div>
      {error ? <p className="text-xs text-red-600 mt-1.5">{error}</p> : hint ? <p className="text-xs text-slate-500 mt-1.5">{hint}</p> : null}
    </div>
  )
}

function NewContactModal({ form, f, errors, saving, onClose, onSubmit }) {
  useEscapeAndLock(onClose)
  const input = (err, withIcon) =>
    `w-full h-10 ${withIcon ? 'pl-9' : 'pl-3'} pr-3 text-sm rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 transition-colors ${
      err ? 'border border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="sc-pop relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <UserPlus size={20} {...ICON} />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">New contact</h3>
              <p className="text-sm text-slate-500 mt-0.5">Add a client or organisation you work with.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1 custom-scroll space-y-6">
          {/* Type */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'client',       icon: User,      title: 'Client',       text: 'An individual customer' },
              { value: 'organisation', icon: Building2, title: 'Organisation', text: 'A company or agency' },
            ].map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => f('type', o.value)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  form.type === o.value ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${form.type === o.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <o.icon size={16} {...ICON} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{o.text}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Name */}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900 mb-3">Name</legend>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="sm:col-span-2">
                <Field label="First name" required error={errors.first_name}>
                  <input className={input(errors.first_name)} value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="Juan" autoFocus />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Last name" required error={errors.last_name}>
                  <input className={input(errors.last_name)} value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Dela Cruz" />
                </Field>
              </div>
              <Field label="Suffix">
                <input className={input()} value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="Jr." />
              </Field>
            </div>
          </fieldset>

          <div className="h-px bg-slate-100" />

          {/* Contact */}
          <fieldset>
            <legend className="text-sm font-semibold text-slate-900 mb-3">Contact information</legend>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Mobile" icon={Smartphone}>
                  <input className={input(null, true)} value={form.mobile} onChange={e => f('mobile', e.target.value)} placeholder="09XX XXX XXXX" inputMode="tel" />
                </Field>
                <Field label="Phone" icon={Phone}>
                  <input className={input(null, true)} value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="02 XXXX XXXX" inputMode="tel" />
                </Field>
              </div>
              <Field label="Email" icon={Mail} error={errors.email}>
                <input type="email" className={input(errors.email, true)} value={form.email} onChange={e => f('email', e.target.value)} placeholder="name@company.com" />
              </Field>
              <Field label="Address" icon={MapPin}>
                <textarea className={`${input(null, true)} h-auto py-2.5 resize-none`} rows={2} value={form.address} onChange={e => f('address', e.target.value)} placeholder="Street, barangay, city, province" />
              </Field>
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="hidden sm:block text-xs text-slate-500"><span className="text-red-500">*</span> Required fields</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onClose} className={`${btnSecondary} flex-1 sm:flex-none`}>Cancel</button>
            <button onClick={onSubmit} disabled={saving} className={`${btnPrimary} flex-1 sm:flex-none`}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} {...ICON} />}
              {saving ? 'Creating…' : 'Create contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Contacts Page ──────────────────────────────────────────────
const EMPTY_FORM = { first_name: '', last_name: '', suffix: '', email: '', mobile: '', phone: '', address: '', type: 'client', status_id: '1' }

export default function ContactsPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [contacts,   setContacts]   = useState([])
  const [jobOrders,  setJobOrders]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort,       setSort]       = useState({ key: 'full_name', dir: 'asc' })
  const [view,       setView]       = useState('table')
  const [page,       setPage]       = useState(1)
  const [perPage,    setPerPage]    = useState(10)
  const [selected,   setSelected]   = useState(null)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [errors,     setErrors]     = useState({})
  const [toast,      setToast]      = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM, type: location.state?.defaultType || 'client' })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(e => ({ ...e, [key]: undefined })) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cData, joData] = await Promise.all([
        apiGet('/api/contacts/list.php',   { per_page: 500 }),
        apiGet('/api/job-orders/list.php', { per_page: 500 }),
      ])
      setContacts((cData.contacts || []).filter(c => c.type === 'client' || c.type === 'organisation'))
      setJobOrders(joData.job_orders || [])
    } catch { showToast('Failed to load contacts.', 'error') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, typeFilter, statusFilter, perPage])

  // Job orders per contact
  const jobsFor = useCallback(c => jobOrders.filter(jo =>
    jo.client_name === c.full_name || String(jo.client_contact_id) === String(c.id)
  ), [jobOrders])

  const jobCounts = useMemo(() => {
    const m = {}
    contacts.forEach(c => { m[c.id] = jobsFor(c).length })
    return m
  }, [contacts, jobsFor])

  const statuses = useMemo(() => [...new Set(contacts.map(c => c.status).filter(Boolean))].sort(), [contacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = contacts.filter(c =>
      (typeFilter === 'all' || c.type === typeFilter) &&
      (statusFilter === 'all' || c.status === statusFilter) &&
      (!q || [c.full_name, c.email, c.mobile, c.contact_code].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = c => sort.key === 'jobs' ? (jobCounts[c.id] || 0) : String(c[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => {
      const A = val(a), B = val(b)
      const r = typeof A === 'number' ? A - B : A.localeCompare(B)
      return sort.dir === 'asc' ? r : -r
    })
  }, [contacts, search, typeFilter, statusFilter, sort, jobCounts])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  const stats = {
    total: contacts.length,
    orgs: contacts.filter(c => c.type === 'organisation').length,
    active: contacts.filter(c => c.status === 'Active').length,
    withJobs: contacts.filter(c => jobCounts[c.id] > 0).length,
  }

  const hasFilters = search || typeFilter !== 'all' || statusFilter !== 'all'
  const clearFilters = () => { setSearch(''); setTypeFilter('all'); setStatusFilter('all') }

  const handleCreate = async () => {
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'Enter a first name.'
    if (!form.last_name.trim()) errs.last_name = 'Enter a last name.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const data = await apiPost('/api/contacts/create.php', form)
      if (!data.success) throw new Error(data.error)
      showToast('Contact created')
      setShowForm(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) { showToast(err.message || 'Failed to create contact.', 'error') }
    setSaving(false)
  }

  const closeForm = useCallback(() => { setShowForm(false); setErrors({}) }, [])
  const closeDrawer = useCallback(() => setSelected(null), [])

  const rowActions = c => (
    <div className="flex items-center justify-end gap-0.5">
      <a href={c.email ? `mailto:${c.email}` : undefined} title="Send email" aria-label="Send email"
        className={`${iconBtn} ${!c.email ? 'pointer-events-none opacity-30' : ''}`}><Mail size={16} {...ICON} /></a>
      <a href={c.mobile ? `tel:${c.mobile}` : undefined} title="Call" aria-label="Call"
        className={`${iconBtn} ${!c.mobile ? 'pointer-events-none opacity-30' : ''}`}><Phone size={16} {...ICON} /></a>
      <button onClick={() => setSelected(c)} title="View details" aria-label="View details" className={iconBtn}><Eye size={16} {...ICON} /></button>
    </div>
  )

  return (
    <div className="max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">Clients and organisations you work with.</p>
        </div>
        <button onClick={() => setShowForm(true)} className={`${btnPrimary} self-start sm:self-auto`}>
          <UserPlus size={16} {...ICON} /> New contact
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MiniStat icon={Users}      label="Total contacts"   value={stats.total}    tone="bg-emerald-50 text-emerald-600" loading={loading} delay={0} />
        <MiniStat icon={BadgeCheck} label="Active"           value={stats.active}   tone="bg-sky-50 text-sky-600"         loading={loading} delay={50} />
        <MiniStat icon={Building2}  label="Organisations"    value={stats.orgs}     tone="bg-violet-50 text-violet-600"   loading={loading} delay={100} />
        <MiniStat icon={Briefcase}  label="With job orders"  value={stats.withJobs} tone="bg-amber-50 text-amber-600"     loading={loading} delay={150} />
      </div>

      {/* Main card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
          <div className="overflow-x-auto -mx-1 px-1">
            <Segmented
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: 'all',          label: 'All',           count: loading ? null : contacts.length },
                { value: 'client',       label: 'Clients',       count: loading ? null : contacts.length - stats.orgs },
                { value: 'organisation', label: 'Organisations', count: loading ? null : stats.orgs },
              ]}
            />
          </div>

          <div className="flex flex-1 items-center gap-2 lg:justify-end">
            <div className="relative flex-1 lg:max-w-xs">
              <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white shadow-sm placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                placeholder="Search name, email, mobile or code"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700">
                  <X size={14} {...ICON} />
                </button>
              )}
            </div>
            <SelectBox value={statusFilter} onChange={setStatusFilter} className="w-36 flex-shrink-0">
              <option value="all">All statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </SelectBox>
            <div className="hidden sm:inline-flex p-1 rounded-lg bg-slate-100 flex-shrink-0">
              {[{ v: 'table', icon: List, label: 'Table view' }, { v: 'grid', icon: LayoutGrid, label: 'Card view' }].map(o => (
                <button key={o.v} onClick={() => setView(o.v)} title={o.label} aria-label={o.label} aria-pressed={view === o.v}
                  className={`w-7 h-7 inline-flex items-center justify-center rounded-md transition-all ${view === o.v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <o.icon size={15} {...ICON} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {hasFilters && !loading && (
          <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 text-sm">
            <span className="text-slate-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {search && <Chip onRemove={() => setSearch('')}>“{search}”</Chip>}
            {typeFilter !== 'all' && <Chip onRemove={() => setTypeFilter('all')}><span className="capitalize">{typeFilter}</span></Chip>}
            {statusFilter !== 'all' && <Chip onRemove={() => setStatusFilter('all')}>{statusFilter}</Chip>}
            <button onClick={clearFilters} className="ml-auto text-sm font-medium text-emerald-700 hover:text-emerald-800">Clear all</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skel className="h-3 w-40" /><Skel className="h-2.5 w-24" /></div>
                <Skel className="hidden md:block h-3 w-32" />
                <Skel className="h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={Search} title="No matching contacts" text="Try a different search or remove a filter."
              action={<button onClick={clearFilters} className={btnSecondary}>Clear filters</button>} />
          ) : (
            <EmptyState icon={Users} title="No contacts yet" text="Add your first client to start creating job orders."
              action={<button onClick={() => setShowForm(true)} className={btnPrimary}><UserPlus size={16} {...ICON} /> New contact</button>} />
          )
        ) : (
          <>
            {/* Mobile list */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((c, i) => (
                <li key={c.id}>
                  <button onClick={() => setSelected(c)} className="sc-rise w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-slate-50" style={{ animationDelay: `${i * 30}ms` }}>
                    <Avatar first={c.first_name} last={c.last_name} seed={c.id} size="w-10 h-10" text="text-xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.full_name}</p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{c.contact_code} · {c.mobile || c.email || 'No contact info'}</p>
                    </div>
                    <ChevronRight size={16} {...ICON} className="text-slate-300 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>

            {view === 'table' ? (
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                      <SortHeader label="Contact"    sortKey="full_name" sort={sort} onSort={onSort} />
                      <SortHeader label="Type"       sortKey="type"      sort={sort} onSort={onSort} />
                      <th className="px-5 py-2.5 font-medium">Mobile / email</th>
                      <SortHeader label="Job orders" sortKey="jobs"      sort={sort} onSort={onSort} />
                      <SortHeader label="Status"     sortKey="status"    sort={sort} onSort={onSort} />
                      <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageItems.map((c, i) => (
                      <tr key={c.id} className="sc-rise group hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                        <td className="px-5 py-3">
                          <button onClick={() => setSelected(c)} className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md">
                            <Avatar first={c.first_name} last={c.last_name} seed={c.id} size="w-9 h-9" text="text-xs" />
                            <span>
                              <span className="block font-medium text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">{c.full_name}</span>
                              <span className="block text-xs text-slate-500 tabular-nums">{c.contact_code}</span>
                            </span>
                          </button>
                        </td>
                        <td className="px-5 py-3"><TypeBadge type={c.type} /></td>
                        <td className="px-5 py-3">
                          <p className="text-slate-700 tabular-nums">{c.mobile || <span className="text-slate-400">—</span>}</p>
                          {c.email && <p className="text-xs text-slate-500 truncate max-w-[220px]">{c.email}</p>}
                        </td>
                        <td className="px-5 py-3">
                          {jobCounts[c.id] ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-700 tabular-nums">
                              <Briefcase size={14} {...ICON} className="text-slate-400" />{jobCounts[c.id]}
                            </span>
                          ) : <span className="text-slate-400">None</span>}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-5 py-3">{rowActions(c)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-4 p-5 bg-slate-50/40">
                {pageItems.map((c, i) => (
                  <article key={c.id} className="sc-rise bg-white rounded-xl border border-slate-200 p-4 flex flex-col hover:border-slate-300 hover:shadow-md transition-all" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar first={c.first_name} last={c.last_name} seed={c.id} size="w-10 h-10" text="text-xs" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-xs text-slate-500 tabular-nums">{c.contact_code}</p>
                        </div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-4 space-y-1.5 text-sm">
                      <p className="flex items-center gap-2 text-slate-600 min-w-0"><Smartphone size={14} {...ICON} className="text-slate-400 flex-shrink-0" /><span className="truncate">{c.mobile || '—'}</span></p>
                      <p className="flex items-center gap-2 text-slate-600 min-w-0"><Mail size={14} {...ICON} className="text-slate-400 flex-shrink-0" /><span className="truncate">{c.email || '—'}</span></p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <TypeBadge type={c.type} />
                        <span className="text-xs text-slate-500 tabular-nums">{jobCounts[c.id] || 0} job{jobCounts[c.id] === 1 ? '' : 's'}</span>
                      </span>
                      <button onClick={() => setSelected(c)} className="text-sm font-medium text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1">
                        View <ArrowRight size={14} {...ICON} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <Pagination page={safePage} total={filtered.length} perPage={perPage} onPage={setPage} onPerPage={setPerPage} />
          </>
        )}
      </section>

      {selected && (
        <ContactDrawer
          contact={selected}
          jobOrders={jobsFor(selected)}
          onClose={closeDrawer}
          onOpenJobOrders={() => {
            const jos = jobsFor(selected)
            setSelected(null)
            navigate('/admin/job-orders', { state: { highlightClientId: jos[0]?.client_contact_id ?? selected.id, highlightClientName: jos[0]?.client_name ?? selected.full_name } })
          }}
        />
      )}

      {showForm && (
        <NewContactModal form={form} f={f} errors={errors} saving={saving} onClose={closeForm} onSubmit={handleCreate} />
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