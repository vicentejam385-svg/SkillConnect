import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, Plus, Search, RefreshCw, Edit2, CheckCircle,
  AlertCircle, X, ArrowRight, AlertTriangle
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

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

// ── Job Orders Page
export default function JobOrdersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const highlightInquiryCode = location.state?.highlightInquiryCode || null
const highlightClientName  = location.state?.highlightClientName  || null
const highlightClientId    = location.state?.highlightClientId    || null
  const [jobOrders,  setJobOrders]  = useState([])
  const [contacts,   setContacts]   = useState([])
  const [contracts,  setContracts]  = useState([])
  const [inquiries,  setInquiries]  = useState([])
  const [search,     setSearch]     = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
const [filterContract, setFilterContract] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [toast,      setToast]      = useState(null)
  const [page,       setPage]       = useState(1)
  const [total,      setTotal]      = useState(0)
const [today,      setToday]      = useState(null)
  const PER_PAGE = 3
  const emptyForm = { worker_contact_id: '', client_contact_id: '', inquiry_id: '', contract_type_id: '', description: '', start_date: '', end_date: '', status_id: '16', _usedStatuses: [16] }
  const [form, setForm] = useState(emptyForm)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const JO_STATUSES = [
  { id: 16, l: 'Pending',      next: [20] },
  { id: 20, l: 'Under Review', next: [17, 23, 19] },
  { id: 19, l: 'On Hold',      next: [17] },
  { id: 17, l: 'Active',       next: [21] },
  { id: 21, l: 'Scheduled',    next: [22] },
  { id: 22, l: 'In Progress',  next: [18] },
  { id: 18, l: 'Complete',     next: [] },
  { id: 23, l: 'Cancelled',    next: [] },
]

  const isWorkerAvailable = (workerId, startDate, endDate, excludeJobOrderId = null) => {
  if (!workerId || !startDate || !endDate) return true
  const newStart = new Date(startDate)
  const newEnd = new Date(endDate)
  const activeStatuses = ['Pending', 'Under Review', 'Active', 'Scheduled', 'In Progress']
  return !jobOrders.some(jo => {
    if (excludeJobOrderId && jo.id === excludeJobOrderId) return false
    if (!activeStatuses.includes(jo.status)) return false
    if (String(jo.worker_contact_id) !== String(workerId)) return false
    if (!jo.start_date || !jo.end_date) return false
    return newStart <= new Date(jo.end_date) && newEnd >= new Date(jo.start_date)
  })
}

  // Helper function to get conflicting job order details
  const getConflictingJobOrder = (workerId, startDate, endDate, excludeJobOrderId = null) => {
    if (!workerId || !startDate || !endDate) return null
    
    const newStart = new Date(startDate)
    const newEnd = new Date(endDate)
    
    return jobOrders.find(jo => {
      if (excludeJobOrderId && jo.id === excludeJobOrderId) return false
      
      const activeStatuses = ['Pending', 'Under Review', 'Active', 'Scheduled', 'In Progress']
      if (!activeStatuses.includes(jo.status)) return false
      
      if (String(jo.worker_contact_id) !== String(workerId)) return false
      
      if (!jo.start_date || !jo.end_date) return false
      
      const joStart = new Date(jo.start_date)
      const joEnd = new Date(jo.end_date)
      
      return newStart <= joEnd && newEnd >= joStart
    })
  }
  const getWorkerBusyRanges = (workerId, excludeJobOrderId = null) => {
  const activeStatuses = ['Pending', 'Under Review', 'Active', 'Scheduled', 'In Progress']
  return jobOrders
    .filter(jo => {
      if (excludeJobOrderId && jo.id === excludeJobOrderId) return false
      if (!activeStatuses.includes(jo.status)) return false
      if (String(jo.worker_contact_id) !== String(workerId)) return false
      return !!(jo.start_date && jo.end_date)
    })
    .map(jo => ({ start: jo.start_date, end: jo.end_date, code: jo.job_order_code }))
}

