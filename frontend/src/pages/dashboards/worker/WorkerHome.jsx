import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, ClipboardList, Briefcase, ChevronRight, ChevronLeft,
  MapPin, X, CalendarDays, CalendarCheck2, CalendarX2, ArrowRight, Camera, Eye, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet, BASE_URL } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// Skeleton stays visible at least this long (ms) so the loading state is never just a flash.
// Set to 0 to show content as soon as the data arrives.
const MIN_SKELETON_MS = 1200

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }

  /* Skeleton shimmer */
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
    animation: sc-shimmer 1.2s infinite;
  }

  /* Entrance animations */
  @keyframes sc-in     { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes sc-slide  { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: none; } }
  @keyframes sc-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-cell   { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
  @keyframes sc-select { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.14); opacity: 1; } 100% { transform: scale(1); } }
  .sc-rise   { animation: sc-in .7s cubic-bezier(.16,1,.3,1) both; }
  .sc-slide  { animation: sc-slide .55s cubic-bezier(.16,1,.3,1) both; }
  .sc-fadein { animation: sc-fadein .6s ease both; }
  .sc-cell   { animation: sc-cell .5s cubic-bezier(.34,1.56,.64,1) both; }
  .sc-select { animation: sc-select .38s ease both; }
  .sc-bar    { transition: width 1.3s cubic-bezier(.16,1,.3,1); }

  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-slide, .sc-fadein, .sc-cell, .sc-select { animation: none; }
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
  'Planned':     ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
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

// ── Animated pieces ────────────────────────────────────────────
function CountUp({ value, duration = 1100 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    let raf, start = null
    const tick = t => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / duration)
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{n}</>
}

function ProgressBar({ pct, delay = 0 }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = setTimeout(() => setW(pct), 250 + delay); return () => clearTimeout(id) }, [pct, delay])
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`sc-bar h-full rounded-full ${pct >= 100 ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${w}%` }} />
    </div>
  )
}

const CARD = 'bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden'

function CardHeader({ title, subtitle, action, onAction }) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
      </div>
      <button onClick={onAction} className="group inline-flex items-center gap-1 h-8 px-2.5 -mr-2.5 rounded-lg text-[13px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap">
        {action} <ArrowRight size={14} {...ICON} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>
    </header>
  )
}

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
    ? { tone: 'bg-red-50 border-red-200 text-red-800', iconTone: 'text-red-500', icon: AlertCircle,
        title: 'License expired', text: <><span className="font-semibold">{names(expired)}</span> expired on {dates(expired)}.</>, action: 'Review now', dismissible: false }
    : hasExpiring
    ? { tone: 'bg-amber-50 border-amber-200 text-amber-900', iconTone: 'text-amber-500', icon: AlertTriangle,
        title: 'License expiring soon', text: <><span className="font-semibold">{names(expiring)}</span> expires on {dates(expiring)}.</>, action: 'Renew', dismissible: true }
    : { tone: 'bg-emerald-50 border-emerald-200 text-emerald-900', iconTone: 'text-emerald-600', icon: ShieldCheck,
        title: 'License valid', text: <><span className="font-semibold">{names(valid)}</span> is valid until {dates(valid)}.</>, action: null, dismissible: true }

  return (
    <div role="status" className={`sc-rise flex items-center gap-3 rounded-xl border px-4 py-2.5 ${cfg.tone}`} style={{ animationDelay: '100ms' }}>
      <cfg.icon size={18} {...ICON} className={`flex-shrink-0 ${cfg.iconTone}`} />
      <p className="flex-1 min-w-0 text-sm"><span className="font-semibold">{cfg.title}.</span> <span className="opacity-90">{cfg.text}</span></p>
      {cfg.action && <button onClick={goLicenses} className="text-sm font-semibold underline underline-offset-2 whitespace-nowrap">{cfg.action}</button>}
      {cfg.dismissible && (
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition"><X size={16} {...ICON} /></button>
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, hint, dot, tone, loading, delay, onClick }) {
  return (
    <button onClick={onClick} style={{ animationDelay: `${delay}ms` }}
      className="sc-rise group text-left bg-white rounded-xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:-translate-y-1 hover:shadow-[0_12px_24px_-12px_rgba(16,24,40,0.18)] hover:border-slate-300 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg] ${tone}`}><Icon size={16} {...ICON} /></span>
      </div>
      {loading ? <Skel className="h-9 w-14 mt-3" /> : (
        <p className="mt-3 text-[34px] leading-none font-semibold text-slate-900 tabular-nums tracking-tight"><CountUp value={value} /></p>
      )}
      {loading ? <Skel className="h-3 w-28 mt-3.5" /> : (
        <p className="sc-fadein mt-3.5 flex items-center gap-1.5 text-xs text-slate-500" style={{ animationDelay: '500ms' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{hint}
        </p>
      )}
    </button>
  )
}

// ── Skeletons ──────────────────────────────────────────────────
function ProjectsSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {[0, 1, 2].map(i => (
        <div key={i} className="px-5 py-5 space-y-3.5">
          <div className="flex justify-between gap-4"><div className="space-y-2"><Skel className="h-4 w-40" /><Skel className="h-3 w-28" /></div><Skel className="h-5 w-20" /></div>
          <Skel className="h-3 w-64 max-w-full" />
          <div className="space-y-2"><div className="flex justify-between"><Skel className="h-3 w-16" /><Skel className="h-3 w-8" /></div><Skel className="h-2 w-full rounded-full" /></div>
          <div className="flex justify-between items-center"><Skel className="h-3 w-36" /><div className="flex gap-2"><Skel className="h-8 w-16 rounded-lg" /><Skel className="h-8 w-32 rounded-lg" /></div></div>
        </div>
      ))}
    </div>
  )
}
function CalendarSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Skel className="h-4 w-28" /><Skel className="h-6 w-12" /></div>
        <div className="flex gap-1"><Skel className="w-7 h-7" /><Skel className="w-7 h-7" /></div>
      </div>
      <div className="grid grid-cols-7 gap-y-2 place-items-center">
        {Array.from({ length: 7 }).map((_, i) => <Skel key={`h${i}`} className="h-3 w-3" />)}
        {Array.from({ length: 35 }).map((_, i) => <Skel key={i} className="w-8 h-8 rounded-full" />)}
      </div>
    </div>
  )
}

