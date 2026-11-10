// src/pages/dashboards/admin/ui.jsx
// Shared UI kit for every admin page: buttons, cards, filters, tables, modals, badges, toast.
import { useEffect, useRef } from 'react'
import {
  X, Search, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react'

export const cx = (...c) => c.filter(Boolean).join(' ')

// ── Global styles (injected once, also works when admin pages run inside the worker layout)
if (typeof document !== 'undefined' && !document.getElementById('admin-ui-styles')) {
  const s = document.createElement('style')
  s.id = 'admin-ui-styles'
  s.textContent = `
    .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #a8a29e; }
    @keyframes adminFadeIn  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes adminModalIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
    @keyframes adminToastIn { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: none } }
    .anim-fade  { animation: adminFadeIn .15s ease-out; }
    .anim-modal { animation: adminModalIn .22s cubic-bezier(.16,1,.3,1); }
    .anim-toast { animation: adminToastIn .2s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .anim-fade, .anim-modal, .anim-toast { animation: none; }
    }
  `
  document.head.appendChild(s)
}

// ── Tones ──────────────────────────────────────────────────────
const TILE_TONES = {
  emerald: 'bg-emerald-50 text-emerald-700',
  blue:    'bg-blue-50 text-blue-700',
  amber:   'bg-amber-50 text-amber-700',
  cyan:    'bg-cyan-50 text-cyan-700',
  violet:  'bg-violet-50 text-violet-700',
  red:     'bg-red-50 text-red-700',
  stone:   'bg-stone-100 text-stone-600',
}

export function IconTile({ icon: Icon, tone = 'emerald', size = 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  return (
    <div className={cx('flex flex-shrink-0 items-center justify-center rounded-lg', box, TILE_TONES[tone] || TILE_TONES.stone)}>
      <Icon size={size === 'sm' ? 15 : 17} />
    </div>
  )
}

// ── Form styles ────────────────────────────────────────────────
export const inputCls =
  'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm ' +
  'placeholder:text-stone-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 ' +
  'focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500'
export const readOnlyCls = 'bg-stone-50 text-stone-600 cursor-not-allowed'
export const labelCls = 'mb-1.5 block text-sm font-medium text-stone-700'

export function Field({ label, required, optional, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className={labelCls}>
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
          {optional && <span className="ml-1 font-normal text-stone-400">(optional)</span>}
        </label>
      )}
      {children}
      {hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>}
    </div>
  )
}

// ── Buttons ────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary:   'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800',
  secondary: 'border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-50',
  danger:    'border border-red-200 bg-white text-red-700 shadow-sm hover:bg-red-50',
  ghost:     'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
}
const BTN_SIZES = { sm: 'h-8 gap-1.5 px-3 text-xs', md: 'h-9 gap-2 px-4 text-sm' }

export function Button({
  variant = 'primary', size = 'md', icon: Icon, loading = false,
  className = '', children, type = 'button', ...props
}) {
  const iconSize = size === 'sm' ? 13 : 15
  return (
    <button
      type={type}
      {...props}
      disabled={loading || props.disabled}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BTN_VARIANTS[variant], BTN_SIZES[size], className,
      )}
    >
      {loading ? <RefreshCw size={iconSize} className="animate-spin" /> : Icon ? <Icon size={iconSize} /> : null}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white',
        'text-stone-500 shadow-sm transition-colors hover:bg-stone-50 hover:text-stone-900',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
        className,
      )}
    >
      <Icon size={15} />
    </button>
  )
}

