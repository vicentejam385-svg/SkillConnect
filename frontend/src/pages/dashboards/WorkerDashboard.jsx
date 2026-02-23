import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatsCard from '../../components/StatsCard'
import { useAuth } from '../../context/AuthContext'
import {
  ClipboardList, CheckCircle, Clock,
  MapPin, Calendar, ChevronRight, HardHat
} from 'lucide-react'

const NAV_ITEMS = [
  { type: 'section', label: 'My Work' },
  { path: '/worker/dashboard',  label: 'Dashboard',     icon: HardHat       },
  { path: '/worker/job-orders', label: 'My Job Orders', icon: ClipboardList },
]

const MOCK_JOBS = [
  {
    id: 1,
    code: 'JO-2026-001',
    title: 'Foundation Concrete Pouring',
    site: 'Project Alpha — Quezon City',
    date: '2026-02-22',
    time: '07:00 AM',
    status: 'In Progress',
    priority: 'High',
    notes: 'Prepare formwork before 7AM. Safety gear mandatory.',
  },
  {
    id: 2,
    code: 'JO-2026-002',
    title: 'Electrical Rough-in, Level 3',
    site: 'Project Beta — Makati',
    date: '2026-02-23',
    time: '08:00 AM',
    status: 'Pending',
    priority: 'Medium',
    notes: 'Coordinate with Foreman Ramos on conduit layout.',
  },
  {
    id: 3,
    code: 'JO-2026-003',
    title: 'Roof Beam Installation',
    site: 'Project Alpha — Quezon City',
    date: '2026-02-19',
    time: '06:00 AM',
    status: 'Completed',
    priority: 'High',
    notes: '',
  },
]

const STATUS_COLOR = {
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'Pending':     'bg-blue-500/10 text-blue-400 border-blue-400/30',
  'Completed':   'bg-emerald-500/10 text-emerald-400 border-emerald-400/30',
}

const PRIORITY_DOT = {
  'High':   'bg-red-400',
  'Medium': 'bg-amber-400',
  'Low':    'bg-emerald-400',
}

function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`card-steel overflow-hidden transition-all duration-300 ${job.status === 'In Progress' ? 'border-amber-500/30' : ''}`}>
      {job.status === 'In Progress' && (
        <div className="h-0.5 bg-amber-500" />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-slate-500">{job.code}</span>
              <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[job.priority]}`} title={`${job.priority} priority`} />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-100 tracking-wide">{job.title}</h3>
          </div>
          <span className={`status-badge border ${STATUS_COLOR[job.status]} flex-shrink-0`}>
            {job.status === 'In Progress' && <Clock size={10} />}
            {job.status === 'Completed'   && <CheckCircle size={10} />}
            {job.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-body text-slate-500">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-slate-600" />
            {job.site}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-slate-600" />
            {job.date}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-600" />
            {job.time}
          </div>
        </div>

        {job.notes && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1.5 text-xs font-body text-slate-500 hover:text-amber-400 transition-colors"
          >
            <ChevronRight size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
            {expanded ? 'Hide notes' : 'View notes'}
          </button>
        )}

        {expanded && job.notes && (
          <div className="mt-3 p-3 bg-steel-950/50 border border-steel-700 text-xs font-body text-slate-400 leading-relaxed">
            {job.notes}
          </div>
        )}
      </div>
    </div>
  )
}

function WorkerHome() {
  const { user } = useAuth()
  const active  = MOCK_JOBS.filter(j => j.status === 'In Progress')
  const pending = MOCK_JOBS.filter(j => j.status === 'Pending')
  const done    = MOCK_JOBS.filter(j => j.status === 'Completed')
  const today   = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-8">
      <div>
        <p className="font-body text-xs text-slate-500 tracking-widest uppercase mb-1">{today}</p>
        <h2 className="font-display font-bold text-3xl text-slate-100 tracking-wide">
          Welcome, {user?.name || user?.username}
        </h2>
        <p className="font-body text-slate-400 text-sm mt-1">Here's your current job assignment overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard icon={Clock}         label="In Progress" value={active.length}  sub="Active jobs"    accent="amber"   />
        <StatsCard icon={ClipboardList} label="Pending"     value={pending.length} sub="Upcoming jobs"  accent="blue"    />
        <StatsCard icon={CheckCircle}   label="Completed"   value={done.length}    sub="This month"     accent="emerald" />
      </div>

      {active.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg text-slate-300 tracking-wide mb-3">
            Active Job{active.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {active.map(j => <JobCard key={j.id} job={j} />)}
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-lg text-slate-300 tracking-wide mb-3">Upcoming</h3>
          <div className="space-y-3">
            {pending.map(j => <JobCard key={j.id} job={j} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function MyJobOrdersPage() {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? MOCK_JOBS : MOCK_JOBS.filter(j => j.status === filter)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">My Job Orders</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">All job assignments for your account</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['all', 'In Progress', 'Pending', 'Completed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-display font-semibold tracking-widest uppercase transition-colors
              ${filter === f ? 'bg-amber-500 text-steel-900' : 'border border-steel-700 text-slate-500 hover:border-steel-500 hover:text-slate-300'}`}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card-steel p-12 text-center">
          <ClipboardList size={36} className="text-steel-600 mx-auto mb-3" />
          <p className="font-body text-slate-500">No job orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(j => <JobCard key={j.id} job={j} />)}
        </div>
      )}
    </div>
  )
}

export default function WorkerDashboard() {
  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Worker Portal">
      <Routes>
        <Route path="dashboard"  element={<WorkerHome />}      />
        <Route path="job-orders" element={<MyJobOrdersPage />} />
        <Route path="*"          element={<WorkerHome />}      />
      </Routes>
    </DashboardLayout>
  )
}