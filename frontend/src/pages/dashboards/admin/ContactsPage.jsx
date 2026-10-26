import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, Users, Search, RefreshCw, CheckCircle,
  AlertCircle, X, ArrowRight, Eye
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

// ── useNavigate (admin wrapper) ────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg border
      ${toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-red-50 border-red-200 text-red-700'}`}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {toast.msg}
    </div>
  )
}

// ── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = {
    'Pending':      'bg-yellow-100 text-yellow-700',
    'Active':       'bg-emerald-100 text-emerald-700',
    'Complete':     'bg-blue-100 text-blue-700',
    'Completed':    'bg-blue-100 text-blue-700',
    'On Hold':      'bg-orange-100 text-orange-700',
    'Under Review': 'bg-purple-100 text-purple-700',
    'Scheduled':    'bg-cyan-100 text-cyan-700',
    'In Progress':  'bg-amber-100 text-amber-700',
    'Cancelled':    'bg-red-100 text-red-700',
    'New':          'bg-sky-100 text-sky-700',
    'Won':          'bg-emerald-100 text-emerald-700',
    'Lost':         'bg-red-100 text-red-700',
    'Inactive':     'bg-gray-100 text-gray-600',
    'On Leave':     'bg-orange-100 text-orange-700',
    'Blacklisted':  'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status || '—'}
    </span>
  )
}

// ── Pagination ─────────────────────────────────────────────────
function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  const pages = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return (
    <div className="flex items-center justify-between px-1 mt-4">
      <p className="text-xs text-gray-400">
        Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-gray-400 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors
                ${p === page
                  ? 'bg-emerald-500 text-white border border-emerald-500'
                  : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  )
}
  // ── Contacts Page