export function TextButton({ className = '', children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1 rounded text-sm font-medium text-emerald-700',
        'transition-colors hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ── Layout pieces ──────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ className = '', children }) {
  return <div className={cx('rounded-xl border border-stone-200 bg-white', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, action, icon, tone = 'emerald' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-stone-900">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-stone-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function SectionLabel({ children, className = '' }) {
  return <p className={cx('mb-2 text-sm font-semibold text-stone-900', className)}>{children}</p>
}

export function Code({ children, tone = 'emerald' }) {
  const tones = { emerald: 'text-emerald-700', amber: 'text-amber-700', blue: 'text-blue-700', stone: 'text-stone-500' }
  return <span className={cx('text-xs font-semibold tabular-nums tracking-wide', tones[tone])}>{children}</span>
}

// ── Avatar ─────────────────────────────────────────────────────
const AVATAR_TONES = [
  'bg-emerald-100 text-emerald-800', 'bg-blue-100 text-blue-800', 'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-cyan-100 text-cyan-800',
]
export function Avatar({ name = '', size = 'md' }) {
  const clean = (name || '').trim()
  const initials = clean.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  let h = 0
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const sizes = { sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }
  return (
    <div className={cx('flex flex-shrink-0 items-center justify-center rounded-full font-semibold', AVATAR_TONES[h % AVATAR_TONES.length], sizes[size])}>
      {initials}
    </div>
  )
}

// ── Badges ─────────────────────────────────────────────────────
const BADGE = {
  emerald: ['bg-emerald-50 text-emerald-800 ring-emerald-600/20', 'bg-emerald-500'],
  blue:    ['bg-blue-50 text-blue-800 ring-blue-600/20',          'bg-blue-500'],
  amber:   ['bg-amber-50 text-amber-800 ring-amber-600/25',       'bg-amber-500'],
  orange:  ['bg-orange-50 text-orange-800 ring-orange-600/20',    'bg-orange-500'],
  violet:  ['bg-violet-50 text-violet-800 ring-violet-600/20',    'bg-violet-500'],
  cyan:    ['bg-cyan-50 text-cyan-800 ring-cyan-600/20',          'bg-cyan-500'],
  sky:     ['bg-sky-50 text-sky-800 ring-sky-600/20',             'bg-sky-500'],
  red:     ['bg-red-50 text-red-800 ring-red-600/20',             'bg-red-500'],
  stone:   ['bg-stone-100 text-stone-700 ring-stone-500/20',      'bg-stone-400'],
}

const STATUS_TONE = {
  Pending: 'amber', Active: 'emerald', Complete: 'blue', Completed: 'blue', 'On Hold': 'orange',
  'Under Review': 'violet', Scheduled: 'cyan', 'In Progress': 'amber', Cancelled: 'red', New: 'sky',
  Won: 'emerald', Lost: 'red', Inactive: 'stone', 'On Leave': 'orange', Blacklisted: 'red',
  Suspended: 'red', Valid: 'emerald', 'Expiring Soon': 'amber', Expired: 'red',
}
export const statusTone = (status) => STATUS_TONE[status] || 'stone'

export function Badge({ tone = 'stone', dot = true, className = '', children }) {
  const [cls, dotCls] = BADGE[tone] || BADGE.stone
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', cls, className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', dotCls)} />}
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  return <Badge tone={statusTone(status)}>{status || '—'}</Badge>
}

// ── Callout ────────────────────────────────────────────────────
const CALLOUT = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  amber:   'border-amber-200 bg-amber-50 text-amber-900',
  red:     'border-red-200 bg-red-50 text-red-900',
  blue:    'border-blue-200 bg-blue-50 text-blue-900',
  stone:   'border-stone-200 bg-stone-50 text-stone-700',
}
export function Callout({ tone = 'stone', icon: Icon, title, children, className = '' }) {
  return (
    <div className={cx('flex gap-3 rounded-lg border px-3.5 py-3 text-sm', CALLOUT[tone], className)}>
      {Icon && <Icon size={16} className="mt-0.5 flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && 'mt-1', 'leading-relaxed')}>{children}</div>}
      </div>
    </div>
  )
}

// ── Filters ────────────────────────────────────────────────────
export function FilterBar({ children }) {
  return <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={cx('relative w-full sm:w-72', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(inputCls, 'h-9 py-0 pl-9 pr-8')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

export function FilterSelect({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cx(inputCls, 'h-9 w-full py-0 pr-8 sm:w-auto', value ? 'border-emerald-600/60 text-stone-900' : 'text-stone-600', className)}
    >
      {children}
    </select>
  )
}

// ── Table ──────────────────────────────────────────────────────
export function Table({ headers, children }) {
  return (
    <div className="custom-scroll overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {headers.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={cx('whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-stone-500', h === '' && 'text-right')}
              >
                {h === '' ? <span className="sr-only">Actions</span> : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  )
}
export const trCls = 'transition-colors hover:bg-stone-50'
export const tdCls = 'px-5 py-3.5 align-middle text-stone-700'

// ── Empty + loading states ─────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <Icon size={20} />
        </div>
      )}
      <p className="text-sm font-medium text-stone-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-stone-500">
      <RefreshCw size={16} className="animate-spin text-emerald-700" />
      {label}
    </div>
  )
}

