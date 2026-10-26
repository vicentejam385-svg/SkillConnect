import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import { Plus, Search, RefreshCw, Eye, X, CheckCircle, AlertCircle } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

// ── Auth headers ───────────────────────────────────────────────
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JSON.parse(localStorage.getItem('sc_user') || 'null')?.token}`,
})

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

// ── Inquiries Page ─────────────────────────────────────────────
export default function InquiriesPage() {
  const navigate = useNavigate()
  const [inquiries, setInquiries] = useState([])
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [showForm,  setShowForm]  = useState(false)
  const [selected,  setSelected]  = useState(null)
  const [page,      setPage]      = useState(1)
  const [total,     setTotal]     = useState(0)
  const PER_PAGE = 3
  const [form, setForm] = useState({
    first_name: '', middle_initial: '', last_name: '', suffix: '', email: '', mobile: '+63',
    province: '', city: '', barangay: '', house_street: '',
    description: '', reason: '', status_id: ''
  })
  const [saving, setSaving] = useState(false)

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const loadInquiries = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/inquiries/list.php', { search, per_page: PER_PAGE, page, status: filterStatus })
      setInquiries(data.inquiries || [])
      setTotal(data.pagination?.total ?? (data.inquiries || []).length)
    } catch { showToast('Failed to load inquiries.', 'error') }
    setLoading(false)
  }

 useEffect(() => { setPage(1) }, [search, filterStatus])
  useEffect(() => { loadInquiries() }, [search, filterStatus, page])

    const handleCreate = async () => {
    if (saving) return
    const nameOk = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/
    if (!form.first_name.trim())            { showToast('First name is required.', 'error'); return }
    if (!nameOk.test(form.first_name.trim())) { showToast('First name must contain letters only.', 'error'); return }
    if (!form.middle_initial.trim())        { showToast('Middle initial is required.', 'error'); return }
    if (!form.last_name.trim())             { showToast('Last name is required.', 'error'); return }
    if (!nameOk.test(form.last_name.trim())) { showToast('Last name must contain letters only.', 'error'); return }
    if (!/^\+639\d{9}$/.test(form.mobile.trim())) { showToast('Enter a valid PH mobile number (+639XXXXXXXXX).', 'error'); return }
    if (!form.email.trim())                 { showToast('Email is required.', 'error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { showToast('Enter a valid email address.', 'error'); return }
    if (!form.province)                     { showToast('Province is required.', 'error'); return }
    if (!form.city)                         { showToast('City / Municipality is required.', 'error'); return }
    if (!form.barangay)                     { showToast('Barangay is required.', 'error'); return }
    if (!form.house_street.trim())          { showToast('House No. & Street is required.', 'error'); return }
    if (!form.reason)                       { showToast('Please select a reason for inquiry.', 'error'); return }
    if (form.reason === 'Other' && !form.description.trim()) { showToast('Please specify your reason.', 'error'); return }

    const provinceName = form.province === '1300000000'
      ? 'Metro Manila'
      : getAllProvinces().find(p => p.psgcCode === form.province)?.name ?? ''
    const filteredCities = form.province ? getMunicipalitiesByProvince(form.province) : []
    const cityName = filteredCities.find(c => c.psgcCode === form.city)?.name ?? ''
    const address = [form.house_street, form.barangay, cityName, provinceName].filter(Boolean).join(', ')

    // The inquiries table has only first_name / last_name, so the middle initial and suffix are merged into them
    const mi        = form.middle_initial.trim().replace(/\.$/, '').toUpperCase()
    const firstFull = `${form.first_name.trim()} ${mi}.`
    const lastFull  = [form.last_name.trim(), form.suffix.trim()].filter(Boolean).join(' ')

    setSaving(true)
    try {
      const res = await fetch('http://localhost/skillconnect/backend/api/inquiries/create.php', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ ...form, first_name: firstFull, last_name: lastFull, address })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('Inquiry created!')
      setShowForm(false)
      setForm({ first_name: '', middle_initial: '', last_name: '', suffix: '', email: '', mobile: '+63', province: '', city: '', barangay: '', house_street: '', description: '', reason: '', status_id: '' })
      loadInquiries()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
    finally { setSaving(false) }
  }

      const handleStatusUpdate = async (inq, status_id, statusLabel) => {
    // ── LOST ──
    if (statusLabel !== 'Won') {
      try {
        await apiPut('/api/inquiries/update.php', { id: inq.id, status_id })
        showToast('Marked as Lost.')
        setSelected(null); loadInquiries()
      } catch { showToast('Update failed.', 'error') }
      return
    }

    // ── WON ──
    const isDuplicate = (msg = '') => /already exists/i.test(msg)

    try {
      // 1. Find or create the client (inquiries.user_id)
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

      // 2. Create the job order (an existing one is fine)
      try {
        const jo = await apiPost('/api/job-orders/create.php', {
          client_user_id: userId,
          inquiry_id: inq.id,
          status_id: 16, // job_order → Pending
          description: inq.reason === 'Other' ? (inq.description || inq.reason) : inq.reason,
        })
        if (!jo.success && !isDuplicate(jo.error)) {
          showToast(`Job order failed: ${jo.error}`, 'error'); return
        }
      } catch (e) {
        if (!isDuplicate(e.message)) { showToast(`Job order failed: ${e.message}`, 'error'); return }
      }

      // 3. Save password + send credentials email (a failed email does NOT block Won)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      const generatedPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + 'A1'

      let credMsg = 'Marked as Won — account created & email sent!'
      try {
        const credRes = await fetch('http://localhost/skillconnect/backend/api/contacts/send-credentials.php', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            email: inq.email,
            name: inq.first_name || inq.full_name?.split(' ')[0] || 'Client',
            password: generatedPassword,
          }),
        })
        const credData = await credRes.json()
        if (!credData.success) {
          credMsg = `Won, but credentials failed to save: ${credData.error}`
        } else if (credData.email_sent === false) {
          credMsg = 'Marked as Won — account activated, but email was not sent (check Brevo setup).'
        }
      } catch (e) {
        console.warn('Welcome email failed:', e)
        credMsg = 'Won, but the credentials request failed.'
      }

      // 4. Mark the inquiry as Won LAST (so a failure above can be retried)
      const won = await apiPut('/api/inquiries/update.php', { id: inq.id, status_id: 9 })
      if (!won.success) { showToast(`Could not mark as Won: ${won.error}`, 'error'); return }

      showToast(credMsg)
      setSelected(null); navigate('/admin/job-orders')
    } catch (err) { showToast(`Error: ${err.message}`, 'error') }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Toast toast={toast} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">Client inquiries</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus size={16} />New Inquiry
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 placeholder-gray-400"
            placeholder="Search inquiries..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-600"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          <option value="New">New</option>
          <option value="Won">Won</option>
          <option value="Lost">Lost</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible">
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
                  {['ID', 'Name', 'Contact', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inquiries.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No inquiries found</td></tr>
                ) : inquiries.map(inq => (
                  <tr key={inq.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{inq.inquiry_code}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{inq.full_name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{inq.mobile || inq.email || '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={inq.status} /></td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{inq.created_at?.slice(0, 10)}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelected(inq)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-md hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                      >
                        <Eye size={11} />View
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

      {/* ── View Inquiry Modal ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-sm text-emerald-600">
                    {selected.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{selected.full_name}</h3>
                  <span className="text-xs text-gray-400">{selected.inquiry_code}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scroll space-y-0">
              <div className="flex items-center gap-2 mb-5">
                <StatusBadge status={selected.status} />
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Inquiry Details</p>

              {[
                { label: 'Full Name',   value: selected.full_name   },
                { label: 'Email',       value: selected.email       },
                { label: 'Mobile',      value: selected.mobile      },
                { label: 'Address',     value: selected.address     },
                { label: 'Reason',      value: selected.reason      },
                ...(selected.reason === 'Other' ? [{ label: 'Description', value: selected.description }] : []),
                { label: 'Submitted',   value: selected.created_at?.slice(0, 10) },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-700 break-all">{value || '—'}</span>
                </div>
              ))}
            </div>

            {/* Footer — Mark as Won / Lost only if not already resolved */}
            <div className="p-6 border-t border-gray-100 bg-white">
              {selected.status !== 'Won' && selected.status !== 'Lost' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusUpdate(selected, 9, 'Won')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold text-sm rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <CheckCircle size={14} />Mark as Won
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(selected, 10, 'Lost')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-500 font-semibold text-sm rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <X size={14} />Mark as Lost
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2">
                  <span className={`text-sm font-semibold ${selected.status === 'Won' ? 'text-emerald-500' : 'text-red-400'}`}>
                    {selected.status === 'Won' ? '✓ This inquiry was marked as Won' : '✗ This inquiry was marked as Lost'}
                  </span>
                </div>
              )}
              <button onClick={() => setSelected(null)} className="w-full mt-3 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

                 {/* ── New Inquiry Form Modal ── */}
      {showForm && (() => {
        const filteredCities    = form.province ? getMunicipalitiesByProvince(form.province) : []
        const filteredBarangays = form.city ? getBarangaysByMunicipality(form.city) : []
        const inputCls = "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5"
        const req = <span className="text-red-500"> *</span>
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 max-h-[92vh] overflow-y-auto custom-scroll">
              <button
                onClick={() => setShowForm(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="px-8 pt-8 pb-8">
                {/* Title */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Submit an Inquiry</h3>
                  <p className="text-sm text-gray-500 mt-1">Tell us about your project and we'll get back to you right away.</p>
                </div>

                <div className="space-y-4">
                  {/* First name | Middle initial */}
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
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
                      <option value="New Construction">New Construction</option>
                      <option value="Renovation & Remodeling">Renovation &amp; Remodeling</option>
                      <option value="Repair & Maintenance">Repair &amp; Maintenance</option>
                      <option value="Electrical Installation">Electrical Installation</option>
                      <option value="Plumbing Services">Plumbing Services</option>
                      <option value="Painting & Finishing">Painting &amp; Finishing</option>
                      <option value="Carpentry">Carpentry</option>
                      <option value="Masonry">Masonry</option>
                      <option value="Roofing">Roofing</option>
                      <option value="Landscaping">Landscaping</option>
                      <option value="Interior Design">Interior Design</option>
                      <option value="Project Management">Project Management</option>
                      <option value="Other">Other</option>
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
                  <button onClick={handleCreate} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 mt-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    {saving ? 'Submitting...' : 'Submit Inquiry'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}