export default function ContactsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [contacts,   setContacts]   = useState([])
const [search,     setSearch]     = useState('')
const [loading,    setLoading]    = useState(true)
const [showForm,   setShowForm]   = useState(false)
const [toast,      setToast]      = useState(null)
const [selected,   setSelected]   = useState(null)
const [jobOrders,  setJobOrders]  = useState([])
const [joLoading,  setJoLoading]  = useState(false)
const [showJoModal, setShowJoModal] = useState(false)
const [page,       setPage]       = useState(1)
const [total,      setTotal]      = useState(0)
const PER_PAGE = 3
  const [form, setForm] = useState({ first_name: '', last_name: '', suffix: '', email: '', mobile: '', phone: '', address: '', type: location.state?.defaultType || 'client', status_id: '1' })

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
  setShowJoModal(true)
  setSelected(null)
  try {
    const data = await apiGet('/api/job-orders/list.php', { per_page: 100 })
    const all = data.job_orders || []
    const filtered = all.filter(jo =>
      jo.client_name === contact.full_name ||
      String(jo.client_contact_id) === String(contact.id)
    )
    setJobOrders(filtered)
  } catch { showToast('Failed to load job orders.', 'error') }
  setJoLoading(false)
}
  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { load() }, [search, page])

  const handleCreate = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { showToast('First and last name are required.', 'error'); return }
    try {
      const data = await apiPost('/api/contacts/create.php', form)
      if (!data.success) throw new Error(data.error)
      showToast('Contact created!')
      setShowForm(false)
      setForm({ first_name: '', last_name: '', suffix: '', email: '', mobile: '', phone: '', address: '', type: 'client', status_id: '1' })
      load()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-gray-800 placeholder-gray-400"
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider"

  return (
    <div className="space-y-6 max-w-6xl">
      <Toast toast={toast} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Clients</p>
        </div>
        
      </div>

      <div className="relative w-full max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-gray-400"
          placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-emerald-500" />
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden divide-y divide-gray-50">
              {contacts.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm">No contacts found</p>
              ) : contacts.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600 flex-shrink-0">
                    {c.first_name?.[0]?.toUpperCase()}{c.last_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-emerald-600 font-semibold">{c.contact_code}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{c.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.mobile || c.email || '—'}</p>
                  </div>
                  <button
                    onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className={`p-1.5 rounded-md border transition-colors flex-shrink-0 ${selected?.id === c.id ? 'border-amber-300 text-amber-500 bg-amber-50' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    <Eye size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Code', 'Name', 'Type', 'Mobile / Email', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">No contacts found</td></tr>
                  ) : contacts.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{c.contact_code}</td>
                      <td className="px-5 py-3 text-gray-700 font-medium">{c.full_name}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize bg-gray-100 text-gray-600">{c.type}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs"><div>{c.mobile || '—'}</div>{c.email && <div className="text-gray-400">{c.email}</div>}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-5 py-3">
                        <button onClick={() => setSelected(selected?.id === c.id ? null : c)}
                          className={`p-1.5 rounded-md border transition-colors ${selected?.id === c.id ? 'border-amber-300 text-amber-500 bg-amber-50' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}>
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <span className="font-bold text-sm text-emerald-600">{selected.first_name?.[0]?.toUpperCase()}{selected.last_name?.[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{selected.full_name}</h3>
                  <span className="text-xs text-gray-400">{selected.contact_code}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-1 overflow-y-auto flex-1 custom-scroll">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold capitalize">{selected.type}</span>
                <StatusBadge status={selected.status} />
              </div>
              {[{ label: 'Full Name', value: selected.full_name }, { label: 'Email', value: selected.email }, { label: 'Mobile', value: selected.mobile }, { label: 'Phone', value: selected.phone }, { label: 'Address', value: selected.address }].filter(({ label, value }) => !(label === 'Phone' && !value)).map(({ label, value }) => (
  <div key={label} className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</span>
    <span className="text-sm text-gray-700 break-all">{value || '—'}</span>
  </div>
))}
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-100">
             <button onClick={() => loadJobOrders(selected)}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-600 font-semibold text-sm rounded-lg hover:bg-amber-100 transition-colors">
  <ClipboardList size={14} />View Job Orders
</button>
              <button onClick={() => setSelected(null)} className="px-4 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {showJoModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowJoModal(false)} />
    <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <ClipboardList size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-800">Job Orders</h3>
            <p className="text-xs text-gray-400">
              {joLoading ? 'Loading...' : `${jobOrders.length} job order${jobOrders.length !== 1 ? 's' : ''} found`}
            </p>
          </div>
        </div>
        <button onClick={() => setShowJoModal(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <X size={18} />
        </button>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {joLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-emerald-500" />
            <span className="text-gray-400 text-sm">Loading job orders...</span>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="block sm:hidden divide-y divide-gray-50">
              {jobOrders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <ClipboardList size={22} className="text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-sm">No job orders found for this client</p>
                </div>
              ) : jobOrders.map(jo => (
                <div key={jo.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs text-emerald-600 font-semibold">{jo.job_order_code}</span>
                    <StatusBadge status={jo.status} />
                  </div>
                  <p className="text-sm font-medium text-gray-700">{jo.worker_name || '—'}</p>
                  <p className="text-xs text-gray-400">{jo.contract_type || '—'} · {jo.start_date && jo.end_date ? `${jo.start_date} → ${jo.end_date}` : 'No dates'}</p>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['ID', 'Worker', 'Client', 'Contract', 'Period', 'Status'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <ClipboardList size={22} className="text-gray-400" />
                          </div>
                          <p className="text-gray-400 text-sm">No job orders found for this client</p>
                        </div>
                      </td>
                    </tr>
                  ) : jobOrders.map(jo => (
                    <tr key={jo.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{jo.job_order_code}</td>
                      <td className="px-5 py-3 text-gray-700">{jo.worker_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-500">{jo.client_name || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{jo.contract_type || '—'}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {jo.start_date && jo.end_date ? `${jo.start_date} → ${jo.end_date}` : '—'}
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
      {/* Footer */}
      <div className="p-5 border-t border-gray-100 bg-white flex justify-between items-center">
        <button
          onClick={() => { setShowJoModal(false); navigate('/admin/job-orders', { state: { highlightClientId: jobOrders[0]?.client_contact_id, highlightClientName: jobOrders[0]?.client_name } }) }}
          className="flex items-center gap-2 text-xs text-emerald-600 font-semibold hover:text-emerald-700"
        >
          <ArrowRight size={12} />Open in Job Orders page
        </button>
        <button onClick={() => setShowJoModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Close
        </button>
      </div>
    </div>
  </div>
)}

{showForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Users size={16} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">New Contact</h3>
                  <p className="text-xs text-gray-400">Fill in the contact details below</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scroll">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>First Name *</label><input className={inputCls} value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="First Name" /></div>
                <div><label className={labelCls}>Last Name *</label><input className={inputCls} value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Last Name" /></div>
              </div>
              <div><label className={labelCls}>Suffix</label><input className={inputCls} value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="Jr., Sr., III..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Mobile</label><input className={inputCls} value={form.mobile} onChange={e => f('mobile', e.target.value)} placeholder="09XX XXX XXXX" /></div>
                <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="02 XXXX XXXX" /></div>
              </div>
              <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={form.email} onChange={e => f('email', e.target.value)} /></div>
              <div><label className={labelCls}>Address</label><textarea className={`${inputCls} resize-none`} rows={2} value={form.address} onChange={e => f('address', e.target.value)} /></div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">Create Contact</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}