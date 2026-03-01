import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatsCard from '../../components/StatsCard'
import {
  ClipboardList, Calendar, Users, Plus, Search, RefreshCw,
  Edit2, CheckCircle, AlertCircle, X, ArrowRight,
  FileText, HardHat, Building2, Settings
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../utils/api'
import WorkersPage from './WorkersPage'
import LicensesPage, { ContactLicensesPanel } from './LicensesPage'


const NAV_ITEMS = [
  { type: 'section', label: 'Operations' },
  { path: '/admin/dashboard',  label: 'Dashboard',     icon: Users         },
  { path: '/admin/contacts',   label: 'Contacts',      icon: Users         },
  { path: '/admin/workers',    label: 'Workers',        icon: HardHat       },
  { path: '/admin/licenses',   label: 'Licenses',      icon: FileText      },
  { path: '/admin/inquiries',  label: 'Inquiries',     icon: FileText      },
  { path: '/admin/job-orders', label: 'Job Orders',    icon: ClipboardList },
  { path: '/admin/scheduling', label: 'Scheduling',    icon: Calendar      },
  { type: 'section', label: 'System' },
  { path: '/admin/config',     label: 'Configuration', icon: Settings      },
]

// ── Shared Toast ───────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 font-body text-sm border
      ${toast.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {toast.msg}
    </div>
  )
}

// ── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = {
    'Pending':      'bg-yellow-500/10 text-yellow-400',
    'Active':       'bg-emerald-500/10 text-emerald-400',
    'Complete':     'bg-blue-500/10 text-blue-400',
    'On Hold':      'bg-orange-500/10 text-orange-400',
    'Under Review': 'bg-purple-500/10 text-purple-400',
    'Scheduled':    'bg-cyan-500/10 text-cyan-400',
    'In Progress':  'bg-amber-500/10 text-amber-400',
    'Cancelled':    'bg-red-500/10 text-red-400',
    'New':          'bg-sky-500/10 text-sky-400',
    'Won':          'bg-emerald-500/10 text-emerald-400',
    'Lost':         'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`status-badge ${colors[status] || 'bg-slate-500/10 text-slate-400'}`}>
      {status || '—'}
    </span>
  )
}

