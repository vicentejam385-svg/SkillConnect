import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Plus, Search, RefreshCw, Eye, X, ArrowRight, FileText, Calendar,
  HardHat, CheckCircle, AlertCircle
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

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
  
// ── Password Generator ──────────────────────────────────────────────────────
function generateWorkerPassword() {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower   = 'abcdefghijklmnopqrstuvwxyz'
  const digits  = '0123456789'
  const special = '@#$!%*?&'
  const all     = upper + lower + digits + special
  const rand    = (str) => str[Math.floor(Math.random() * str.length)]
  const required = [rand(upper), rand(lower), rand(digits), rand(special)]
  const rest = Array.from({ length: 6 }, () => rand(all))
  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join('')
}

// ── Workers Page
export default function WorkersPage() {
  const navigate = useNavigate()
  const [workers,         setWorkers]         = useState([])
  const [specializations, setSpecializations] = useState([])
  const [search,          setSearch]          = useState('')
  const [filterStatus, setFilterStatus] = useState('')
const [filterSpec,   setFilterSpec]   = useState('')
  const [loading,         setLoading]         = useState(true)
  const [toast,           setToast]           = useState(null)
  const [showForm,        setShowForm]        = useState(false)
const [selected,        setSelected]        = useState(null)
const [licenseWorker,   setLicenseWorker]   = useState(null)
const [scheduleWorker,  setScheduleWorker]  = useState(null)
const [workerSchedules, setWorkerSchedules] = useState([])
const [schedLoading,    setSchedLoading]    = useState(false)
const [workerLicenses,  setWorkerLicenses]  = useState([])
const [licenseLoading,  setLicenseLoading]  = useState(false)
const [viewFile,        setViewFile]        = useState(null)
const [page,            setPage]            = useState(1)
const [total,           setTotal]           = useState(0)
const PER_PAGE = 3
 const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', suffix: '', email: '', mobile: '+63',
    phone: '', username: '', specialization_id: '', status_id: '4'
  })
  const [usernameSuggestions, setUsernameSuggestions] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const first = form.first_name.trim().toLowerCase().replace(/\s+/g, '')
    const last  = form.last_name.trim().toLowerCase().replace(/\s+/g, '')
    if (!first || !last || form.username) { setUsernameSuggestions([]); return }
    const rand2 = () => Math.floor(10  + Math.random() * 90)
    const rand3 = () => Math.floor(100 + Math.random() * 900)
        setUsernameSuggestions([
      `${first}_${last}`,
      `${first}${last}`,
      `${first}_${last}${rand2()}`,
      `${first[0]}_${last}`,
      `${first[0]}${last}${rand2()}`,
      `${first}_${last[0]}${rand3()}`,
      `${first}${rand3()}`,
    ].map(s => s.replace(/[^a-z0-9_]/g, '')))
  }, [form.first_name, form.last_name, form.username])

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const loadWorkerSchedules = async (worker) => {
    setSchedLoading(true)
    setWorkerSchedules([])
    setScheduleWorker(worker)
    setSelected(null)
    try {
      const data = await apiGet('/api/schedules/list.php', { per_page: 100 })
      const all = data.schedules || []
      const filtered = all.filter(sc =>
        sc.worker_name === worker.full_name ||
        String(sc.worker_contact_id) === String(worker.id)
      )
      setWorkerSchedules(filtered)
    } catch { showToast('Failed to load schedules.', 'error') }
    setSchedLoading(false)
  }

 const load = async () => {
    setLoading(true)
    try {
      const [wData, sData] = await Promise.all([
        apiGet('/api/workers/list.php', { search, per_page: PER_PAGE, page, status: filterStatus, specialization: filterSpec }),
        apiGet('/api/config/specializations.php'),
      ])
      setWorkers(wData.workers || [])
      setTotal(wData.pagination?.total ?? (wData.workers || []).length)
      setSpecializations(sData.data || sData.specializations || [])
    } catch { showToast('Failed to load workers.', 'error') }
    setLoading(false)
  }

  useEffect(() => { setPage(1) }, [search, filterStatus, filterSpec])
  useEffect(() => { load() }, [search, filterStatus, filterSpec, page])

