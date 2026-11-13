import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, ClipboardList, Briefcase, ChevronRight, ChevronLeft,
  MapPin, Clock, X, CalendarDays, CalendarCheck2, ArrowRight, Camera, Eye, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet, BASE_URL } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// ── Local styles (same as the admin pages) ─────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #eef2f5; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  @keyframes sc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes sc-pop  { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-rise .45s cubic-bezier(.2,.7,.2,1) both; }
  .sc-pop  { animation: sc-pop .25s cubic-bezier(.2,.7,.2,1) both; }
  .sc-bar  { transition: width 1s cubic-bezier(.2,.7,.2,1); }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-pop { animation: none; }
    .sc-bar { transition: none; }
  }
`

const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

// ── Helpers ────────────────────────────────────────────────────
const STATUS = {
  'Pending':     ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Active':      ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Complete':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Completed':   ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'On Hold':     ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'In Progress': ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500'],
  'Scheduled':   ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500'],
  'Cancelled':   ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
}
function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

// Progress is based on the days photos were uploaded (unchanged)
function progressPercent(status, start_date, end_date, uploadedPhotos = []) {
  if (status === 'Complete' || status === 'Completed') return 100
  if (status === 'Cancelled') return 0
  if (!start_date || !end_date) return 0
  const start = new Date(start_date)
  const end   = new Date(end_date)
  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  if (uploadedPhotos.length === 0) return 0
  const uniqueDays = new Set(uploadedPhotos.map(p => (p.upload_date || '').slice(0, 10)).filter(Boolean)).size
  return Math.min(99, Math.round((uniqueDays / totalDays) * 100))
}

const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!s) return '—'
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  return isNaN(d) ? s : d.toLocaleDateString('en-PH', opts)
}
const fmtTime = s => {
  if (!s) return '—'
  const [h, m] = String(s).slice(11, 16).split(':').map(Number)
  if (isNaN(h)) return '—'
  const d = new Date(); d.setHours(h, m || 0)
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
const toKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ── License notice (same rules as before) ──────────────────────
function LicenseBanner({ licenses }) {
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()
  if (!licenses || licenses.length === 0) return null

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in3Months = new Date(today); in3Months.setMonth(in3Months.getMonth() + 3)

  const expired  = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) < today)
  const expiring = licenses.filter(l => { if (!l.expiry_date) return false; const exp = new Date(l.expiry_date); return exp >= today && exp <= in3Months })
  const valid    = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) > in3Months)

  const hasExpired  = expired.length > 0
  const hasExpiring = expiring.length > 0
  const hasValid    = valid.length > 0 && !hasExpired && !hasExpiring

  if (!hasExpired && !hasExpiring && !hasValid) return null
  if ((hasExpiring || hasValid) && dismissed) return null

  const names = list => list.map(l => l.document_name).join(', ')
  const dates = list => list.map(l => fmtDate(l.expiry_date)).join(', ')
  const goLicenses = () => navigate('/worker/profile', { state: { tab: 'licenses' } })

  const cfg = hasExpired
    ? { tone: 'bg-red-50 border-red-200 text-red-800', iconTone: 'bg-red-100 text-red-600', icon: AlertCircle,
        title: 'License expired', text: <><span className="font-semibold">{names(expired)}</span> expired on {dates(expired)}.</>, action: 'Review now', dismissible: false }
    : hasExpiring
    ? { tone: 'bg-amber-50 border-amber-200 text-amber-900', iconTone: 'bg-amber-100 text-amber-600', icon: AlertTriangle,
        title: 'License expiring soon', text: <><span className="font-semibold">{names(expiring)}</span> expires on {dates(expiring)}.</>, action: 'Renew', dismissible: true }
    : { tone: 'bg-emerald-50 border-emerald-200 text-emerald-900', iconTone: 'bg-emerald-100 text-emerald-600', icon: ShieldCheck,
        title: 'License valid', text: <><span className="font-semibold">{names(valid)}</span> is valid until {dates(valid)}.</>, action: null, dismissible: true }

  return (
    <div role="status" className={`sc-rise flex items-start sm:items-center gap-3 rounded-xl border px-4 py-3 ${cfg.tone}`}>
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconTone}`}><cfg.icon size={18} {...ICON} /></span>
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold">{cfg.title}</p>
        <p className="opacity-90">{cfg.text}</p>
        {cfg.action && <button onClick={goLicenses} className="sm:hidden mt-1 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2">{cfg.action} <ArrowRight size={13} {...ICON} /></button>}
      </div>
      {cfg.action && (
        <button onClick={goLicenses} className="hidden sm:inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-white/70 hover:bg-white text-sm font-medium ring-1 ring-black/5 transition-colors whitespace-nowrap">
          {cfg.action} <ArrowRight size={14} {...ICON} />
        </button>
      )}
      {cfg.dismissible && (
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition">
          <X size={16} {...ICON} />
        </button>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone, loading, delay, onClick }) {
  return (
    <button onClick={onClick} style={{ animationDelay: `${delay}ms` }}
      className="sc-rise group text-left bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 hover:border-slate-300 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}><Icon size={18} {...ICON} /></span>
        <ChevronRight size={16} {...ICON} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      {loading ? <Skel className="h-7 w-10 mt-3" /> : <p className="mt-3 text-2xl font-semibold text-slate-900 tabular-nums leading-none">{value}</p>}
      <p className="mt-1.5 text-sm text-slate-500">{label}</p>
    </button>
  )
}