// ── Admin Home ─────────────────────────────────────────────────
function AdminHome() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ inquiries: 0, jobOrders: 0, schedules: 0, contacts: 0 })

  useEffect(() => {
    apiGet('/api/inquiries/list.php',  { per_page: 1 }).then(d => setCounts(p => ({ ...p, inquiries: d.pagination?.total || 0 }))).catch(() => {})
    apiGet('/api/job-orders/list.php', { per_page: 1 }).then(d => setCounts(p => ({ ...p, jobOrders: d.pagination?.total || 0 }))).catch(() => {})
    apiGet('/api/schedules/list.php',  { per_page: 1 }).then(d => setCounts(p => ({ ...p, schedules: d.pagination?.total || 0 }))).catch(() => {})
    apiGet('/api/contacts/list.php',   { per_page: 1 }).then(d => setCounts(p => ({ ...p, contacts: d.pagination?.total || 0 }))).catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display font-bold text-3xl text-slate-100 tracking-wide">Dashboard</h2>
        <p className="font-body text-slate-400 text-sm mt-1">Admin Portal — Emerald Builders & Construction</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={FileText}     label="Inquiries"   value={counts.inquiries} sub="Total inquiries"   accent="amber"   />
        <StatsCard icon={ClipboardList} label="Job Orders" value={counts.jobOrders} sub="All job orders"    accent="blue"    />
        <StatsCard icon={Calendar}     label="Schedules"   value={counts.schedules} sub="All schedules"     accent="emerald" />
        <StatsCard icon={Users}        label="Contacts"    value={counts.contacts}  sub="All contacts"      accent="purple"  />
      </div>
      <div>
        <h3 className="font-display font-bold text-lg text-slate-300 tracking-wide mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'New Inquiry',   sub: 'Record a new client inquiry',   path: '/admin/inquiries',  icon: FileText,      color: 'amber'   },
            { label: 'New Job Order', sub: 'Create a new job order',        path: '/admin/job-orders', icon: ClipboardList, color: 'blue'    },
            { label: 'New Schedule',  sub: 'Schedule a worker assignment',   path: '/admin/schedules',  icon: Calendar,      color: 'emerald' },
          ].map(q => (
            <button key={q.label} onClick={() => navigate(q.path)}
              className="card-steel p-5 text-left hover:border-amber-500/30 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <q.icon size={18} className="text-amber-400" />
                <span className="font-display font-bold text-slate-100 tracking-wide">{q.label}</span>
              </div>
              <p className="font-body text-xs text-slate-500">{q.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Inquiries Page ─────────────────────────────────────────────
function InquiriesPage() {
  const navigate = useNavigate()
  const [inquiries, setInquiries] = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [showForm,  setShowForm]  = useState(false)
  const [statuses,  setStatuses]  = useState([])
  const [editItem,  setEditItem]  = useState(null)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', mobile: '', address: '', description: '', reason: '', status_id: ''
  })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const [inqData, stData] = await Promise.all([
        apiGet('/api/inquiries/list.php', { search, per_page: 50 }),
        apiGet('/api/contacts/list.php',  { per_page: 1 }).catch(() => ({})),
      ])
      setInquiries(inqData.inquiries || [])
      // Load inquiry statuses
      const stRes = await fetch('http://localhost/skillconnect/backend/api/contacts/list.php', {}).catch(() => null)
    } catch { }
    // Load statuses separately
    try {
      const res  = await fetch('http://localhost/skillconnect/backend/api/config/org-types.php', {
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('sc_user'))?.token}` }
      })
    } catch {}
    setLoading(false)
  }

  const loadInquiries = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/inquiries/list.php', { search, per_page: 50 })
      setInquiries(data.inquiries || [])
    } catch { showToast('Failed to load inquiries.', 'error') }
    setLoading(false)
  }

  useEffect(() => { loadInquiries() }, [search])

  const handleCreate = async () => {
    try {
      const res = await fetch('http://localhost/skillconnect/backend/api/inquiries/create.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Inquiry created!')
      setShowForm(false)
      setForm({ first_name: '', last_name: '', email: '', mobile: '', address: '', description: '', reason: '', status_id: '' })
      loadInquiries()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const handleStatusUpdate = async (id, status_id) => {
    try {
      await apiPut('/api/inquiries/update.php', { id, status_id })
      showToast('Status updated!')
      loadInquiries()
    } catch { showToast('Update failed.', 'error') }
  }

  const createJobOrder = (inq) => {
    navigate('/admin/job-orders', { state: { fromInquiry: inq } })
  }

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Inquiries</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Client inquiries and leads</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />New Inquiry
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-10 text-sm" placeholder="Search inquiries..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card-steel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-amber-400" />
            <span className="font-body text-slate-400 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-steel-700 bg-steel-900/60">
                  {['ID', 'Name', 'Contact', 'Reason', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inquiries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-600">No inquiries found</td></tr>
                ) : inquiries.map(inq => (
                  <tr key={inq.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{inq.inquiry_code}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{inq.full_name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{inq.mobile || inq.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{inq.reason || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={inq.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{inq.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => createJobOrder(inq)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-display font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors">
                        <ArrowRight size={11} />Job Order
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Inquiry Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-steel-900 border border-steel-700 z-10 max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
            <div className="flex items-center justify-between p-6 border-b border-steel-800 sticky top-0 bg-steel-900 z-10">
              <h3 className="font-display font-bold text-xl text-slate-100 tracking-wide">New Inquiry</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">First Name *</label>
                  <input className="input-field" value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="Juan" />
                </div>
                <div>
                  <label className="label-field">Last Name *</label>
                  <input className="input-field" value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="dela Cruz" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Email</label>
                  <input className="input-field" type="email" value={form.email} onChange={e => f('email', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">Mobile</label>
                  <input className="input-field" value={form.mobile} onChange={e => f('mobile', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label-field">Address</label>
                <input className="input-field" value={form.address} onChange={e => f('address', e.target.value)} />
              </div>
              <div>
                <label className="label-field">Reason</label>
                <select className="input-field" value={form.reason} onChange={e => f('reason', e.target.value)}>
                  <option value="">Select reason...</option>
                  <option>Construction Services</option>
                  <option>Manpower Supply</option>
                  <option>Equipment Rental</option>
                  <option>Project Consultation</option>
                  <option>Partnership / Subcontracting</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label-field">Description *</label>
                <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => f('description', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-steel-800">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleCreate} className="btn-primary flex-1 text-sm">Create Inquiry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Job Orders Page ────────────────────────────────────────────
function JobOrdersPage() {
  const navigate  = useNavigate()
  const [jobOrders,  setJobOrders]  = useState([])
  const [contacts,   setContacts]   = useState([])
  const [contracts,  setContracts]  = useState([])
  const [statuses,   setStatuses]   = useState([])
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [toast,      setToast]      = useState(null)
  const [form, setForm] = useState({
    worker_contact_id: '', client_contact_id: '', inquiry_id: '',
    contract_type_id: '', description: '', start_date: '', end_date: '', status_id: ''
  })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const load = async () => {
    setLoading(true)
    try {
      const [joData, cData, ctData] = await Promise.all([
        apiGet('/api/job-orders/list.php',    { search, per_page: 50 }),
        apiGet('/api/contacts/list.php',      { per_page: 100 }),
        apiGet('/api/config/contract-types.php'),
      ])
      setJobOrders(joData.job_orders  || [])
      setContacts(cData.contacts      || [])
      setContracts(ctData.contract_types || [])
    } catch { showToast('Failed to load.', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const workers = contacts.filter(c => c.type === 'worker')
  const clients = contacts.filter(c => c.type === 'client' || c.type === 'organisation')

  const handleCreate = async () => {
    try {
      const data = await apiPost('/api/job-orders/create.php', form)
      if (!data.success) throw new Error(data.error)
      showToast('Job order created!')
      setShowForm(false)
      setForm({ worker_contact_id: '', client_contact_id: '', inquiry_id: '', contract_type_id: '', description: '', start_date: '', end_date: '', status_id: '' })
      load()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const handleStatusUpdate = async (id, status_id) => {
    try {
      await apiPut('/api/job-orders/update.php', { id, status_id })
      showToast('Status updated!')
      load()
    } catch { showToast('Update failed.', 'error') }
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Job Orders</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Manage all job orders</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />New Job Order
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-10 text-sm" placeholder="Search job orders..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card-steel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-amber-400" />
            <span className="font-body text-slate-400 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-steel-700 bg-steel-900/60">
                  {['ID', 'Worker', 'Client', 'Contract', 'Start', 'End', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobOrders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-600">No job orders found</td></tr>
                ) : jobOrders.map(jo => (
                  <tr key={jo.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{jo.job_order_code}</td>
                    <td className="px-4 py-3 text-slate-200">{jo.worker_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{jo.client_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{jo.contract_type || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{jo.start_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{jo.end_date || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={jo.status} /></td>
                    <td className="px-4 py-3">
                      <select
                        className="bg-steel-800 border border-steel-700 text-slate-300 text-xs px-2 py-1 font-body"
                        defaultValue=""
                        onChange={e => { if (e.target.value) handleStatusUpdate(jo.id, e.target.value) }}>
                        <option value="" disabled>Update</option>
                        {['Pending','Active','In Progress','On Hold','Under Review','Scheduled','Complete','Cancelled'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Job Order Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-steel-900 border border-steel-700 z-10 max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
            <div className="flex items-center justify-between p-6 border-b border-steel-800 sticky top-0 bg-steel-900 z-10">
              <h3 className="font-display font-bold text-xl text-slate-100 tracking-wide">New Job Order</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-field">Worker</label>
                <select className="input-field" value={form.worker_contact_id} onChange={e => f('worker_contact_id', e.target.value)}>
                  <option value="">Select worker...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Client / Subcon</label>
                <select className="input-field" value={form.client_contact_id} onChange={e => f('client_contact_id', e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Contract Type</label>
                <select className="input-field" value={form.contract_type_id} onChange={e => f('contract_type_id', e.target.value)}>
                  <option value="">Select contract...</option>
                  {contracts.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Description</label>
                <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => f('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Start Date</label>
                  <input type="date" className="input-field" value={form.start_date} onChange={e => f('start_date', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">End Date</label>
                  <input type="date" className="input-field" value={form.end_date} onChange={e => f('end_date', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-steel-800">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleCreate} className="btn-primary flex-1 text-sm">Create Job Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Schedules Page ─────────────────────────────────────────────
function SchedulesPage() {
  const [schedules, setSchedules] = useState([])
  const [contacts,  setContacts]  = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [toast,     setToast]     = useState(null)
  const [form, setForm] = useState({
    start_time: '', end_time: '', description: '',
    worker_contact_id: '', client_contact_id: '', status_id: ''
  })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const load = async () => {
    setLoading(true)
    try {
      const [schData, cData] = await Promise.all([
        apiGet('/api/schedules/list.php', { search, per_page: 50 }),
        apiGet('/api/contacts/list.php',  { per_page: 100 }),
      ])
      setSchedules(schData.schedules || [])
      setContacts(cData.contacts     || [])
    } catch { showToast('Failed to load.', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const workers = contacts.filter(c => c.type === 'worker')
  const clients = contacts.filter(c => c.type === 'client' || c.type === 'organisation')

  const handleCreate = async () => {
    if (!form.start_time || !form.end_time) { showToast('Start and end time are required.', 'error'); return }
    try {
      const data = await apiPost('/api/schedules/create.php', form)
      if (!data.success) throw new Error(data.error)
      showToast('Schedule created!')
      setShowForm(false)
      setForm({ start_time: '', end_time: '', description: '', worker_contact_id: '', client_contact_id: '', status_id: '' })
      load()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const handleStatusUpdate = async (id, status_id) => {
    try {
      await apiPut('/api/schedules/update.php', { id, status_id })
      showToast('Status updated!')
      load()
    } catch { showToast('Update failed.', 'error') }
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Schedules</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Worker scheduling and assignments</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />New Schedule
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-10 text-sm" placeholder="Search schedules..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card-steel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-amber-400" />
            <span className="font-body text-slate-400 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-steel-700 bg-steel-900/60">
                  {['ID', 'Worker', 'Client', 'Start', 'End', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedules.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-600">No schedules found</td></tr>
                ) : schedules.map(sc => (
                  <tr key={sc.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{sc.schedule_code}</td>
                    <td className="px-4 py-3 text-slate-200">{sc.worker_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{sc.client_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{sc.start_time?.slice(0, 16).replace('T', ' ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{sc.end_time?.slice(0, 16).replace('T', ' ') || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={sc.status} /></td>
                    <td className="px-4 py-3">
                      <select
                        className="bg-steel-800 border border-steel-700 text-slate-300 text-xs px-2 py-1 font-body"
                        defaultValue=""
                        onChange={e => { if (e.target.value) handleStatusUpdate(sc.id, e.target.value) }}>
                        <option value="" disabled>Update</option>
                        {['Pending','Scheduled','In Progress','Complete','Cancelled'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Schedule Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-steel-900 border border-steel-700 z-10">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
            <div className="flex items-center justify-between p-6 border-b border-steel-800">
              <h3 className="font-display font-bold text-xl text-slate-100 tracking-wide">New Schedule</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-200"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-field">Worker</label>
                <select className="input-field" value={form.worker_contact_id} onChange={e => f('worker_contact_id', e.target.value)}>
                  <option value="">Select worker...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Client / Organisation</label>
                <select className="input-field" value={form.client_contact_id} onChange={e => f('client_contact_id', e.target.value)}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Start Time *</label>
                  <input type="datetime-local" className="input-field" value={form.start_time} onChange={e => f('start_time', e.target.value)} />
                </div>
                <div>
                  <label className="label-field">End Time *</label>
                  <input type="datetime-local" className="input-field" value={form.end_time} onChange={e => f('end_time', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label-field">Description</label>
                <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => f('description', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-steel-800">
              <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleCreate} className="btn-primary flex-1 text-sm">Create Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Contacts Page (placeholder) ────────────────────────────────
function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Contacts</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Manage clients, organisations, and workers</p>
      </div>
      <div className="card-steel p-12 flex items-center justify-center">
        <p className="font-body text-slate-600">Contacts management coming soon.</p>
      </div>
    </div>
  )
}
// ── Config Page ────────────────────────────────────────────────
const ORG_TYPES = [
  { id: 1, name: 'ManPower' }, { id: 2, name: 'Heavy Equipments' },
  { id: 3, name: 'Materials Supplier' }, { id: 4, name: 'Subcontractor - General' },
  { id: 5, name: 'Logistics' },
]
const SPECIALIZATIONS = [
  { id: 1, name: 'Architect' }, { id: 2, name: 'Civil Engineer' },
  { id: 3, name: 'Structural Engineer' }, { id: 4, name: 'Electrical Engineer' },
  { id: 5, name: 'Mechanical Engineer' }, { id: 6, name: 'Plumbing' },
  { id: 7, name: 'Foreman' }, { id: 8, name: 'Carpenter' },
  { id: 9, name: 'Mason' }, { id: 10, name: 'Welder' },
]

function ConfigPage() {
  const [activeTab, setActiveTab] = useState('org_types')
  const [orgTypes, setOrgTypes] = useState(ORG_TYPES)
  const [specializations, setSpecializations] = useState(SPECIALIZATIONS)
  const [statuses] = useState([
    { id: 1, entity: 'contact', label: 'Active' }, { id: 2, entity: 'contact', label: 'Inactive' }, { id: 3, entity: 'contact', label: 'Blacklisted' },
    { id: 4, entity: 'worker',  label: 'Active' }, { id: 5, entity: 'worker',  label: 'Inactive' }, { id: 6, entity: 'worker',  label: 'On Leave'    },
    { id: 7, entity: 'user',    label: 'Active' }, { id: 8, entity: 'user',    label: 'Inactive' }, { id: 9, entity: 'user',    label: 'Suspended'   },
  ])
  const [newName, setNewName] = useState('')

  const tabs = [
    { key: 'org_types',       label: 'Organisation Types' },
    { key: 'specializations', label: 'Specializations'    },
    { key: 'statuses',        label: 'Statuses'           },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Configuration</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Manage lookup tables and system settings</p>
      </div>
      <div className="flex border-b border-steel-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setNewName('') }}
            className={`px-5 py-3 font-display font-semibold text-sm tracking-wider uppercase transition-colors border-b-2 -mb-px
              ${activeTab === t.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'org_types' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input className="input-field flex-1 text-sm" placeholder="New organisation type..."
              value={newName} onChange={e => setNewName(e.target.value)} />
            <button onClick={() => { if (newName.trim()) { setOrgTypes(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName('') }}}
              className="btn-primary text-sm flex items-center gap-2"><Plus size={15} />Add</button>
          </div>
          <div className="card-steel overflow-hidden">
            {orgTypes.map((ot, i) => (
              <div key={ot.id} className={`flex items-center justify-between px-5 py-3.5 ${i < orgTypes.length - 1 ? 'border-b border-steel-800' : ''} hover:bg-steel-800/40`}>
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="font-body text-slate-200">{ot.name}</span></div>
                <button className="p-1.5 text-slate-600 hover:text-amber-400 transition-colors"><Edit2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'specializations' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input className="input-field flex-1 text-sm" placeholder="New specialization..."
              value={newName} onChange={e => setNewName(e.target.value)} />
            <button onClick={() => { if (newName.trim()) { setSpecializations(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName('') }}}
              className="btn-primary text-sm flex items-center gap-2"><Plus size={15} />Add</button>
          </div>
          <div className="card-steel overflow-hidden">
            {specializations.map((s, i) => (
              <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 ${i < specializations.length - 1 ? 'border-b border-steel-800' : ''} hover:bg-steel-800/40`}>
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span className="font-body text-slate-200">{s.name}</span></div>
                <button className="p-1.5 text-slate-600 hover:text-amber-400 transition-colors"><Edit2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'statuses' && (
        <div className="space-y-6">
          {['contact', 'worker', 'user'].map(entity => (
            <div key={entity}>
              <h4 className="font-display font-bold text-sm tracking-widest uppercase text-slate-500 mb-3">{entity} Statuses</h4>
              <div className="card-steel overflow-hidden">
                {statuses.filter(s => s.entity === entity).map((s, i, arr) => (
                  <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 ${i < arr.length - 1 ? 'border-b border-steel-800' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.label === 'Active' ? 'bg-emerald-400' : s.label === 'Blacklisted' || s.label === 'Suspended' ? 'bg-red-400' : 'bg-slate-500'}`} />
                      <span className="font-body text-slate-200">{s.label}</span>
                    </div>
                    <span className="font-body text-xs text-slate-600 capitalize">{s.entity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ── Main Export ────────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Admin Panel">
      <Routes>
        <Route path="dashboard"  element={<AdminHome />}      />
        <Route path="contacts"   element={<ContactsPage />}   />
        <Route path="workers"    element={<WorkersPage />}    />
        <Route path="licenses"   element={<LicensesPage />}   />
        <Route path="inquiries"  element={<InquiriesPage />}  />
        <Route path="job-orders" element={<JobOrdersPage />}  />
        <Route path="scheduling" element={<SchedulesPage />} />
        <Route path="config"     element={<ConfigPage />}     />
        <Route path="*"          element={<AdminHome />}      />
      </Routes>
    </DashboardLayout>
  )
}