useEffect(() => {
  if (!licenseWorker) return
  const fetchLicenses = async () => {
    setLicenseLoading(true)
    try {
      const contactData = await apiGet('/api/contacts/list.php', { per_page: 100 })
      const allContacts = contactData.contacts || []
      const matched = allContacts.find(c => c.contact_code === licenseWorker.contact_code)
      const realContactId = matched?.id || licenseWorker.id

      const data = await apiGet('/api/licenses/list.php', { per_page: 100 })
      const all = data.licenses || []
      const workerOnes = all.filter(l => String(l.contact_id) === String(realContactId))
      const latest = workerOnes.sort((a, b) => b.id - a.id)[0] || null
      setWorkerLicenses(latest ? [latest] : [])
    } catch (e) { console.error('license fetch error:', e) }
    setLicenseLoading(false)
  }
  fetchLicenses()
}, [licenseWorker])

  const handleCreate = async () => {
    // First Name
    if (!form.first_name.trim()) { showToast('First name is required.', 'error'); return }
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.first_name.trim())) { showToast('First name must contain letters only.', 'error'); return }
    // Middle Name (optional but validate if filled)
    if (form.middle_name.trim() && !/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.middle_name.trim())) { showToast('Middle name must contain letters only.', 'error'); return }
    // Last Name
    if (!form.last_name.trim()) { showToast('Last name is required.', 'error'); return }
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.last_name.trim())) { showToast('Last name must contain letters only.', 'error'); return }
    // Mobile
    if (!form.mobile.trim()) { showToast('Mobile number is required.', 'error'); return }
    if (!/^(09\d{9}|\+639\d{9})$/.test(form.mobile.trim())) { showToast('Enter a valid PH mobile number (e.g. 09XXXXXXXXX or +639XXXXXXXXX).', 'error'); return }
    // Email
    if (!form.email.trim()) { showToast('Email is required.', 'error'); return }
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
    const validTLDs = ['com','net','org','edu','gov','ph','io','info','biz','me','tv','us','uk','au','ca','de','fr','jp','sg','nz','in']
    if (!emailRegex.test(form.email.trim())) { showToast('Enter a valid email address (e.g. name@example.com).', 'error'); return }
    if (!validTLDs.includes(form.email.trim().split('.').pop().toLowerCase())) { showToast('Enter a valid email domain (e.g. .com, .net, .ph).', 'error'); return }
    // Username
    if (!form.username.trim()) { showToast('Username is required.', 'error'); return }
    if (form.username.trim().length < 4) { showToast('Username must be at least 4 characters.', 'error'); return }
        if (!/^[a-zA-Z0-9_]+$/.test(form.username.trim())) { showToast('Username can only contain letters, numbers, and underscores (no dots or spaces).', 'error'); return }
    // Specialization
    if (!form.specialization_id) { showToast('Specialization is required.', 'error'); return }
    if (saving) return
    setSaving(true)
    try {
      const generatedPassword = generateWorkerPassword()
      const data = await apiPost('/api/workers/create.php', { ...form, type: 'worker', password: generatedPassword })
      if (!data.success) throw new Error(data.error)

      // Send welcome email
      let emailOk = true
      try {
        const mailRes = await fetch('http://localhost/skillconnect/backend/api/workers/send-welcome.php', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            email:    form.email.trim(),
            name:     `${form.first_name.trim()} ${form.last_name.trim()}`,
            username: form.username.trim(),
            password: generatedPassword,
          }),
        })
              const mailData = await mailRes.json()
        emailOk = mailData.email_sent !== false
      } catch (e) { console.warn('Worker email failed:', e); emailOk = false }

      showToast(emailOk ? 'Worker added & email sent!' : 'Worker added, but the email was not sent.', emailOk ? 'success' : 'error')

           setShowForm(false)
     setForm({ first_name: '', middle_name: '', last_name: '', suffix: '', email: '', mobile: '+63', phone: '', username: '', specialization_id: '', status_id: '4' })
      load()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
    finally { setSaving(false) }
  }

  const inputCls  = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-gray-800 placeholder-gray-400"
  const labelCls  = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider"

  const WORKER_STATUSES = [
    { id: 1, label: 'Active'   },
    { id: 2, label: 'Inactive' },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Workers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your workforce</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={16} />Add Worker
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-gray-400"
            placeholder="Search workers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-600"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="On Leave">On Leave</option>
        </select>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-600"
          value={filterSpec}
          onChange={e => { setFilterSpec(e.target.value); setPage(1) }}
        >
          <option value="">All Specializations</option>
          {specializations.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      {/* Table */}
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
              {workers.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <HardHat size={22} className="text-gray-400" />
                  </div>
                  <p className="text-gray-400 text-sm">No workers found</p>
                  <button onClick={() => setShowForm(true)} className="text-emerald-500 text-xs font-semibold hover:underline">Add your first worker</button>
                </div>
              ) : workers.map(w => {
                const initials = `${w.first_name?.[0] || ''}${w.last_name?.[0] || ''}`.toUpperCase()
                const colorMap = ['bg-blue-100 text-blue-600','bg-emerald-100 text-emerald-600','bg-purple-100 text-purple-600','bg-amber-100 text-amber-600','bg-rose-100 text-rose-600']
                const color = colorMap[w.id % colorMap.length]
                return (
                  <div key={w.id} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-emerald-600 font-semibold">{w.contact_code || w.worker_code}</span>
                        <StatusBadge status={w.status} />
                      </div>
                      <p className="text-sm font-medium text-gray-700 truncate">{w.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{w.specialization || '—'} · {w.mobile || '—'}</p>
                    </div>
                    <button
                      onClick={() => setSelected(selected?.id === w.id ? null : w)}
                      className={`p-1.5 rounded-md border transition-colors flex-shrink-0 ${selected?.id === w.id ? 'border-amber-300 text-amber-500 bg-amber-50' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Code', 'Name', 'Specialization', 'Contact', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <HardHat size={22} className="text-gray-400" />
                          </div>
                          <p className="text-gray-400 text-sm">No workers found</p>
                          <button onClick={() => setShowForm(true)} className="text-emerald-500 text-xs font-semibold hover:underline">Add your first worker</button>
                        </div>
                      </td>
                    </tr>
                  ) : workers.map(w => {
                    const initials = `${w.first_name?.[0] || ''}${w.last_name?.[0] || ''}`.toUpperCase()
                    const colorMap = ['bg-blue-100 text-blue-600','bg-emerald-100 text-emerald-600','bg-purple-100 text-purple-600','bg-amber-100 text-amber-600','bg-rose-100 text-rose-600']
                    const color = colorMap[w.id % colorMap.length]
                    return (
                      <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{w.contact_code || w.worker_code}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
                              {initials}
                            </div>
                            <div>
                              <p className="text-gray-800 font-medium">{w.full_name}</p>
                              {w.email && <p className="text-gray-400 text-xs">{w.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {w.specialization ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                              {w.specialization}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          <div>{w.mobile || '—'}</div>
                          {w.email && <div className="text-gray-400">{w.email}</div>}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setSelected(selected?.id === w.id ? null : w)}
                            className={`p-1.5 rounded-md border transition-colors ${selected?.id === w.id ? 'border-amber-300 text-amber-500 bg-amber-50' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300'}`}
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <span className="font-bold text-sm text-emerald-600">
                    {selected.first_name?.[0]?.toUpperCase()}{selected.last_name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{selected.full_name}</h3>
                  <span className="text-xs text-gray-400">{selected.contact_code || selected.worker_code}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scroll">
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full font-medium border border-blue-100">
                  {selected.specialization || 'No specialization'}
                </span>
                <StatusBadge status={selected.status} />
              </div>
              <div className="space-y-0">
                {[
  { label: 'Email',   value: selected.email   },
  { label: 'Mobile',  value: selected.mobile  },
  { label: 'Phone',   value: selected.phone   },
  { label: 'Address', value: selected.address },
].filter(({ label, value }) => !(label === 'Phone' && !value)).map(({ label, value }) => (
  <div key={label} className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
    <span className="text-sm text-gray-700 break-all">{value || '—'}</span>
  </div>
))}
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
  onClick={() => { setLicenseWorker(selected); setSelected(null) }}
  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold text-sm rounded-lg hover:bg-emerald-100 transition-colors"
>
  <FileText size={14} />View Licenses
</button>
              <button
                onClick={() => loadWorkerSchedules(selected)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-600 font-semibold text-sm rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Calendar size={14} />Schedules
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setScheduleWorker(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Calendar size={16} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Schedules</h3>
                  <p className="text-xs text-gray-400">
                    {schedLoading ? 'Loading...' : `${workerSchedules.length} schedule${workerSchedules.length !== 1 ? 's' : ''} found for ${scheduleWorker.full_name}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setScheduleWorker(null)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {schedLoading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                  <RefreshCw size={18} className="animate-spin text-emerald-500" />
                  <span className="text-gray-400 text-sm">Loading schedules...</span>
                </div>
             ) : (
                <>
                  {/* Mobile card view */}
                  <div className="block sm:hidden divide-y divide-gray-50">
                    {workerSchedules.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-16">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <Calendar size={22} className="text-gray-400" />
                        </div>
                        <p className="text-gray-400 text-sm">No schedules found for this worker</p>
                      </div>
                    ) : workerSchedules.map(sc => (
                      <div key={sc.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-xs text-emerald-600 font-semibold">{sc.schedule_code}</span>
                          <span className="text-xs text-gray-400">{sc.start_time?.slice(0, 10) || '—'}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-700">{sc.client_name || '—'}</p>
                        <p className="text-xs text-gray-400">{sc.description || '—'}</p>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {['Code', 'Client', 'Description', 'Start', 'End'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {workerSchedules.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-16">
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                  <Calendar size={22} className="text-gray-400" />
                                </div>
                                <p className="text-gray-400 text-sm">No schedules found for this worker</p>
                              </div>
                            </td>
                          </tr>
                        ) : workerSchedules.map(sc => (
                          <tr key={sc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{sc.schedule_code}</td>
                            <td className="px-5 py-3 text-gray-700">{sc.client_name || '—'}</td>
                            <td className="px-5 py-3 text-gray-500 text-xs">{sc.description || '—'}</td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{sc.start_time?.slice(0, 10) || '—'}</td>
                            <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{sc.end_time?.slice(0, 10) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 bg-white flex justify-between items-center">
              <button
                onClick={() => { setScheduleWorker(null); navigate('/admin/scheduling', { state: { highlightWorkerName: scheduleWorker.full_name, highlightWorkerId: scheduleWorker.id } }) }}
                className="flex items-center gap-2 text-xs text-emerald-600 font-semibold hover:text-emerald-700"
              >
                <ArrowRight size={12} />Open in Scheduling page
              </button>
              <button onClick={() => setScheduleWorker(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {licenseWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLicenseWorker(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <FileText size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Licenses</h3>
                  <p className="text-xs text-gray-400">{licenseWorker.full_name}</p>
                </div>
              </div>
              <button onClick={() => setLicenseWorker(null)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
  {licenseLoading ? (
    <div className="flex items-center justify-center py-16 gap-3">
      <RefreshCw size={18} className="animate-spin text-emerald-500" />
      <span className="text-gray-400 text-sm">Loading...</span>
    </div>
  ) : workerLicenses.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <FileText size={22} className="text-gray-400" />
      </div>
      <p className="text-gray-400 text-sm">No licenses found for this worker</p>
    </div>
  ) : (() => {
    const l = workerLicenses[0]
    const expired  = l.expiry_date && new Date(l.expiry_date) < new Date()
    const expiring = l.expiry_date && !expired && (new Date(l.expiry_date) - new Date()) < 30 * 24 * 60 * 60 * 1000
    const fileUrl  = l.file_path ? `http://localhost/skillconnect/${l.file_path}` : null
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">{l.document_name}</p>
            <div className={`text-xs mt-0.5 font-medium ${expired ? 'text-red-500' : expiring ? 'text-amber-500' : 'text-gray-400'}`}>
              Expiry: {l.expiry_date || '—'} {expired ? '· Expired' : expiring ? '· Expiring soon' : ''}
            </div>
          </div>
          {expired ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Expired</span>
          ) : expiring ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Expiring Soon</span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Valid</span>
          )}
        </div>
        {fileUrl ? (
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl) ? (
            <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center min-h-[300px]">
              <img src={fileUrl} alt={l.document_name} className="max-w-full max-h-[400px] object-contain" />
            </div>
          ) : /\.pdf$/i.test(fileUrl) ? (
            <iframe src={fileUrl} title={l.document_name} className="w-full min-h-[400px] rounded-xl border border-gray-100" />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3 bg-gray-50 rounded-xl border border-gray-100">
              <FileText size={28} className="text-gray-400" />
              <p className="text-sm text-gray-500">Preview not available</p>
              <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
                <Eye size={14} />Open file
              </a>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3 bg-gray-50 rounded-xl border border-gray-100">
            <FileText size={28} className="text-gray-400" />
            <p className="text-sm text-gray-500">No file attached</p>
          </div>
        )}
      </div>
    )
  })()}
</div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setLicenseWorker(null)} className="w-full px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {viewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewFile(null)} />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{viewFile.name}</p>
                  <p className="text-xs text-gray-400">{viewFile.worker}</p>
                </div>
              </div>
              <button onClick={() => setViewFile(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100 min-h-[400px]">
              {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(viewFile.url) ? (
                <div className="flex items-center justify-center h-full p-6">
                  <img src={viewFile.url} alt={viewFile.name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
                </div>
              ) : /\.pdf$/i.test(viewFile.url) ? (
                <iframe src={viewFile.url} title={viewFile.name} className="w-full h-full min-h-[500px] border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <FileText size={28} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Preview not available for this file type.</p>
                  <a href={viewFile.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
                    <Eye size={14} />Open file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

            {/* Create Form */}
      {showForm && (() => {
        const inp = "w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
        const lbl = "block text-sm font-semibold text-gray-700 mb-1.5"
        const sec = "text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-3"
        const req = <span className="text-red-500"> *</span>
        const opt = <span className="text-xs font-normal text-gray-400"> (optional)</span>
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <HardHat size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">Add Worker</h3>
                    <p className="text-xs text-gray-500">Fill in the worker's details below</p>
                  </div>
                </div>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-7 py-6 overflow-y-auto flex-1 custom-scroll space-y-6">

                {/* Personal information */}
                <div>
                  <p className={sec}>Personal Information</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>First Name{req}</label>
                        <input className={inp} value={form.first_name} onChange={e => f('first_name', e.target.value)} placeholder="First Name" />
                      </div>
                      <div>
                        <label className={lbl}>Middle Name{opt}</label>
                        <input className={inp} value={form.middle_name} onChange={e => f('middle_name', e.target.value)} placeholder="Middle Name" />
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_120px] gap-4">
                      <div>
                        <label className={lbl}>Last Name{req}</label>
                        <input className={inp} value={form.last_name} onChange={e => f('last_name', e.target.value)} placeholder="Last Name" />
                      </div>
                      <div>
                        <label className={lbl}>Suffix{opt}</label>
                        <input className={inp} value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="Jr." />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="border-t border-gray-100 pt-5">
                  <p className={sec}>Contact</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>Mobile Number{req}</label>
                        <input
                          className={inp}
                          value={form.mobile}
                          maxLength={13}
                          placeholder="+639XXXXXXXXX"
                          onChange={e => {
                            let val = e.target.value
                            if (!val.startsWith('+63')) val = '+63'
                            let digits = val.slice(3).replace(/\D/g, '')
                            if (digits.startsWith('0')) digits = digits.slice(1)
                            f('mobile', '+63' + digits.slice(0, 10))
                          }}
                        />
                      </div>
                      <div>
                        <label className={lbl}>Phone{opt}</label>
                        <input className={inp} value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="02 XXXX XXXX" />
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Email Address{req}</label>
                      <input type="email" className={inp} value={form.email} onChange={e => f('email', e.target.value)} placeholder="name@example.com" />
                      <p className="text-xs text-gray-400 mt-1.5">Login credentials will be sent to this email.</p>
                    </div>
                  </div>
                </div>

                {/* Account & work */}
                <div className="border-t border-gray-100 pt-5">
                  <p className={sec}>Account &amp; Work</p>
                  <div className="space-y-4">
                    <div>
                      <label className={lbl}>Username{req}</label>
                      <input className={inp} value={form.username} onChange={e => f('username', e.target.value)} placeholder="Username" />
                      {usernameSuggestions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Suggested usernames</p>
                          <div className="flex flex-wrap gap-1.5">
                            {usernameSuggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => f('username', s)}
                                className="px-2.5 py-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors font-medium"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={lbl}>Specialization{req}</label>
                        <select className={inp} value={form.specialization_id} onChange={e => f('specialization_id', e.target.value)}>
                          <option value="">Select specialization...</option>
                          {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lbl}>Status</label>
                        <select className={inp} value={form.status_id} onChange={e => f('status_id', e.target.value)}>
                          {WORKER_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-7 py-4 border-t border-gray-100 bg-white">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {saving ? 'Saving...' : 'Add Worker'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
