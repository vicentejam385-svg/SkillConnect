// Shared look for the customer pages (same style as the admin and worker pages).
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertCircle } from 'lucide-react'

export const ICON = { strokeWidth: 1.75 }
export const MIN_SKELETON_MS = 600

export const cxStyles = `
  .cx-page, .cx-page h1, .cx-page h2, .cx-page h3, .cx-nav {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .cx-page :focus-visible, .cx-nav :focus-visible { outline: 2px solid #059669; outline-offset: 2px; border-radius: 8px; }
  @keyframes cx-shimmer { 100% { transform: translateX(100%); } }
  .cx-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .cx-skel::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); animation: cx-shimmer 1.2s infinite; }
  @keyframes cx-in     { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes cx-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cx-modal  { from { opacity: 0; transform: translateY(18px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes cx-pop    { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes cx-shake  { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .cx-rise   { animation: cx-in .6s cubic-bezier(.16,1,.3,1) both; }
  .cx-fadein { animation: cx-fadein .3s ease both; }
  .cx-modal  { animation: cx-modal .35s cubic-bezier(.16,1,.3,1) both; }
  .cx-pop    { animation: cx-pop .18s ease-out both; }
  .cx-shake  { animation: cx-shake .35s ease; }
  @media (prefers-reduced-motion: reduce) { .cx-skel::after, .cx-rise, .cx-fadein, .cx-modal, .cx-pop, .cx-shake { animation: none; } }
`

// ── Formatting ─────────────────────────────────────────────────
const toDate = s => {
  if (!s) return null
  const str = String(s)
  const d = new Date(str.length === 10 ? str + 'T00:00:00' : str.slice(0, 19).replace(' ', 'T'))
  return isNaN(d) ? null : d
}
export const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  const d = toDate(s)
  return d ? d.toLocaleDateString('en-PH', opts) : '—'
}
export const fmtTime = s => {
  const d = toDate(s)
  return d ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : ''
}
export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const isWeekend = s => { const d = new Date(s + 'T00:00:00'); return d.getDay() === 0 || d.getDay() === 6 }

// ── Classes ────────────────────────────────────────────────────
export const inputCls = 'w-full h-10 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed'
export const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5'
export const btnPrimary = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[.98] text-white text-sm font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed'
export const btnSecondary = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
export const btnSmPrimary = 'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed'
export const btnSmSecondary = 'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-medium text-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed'

// ── Pieces ─────────────────────────────────────────────────────
export const Skel = ({ className = '' }) => <div className={`cx-skel ${className}`} />

export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 3800)
  }
  return [toast, showToast]
}

export function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return createPortal(
    <div role="status" className={`cx-fadein fixed bottom-5 right-5 left-5 sm:left-auto z-[1100] flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg bg-white sm:max-w-sm
      ${ok ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-700'}`}>
      {ok ? <CheckCircle2 size={18} {...ICON} className="text-emerald-600 flex-shrink-0" /> : <AlertCircle size={18} {...ICON} className="text-red-500 flex-shrink-0" />}
      {toast.msg}
    </div>,
    document.body
  )
}

export function Modal({ onClose, children, maxW = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return createPortal(
    <div className="cx-fadein fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/20 backdrop-blur-[1px]"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={`cx-modal relative w-full ${maxW} max-h-[92vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden`}>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function ModalHeader({ title, sub, icon: Icon, onClose, badge }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Icon size={20} {...ICON} /></span>}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight truncate">{title}</h2>
            {badge}
          </div>
          {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0"><X size={18} {...ICON} /></button>
    </div>
  )
}

export function PageHeader({ title, sub, action }) {
  return (
    <div className="cx-rise flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <span className="w-14 h-14 rounded-2xl bg-slate-50 ring-1 ring-slate-200 text-slate-400 flex items-center justify-center mb-4"><Icon size={24} {...ICON} /></span>
      <p className="text-[15px] font-semibold text-slate-900">{title}</p>
      {text && <p className="text-sm text-slate-500 mt-1 max-w-xs">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// Job order statuses (same colors as the admin pages)
export const JOB_STATUS = {
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  'On Hold':      ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Active':       ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Scheduled':    ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500'],
  'In Progress':  ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500'],
  'Complete':     ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Cancelled':    ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
}

export function Pill({ label, cls, dot }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const [cls, dot] = JOB_STATUS[status] || ['bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400']
  return <Pill label={status || '—'} cls={cls} dot={dot} />
}

export function getCustomerInfo() {
  try { return JSON.parse(localStorage.getItem('sc_user') || '{}') }
  catch { return {} }
}