// ── DASHBOARD HOME ─────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['S','M','T','W','T','F','S']

export default function WorkerHome() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const [jobs,      setJobs]      = useState([])
  const [schedules, setSchedules] = useState([])
  const [licenses,  setLicenses]  = useState([])
  const [jobPhotos, setJobPhotos] = useState({})
  const [loading,   setLoading]   = useState(true)

  // ── Data loading (unchanged, except the minimum skeleton time)
  useEffect(() => {
    const t0 = Date.now()
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
        setTimeout(() => setLoading(false), Math.max(0, MIN_SKELETON_MS - (Date.now() - t0)))
      }
    }
    load()
  }, [])

  const now = new Date()
  const today = toKey(now)
  const [calYear,     setCalYear]     = useState(now.getFullYear())
  const [calMonth,    setCalMonth]    = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(today)

  const totalProjects = jobs.length
  const totalTasks    = schedules.length
  const todaySchedules = schedules
    .filter(sc => sc.start_time?.slice(0, 10) === today)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
  const todayCount    = todaySchedules.length
  const upcomingCount = schedules.filter(sc => (sc.start_time?.slice(0, 10) || '') >= today).length
  const inProgressCount = jobs.filter(jo => !['Cancelled', 'Complete', 'Completed'].includes(jo.status)).length
  const activeJobs    = jobs.filter(jo => jo.status !== 'Cancelled').slice(0, 3)
  const scheduleDates = useMemo(() => new Set(schedules.map(sc => sc.start_time?.slice(0, 10)).filter(Boolean)), [schedules])
  const daySchedules  = schedules
    .filter(sc => sc.start_time?.slice(0, 10) === selectedDay)
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

  const firstName = (user?.name || user?.full_name || '').split(' ')[0]

  // Calendar
  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }
  const goToday   = () => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); setSelectedDay(today) }

  return (
    <div className="sc-page w-full space-y-6">
      <style>{styles}</style>

      {/* Header */}
      <div className="sc-rise flex items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here’s your work at a glance.</p>
        </div>
      </div>

      <LicenseBanner licenses={licenses} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Briefcase}      label="Projects"        value={totalProjects} dot="bg-emerald-500" tone="bg-emerald-50 text-emerald-600" loading={loading} delay={120}
          hint={`${inProgressCount} in progress`} onClick={() => navigate('/worker/job-orders')} />
        <StatCard icon={CalendarDays}   label="Scheduled tasks" value={totalTasks}    dot="bg-sky-500"     tone="bg-sky-50 text-sky-600"         loading={loading} delay={220}
          hint={`${upcomingCount} upcoming`} onClick={() => navigate('/worker/schedules')} />
        <StatCard icon={CalendarCheck2} label="Today"           value={todayCount}    dot="bg-amber-500"   tone="bg-amber-50 text-amber-600"     loading={loading} delay={320}
          hint={todayCount > 0 ? `First visit at ${fmtTime(todaySchedules[0].start_time)}` : 'No visits today'} onClick={goToday} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
        {/* Active projects */}
        <section className={`${CARD} sc-rise`} style={{ animationDelay: '420ms' }}>
          <CardHeader title="Active projects" subtitle="Your current job orders" action="View all" onAction={() => navigate('/worker/job-orders')} />

          {loading ? <ProjectsSkeleton /> : activeJobs.length === 0 ? (
            <div className="sc-fadein py-16 flex flex-col items-center text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-slate-400 flex items-center justify-center"><ClipboardList size={22} {...ICON} /></div>
              <p className="mt-4 text-sm font-semibold text-slate-900">No active projects</p>
              <p className="text-sm text-slate-500 mt-1">New job orders assigned to you will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeJobs.map((jo, i) => {
                const pct = progressPercent(jo.status, jo.start_date, jo.end_date, jobPhotos[jo.id] || [])
                return (
                  <li key={jo.id} className="sc-rise px-5 py-5 hover:bg-slate-50/60 transition-colors" style={{ animationDelay: `${i * 150}ms` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{jo.job_order_code}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{jo.contract_type || 'Construction project'}</p>
                      </div>
                      <StatusBadge status={jo.status} />
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                      <MapPin size={13} {...ICON} className="flex-shrink-0 text-slate-400" />
                      <span className="truncate">{jo.client_address || jo.location || 'No address'}</span>
                    </p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-500">Progress</span>
                        <span className="text-xs font-semibold text-slate-900 tabular-nums">{pct}%</span>
                      </div>
                      <ProgressBar pct={pct} delay={i * 150} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <CalendarDays size={13} {...ICON} className="text-slate-400" />
                        {fmtDate(jo.start_date, { month: 'short', day: 'numeric' })} – {fmtDate(jo.end_date)}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => navigate('/worker/job-orders')}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[.97] transition-all">
                          <Eye size={14} {...ICON} /> View
                        </button>
                        <button onClick={() => navigate('/worker/job-orders')}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium shadow-sm active:scale-[.97] transition-all">
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

        {/* Schedule */}
        <section className={`${CARD} sc-rise`} style={{ animationDelay: '520ms' }}>
          <CardHeader title="Schedule" subtitle="Select a day to see its visits" action="View all" onAction={() => navigate('/worker/schedules')} />

          {loading ? <CalendarSkeleton /> : (
            <div className="p-4 sc-fadein">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{MONTHS[calMonth]} {calYear}</p>
                  <button onClick={goToday} className="h-6 px-2 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition">Today</button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} aria-label="Previous month" className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-90 transition"><ChevronLeft size={16} {...ICON} /></button>
                  <button onClick={nextMonth} aria-label="Next month" className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-90 transition"><ChevronRight size={16} {...ICON} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7">
                {DAYS.map((d, i) => <div key={i} className="text-center text-[11px] font-medium text-slate-400 py-1.5">{d}</div>)}
              </div>
              <div key={`${calYear}-${calMonth}`} className="grid grid-cols-7">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />
                  const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = key === today, isSel = key === selectedDay, has = scheduleDates.has(key)
                  return (
                    <button key={key} onClick={() => setSelectedDay(key)} aria-pressed={isSel}
                      style={{ animationDelay: `${i * 14}ms` }}
                      className={`sc-cell relative mx-auto my-0.5 w-8 h-8 flex items-center justify-center rounded-full text-[13px] tabular-nums transition-colors duration-150
                        ${isSel ? 'text-white font-semibold' : isToday ? 'text-emerald-700 font-semibold ring-1 ring-emerald-300 bg-emerald-50' : 'text-slate-700 hover:bg-slate-100'}`}>
                      {isSel && <span className="sc-select absolute inset-0 rounded-full bg-emerald-600 shadow-sm shadow-emerald-600/30" />}
                      <span className="relative">{day}</span>
                      {has && <span className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSel ? 'bg-white' : 'bg-emerald-500'}`} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected day */}
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-600 mb-3">{fmtDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            {loading ? (
              <div className="space-y-2.5">
                {[0, 1].map(i => <div key={i} className="flex gap-3"><Skel className="w-14 h-9" /><Skel className="h-14 flex-1 rounded-lg" /></div>)}
              </div>
            ) : daySchedules.length === 0 ? (
              <div className="sc-fadein flex items-center gap-2.5 text-sm text-slate-400 py-1">
                <CalendarX2 size={16} {...ICON} /> No visits on this day.
              </div>
            ) : (
              <ul key={selectedDay} className="space-y-2.5">
                {daySchedules.map((sc, i) => (
                  <li key={sc.id} className="sc-slide flex gap-3" style={{ animationDelay: `${i * 90}ms` }}>
                    <div className="w-14 flex-shrink-0 pt-2.5 text-right">
                      <p className="text-xs font-semibold text-slate-800 tabular-nums">{fmtTime(sc.start_time)}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{fmtTime(sc.end_time)}</p>
                    </div>
                    <div className="relative flex-1 min-w-0 rounded-lg border border-slate-200 bg-white pl-4 pr-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all">
                      <span className="absolute left-1.5 top-2.5 bottom-2.5 w-1 rounded-full bg-emerald-500" />
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{sc.description || sc.schedule_code || 'Site visit'}</p>
                        {sc.status && <StatusBadge status={sc.status} />}
                      </div>
                      {sc.client_name && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} {...ICON} /><span className="truncate">{sc.client_name}</span></p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}