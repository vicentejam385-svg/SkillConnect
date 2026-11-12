import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus, Search, Pencil, AlertCircle, X, Loader2, CheckCircle2, ShieldCheck, Info, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown, ArrowUpDown,
  UserCog, Users, HardHat, CircleCheck, CircleSlash, Ban,
} from 'lucide-react'
import { validate } from '../../../utils/validators'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

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
const rowBtn = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
const inputCls = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'

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
  'Active':    ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Inactive':  ['bg-gray-50 text-gray-600 ring-gray-200',          'bg-gray-400'],
  'Suspended': ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
}
function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

const STATUS_OPTIONS = [
  { id: 1, label: 'Active',    text: 'Can sign in and use admin access.',        icon: CircleCheck, tone: 'text-emerald-600 bg-emerald-50' },
  { id: 2, label: 'Inactive',  text: 'Admin access is turned off for now.',      icon: CircleSlash, tone: 'text-slate-500 bg-slate-100' },
  { id: 3, label: 'Suspended', text: 'Blocked from signing in until restored.',  icon: Ban,         tone: 'text-red-600 bg-red-50' },
]

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="sc-pop fixed top-6 right-6 z-[80] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700 max-w-sm">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} {...ICON} /></span>
      {msg}
    </div>
  )
}

// ── Modal shell ────────────────────────────────────────────────
function Modal({ onClose, width = 'max-w-md', children }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sc-fade absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`sc-pop relative w-full ${width} bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 max-h-[92vh] flex flex-col overflow-hidden`}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ icon: Icon, title, subtitle, onClose, tone = 'bg-emerald-50 ring-emerald-100 text-emerald-600' }) {
  return (
    <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-5 border-b border-slate-100 flex-shrink-0">
      <div className="flex items-start gap-4 min-w-0">
        <span className={`w-11 h-11 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={20} {...ICON} /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className={iconBtn}><X size={18} {...ICON} /></button>
    </div>
  )
}

function ErrorNotice({ children }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
      <AlertCircle size={16} {...ICON} className="flex-shrink-0 mt-0.5 text-red-500" />{children}
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

// ── Change status modal ────────────────────────────────────────
function StatusModal({ user, onClose, onSave }) {
  const currentId = STATUS_OPTIONS.find(s => s.label === (user.status ?? 'Active'))?.id ?? 1
  const [statusId, setStatusId] = useState(currentId === 1 ? 2 : 1)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleConfirm = async () => {
    setSaving(true); setError('')
    try {
      await apiPost('/api/users/deactivate.php', { id: user.id, status_id: statusId })
      onSave(); onClose()
    } catch (err) { setError(err?.response?.data?.error || 'Could not update the status. Try again.') }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader icon={UserCog} title="Change status" subtitle={`For ${user.name}`} onClose={onClose} />
      <div className="px-6 py-5 space-y-3">
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <div className="space-y-2" role="radiogroup" aria-label="New status">
          {STATUS_OPTIONS.map(s => {
            const on = statusId === s.id
            const isCurrent = s.id === currentId
            return (
              <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setStatusId(s.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                  ${on ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.tone}`}><s.icon size={18} {...ICON} /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {s.label}{isCurrent && <span className="text-[11px] font-normal text-slate-500">(current)</span>}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">{s.text}</span>
                </span>
                <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${on ? 'border-emerald-600 bg-emerald-600 shadow-[inset_0_0_0_2px_white]' : 'border-slate-300'}`} />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
        <button onClick={onClose} className={btnSecondary}>Cancel</button>
        <button onClick={handleConfirm} disabled={saving || statusId === currentId}
          className={statusId === 3
            ? 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm disabled:opacity-60'
            : btnPrimary}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Saving…' : `Set as ${STATUS_OPTIONS.find(s => s.id === statusId)?.label.toLowerCase()}`}
        </button>
      </div>
    </Modal>
  )
}

// ── Create / edit admin modal ──────────────────────────────────
function AdminUserModal({ onClose, onSave, editUser = null }) {
  const [form, setForm] = useState({
    name: editUser?.name || '', username: editUser?.username || '',
    type: editUser?.type || 'admin',
    worker_id: '',
  })
  const [workers, setWorkers]           = useState([])
  const [workersLoading, setWLoading]   = useState(!editUser)
  const [errors, setErrors]             = useState({})
  const [saving, setSaving]             = useState(false)
  const f = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })) }

  useEffect(() => {
    if (!editUser) {
      apiGet('/api/workers/list.php').then(d => setWorkers(d.workers || [])).catch(() => {}).finally(() => setWLoading(false))
    }
  }, [])

  const validateForm = () => {
    const e = {}
    const nv = validate.name(form.name);         if (nv !== true) e.name = editUser ? nv : 'Select a worker.'
    const uv = validate.username(form.username); if (uv !== true) e.username = uv
    setErrors(e); return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      if (editUser) await apiPut('/api/users/update.php', { id: editUser.id, ...form })
      else          await apiPost('/api/users/create.php', form)
      onSave(); onClose()
    } catch (err) { setErrors({ api: err?.response?.data?.error || 'Could not save. Try again.' }) }
    finally { setSaving(false) }
  }

  const selectedWorker = workers.find(w => String(w.id) === String(form.worker_id))
  const errCls = key => errors[key] ? '!border-red-300 focus:!border-red-500 focus:!ring-red-500/20' : ''

  return (
    <Modal onClose={onClose} width="max-w-lg">
      <ModalHeader
        icon={editUser ? Pencil : ShieldCheck}
        title={editUser ? 'Edit admin user' : 'Create admin user'}
        subtitle={editUser ? `Update ${editUser.name}’s details.` : 'Give a worker access to the admin side.'}
        onClose={onClose}
      />

      <div className="px-6 py-5 space-y-5 overflow-y-auto custom-scroll">
        {errors.api && <ErrorNotice>{errors.api}</ErrorNotice>}

        {editUser ? (
          <>
            <div>
              <label className={labelCls}>Full name</label>
              <input className={`${inputCls} ${errCls('name')}`} value={form.name} onChange={e => f('name', e.target.value)} placeholder="Juan dela Cruz" autoFocus />
              {errors.name && <p className="text-xs text-red-600 mt-1.5">{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input className={`${inputCls} ${errCls('username')}`} value={form.username} onChange={e => f('username', e.target.value)} placeholder="juan_delacruz" />
              {errors.username ? <p className="text-xs text-red-600 mt-1.5">{errors.username}</p> : <p className="text-xs text-slate-500 mt-1.5">At least 5 characters, no special characters.</p>}
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelCls}>Worker</label>
              <div className="relative">
                <select
                  className={`${inputCls} appearance-none pr-9 cursor-pointer ${errCls('name')}`}
                  value={form.worker_id}
                  disabled={workersLoading}
                  onChange={e => {
                    const w = workers.find(w => String(w.id) === String(e.target.value))
                    setErrors({})
                    setForm(p => ({ ...p, worker_id: e.target.value, name: w ? w.full_name : '', username: w ? (w.username || '') : '' }))
                  }}
                >
                  <option value="">{workersLoading ? 'Loading workers…' : 'Select a worker'}</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}{w.specialization ? ` — ${w.specialization}` : ''}</option>)}
                </select>
                <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              {errors.name && <p className="text-xs text-red-600 mt-1.5">{errors.name}</p>}
            </div>

            {selectedWorker && (
              <div className="sc-pop flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <Avatar name={selectedWorker.full_name} size="w-10 h-10" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{selectedWorker.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {form.username ? `@${form.username}` : 'No username'}{selectedWorker.specialization ? ` · ${selectedWorker.specialization}` : ''}
                  </p>
                </div>
                <HardHat size={16} {...ICON} className="text-slate-400 flex-shrink-0" />
              </div>
            )}
            {errors.username && <p className="text-xs text-red-600 -mt-3">{errors.username}</p>}

            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg border border-sky-200 bg-sky-50 text-sm text-sky-800">
              <Info size={16} {...ICON} className="flex-shrink-0 mt-0.5 text-sky-500" />
              <p>This worker signs in with their usual worker login, then switches to admin access from their dashboard.</p>
            </div>
          </>
        )}

        <div>
          <label className={labelCls}>Role</label>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500 p-3">
            <span className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0"><ShieldCheck size={18} {...ICON} /></span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Admin</p>
              <p className="text-xs text-slate-500">Manages contacts, workers, job orders and schedules.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
        <button onClick={onClose} disabled={saving} className={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : editUser ? <CheckCircle2 size={16} {...ICON} /> : <Plus size={16} {...ICON} />}
          {saving ? 'Saving…' : editUser ? 'Save changes' : 'Create admin'}
        </button>
      </div>
    </Modal>
  )
}

// ── Admin Users Page ───────────────────────────────────────────
export default function AdminUsersPage() {
  const [users,        setUsers]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sort,         setSort]         = useState({ key: 'name', dir: 'asc' })
  const [page,         setPage]         = useState(1)
  const [perPage,      setPerPage]      = useState(10)
  const [showModal,    setShowModal]    = useState(false)
  const [editUser,     setEditUser]     = useState(null)
  const [statusUser,   setStatusUser]   = useState(null)
  const [toast,        setToast]        = useState(null)
  const showToast = m => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    try { const d = await apiGet('/api/users/list.php'); setUsers(d.users || []) } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, filterStatus, perPage])

  const rows = useMemo(() => users.map(u => ({ ...u, _status: u.status ?? 'Active', _code: u.admin_code ?? `ADM${String(u.id).padStart(3, '0')}` })), [users])
  const counts = useMemo(() => {
    const c = { all: rows.length, Active: 0, Inactive: 0, Suspended: 0 }
    rows.forEach(r => { if (c[r._status] != null) c[r._status]++ })
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter(u =>
      (!filterStatus || u._status === filterStatus) &&
      (!q || [u.name, u.username, u.email, u._code].some(v => String(v || '').toLowerCase().includes(q)))
    )
    const val = u => String(sort.key === '_code' ? u._code : u[sort.key] || '').toLowerCase()
    return [...list].sort((a, b) => { const r = val(a).localeCompare(val(b), undefined, { numeric: true }); return sort.dir === 'asc' ? r : -r })
  }, [rows, search, filterStatus, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage)
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  const hasFilters = search || filterStatus

  const openCreate = () => { setEditUser(null); setShowModal(true) }
  const closeModal = useCallback(() => setShowModal(false), [])
  const closeStatus = useCallback(() => setStatusUser(null), [])

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>
      <Toast msg={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">Admin users</h1>
          <p className="text-sm text-slate-500 mt-1">People who can manage SkillConnect from the admin side.</p>
        </div>
        <button onClick={openCreate} className={`${btnPrimary} self-start sm:self-auto`}><Plus size={16} {...ICON} /> Create admin</button>
      </div>

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-100">
          <StatusDropdown
            value={filterStatus}
            onChange={setFilterStatus}
            loading={loading}
            options={[
              { value: '',          label: 'All statuses', count: counts.all },
              { value: 'Active',    label: 'Active',       count: counts.Active,    dot: 'bg-emerald-500' },
              { value: 'Inactive',  label: 'Inactive',     count: counts.Inactive,  dot: 'bg-gray-400' },
              { value: 'Suspended', label: 'Suspended',    count: counts.Suspended, dot: 'bg-red-500' },
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <Skel className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skel className="h-3 w-40" /><Skel className="h-2.5 w-24" /></div>
                <Skel className="hidden md:block h-3 w-32" />
                <Skel className="h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center">
              {hasFilters ? <Search size={22} {...ICON} /> : <Users size={22} {...ICON} />}
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">{hasFilters ? 'No matching admin users' : 'No admin users yet'}</p>
            <p className="text-sm text-slate-500 mt-1 max-w-[300px]">{hasFilters ? 'Try a different search or status.' : 'Give a worker admin access to get started.'}</p>
            <div className="mt-4">
              {hasFilters
                ? <button onClick={() => { setSearch(''); setFilterStatus('') }} className={btnSecondary}>Clear filters</button>
                : <button onClick={openCreate} className={btnPrimary}><Plus size={16} {...ICON} /> Create admin</button>}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <ul className="sm:hidden divide-y divide-slate-100">
              {pageItems.map((u, i) => (
                <li key={u.id} className="sc-rise px-4 py-3.5 flex items-center gap-3" style={{ animationDelay: `${i * 30}ms` }}>
                  <Avatar name={u.name} size="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                      <StatusBadge status={u._status} />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{u._code} · {u.email || (u.username ? `@${u.username}` : '—')}</p>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => { setEditUser(u); setShowModal(true) }} className={rowBtn}><Pencil size={14} {...ICON} /> Edit</button>
                      <button onClick={() => setStatusUser(u)} className={rowBtn}><UserCog size={14} {...ICON} /> Status</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50/80 border-b border-slate-100">
                    <SortHeader label="Admin"            sortKey="name"     sort={sort} onSort={onSort} />
                    <SortHeader label="Admin ID"         sortKey="_code"    sort={sort} onSort={onSort} />
                    <SortHeader label="Email / username" sortKey="username" sort={sort} onSort={onSort} />
                    <SortHeader label="Status"           sortKey="_status"  sort={sort} onSort={onSort} />
                    <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((u, i) => (
                    <tr key={u.id} className="sc-rise hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 25}ms` }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <span>
                            <span className="block font-medium text-slate-900 whitespace-nowrap">{u.name}</span>
                            <span className="block text-xs text-slate-500">{u.type === 'super_admin' ? 'Super admin' : 'Admin'}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700 tabular-nums">{u._code}</td>
                      <td className="px-5 py-3">
                        <p className="text-slate-700">{u.email || (u.username ? `@${u.username}` : '—')}</p>
                        {u.email && u.username && <p className="text-xs text-slate-500">@{u.username}</p>}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={u._status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => { setEditUser(u); setShowModal(true) }} className={rowBtn}><Pencil size={14} {...ICON} /> Edit</button>
                          <button onClick={() => setStatusUser(u)} className={rowBtn}><UserCog size={14} {...ICON} /> Status</button>
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

      {showModal && (
        <AdminUserModal editUser={editUser} onClose={closeModal}
          onSave={() => { load(); showToast(editUser ? 'Admin user updated' : 'Admin user created') }} />
      )}
      {statusUser && (
        <StatusModal user={statusUser} onClose={closeStatus}
          onSave={() => { load(); showToast('Status updated') }} />
      )}
    </div>
  )
}