const getWorkerNextAvailable = (workerId, excludeJobOrderId = null) => {
  const ranges = getWorkerBusyRanges(workerId, excludeJobOrderId)
  if (ranges.length === 0) return null
  const sorted = [...ranges].sort((a, b) => new Date(a.end) - new Date(b.end))
  const latest = sorted[sorted.length - 1]
  const next = new Date(latest.end)
  next.setDate(next.getDate() + 1)
  return next.toISOString().slice(0, 10)
}

  const load = async () => {
    setLoading(true)
    try {
      const [joData, cData, ctData, inqData] = await Promise.all([
        apiGet('/api/job-orders/list.php', { search, per_page: PER_PAGE, page, status: filterStatus, contract_type: filterContract }),
        apiGet('/api/contacts/list.php',   { per_page: 100 }),
        apiGet('/api/config/contract-types.php'),
        apiGet('/api/inquiries/list.php',  { per_page: 100 }),
      ])
      setJobOrders(joData.job_orders || [])
      setTotal(joData.pagination?.total ?? (joData.job_orders || []).length)
      setContacts(cData.contacts         || [])
      setContracts(ctData.contract_types || [])
      setInquiries(inqData.inquiries     || [])
    } catch { showToast('Failed to load.', 'error') }
    setLoading(false)
  }

  useEffect(() => {
  fetch('http://localhost/skillconnect/backend/api/time/now.php')
    .then(r => r.json())
    .then(data => {
      if (data?.datetime) setToday(new Date(data.datetime))
      else throw new Error('No datetime')
    })
    .catch(() => setToday(new Date()))
}, [])