// ── Detail list (label / value rows) ───────────────────────────
export function DetailList({ items }) {
  return (
    <dl className="divide-y divide-stone-100">
      {items.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[7rem_1fr] gap-4 py-2.5">
          <dt className="text-sm text-stone-500">{label}</dt>
          <dd className="break-words text-sm text-stone-900">{value || <span className="text-stone-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Pagination ─────────────────────────────────────────────────
export function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  const pages = []
  const delta = 1
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) pages.push(i)
    else if (pages[pages.length - 1] !== '...') pages.push('...')
  }
  const from = Math.min((page - 1) * perPage + 1, total)
  const to   = Math.min(page * perPage, total)
  const navBtn = 'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex flex-col gap-3 border-t border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-stone-500">
        Showing <span className="font-medium text-stone-800">{from}</span> to{' '}
        <span className="font-medium text-stone-800">{to}</span> of{' '}
        <span className="font-medium text-stone-800">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page"
          className={cx(navBtn, 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50')}>
          <ChevronLeft size={14} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1.5 text-xs text-stone-400">…</span>
          ) : (
            <button key={p} type="button" onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}
              className={cx(navBtn, p === page
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50')}>
              {p}
            </button>
          )
        )}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Next page"
          className={cx(navBtn, 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50')}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────
export function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="anim-toast fixed inset-x-4 top-4 z-[80] sm:inset-x-auto sm:right-6 sm:top-6 sm:w-96" role="status" aria-live="polite">
      <div className={cx('flex items-start gap-3 rounded-lg border bg-white p-3.5 shadow-lg', ok ? 'border-emerald-200' : 'border-red-200')}>
        <div className={cx('mt-0.5 flex-shrink-0', ok ? 'text-emerald-700' : 'text-red-600')}>
          {ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
        </div>
        <p className="min-w-0 flex-1 break-words text-sm text-stone-800">{toast.msg}</p>
      </div>
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────
const MODAL_SIZES = {
  sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', '2xl': 'sm:max-w-5xl',
}
const modalStack = []

export function Modal({
  onClose, title, subtitle, icon, tone = 'emerald', leading,
  size = 'md', footer, children, bodyClassName, z = 'z-50',
}) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const id = Symbol('modal')
    modalStack.push(id)
    const onKey = (e) => {
      // Only the top-most modal reacts to Escape
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current?.()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      const idx = modalStack.indexOf(id)
      if (idx !== -1) modalStack.splice(idx, 1)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div className={cx('fixed inset-0 flex items-end justify-center sm:items-center sm:p-4', z)} role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-stone-900/50" onClick={onClose} />
      <div className={cx(
        'anim-modal relative flex max-h-[92vh] w-full flex-col bg-white shadow-2xl',
        'rounded-t-2xl sm:rounded-xl', MODAL_SIZES[size] || MODAL_SIZES.md,
      )}>
        {(title || icon || leading) && (
          <div className="flex items-start gap-3 border-b border-stone-200 px-5 py-4 sm:px-6">
            {leading || (icon && <IconTile icon={icon} tone={tone} />)}
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="truncate text-base font-semibold text-stone-900">{title}</h3>
              {subtitle && <div className="mt-0.5 text-sm text-stone-500">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cx('custom-scroll flex-1 overflow-y-auto', bodyClassName ?? 'px-5 py-5 sm:px-6')}>
          {children}
        </div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:rounded-b-xl sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}