// ── DASHBOARD HOME ─────────────────────────────────────────────
export default function WorkerHome() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const [jobs,      setJobs]      = useState([])
  const [schedules, setSchedules] = useState([])
  const [licenses,  setLicenses]  = useState([])
  const [jobPhotos, setJobPhotos] = useState({})
  const [loading,   setLoading]   = useState(true)

  // ── Data loading (unchanged)
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
        const mySchedules = (sData.schedules || []).filter(sc => sc.worker_contact_code === worker.contact_code)
        setJobs(myJobs)
        setSchedules(mySchedules)

        // Photos for progress bars
        const token = JSON.parse(localStorage.getItem('sc_user'))?.token
        const photoResults = await Promise.all(
          myJobs.map(jo =>
            fetch(`${BASE_URL}/api/job-orders/get-progress.php?job_order_id=${jo.id}`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.json())
              .then(d => ({ id: jo.id, photos: d.photos || [] }))
              .catch(() => ({ id: jo.id, photos: [] }))
          )
        )
        const photoMap = {}
        photoResults.forEach(r => { photoMap[r.id] = r.photos })
        setJobPhotos(photoMap)

        // Licenses for the notice
        try {
          const lData = await apiGet('/api/licenses/list.php', { per_page: 50 })
          setLicenses((lData.licenses || []).filter(l => String(l.contact_id) === String(worker?.contact_id)))
        } catch { /* silent */ }
      } catch (err) {
        console.error('WorkerHome load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const now = new Date()
  const today = toKey(now)
  const [calYear,     setCalYear]     = useState(now.getFullYear())
  const [calMonth,    setCalMonth]    = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(today)

  const totalProjects  = jobs.length
  const totalTasks     = schedules.length
  const todayCount     = schedules.filter(sc => sc.start_time?.slice(0, 10) === today).length
  const activeJobs     = jobs.filter(jo => jo.status !== 'Cancelled').slice(0, 3)
  const scheduleDates  = useMemo(() => new Set(schedules.map(sc => sc.start_time?.slice(0, 10)).filter(Boolean)), [schedules])
  const daySchedules   = schedules
    .filter(sc => sc.start_time?.slice(0, 10) === selectedDay)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

  const firstName = (user?.name || user?.full_name || '').split(' ')[0]

  // Calendar
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }
  const goToday   = () => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); setSelectedDay(today) }

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>

      {/* Header */}
      <div className="sc-rise">
        <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Here’s your work at a glance.</p>
      </div>

      <LicenseBanner licenses={licenses} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Briefcase}      label="Projects"        value={totalProjects} tone="bg-emerald-50 text-emerald-600" loading={loading} delay={0}   onClick={() => navigate('/worker/job-orders')} />
        <StatCard icon={CalendarDays}   label="Scheduled tasks" value={totalTasks}    tone="bg-sky-50 text-sky-600"         loading={loading} delay={60}  onClick={() => navigate('/worker/schedules')} />
        <StatCard icon={CalendarCheck2} label="Today"           value={todayCount}    tone="bg-amber-50 text-amber-600"     loading={loading} delay={120} onClick={goToday} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 sm:gap-5 items-start">
        {/* Active projects */}
        <section className="sc-rise bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden" style={{ animationDelay: '150ms' }}>
          <header className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Active projects</h2>
              <p className="text-xs text-slate-500 mt-0.5">Your current job orders</p>
            </div>
            <button onClick={() => navigate('/worker/job-orders')} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
              View all <ArrowRight size={14} {...ICON} />
            </button>
          </header>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {[0, 1, 2].map(i => (
                <div key={i} className="px-5 py-4 space-y-3">
                  <div className="flex justify-between"><Skel className="h-4 w-48" /><Skel className="h-5 w-20 rounded-md" /></div>
                  <Skel className="h-3 w-64" /><Skel className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : activeJobs.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center"><ClipboardList size={22} {...ICON} /></div>
              <p className="mt-3 text-sm font-semibold text-slate-800">No active projects</p>
              <p className="text-sm text-slate-500 mt-1">New job orders assigned to you will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeJobs.map((jo, i) => {
                const pct = progressPercent(jo.status, jo.start_date, jo.end_date, jobPhotos[jo.id] || [])
                return (
                  <li key={jo.id} className="sc-rise px-5 py-4 hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${200 + i * 60}ms` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {jo.job_order_code} <span className="font-normal text-slate-500">· {jo.contract_type || 'Construction project'}</span>
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                          <MapPin size={13} {...ICON} className="flex-shrink-0 text-slate-400" />
                          <span className="truncate">{jo.client_address || jo.location || 'No address'}</span>
                        </p>
                      </div>
                      <StatusBadge status={jo.status} />
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`sc-bar h-full rounded-full ${pct >= 100 ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600 tabular-nums w-9 text-right">{pct}%</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays size={13} {...ICON} className="text-slate-400" />
                        {fmtDate(jo.start_date, { month: 'short', day: 'numeric' })} – {fmtDate(jo.end_date)}
                      </p>
                      <div className="flex gap-1.5">
                        <button onClick={() => navigate('/worker/job-orders')}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                          <Eye size={14} {...ICON} /> View
                        </button>
                        <button onClick={() => navigate('/worker/job-orders')}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow-sm transition-colors">
                          <Camera size={14} {...ICON} /> Update progress
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Calendar */}
        <section className="sc-rise bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden" style={{ animationDelay: '220ms' }}>
          <header className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Schedule</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tap a day to see its visits</p>
            </div>
            <button onClick={() => navigate('/worker/schedules')} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
              View all <ArrowRight size={14} {...ICON} />
            </button>
          </header>

          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 tabular-nums">{MONTHS[calMonth]} {calYear}</p>
                <button onClick={goToday} className="h-7 px-2.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">Today</button>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden divide-x divide-slate-200">
                <button onClick={prevMonth} aria-label="Previous month" className="w-8 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronLeft size={15} {...ICON} /></button>
                <button onClick={nextMonth} aria-label="Next month" className="w-8 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronRight size={15} {...ICON} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d, i) => <div key={d} className={`text-center text-[11px] font-medium py-1 ${i === 0 || i === 6 ? 'text-slate-300' : 'text-slate-400'}`}>{d}</div>)}
            </div>
            <div key={`${calYear}-${calMonth}`} className="sc-pop grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />
                const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = key === today, isSel = key === selectedDay, has = scheduleDates.has(key)
                return (
                  <button key={key} onClick={() => setSelectedDay(key)} aria-pressed={isSel}
                    className={`relative mx-auto w-9 h-9 flex items-center justify-center rounded-full text-sm tabular-nums transition-all duration-200
                      ${isSel ? 'bg-emerald-600 text-white font-semibold shadow-sm scale-105'
                        : isToday ? 'bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-emerald-300'
                        : 'text-slate-700 hover:bg-slate-100'}`}>
                    {day}
                    {has && <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSel ? 'bg-white' : 'bg-emerald-500'}`} />}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2">{fmtDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              {daySchedules.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">No visits on this day</p>
              ) : (
                <ul key={selectedDay} className="space-y-2">
                  {daySchedules.map((sc, i) => (
                    <li key={sc.id} className="sc-rise flex items-start gap-3 rounded-lg border border-slate-200 p-3" style={{ animationDelay: `${i * 50}ms` }}>
                      <span className="w-1 self-stretch rounded-full bg-emerald-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{sc.description || sc.schedule_code || 'Site visit'}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Clock size={12} {...ICON} />{fmtTime(sc.start_time)} – {fmtTime(sc.end_time)}</p>
                        {sc.client_name && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} {...ICON} />{sc.client_name}</p>}
                      </div>
                      {sc.status && <StatusBadge status={sc.status} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}