useEffect(() => { setPage(1) }, [search, filterStatus, filterContract])
  useEffect(() => { load() }, [search, filterStatus, filterContract, page])

  const displayedJobOrders = highlightInquiryCode
  ? jobOrders.filter(jo => jo.inquiry_code === highlightInquiryCode)
  : highlightClientName
    ? jobOrders.filter(jo =>
        jo.client_name === highlightClientName ||
        String(jo.client_contact_id) === String(highlightClientId)
      )
    : jobOrders

  const workers = contacts.filter(c => c.type === 'worker')
  const clients = contacts.filter(c => c.type === 'client' || c.type === 'organisation')

  const handleClientChange = (clientId) => {
    f('client_contact_id', clientId)
    if (!clientId) { f('description', ''); f('_client_mobile', ''); f('_client_email', ''); f('_client_address', ''); return }
    const client = clients.find(c => String(c.id) === String(clientId))
    if (client) {
      const linked = inquiries.find(inq => String(inq.contact_id) === String(clientId) && inq.status === 'Won')
      f('description', (linked?.reason === 'Other' ? linked?.description : linked?.reason) || linked?.description || '')
      f('inquiry_id',  linked?.id || '')
      f('_client_mobile',  client.mobile  || '')
      f('_client_email',   client.email   || '')
      f('_client_address', client.address || '')
    }
  }

  const calcEndDate = (startDate, contractName) => {
    if (!startDate || !contractName) return ''
    const start = new Date(startDate)
    if (isNaN(start)) return ''
    const map = {
      '1 Day':    () => { const d = new Date(start); d.setDate(d.getDate() + 1); return d },
      '2 Days':   () => { const d = new Date(start); d.setDate(d.getDate() + 2); return d },
      '3 Days':   () => { const d = new Date(start); d.setDate(d.getDate() + 3); return d },
      '1 Week':   () => { const d = new Date(start); d.setDate(d.getDate() + 7); return d },
      '2 Weeks':  () => { const d = new Date(start); d.setDate(d.getDate() + 14); return d },
      '1 Month':  () => { const d = new Date(start); d.setMonth(d.getMonth() + 1); return d },
      '3 Months': () => { const d = new Date(start); d.setMonth(d.getMonth() + 3); return d },
      '6 Months': () => { const d = new Date(start); d.setMonth(d.getMonth() + 6); return d },
      '1 Year':   () => { const d = new Date(start); d.setFullYear(d.getFullYear() + 1); return d },
      '5 Years ++': () => { const d = new Date(start); d.setFullYear(d.getFullYear() + 5); return d },
    }
    const fn = map[contractName]
    if (!fn) return ''
    return fn().toISOString().slice(0, 10)
  }

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setShowForm(true) }

  const openEdit = (jo) => {
    setEditTarget(jo)
    const worker   = contacts.find(c => c.type === 'worker' && (c.full_name === jo.worker_name || c.contact_code === jo.worker_contact_code))
    const client   = clients.find(c => (c.full_name === jo.client_name || c.contact_code === jo.client_contact_code))
    const contract = contracts.find(ct => ct.name === jo.contract_type)
    const status   = JO_STATUSES.find(s => s.l === jo.status)
    const linkedInquiry = inquiries.find(inq => String(inq.id) === String(jo.inquiry_id))
    setForm({
      worker_contact_id: worker?.id    || '',
      client_contact_id: client?.id    || '',
      inquiry_id:        jo.inquiry_id  || '',
      contract_type_id:  contract?.id   || '',
      description: jo.description || (linkedInquiry?.reason === 'Other' ? linkedInquiry?.description : linkedInquiry?.reason) || linkedInquiry?.description || '',
      start_date:        jo.start_date  || '',
      end_date:          jo.end_date    || '',
           status_id:         status?.id     || '16',
      _client_mobile:    client?.mobile  || '',
      _client_email:     client?.email   || '',
      _client_address:   client?.address || '',
      _inquiry_code:     linkedInquiry?.inquiry_code || '',
      _inquiry_reason: linkedInquiry?.reason || '',
      _inquiry_description: linkedInquiry?.reason === 'Other' ? (linkedInquiry?.description || '') : '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    // Validate worker availability before saving
    if (form.worker_contact_id && form.start_date && form.end_date) {
      if (!isWorkerAvailable(form.worker_contact_id, form.start_date, form.end_date, editTarget?.id)) {
        const conflict = getConflictingJobOrder(form.worker_contact_id, form.start_date, form.end_date, editTarget?.id)
        showToast(`Worker is not available. Conflict with ${conflict?.job_order_code || 'another job order'}`, 'error')
        return
      }
    }

    const token = JSON.parse(localStorage.getItem('sc_user'))?.token
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    const base = 'http://localhost/skillconnect/backend/api'
    try {
      let res
      if (editTarget) {
        res = await apiPut('/api/job-orders/update.php', { id: editTarget.id, ...form })
      } else {
        res = await apiPost('/api/job-orders/create.php', form)
      }
      if (!res.success) throw new Error(res.error)
      if (!editTarget && form.start_date && form.end_date) {
        try {
          await fetch(`${base}/schedules/create.php`, {
            method: 'POST', headers,
            body: JSON.stringify({ worker_contact_id: form.worker_contact_id || null, client_contact_id: form.client_contact_id || null, start_time: `${form.start_date} 08:00:00`, end_time: `${form.end_date} 17:00:00`, description: form.description || '', status_id: 11 }),
          })
        } catch (e) { console.warn('Schedule auto-create failed:', e) }
      }
      showToast(editTarget ? 'Job order updated!' : 'Job order created!')
      setShowForm(false); setEditTarget(null); setForm(emptyForm); load()
      // If status changed to Scheduled (33), navigate to scheduling with job order details
            if (Number(form.status_id) === 21 && editTarget) {
        const selectedContract = contracts.find(c => String(c.id) === String(form.contract_type_id))
        const contractName = selectedContract?.name || ''
        const longContracts = ['3 Months', '6 Months', '1 Year', '5 Years ++']
        const isLongContract = longContracts.includes(contractName)

        let schedStart = form.start_date
        let schedEnd   = form.end_date

        if (isLongContract && form.start_date) {
          // Pick a random start within the job order range, schedule lasts 3-4 days
          const joStart  = new Date(form.start_date)
          const joEnd    = new Date(form.end_date)
          const rangeDays = Math.floor((joEnd - joStart) / (1000 * 60 * 60 * 24))
          const maxOffset = Math.max(0, rangeDays - 4)
          const randomOffset = Math.floor(Math.random() * (maxOffset + 1))
          const randStart = new Date(joStart)
          randStart.setDate(randStart.getDate() + randomOffset)
          const duration = Math.random() < 0.5 ? 3 : 4 // randomly 3 or 4 days
          const randEnd = new Date(randStart)
          randEnd.setDate(randEnd.getDate() + duration - 1)
          schedStart = randStart.toISOString().slice(0, 10)
          schedEnd   = randEnd.toISOString().slice(0, 10)
        }

        navigate('/admin/scheduling', { state: { fromJobOrder: {
          id: editTarget.id,
          worker_contact_id: form.worker_contact_id,
          client_contact_id: form.client_contact_id,
          description: form.description,
          start_date: schedStart,
          end_date:   schedEnd,
          contract_name: contractName,
          is_long_contract: isLongContract,
          jo_start_date: form.start_date,
          jo_end_date:   form.end_date,
        } } })
      }
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const handleStatusUpdate = async (id, status_id) => {
    try { await apiPut('/api/job-orders/update.php', { id, status_id }); showToast('Status updated!'); load() }
    catch { showToast('Update failed.', 'error') }
  }

const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-gray-800 placeholder-gray-400"
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider"

  

  return (
    <div className="space-y-6 max-w-6xl">
      <Toast toast={toast} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Job Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all job orders</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus size={16} />New Job Order
        </button>
      </div>

      {(highlightInquiryCode || highlightClientName) && (
  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-center gap-2">
      <ArrowRight size={14} className="text-amber-500" />
      {highlightInquiryCode
        ? <span className="text-sm text-amber-700">Showing job order for inquiry <span className="font-semibold">{highlightInquiryCode}</span></span>
        : <span className="text-sm text-amber-700">Showing job orders for client <span className="font-semibold">{highlightClientName}</span></span>
      }
    </div>
    <button onClick={() => navigate('/admin/job-orders', { replace: true, state: {} })} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><X size={12} />Clear</button>
  </div>
)}

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-gray-400"
            placeholder="Search job orders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-600"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          {JO_STATUSES.map(s => <option key={s.id} value={s.l}>{s.l}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-emerald-500" />
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['ID', 'Worker', 'Client', 'Contract', 'Period', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedJobOrders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">{highlightInquiryCode ? 'No job order found for this inquiry.' : highlightClientName ? `No job orders found for ${highlightClientName}.` : 'No job orders found'}</td></tr>
                ) : displayedJobOrders.map(jo => (
                  <tr key={jo.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{jo.job_order_code}</td>
                    <td className="px-5 py-3 text-gray-700">{jo.worker_name || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{jo.client_name || '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{jo.contract_type || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{jo.start_date && jo.end_date ? `${jo.start_date} → ${jo.end_date}` : '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={jo.status} /></td>
                    <td className="px-5 py-3">
                      <button onClick={() => openEdit(jo)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-md hover:text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-colors">
                        <Edit2 size={11} />Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowForm(false); setEditTarget(null) }} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ClipboardList size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{editTarget ? `Edit ${editTarget.job_order_code}` : 'New Job Order'}</h3>
                  {editTarget?.inquiry_code
                    ? <p className="text-xs text-gray-400">Linked to <span className="text-amber-500 font-medium">{editTarget.inquiry_code}</span></p>
                    : <p className="text-xs text-gray-400">Fill in the job order details below</p>}
                </div>
              </div>
              <button onClick={() => { setShowForm(false); setEditTarget(null) }} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scroll">
              <div>
  <label className={labelCls}>Worker</label>
  <select
    className={inputCls}
    value={form.worker_contact_id}
    onChange={e => f('worker_contact_id', e.target.value)}
  >
    {(() => {
      const linked = inquiries.find(inq =>
        String(inq.id) === String(form.inquiry_id) ||
        (form.client_contact_id && String(inq.contact_id) === String(form.client_contact_id) && inq.status === 'Won')
      )
      const inquiryReason = linked?.reason === 'Other'
        ? (linked?.description || 'Other')
        : (linked?.reason || '')

      const allWorkers = contacts.filter(c => c.type === 'worker')

      // Exact match: worker specialization === inquiry reason
      const matched   = inquiryReason
        ? allWorkers.filter(w => w.specialization === inquiryReason)
        : []
      const unmatched = allWorkers.filter(w => !matched.includes(w))

      const renderOption = (w) => {
        const hasDates = !!(form.start_date && form.end_date)
        const available = !hasDates || isWorkerAvailable(w.id, form.start_date, form.end_date, editTarget?.id)
        const nextAvail = getWorkerNextAvailable(w.id, editTarget?.id)
        const specLabel = w.specialization ? ` — ${w.specialization}` : ''
        return (
          <option key={w.id} value={w.id} disabled={hasDates && !available}>
            {w.full_name}{specLabel}{hasDates && !available ? ` (Busy until ${nextAvail || '?'})` : ''}
          </option>
        )
      }

      if (!inquiryReason) {
        return (
          <>
            <option value="">-- Select worker --</option>
            {allWorkers.map(renderOption)}
          </>
        )
      }

      return (
        <>
          <option value="">-- Select worker --</option>
          {matched.map(renderOption)}
        </>
      )
    })()}
  </select>

  {/* Show selected worker's busy schedule */}
  {form.worker_contact_id && (() => {
    const busyRanges = getWorkerBusyRanges(form.worker_contact_id, editTarget?.id)
    const nextAvail = getWorkerNextAvailable(form.worker_contact_id, editTarget?.id)
    const hasConflict = form.start_date && form.end_date &&
      !isWorkerAvailable(form.worker_contact_id, form.start_date, form.end_date, editTarget?.id)

    if (busyRanges.length === 0) return (
      <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
        <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
        <span className="text-xs text-emerald-600 font-medium">Worker is fully available — no active job orders</span>
      </div>
    )

    return (
      <div className={`mt-2 px-3 py-2 rounded-lg border flex flex-col gap-1.5 ${hasConflict ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={13} className={`flex-shrink-0 ${hasConflict ? 'text-red-500' : 'text-amber-500'}`} />
          <span className={`text-xs font-semibold ${hasConflict ? 'text-red-600' : 'text-amber-600'}`}>
            {hasConflict ? 'Conflict detected — worker is busy on selected dates' : 'Worker has existing job orders'}
          </span>
        </div>
        <div className="pl-5 space-y-1">
          {busyRanges.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasConflict ? 'bg-red-400' : 'bg-amber-400'}`} />
              <span className={`text-xs ${hasConflict ? 'text-red-500' : 'text-amber-600'}`}>
                <span className="font-semibold">{r.code}</span>: {r.start} → {r.end}
              </span>
            </div>
          ))}
        </div>
        <div className="pl-5">
          <span className={`text-xs font-medium ${hasConflict ? 'text-red-600' : 'text-amber-600'}`}>
            Next available: <span className="font-bold">{nextAvail || 'Unknown'}</span>
          </span>
        </div>
      </div>
    )
  })()}
</div>
              <div><label className={labelCls}>Client / Subcon</label>
                <select className={inputCls} value={form.client_contact_id} onChange={e => handleClientChange(e.target.value)}>
                  <option value="">-- Select client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select></div>
              {form.client_contact_id && (
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Info</p>
                  {[{ label: 'Mobile', value: form._client_mobile }, { label: 'Email', value: form._client_email }, { label: 'Address', value: form._client_address }].map(({ label, value }) => (
                    <div key={label} className="flex gap-3"><span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span><span className="text-xs text-gray-700">{value || '—'}</span></div>
                  ))}
                </div>
              )}
              <div><label className={labelCls}>Contract Type</label>
                <select className={inputCls} value={form.contract_type_id} onChange={e => {
                  const id = e.target.value
                  f('contract_type_id', id)
                  const ct = contracts.find(c => String(c.id) === String(id))
                  if (ct && form.start_date) {
                    const end = calcEndDate(form.start_date, ct.name)
                    if (end) f('end_date', end)
                  }
                }}>
                  <option value="">-- Select contract --</option>
                  {contracts.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                </select></div>
              <div><label className={labelCls}>Status</label>
  <select className={inputCls} value={form.status_id} onChange={e => f('status_id', Number(e.target.value))}>
    {(() => {
      // Always base allowed options on the SAVED status (editTarget), not the currently selected value
      const savedStatus = editTarget
        ? JO_STATUSES.find(s => s.l === editTarget.status)
                : JO_STATUSES.find(s => s.id === 16) // Pending for new
      const savedId = savedStatus?.id ?? 16
      return JO_STATUSES.filter(s =>
        s.id === savedId || (savedStatus?.next || []).includes(s.id)
      ).map(s => (
        <option key={s.id} value={s.id}>{s.l}</option>
      ))
    })()}
  </select></div>
              {form._inquiry_code && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Linked Inquiry</p>
                  {[
                    { label: 'Code',   value: form._inquiry_code },
                    { label: 'Reason', value: form._inquiry_reason },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3"><span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span><span className="text-xs text-amber-600">{value || '—'}</span></div>
                  ))}
                </div>
              )}
              <div><label className={labelCls}>Description</label>
                {editTarget ? (
                  <textarea className={`${inputCls} resize-none bg-gray-50 text-gray-500 cursor-not-allowed`} rows={3} value={form.description} readOnly />
                ) : (
                  <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e => f('description', e.target.value)} />
                )}
              </div>
              {(() => {
  const busyRanges = form.worker_contact_id
    ? getWorkerBusyRanges(form.worker_contact_id, editTarget?.id)
    : []

  // Build a Set of all busy date strings for fast lookup
  const busyDates = new Set()
  busyRanges.forEach(r => {
    const cur = new Date(r.start)
    const end = new Date(r.end)
    while (cur <= end) {
      busyDates.add(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
  })

  const isDateBusy = (dateStr) => busyDates.has(dateStr)

  const startBusy = form.start_date && isDateBusy(form.start_date)
  const endBusy   = form.end_date   && isDateBusy(form.end_date)

  const nextAvail = form.worker_contact_id
    ? getWorkerNextAvailable(form.worker_contact_id, editTarget?.id)
    : null

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Start Contract
            {startBusy && <span className="ml-1 normal-case font-normal text-red-400 text-[10px]">worker busy on this date</span>}
          </label>
          <input
            type="date"
            className={`${inputCls} ${startBusy ? 'border-red-300 bg-red-50' : ''}`}
            value={form.start_date}
            min={nextAvail || (today ? today.toISOString().slice(0, 10) : undefined)}
            onChange={e => {
              f('start_date', e.target.value)
              const ct = contracts.find(c => String(c.id) === String(form.contract_type_id))
              if (ct && e.target.value) {
                const end = calcEndDate(e.target.value, ct.name)
                if (end) f('end_date', end)
              }
            }}
          />
        </div>
        <div>
          <label className={labelCls}>
            End Contract
            {endBusy && <span className="ml-1 normal-case font-normal text-red-400 text-[10px]">worker busy on this date</span>}
          </label>
          <input
            type="date"
            className={`${inputCls} ${endBusy ? 'border-red-300 bg-red-50' : ''}`}
            value={form.end_date}
            min={form.start_date || (today ? today.toISOString().slice(0, 10) : undefined)}
            onChange={e => f('end_date', e.target.value)}
          />
        </div>
      </div>

      {/* Busy range visual guide */}
      {form.worker_contact_id && busyRanges.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Unavailable date ranges for this worker</p>
          <div className="flex flex-wrap gap-2">
            {busyRanges.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {r.code}: {r.start} → {r.end}
              </span>
            ))}
          </div>
          {nextAvail && (
            <p className="text-xs text-gray-500 mt-1.5">
              Earliest available start date: <span className="font-semibold text-emerald-600">{nextAvail}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
})()}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => { setShowForm(false); setEditTarget(null) }} className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">
                {editTarget ? 'Save Changes' : 'Create Job Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}