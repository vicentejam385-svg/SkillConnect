import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { ClipboardList, Calendar, RefreshCw } from 'lucide-react'
import { apiGet } from '../../utils/api'

const NAV_ITEMS = [
  { type: 'section', label: 'My Work' },
  { path: '/worker/dashboard',  label: 'My Job Orders', icon: ClipboardList },
  { path: '/worker/schedules',  label: 'My Schedules',  icon: Calendar      },
]

function StatusBadge({ status }) {
  const colors = {
    'Pending':     'bg-yellow-500/10 text-yellow-400',
    'Active':      'bg-emerald-500/10 text-emerald-400',
    'Complete':    'bg-blue-500/10 text-blue-400',
    'On Hold':     'bg-orange-500/10 text-orange-400',
    'In Progress': 'bg-amber-500/10 text-amber-400',
    'Scheduled':   'bg-cyan-500/10 text-cyan-400',
    'Cancelled':   'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`status-badge ${colors[status] || 'bg-slate-500/10 text-slate-400'}`}>
      {status || '—'}
    </span>
  )
}

function MyJobOrders() {
  const { user }   = useAuth()
  const [jobs,     setJobs]    = useState([])
  const [loading,  setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/job-orders/list.php', { per_page: 50 })
      .then(d => setJobs(d.job_orders || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">My Job Orders</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Jobs assigned to you</p>
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
                  {['Job ID', 'Client', 'Contract', 'Start', 'End', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-600">No job orders assigned</td></tr>
                ) : jobs.map(jo => (
                  <tr key={jo.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{jo.job_order_code}</td>
                    <td className="px-4 py-3 text-slate-200">{jo.client_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{jo.contract_type || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{jo.start_date || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{jo.end_date || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={jo.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MySchedules() {
  const [schedules, setSchedules] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    apiGet('/api/schedules/list.php', { per_page: 50 })
      .then(d => setSchedules(d.schedules || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">My Schedules</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Your upcoming assignments</p>
      </div>
      <div className="card-steel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-amber-400" />
            <span className="font-body text-slate-400 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {schedules.length === 0 ? (
              <p className="text-center py-12 text-slate-600 font-body">No schedules assigned</p>
            ) : schedules.map(sc => (
              <div key={sc.id} className="border border-steel-700 bg-steel-800/40 p-4 hover:border-amber-500/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-amber-400 font-semibold">{sc.schedule_code}</span>
                  <StatusBadge status={sc.status} />
                </div>
                <p className="font-body text-slate-300 text-sm mb-2">{sc.description || 'No description'}</p>
                <div className="flex gap-4 text-xs text-slate-500 font-body">
                  <span>Start: {sc.start_time?.slice(0, 16).replace('T', ' ') || '—'}</span>
                  <span>End: {sc.end_time?.slice(0, 16).replace('T', ' ') || '—'}</span>
                </div>
                {sc.client_name && (
                  <p className="text-xs text-slate-500 mt-1 font-body">Client: {sc.client_name}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function WorkerDashboard() {
  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Worker">
      <Routes>
        <Route path="dashboard" element={<MyJobOrders />}  />
        <Route path="schedules" element={<MySchedules />}  />
        <Route path="*"         element={<MyJobOrders />}  />
      </Routes>
    </DashboardLayout>
  )
}