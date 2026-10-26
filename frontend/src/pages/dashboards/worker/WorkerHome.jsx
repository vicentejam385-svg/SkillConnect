import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, CheckCircle, AlertCircle, ClipboardList, Briefcase,
  ChevronRight, MapPin, Clock, X
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet } from '../../../utils/api'

// ── Helpers ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = {
    'Pending':     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'Active':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Complete':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Completed':   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'On Hold':     'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Scheduled':   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'Cancelled':   'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-sm
      ${colors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {status || '—'}
    </span>
  )
}

function progressPercent(status, start_date, end_date, uploadedPhotos = []) {
  if (status === 'Complete' || status === 'Completed') return 100
  if (status === 'Cancelled') return 0
  if (!start_date || !end_date) return 0
  const start = new Date(start_date)
  const end   = new Date(end_date)
  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  if (uploadedPhotos.length === 0) return 0
  const uniqueDays = new Set(
    uploadedPhotos.map(p => (p.upload_date || '').slice(0, 10)).filter(Boolean)
  ).size
  return Math.min(99, Math.round((uniqueDays / totalDays) * 100))
}

function LicenseBanner({ licenses }) {
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()
  if (!licenses || licenses.length === 0) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in3Months = new Date(today)
  in3Months.setMonth(in3Months.getMonth() + 3)

  const expired  = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) < today)
  const expiring = licenses.filter(l => {
    if (!l.expiry_date) return false
    const exp = new Date(l.expiry_date)
    return exp >= today && exp <= in3Months
  })
  const valid = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) > in3Months)

  const hasExpired  = expired.length > 0
  const hasExpiring = expiring.length > 0
  const hasValid    = valid.length > 0 && !hasExpired && !hasExpiring

  if (!hasExpired && !hasExpiring && !hasValid) return null
  if ((hasExpiring || hasValid) && dismissed) return null

  if (hasExpired) {
    return (
      <div className="flex items-center justify-between gap-4 px-6 py-3 bg-red-500 mb-4 rounded-md">
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-center">
          <AlertCircle size={16} className="text-white flex-shrink-0" />
          <p className="text-sm font-medium text-white text-center">
            Your license <span className="font-bold">{expired.map(l => l.document_name).join(', ')}</span> has expired on{' '}
            {expired.map(l => new Date(l.expiry_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })).join(', ')}.{' '}
            <span
              onClick={() => navigate('/worker/profile', { state: { tab: 'licenses' } })}
              className="underline underline-offset-2 cursor-pointer font-semibold hover:opacity-80">
              Please review immediately →
            </span>
          </p>
        </div>
      </div>
    )
  }

  if (hasExpiring) {
    return (
      <div className="flex items-center justify-between gap-4 px-6 py-3 bg-yellow-400 mb-4 rounded-md">
        <div className="w-4 flex-shrink-0" />
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-center">
          <AlertCircle size={16} className="text-yellow-900 flex-shrink-0" />
          <p className="text-sm font-medium text-yellow-900 text-center">
            Your license <span className="font-bold">{expiring.map(l => l.document_name).join(', ')}</span> will expire on{' '}
            {expiring.map(l => new Date(l.expiry_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })).join(', ')}.{' '}
            <span
              onClick={() => navigate('/worker/profile', { state: { tab: 'licenses' } })}
              className="underline underline-offset-2 cursor-pointer font-semibold hover:opacity-80">
              Renew before it expires →
            </span>
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-yellow-900 hover:opacity-70 transition-opacity flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    )
  }

  if (hasValid) {
    return (
      <div className="flex items-center justify-between gap-4 px-6 py-3 bg-emerald-500 mb-4 rounded-md">
        <div className="w-4 flex-shrink-0" />
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-center">
          <CheckCircle size={16} className="text-white flex-shrink-0" />
          <p className="text-sm font-medium text-white text-center">
            Your license <span className="font-bold">{valid.map(l => l.document_name).join(', ')}</span> is valid until{' '}
            {valid.map(l => new Date(l.expiry_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })).join(', ')}.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-white hover:opacity-70 transition-opacity flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    )
  }

  return null
}
// ── DASHBOARD HOME ─────────────────────────────────────────────
export default function WorkerHome() {
  const { user }      = useAuth()
  const navigate      = useNavigate()
const [jobs,        setJobs]      = useState([])
const [schedules,   setSchedules] = useState([])
const [licenses,    setLicenses]  = useState([])
const [jobPhotos,   setJobPhotos] = useState({})
const [loading,     setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const wData = await apiGet('/api/workers/list.php', { per_page: 100 })
        const workers = wData.workers || []
        const worker = workers.find(w =>
          String(w.id)           === String(user?.id) ||
          String(w.user_id)      === String(user?.id) ||
          String(w.contact_code) === String(user?.contact_code)
        )
        if (!worker) return

        const [jData, sData] = await Promise.all([
          apiGet('/api/job-orders/list.php', { per_page: 100 }),
          apiGet('/api/schedules/list.php',  { per_page: 100 }),
        ])

        const myJobs = (jData.job_orders || []).filter(jo =>
          String(jo.worker_contact_id) === String(worker.contact_id) ||
          String(jo.worker_contact_id) === String(worker.id)         ||
          String(jo.worker_name)       === String(worker.full_name)
        )
        const mySchedules = (sData.schedules || []).filter(
          sc => sc.worker_contact_code === worker.contact_code
        )
       setJobs(myJobs)
setSchedules(mySchedules)

// Load photos for progress bars
const token = JSON.parse(localStorage.getItem('sc_user'))?.token
const photoResults = await Promise.all(
  myJobs.map(jo =>
    fetch(`http://localhost/skillconnect/backend/api/job-orders/get-progress.php?job_order_id=${jo.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => ({ id: jo.id, photos: d.photos || [] }))
      .catch(() => ({ id: jo.id, photos: [] }))
  )
)
const photoMap = {}
photoResults.forEach(r => { photoMap[r.id] = r.photos })
setJobPhotos(photoMap)
        // Load licenses for banner
        try {
  const lData = await apiGet('/api/licenses/list.php', { per_page: 50 })
  // Filter licenses to only show for current worker
  const workerLicenses = (lData.licenses || []).filter(l =>
    String(l.contact_id) === String(worker?.contact_id)
  )
  setLicenses(workerLicenses)
} catch { /* silent */ }
      } catch (err) {
        console.error('WorkerHome load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [calYear,     setCalYear]    = useState(new Date().getFullYear())
  const [calMonth,    setCalMonth]   = useState(new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10))

  // Derived stats
  const totalProjects = jobs.length
  const totalTasks    = schedules.length
  const totalPayroll  = jobs.reduce((sum, jo) => sum + (parseFloat(jo.budget) || 0), 0)

  // Today's schedules
  const today = new Date().toISOString().slice(0, 10)
  const todaySchedules = schedules.filter(sc => {
    const start = sc.start_time?.slice(0, 10)
    return start === today
  })

  // Active / recent job orders (max 3)
  const activeJobs = jobs.filter(jo => jo.status !== 'Cancelled').slice(0, 3)

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <RefreshCw size={18} className="animate-spin text-emerald-500" />
      <span className="font-body text-slate-400 text-sm">Loading dashboard...</span>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* ── License Banner ── */}
      <LicenseBanner licenses={licenses} />
      {/* ── Stat Cards ── */}
     <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 font-medium mb-0.5">Total Projects</p>
            <p className="text-2xl font-bold text-slate-800">{totalProjects}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Briefcase size={18} className="text-white" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 font-medium mb-0.5">Net Tasks</p>
            <p className="text-2xl font-bold text-slate-800">{totalTasks}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
            <CheckCircle size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* ── Main Layout: Left = Active Projects, Right = Calendar ── */}
      <div className="flex flex-col gap-4">

        {/* ── LEFT: Active Projects ── */}
        <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm">Active Projects</h3>
            <button
              onClick={() => navigate('/worker/job-orders')}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
              View All <ChevronRight size={13} />
            </button>
          </div>
          {activeJobs.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">No active projects</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {activeJobs.map(jo => {
                const pct = progressPercent(jo.status, jo.start_date, jo.end_date, jobPhotos[jo.id] || [])
                return (
                  <div key={jo.id} className="px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate('/worker/job-orders')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-slate-700 font-mono">{jo.job_order_code}</span>
                        <span className="text-xs text-slate-400">–</span>
                        <span className="text-xs font-medium text-slate-600 truncate">{jo.contract_type || 'Construction Project'}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={jo.status} />
                        <button className="px-2 py-0.5 text-[10px] bg-white border border-slate-200 text-slate-500 rounded hover:bg-slate-50 transition-colors">View</button>
                        <button className="px-2 py-0.5 text-[10px] bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">Update Progress</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                      <div className="flex items-center gap-1">
                        <MapPin size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-500 truncate">{jo.client_address || jo.location || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-500">{jo.start_date || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-500">{jo.end_date || '—'}</span>
                      </div>
                    </div>
                    <div />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Calendar (box style, fixed width) ── */}
        <div className="w-full">
      {/* ── Schedule Calendar ── */}
      {(() => {
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
        const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

        const firstDay    = new Date(calYear, calMonth, 1).getDay()
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

        const scheduleDates = new Set(
          schedules.map(sc => sc.start_time?.slice(0, 10)).filter(Boolean)
        )

        const selectedSchedules = schedules.filter(sc => sc.start_time?.slice(0, 10) === selectedDay)

        const prevMonth = () => {
          if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
          else setCalMonth(m => m - 1)
        }
        const nextMonth = () => {
          if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
          else setCalMonth(m => m + 1)
        }

        const cells = []
        for (let i = 0; i < firstDay; i++) cells.push(null)
        for (let d = 1; d <= daysInMonth; d++) cells.push(d)

        return (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">Schedule Calendar</h3>
              <button
                onClick={() => navigate('/worker/schedules')}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                View All <ChevronRight size={13} />
              </button>
            </div>

           <div className="p-3">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-2">
                <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronRight size={13} className="rotate-180" />
                </button>
                <span className="text-sm font-semibold text-slate-700">{monthNames[calMonth]} {calYear}</span>
                <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday     = dateStr === today
                  const isSelected  = dateStr === selectedDay
                  const hasSchedule = scheduleDates.has(dateStr)
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(dateStr)}
                      className={`relative mx-auto w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-all
                        ${isSelected
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : isToday
                            ? 'bg-emerald-50 text-emerald-700 font-bold ring-1 ring-emerald-300'
                            : 'text-slate-600 hover:bg-slate-100'}`}>
                      {day}
                      {hasSchedule && (
                        <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Selected day schedules */}
              {selectedSchedules.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {selectedSchedules.map(sc => (
                    <div key={sc.id} className="flex items-start gap-2 p-2 rounded-md bg-emerald-50/60 border border-emerald-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{sc.description || sc.schedule_code || 'Schedule'}</p>
                        <p className="text-[10px] text-slate-400">{sc.start_time?.slice(11,16) || '—'} – {sc.end_time?.slice(11,16) || '—'}</p>
                        {sc.client_name && <p className="text-[10px] text-slate-400 flex items-center gap-1"><MapPin size={8}/>{sc.client_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedSchedules.length === 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                  <p className="text-[10px] text-slate-300">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })} — no schedules
                  </p>
                </div>
              )}
            </div>
          </div>
       )
      })()}
        </div>{/* end right calendar column */}
      </div>{/* end main flex row */}
    </div>
  )
}