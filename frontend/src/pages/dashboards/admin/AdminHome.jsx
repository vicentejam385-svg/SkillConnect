import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, Calendar, Users, RefreshCw,
  CheckCircle, X, ArrowRight, FileText, HardHat
} from 'lucide-react'
import { apiGet } from '../../../utils/api'

// ── useNavigate (admin wrapper) ────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
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

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'emerald' }) {
  const colors = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500', border: 'border-emerald-100' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-500',    border: 'border-blue-100'    },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   border: 'border-amber-100'   },
    purple:  { bg: 'bg-purple-50',  icon: 'text-purple-500',  border: 'border-purple-100'  },
  }
  const c = colors[color] || colors.emerald
  return (
    <div className={`bg-white rounded-xl border ${c.border} p-3 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm`}>
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={`${c.icon} sm:w-5 sm:h-5`} />
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-800">{value ?? <span className="text-gray-300 text-lg">—</span>}</p>
        <p className="text-xs sm:text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

// ── Admin Home ─────────────────────────────────────────────────
export default function AdminHome() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ inquiries: null, jobOrders: null, contacts: null, workers: null, schedules: null, licensesValid: null, licensesExpiring: null, licensesExpired: null, pendingReschedules: null })
const [rescheduleRequests, setRescheduleRequests] = useState([])
const [reviewSaving, setReviewSaving] = useState(null) // id being saved
  const [recentJobOrders, setRecentJobOrders] = useState([])
  const [joStats, setJoStats] = useState({ total: 0, completed: 0, inProgress: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [inqData, joData, contactsData, schedData] = await Promise.all([
          apiGet('/api/inquiries/list.php',   { per_page: 1 }),
          apiGet('/api/job-orders/list.php',  { per_page: 50 }),
          apiGet('/api/contacts/list.php',    { per_page: 1 }),
          apiGet('/api/schedules/list.php',   { per_page: 1 }),
        ])

        setCounts(p => ({
          ...p,
          inquiries: inqData.pagination?.total ?? 0,
          jobOrders: joData.pagination?.total ?? 0,
          contacts:  contactsData.pagination?.total ?? 0,
          schedules: schedData.pagination?.total ?? 0,
        }))

        const allJO = joData.job_orders || []
        setRecentJobOrders(allJO.slice(0, 3))

        const completed  = allJO.filter(jo => jo.status === 'Complete' || jo.status === 'Completed').length
        const inProgress = allJO.filter(jo => jo.status === 'In Progress' || jo.status === 'Active').length
        setJoStats({ total: allJO.length, completed, inProgress })

        // Fetch workers count
        const workersData = await apiGet('/api/contacts/list.php', { per_page: 1, type: 'worker' })
setCounts(p => ({ ...p, workers: workersData.pagination?.total ?? 0 }))

// Fetch license stats
const licData = await apiGet('/api/licenses/list.php', { per_page: 100 })
const allLic = licData.licenses || []
const now = new Date()
const soon = 60 * 24 * 60 * 60 * 1000
const licensesExpired  = allLic.filter(l => l.expiry_date && new Date(l.expiry_date) < now).length
const licensesExpiring = allLic.filter(l => l.expiry_date && new Date(l.expiry_date) >= now && (new Date(l.expiry_date) - now) < soon).length
const licensesValid    = allLic.filter(l => l.expiry_date && new Date(l.expiry_date) >= now && (new Date(l.expiry_date) - now) >= soon).length
setCounts(p => ({ ...p, licensesExpired, licensesExpiring, licensesValid }))

        // Fetch pending reschedule requests
        const rrData = await apiGet('/api/schedules/reschedule-requests/list.php', { status: 'pending' })
        const pending = rrData.requests || []
        setRescheduleRequests(pending)
        setCounts(p => ({ ...p, pendingReschedules: pending.length }))

      } catch (e) {
        console.warn('Dashboard load error:', e)
      }
      setLoading(false)
    }
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome to SkillConnect Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Emerald Builders & Construction. Here's your overview today</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={FileText}      label="Total Inquiries"  value={counts.inquiries}  color="emerald" />
        <StatCard icon={ClipboardList} label="Job Orders"       value={counts.jobOrders}  color="blue"    />
        <StatCard icon={Users}         label="All Contacts"     value={counts.contacts}   color="amber"   />
        <StatCard icon={HardHat}       label="Workers"          value={counts.workers}    color="purple"  />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6" style={{alignItems: 'start'}}>
        {/* Recent Job Orders */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{minWidth:0}}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Recent Job Orders</p>
              <p className="text-xs text-gray-400 mt-0.5">Latest projects</p>
            </div>
            <button
              onClick={() => navigate('/admin/job-orders')}
              className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {loading ? (
  <div className="flex items-center justify-center py-12 gap-2">
    <RefreshCw size={16} className="animate-spin text-emerald-400" />
    <span className="text-sm text-gray-400">Loading...</span>
  </div>
) : (
  <>
    {/* Mobile card view */}
    <div className="block sm:hidden divide-y divide-gray-50">
      {recentJobOrders.length === 0 ? (
        <p className="text-center py-10 text-gray-400 text-sm">No job orders yet</p>
      ) : recentJobOrders.map((jo) => {
        const initials = (jo.worker_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
        const colorMap = ['bg-blue-100 text-blue-600','bg-emerald-100 text-emerald-600','bg-purple-100 text-purple-600','bg-amber-100 text-amber-600','bg-rose-100 text-rose-600']
        const color = colorMap[jo.id % colorMap.length]
        return (
          <div key={jo.id} className="px-4 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-emerald-600 font-semibold">{jo.job_order_code}</span>
                <StatusBadge status={jo.status} />
              </div>
              <p className="text-sm font-medium text-gray-700 truncate">{jo.worker_name || '—'}</p>
              <p className="text-xs text-gray-400 truncate">{jo.client_name || '—'} · {jo.contract_type || '—'}</p>
            </div>
          </div>
        )
      })}
    </div>

    {/* Desktop table view */}
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {['Code', 'Worker', 'Client', 'Contract', 'Status'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recentJobOrders.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No job orders yet</td></tr>
          ) : recentJobOrders.map((jo) => {
            const initials = (jo.worker_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            const colorMap = ['bg-blue-100 text-blue-600','bg-emerald-100 text-emerald-600','bg-purple-100 text-purple-600','bg-amber-100 text-amber-600','bg-rose-100 text-rose-600']
            const color = colorMap[jo.id % colorMap.length]
            return (
              <tr key={jo.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">{jo.job_order_code}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}>
                      {initials}
                    </div>
                    <span className="text-gray-700 font-medium text-sm">{jo.worker_name || '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600 text-sm">{jo.client_name || '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-sm">{jo.contract_type || '—'}</td>
                <td className="px-5 py-3"><StatusBadge status={jo.status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </>
)}
        </div>

        {/* Right Column: Stats + Reschedule Requests */}
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 items-start">
  {/* Job Order Stats */}
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="font-semibold text-gray-800">Job Order Stats</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">Current overview</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-800">{joStats.total}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-xl font-bold text-emerald-500">{joStats.completed}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-500">{joStats.inProgress}</p>
                <p className="text-xs text-gray-400">In Progress</p>
              </div>
            </div>

            {/* Schedules quick stat */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-cyan-500" />
                <span className="text-xs text-gray-500">Active Schedules</span>
              </div>
              <span className="text-sm font-bold text-gray-700">{counts.schedules ?? '—'}</span>
            </div>

            {/* License stats */}
            <div className="mt-3 pt-3 border-t border-gray-100">
  <p className="text-xs font-semibold text-gray-500 mb-2">License Status</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-gray-500">Valid</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">{counts.licensesValid ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs text-gray-500">Expiring Soon</span>
                  </div>
                  <span className="text-xs font-bold text-amber-500">{counts.licensesExpiring ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs text-gray-500">Expired</span>
                  </div>
                  <span className="text-xs font-bold text-red-500">{counts.licensesExpired ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reschedule Requests */}
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-3 bg-amber-50/60">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Reschedule Requests</p>
                <p className="text-xs text-amber-600">
                  {rescheduleRequests.length > 0 ? `${rescheduleRequests.length} pending approval` : 'No pending requests'}
                </p>
              </div>
            </div>

            {rescheduleRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-400">No pending reschedule requests</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {rescheduleRequests.map(req => (
                  <div key={req.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-amber-600">{req.schedule_code}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-medium text-gray-700 truncate">{req.worker_name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-1">{req.reason}</p>
                    <div className="space-y-1 mb-3">
                      <div className="flex gap-2">
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider w-16 flex-shrink-0">Current</span>
                        <span className="text-[10px] text-gray-600">{req.current_start_time?.slice(0,16).replace('T',' ')} → {req.current_end_time?.slice(0,16).replace('T',' ')}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[10px] text-amber-500 font-medium uppercase tracking-wider w-16 flex-shrink-0">Requested</span>
                        <span className="text-[10px] text-gray-700 font-medium">{req.new_start_time?.slice(0,16).replace('T',' ')} → {req.new_end_time?.slice(0,16).replace('T',' ')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={reviewSaving === req.id}
                        onClick={async () => {
                          setReviewSaving(req.id)
                          try {
                            const token = JSON.parse(localStorage.getItem('sc_user'))?.token
                            const res = await fetch('http://localhost/skillconnect/backend/api/schedules/reschedule-requests/review.php', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ request_id: req.id, action: 'approve' }),
                            })
                            const data = await res.json()
                            if (!data.success) throw new Error(data.error)
                            setRescheduleRequests(prev => prev.filter(r => r.id !== req.id))
                            setCounts(p => ({ ...p, pendingReschedules: (p.pendingReschedules || 1) - 1 }))
                          } catch (e) { alert('Failed: ' + e.message) }
                          setReviewSaving(null)
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50">
                        {reviewSaving === req.id ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                        Approve
                      </button>
                      <button
                        disabled={reviewSaving === req.id}
                        onClick={async () => {
                          setReviewSaving(req.id)
                          try {
                            const token = JSON.parse(localStorage.getItem('sc_user'))?.token
                            const res = await fetch('http://localhost/skillconnect/backend/api/schedules/reschedule-requests/review.php', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ request_id: req.id, action: 'reject' }),
                            })
                            const data = await res.json()
                            if (!data.success) throw new Error(data.error)
                            setRescheduleRequests(prev => prev.filter(r => r.id !== req.id))
                            setCounts(p => ({ ...p, pendingReschedules: (p.pendingReschedules || 1) - 1 }))
                          } catch (e) { alert('Failed: ' + e.message) }
                          setReviewSaving(null)
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-white border border-red-200 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-50">
                        <X size={11} />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}