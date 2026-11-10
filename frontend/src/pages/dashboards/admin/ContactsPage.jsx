import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, UserPlus, Search, CheckCircle2, AlertCircle, X, ArrowRight,
  Eye, ChevronLeft, ChevronRight, Mail, Phone, Smartphone, MapPin, Users, Briefcase,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// ── Local styles (shared look with dashboard) ──────────────────
const styles = `
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #eef2f5; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  @keyframes sc-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-rise .4s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes sc-fade { from { opacity: 0; } to { opacity: 1; } }
  .sc-fade { animation: sc-fade .2s ease both; }
  @keyframes sc-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
  .sc-pop { animation: sc-pop .25s cubic-bezier(.2,.7,.2,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-fade, .sc-pop { animation: none; }
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
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize bg-slate-100 text-slate-600">
      {type || '—'}
    </span>
  )
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center px-6">
      <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center"><Icon size={20} {...ICON} /></div>
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      {text && <p className="text-xs text-slate-500 mt-1 max-w-[260px]">{text}</p>}
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="px-5 py-3.5 flex items-center gap-3">
      <Skel className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-2"><Skel className="h-3 w-1/3" /><Skel className="h-2.5 w-1/2" /></div>
      <Skel className="h-5 w-16 rounded-md" />
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div className="sc-pop fixed top-6 right-6 z-[60] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-lg text-sm text-slate-700">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {ok ? <CheckCircle2 size={16} {...ICON} /> : <AlertCircle size={16} {...ICON} />}
      </span>
      {toast.msg}
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
      <div role="dialog" aria-modal="true" className={`sc-pop relative w-full ${width} bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden`}>
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ icon: Icon, title, subtitle, onClose, children }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        {children || (
          <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Icon size={18} {...ICON} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <X size={18} {...ICON} />
      </button>
    </div>
  )
}

const btnPrimary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60'
const btnSecondary = 'inline-flex items-center justify-center gap-2 h-9 px-4 text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2'

// ── Pagination ─────────────────────────────────────────────────
function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (total === 0) return null
  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i)
    else if (pages[pages.length - 1] !== '...') pages.push('...')
  }
  const nav = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)}</span> of <span className="font-medium text-slate-700">{total}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(page - 1)} disabled={page === 1} className={nav} aria-label="Previous page">
            <ChevronLeft size={16} {...ICON} />
          </button>
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`d${i}`} className="w-8 text-center text-slate-400 text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  p === page ? 'bg-emerald-600 text-white' : 'text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={nav} aria-label="Next page">
            <ChevronRight size={16} {...ICON} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Contacts Page ──────────────────────────────────────────────
const EMPTY_FORM = { first_name: '', last_name: '', suffix: '', email: '', mobile: '', phone: '', address: '', type: 'client', status_id: '1' }

export default function ContactsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [contacts,    setContacts]    = useState([])
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [jobOrders,   setJobOrders]   = useState([])
  const [joLoading,   setJoLoading]   = useState(false)
  const [showJoModal, setShowJoModal] = useState(false)
  const [joClient,    setJoClient]    = useState(null)
  const [page,        setPage]        = useState(1)
  const [total,       setTotal]       = useState(0)
  const PER_PAGE = 3
  const [form, setForm] = useState({ ...EMPTY_FORM, type: location.state?.defaultType || 'client' })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/contacts/list.php', { search, per_page: PER_PAGE, page })
      const clientsOnly = (data.contacts || []).filter(c => c.type === 'client' || c.type === 'organisation')
      setContacts(clientsOnly)
      setTotal(data.pagination?.total ?? clientsOnly.length)
    } catch { showToast('Failed to load contacts.', 'error') }
    setLoading(false)
  }

  const loadJobOrders = async (contact) => {
    setJoLoading(true)
    setJobOrders([])
    setJoClient(contact)
    setShowJoModal(true)
    setSelected(null)
    try {
      const data = await apiGet('/api/job-orders/list.php', { per_page: 100 })
      const all = data.job_orders || []
      setJobOrders(all.filter(jo =>
        jo.client_name === contact.full_name ||
        String(jo.client_contact_id) === String(contact.id)
      ))
    } catch { showToast('Failed to load job orders.', 'error') }
    setJoLoading(false)
  }

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { load() }, [search, page])

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { showToast('First and last name are required.', 'error'); return }
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

  const inputCls = 'w-full h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5'

  const viewBtn = (c) => (
    <button
      onClick={() => setSelected(c)}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    >
      <Eye size={14} {...ICON} /> View
    </button>
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

      {/* Table card */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">All clients</h2>
            <p className="text-xs text-slate-500 mt-0.5">{loading ? 'Loading…' : `${total} contact${total !== 1 ? 's' : ''}`}</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              className="w-full h-9 pl-9 pr-9 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
              placeholder="Search by name, email or mobile"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700">
                <X size={14} {...ICON} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {Array.from({ length: PER_PAGE }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : contacts.length === 0 ? (
          <div className="border-t border-slate-100">
            <EmptyState
              icon={Users}
              title={search ? 'No matching contacts' : 'No contacts yet'}
              text={search ? `Nothing matches “${search}”. Try a different name or email.` : 'Add your first client to get started.'}
            />
          </div>
        ) : (
          <>
            {/* Mobile list */}
            <ul className="sm:hidden divide-y divide-slate-100 border-t border-slate-100">
              {contacts.map((c, i) => (
                <li key={c.id} className="sc-rise px-4 py-3.5 flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                  <Avatar first={c.first_name} last={c.last_name} seed={c.id} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.full_name}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      <span className="font-medium text-emerald-700">{c.contact_code}</span> · {c.mobile || c.email || '—'}
                    </p>
                  </div>
                  <button onClick={() => setSelected(c)} aria-label={`View ${c.full_name}`} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <Eye size={14} {...ICON} />
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50 border-y border-slate-100">
                    {['Code', 'Name', 'Type', 'Contact', 'Status', ''].map((h, i) => (
                      <th key={i} className="px-5 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c, i) => (
                    <tr key={c.id} className="sc-rise hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 40}ms` }}>
                      <td className="px-5 py-3 font-medium text-emerald-700 tabular-nums whitespace-nowrap">{c.contact_code}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar first={c.first_name} last={c.last_name} seed={c.id} size="w-7 h-7" />
                          <span className="text-slate-900 font-medium whitespace-nowrap">{c.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><TypeBadge type={c.type} /></td>
                      <td className="px-5 py-3">
                        <p className="text-slate-700">{c.mobile || '—'}</p>
                        {c.email && <p className="text-xs text-slate-500">{c.email}</p>}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-3 text-right">{viewBtn(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />}
      </section>

      {/* Contact details */}
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <ModalHeader title={selected.full_name} subtitle={selected.contact_code} onClose={() => setSelected(null)}>
            <Avatar first={selected.first_name} last={selected.last_name} seed={selected.id} size="w-10 h-10" text="text-sm" />
          </ModalHeader>
          <div className="px-5 py-4 overflow-y-auto flex-1 custom-scroll">
            <div className="flex items-center gap-2 mb-3">
              <TypeBadge type={selected.type} />
              <StatusBadge status={selected.status} />
            </div>
            <dl className="divide-y divide-slate-100">
              {[
                { icon: Mail,       label: 'Email',   value: selected.email },
                { icon: Smartphone, label: 'Mobile',  value: selected.mobile },
                { icon: Phone,      label: 'Phone',   value: selected.phone, hideEmpty: true },
                { icon: MapPin,     label: 'Address', value: selected.address },
              ].filter(r => !(r.hideEmpty && !r.value)).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 py-3">
                  <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm text-slate-900 break-words mt-0.5">{value || '—'}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
            <button onClick={() => loadJobOrders(selected)} className={`${btnPrimary} flex-1`}>
              <ClipboardList size={16} {...ICON} /> View job orders
            </button>
            <button onClick={() => setSelected(null)} className={btnSecondary}>Close</button>
          </div>
        </Modal>
      )}

      {/* Job orders */}
      {showJoModal && (
        <Modal onClose={() => setShowJoModal(false)} width="max-w-4xl">
          <ModalHeader
            icon={Briefcase}
            title={joClient ? `Job orders for ${joClient.full_name}` : 'Job orders'}
            subtitle={joLoading ? 'Loading…' : `${jobOrders.length} job order${jobOrders.length !== 1 ? 's' : ''}`}
            onClose={() => setShowJoModal(false)}
          />
          <div className="flex-1 overflow-y-auto custom-scroll">
            {joLoading ? (
              <div className="divide-y divide-slate-100">{[0, 1, 2].map(i => <RowSkeleton key={i} />)}</div>
            ) : jobOrders.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No job orders yet" text="Job orders created for this client will show up here." />
            ) : (
              <>
                <ul className="sm:hidden divide-y divide-slate-100">
                  {jobOrders.map(jo => (
                    <li key={jo.id} className="px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-emerald-700">{jo.job_order_code}</span>
                        <StatusBadge status={jo.status} />
                      </div>
                      <p className="text-sm text-slate-900 mt-1">{jo.worker_name || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {jo.contract_type || '—'} · {jo.start_date && jo.end_date ? `${jo.start_date} – ${jo.end_date}` : 'No dates'}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
                        {['Code', 'Worker', 'Client', 'Contract', 'Period', 'Status'].map(h => (
                          <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {jobOrders.map(jo => (
                        <tr key={jo.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 font-medium text-emerald-700 whitespace-nowrap">{jo.job_order_code}</td>
                          <td className="px-5 py-3 text-slate-900">{jo.worker_name || 'Unassigned'}</td>
                          <td className="px-5 py-3 text-slate-600">{jo.client_name || '—'}</td>
                          <td className="px-5 py-3 text-slate-600">{jo.contract_type || '—'}</td>
                          <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                            {jo.start_date && jo.end_date ? `${jo.start_date} – ${jo.end_date}` : '—'}
                          </td>
                          <td className="px-5 py-3"><StatusBadge status={jo.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
            <button
              onClick={() => {
                setShowJoModal(false)
                navigate('/admin/job-orders', { state: { highlightClientId: jobOrders[0]?.client_contact_id, highlightClientName: jobOrders[0]?.client_name } })
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:underline"
            >
              Open in Job orders <ArrowRight size={14} {...ICON} />
            </button>
            <button onClick={() => setShowJoModal(false)} className={btnSecondary}>Close</button>
          </div>
        </Modal>
      )}

      {/* New contact */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} width="max-w-2xl">
          <ModalHeader icon={UserPlus} title="New contact" subtitle="Add a client’s details" onClose={() => setShowForm(false)} />
          <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 custom-scroll">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First name <span className="text-red-500">*</span></label>
                <input className={inputCls} value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="Juan" />
              </div>
              <div>
                <label className={labelCls}>Last name <span className="text-red-500">*</span></label>
                <input className={inputCls} value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Dela Cruz" />
              </div>
            </div>
            <div className="sm:w-1/2 sm:pr-2">
              <label className={labelCls}>Suffix</label>
              <input className={inputCls} value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="Jr., Sr., III" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Mobile</label>
                <input className={inputCls} value={form.mobile} onChange={e => f('mobile', e.target.value)} placeholder="09XX XXX XXXX" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="02 XXXX XXXX" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={e => f('email', e.target.value)} placeholder="name@company.com" />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <textarea className={`${inputCls} h-auto py-2 resize-none`} rows={2} value={form.address} onChange={e => f('address', e.target.value)} placeholder="Street, city, province" />
            </div>
          </div>
          <div className="flex gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
            <button onClick={() => setShowForm(false)} className={`${btnSecondary} flex-1`}>Cancel</button>
            <button onClick={handleCreate} disabled={saving} className={`${btnPrimary} flex-1`}>
              {saving ? 'Creating…' : 'Create contact'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}