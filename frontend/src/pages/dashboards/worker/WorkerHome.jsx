import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, AlertTriangle, ClipboardList, Briefcase, ChevronRight, ChevronLeft,
  MapPin, Clock, X, CalendarDays, CalendarCheck2, CalendarX2, ArrowRight, Camera, Eye, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet, BASE_URL } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  /* skeleton shimmer */
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #e9eef3; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  .sc-skel.sc-dark { background: rgba(255,255,255,.18); }
  .sc-skel.sc-dark::after { background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent); }

  /* entrance + micro animations */
  @keyframes sc-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes sc-pop  { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: none; } }
  @keyframes sc-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  .sc-rise  { animation: sc-rise .5s cubic-bezier(.2,.7,.2,1) both; }
  .sc-pop   { animation: sc-pop .28s cubic-bezier(.2,.7,.2,1) both; }
  .sc-float { animation: sc-float 7s ease-in-out infinite; }
  .sc-bar   { transition: width 1.1s cubic-bezier(.2,.7,.2,1); }

  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-pop, .sc-float { animation: none; }
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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
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

// ── Small animated pieces ──────────────────────────────────────
function CountUp({ value }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    let raf, start = null
    const dur = 750
    const tick = t => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n}</>
}

function ProgressBar({ pct }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = setTimeout(() => setW(pct), 80); return () => clearTimeout(id) }, [pct])
  return (
    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`sc-bar h-full rounded-full ${pct >= 100 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} style={{ width: `${w}%` }} />
    </div>
  )
}

const CARD = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden'

function CardHeader({ icon: Icon, title, subtitle, action, onAction }) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-lg bg-slate-50 ring-1 ring-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0"><Icon size={17} {...ICON} /></span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <button onClick={onAction} className="group inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap">
        {action} <ArrowRight size={14} {...ICON} className="transition-transform group-hover:translate-x-0.5" />
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
    ? { tone: 'bg-red-50 border-red-200 text-red-800', iconTone: 'bg-red-100 text-red-600', icon: AlertCircle,
        title: 'License expired', text: <><span className="font-semibold">{names(expired)}</span> expired on {dates(expired)}.</>, action: 'Review now', dismissible: false }
    : hasExpiring
    ? { tone: 'bg-amber-50 border-amber-200 text-amber-900', iconTone: 'bg-amber-100 text-amber-600', icon: AlertTriangle,
        title: 'License expiring soon', text: <><span className="font-semibold">{names(expiring)}</span> expires on {dates(expiring)}.</>, action: 'Renew', dismissible: true }
    : { tone: 'bg-emerald-50 border-emerald-200 text-emerald-900', iconTone: 'bg-emerald-100 text-emerald-600', icon: ShieldCheck,
        title: 'License valid', text: <><span className="font-semibold">{names(valid)}</span> is valid until {dates(valid)}.</>, action: null, dismissible: true }

  return (
    <div role="status" className={`sc-rise flex items-center gap-3 rounded-xl border px-4 py-3 ${cfg.tone}`} style={{ animationDelay: '60ms' }}>
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconTone}`}><cfg.icon size={17} {...ICON} /></span>
      <p className="flex-1 min-w-0 text-sm"><span className="font-semibold">{cfg.title}.</span> <span className="opacity-90">{cfg.text}</span></p>
      {cfg.action && <button onClick={goLicenses} className="text-sm font-semibold underline underline-offset-2 whitespace-nowrap">{cfg.action}</button>}
      {cfg.dismissible && (
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition"><X size={16} {...ICON} /></button>
      )}
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, hint, tone, loading, delay, onClick }) {
  return (
    <button onClick={onClick} style={{ animationDelay: `${delay}ms` }}
      className="sc-rise group text-left bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-[13px] font-medium text-slate-500 truncate">{label}</p>
          {loading
            ? <Skel className="h-8 w-12 mt-2" />
            : <p className="mt-1.5 text-3xl font-semibold text-slate-900 tabular-nums leading-none tracking-tight"><CountUp value={value} /></p>}
        </div>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${tone}`}><Icon size={20} {...ICON} /></span>
      </div>
      <p className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-500">
        <span className="truncate">{hint}</span>
        <ArrowRight size={12} {...ICON} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-600 flex-shrink-0" />
      </p>
    </button>
  )
}

// ── Skeletons ──────────────────────────────────────────────────
function ProjectsSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {[0, 1, 2].map(i => (
        <div key={i} className="px-5 py-4 flex gap-4">
          <Skel className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="flex justify-between gap-4"><Skel className="h-4 w-44" /><Skel className="h-5 w-20 rounded-full" /></div>
            <Skel className="h-3 w-56" />
            <Skel className="h-2 w-full rounded-full" />
            <div className="flex justify-between"><Skel className="h-3 w-32" /><div className="flex gap-2"><Skel className="h-8 w-16 rounded-lg" /><Skel className="h-8 w-32 rounded-lg" /></div></div>
          </div>
        </div>
      ))}
    </div>
  )
}
function CalendarSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Skel className="h-4 w-28" /><Skel className="h-6 w-12 rounded-md" /></div>
        <div className="flex gap-1"><Skel className="w-7 h-7 rounded-md" /><Skel className="w-7 h-7 rounded-md" /></div>
      </div>
      <div className="grid grid-cols-7 gap-y-2.5 place-items-center">
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

  const totalProjects = jobs.length
  const totalTasks    = schedules.length
  const todayCount    = schedules.filter(sc => sc.start_time?.slice(0, 10) === today).length
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

  const summary = todayCount > 0
    ? `You have ${todayCount} visit${todayCount > 1 ? 's' : ''} scheduled today.`
    : 'No visits scheduled today.'

  return (
    <div className="sc-page max-w-6xl space-y-5">
      <style>{styles}</style>

      {/* Hero */}
      <section className="sc-rise relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-6 py-6 sm:px-8 sm:py-7 text-white shadow-[0_8px_24px_-12px_rgba(5,150,105,0.5)]">
        <div className="sc-float pointer-events-none absolute -right-12 -top-20 w-64 h-64 rounded-full bg-white/10" />
        <div className="sc-float pointer-events-none absolute right-28 -bottom-24 w-52 h-52 rounded-full bg-white/[0.06]" style={{ animationDelay: '-3s' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-emerald-100/90">{fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h1 className="mt-1.5 text-2xl sm:text-[30px] font-semibold tracking-tight leading-tight">
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
            {loading
              ? <Skel className="sc-dark h-4 w-56 mt-3" />
              : <p className="mt-2 text-sm text-emerald-50/90">{summary}</p>}
          </div>
          <button onClick={() => navigate('/worker/schedules')}
            className="group inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-white text-emerald-700 text-sm font-semibold shadow-sm hover:bg-emerald-50 transition-colors self-start sm:self-auto">
            <CalendarDays size={16} {...ICON} /> View schedule
            <ArrowRight size={14} {...ICON} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <LicenseBanner licenses={licenses} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={Briefcase}      label="Projects"        value={totalProjects} hint="View job orders"   tone="bg-emerald-50 text-emerald-600" loading={loading} delay={80}  onClick={() => navigate('/worker/job-orders')} />
        <StatCard icon={CalendarDays}   label="Scheduled tasks" value={totalTasks}    hint="View all visits"   tone="bg-sky-50 text-sky-600"         loading={loading} delay={140} onClick={() => navigate('/worker/schedules')} />
        <StatCard icon={CalendarCheck2} label="Today"           value={todayCount}    hint="Jump to today"     tone="bg-amber-50 text-amber-600"     loading={loading} delay={200} onClick={goToday} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 sm:gap-5 items-start">
        {/* Active projects */}
        <section className={`${CARD} sc-rise`} style={{ animationDelay: '240ms' }}>
          <CardHeader icon={Briefcase} title="Active projects" subtitle="Your current job orders" action="View all" onAction={() => navigate('/worker/job-orders')} />

          {loading ? <ProjectsSkeleton /> : activeJobs.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center"><ClipboardList size={22} {...ICON} /></div>
              <p className="mt-3 text-sm font-semibold text-slate-800">No active projects</p>
              <p className="text-sm text-slate-500 mt-1">New job orders assigned to you will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeJobs.map((jo, i) => {
                const pct = progressPercent(jo.status, jo.start_date, jo.end_date, jobPhotos[jo.id] || [])
                return (
                  <li key={jo.id} className="sc-rise group/row px-5 py-4 flex gap-4 hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${300 + i * 80}ms` }}>
                    <span className="hidden sm:flex w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 items-center justify-center flex-shrink-0 transition-transform group-hover/row:scale-105"><Briefcase size={18} {...ICON} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{jo.job_order_code}</p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{jo.contract_type || 'Construction project'}</p>
                        </div>
                        <StatusBadge status={jo.status} />
                      </div>

                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                        <MapPin size={13} {...ICON} className="flex-shrink-0 text-slate-400" />
                        <span className="truncate">{jo.client_address || jo.location || 'No address'}</span>
                      </p>

                      <div className="mt-3.5 flex items-center gap-3">
                        <ProgressBar pct={pct} />
                        <span className="text-xs font-semibold text-slate-700 tabular-nums w-9 text-right">{pct}%</span>
                      </div>

                      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays size={13} {...ICON} className="text-slate-400" />
                          {fmtDate(jo.start_date, { month: 'short', day: 'numeric' })} – {fmtDate(jo.end_date)}
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => navigate('/worker/job-orders')}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                            <Eye size={14} {...ICON} /> View
                          </button>
                          <button onClick={() => navigate('/worker/job-orders')}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium shadow-sm active:scale-[.98] transition-all">
                            <Camera size={14} {...ICON} /> Update progress
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Schedule */}
        <section className={`${CARD} sc-rise`} style={{ animationDelay: '300ms' }}>
          <CardHeader icon={CalendarDays} title="Schedule" subtitle="Select a day to see its visits" action="View all" onAction={() => navigate('/worker/schedules')} />

          {loading ? <CalendarSkeleton /> : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">{MONTHS[calMonth]} {calYear}</p>
                  <button onClick={goToday} className="h-6 px-2 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">Today</button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} aria-label="Previous month" className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition"><ChevronLeft size={16} {...ICON} /></button>
                  <button onClick={nextMonth} aria-label="Next month" className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition"><ChevronRight size={16} {...ICON} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7">
                {DAYS.map((d, i) => <div key={i} className="text-center text-[11px] font-medium text-slate-400 py-1.5">{d}</div>)}
              </div>
              <div key={`${calYear}-${calMonth}`} className="sc-pop grid grid-cols-7">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />
                  const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isToday = key === today, isSel = key === selectedDay, has = scheduleDates.has(key)
                  return (
                    <button key={key} onClick={() => setSelectedDay(key)} aria-pressed={isSel}
                      className={`relative mx-auto my-0.5 w-8 h-8 flex items-center justify-center rounded-full text-[13px] tabular-nums transition-all duration-150 active:scale-90
                        ${isSel ? 'bg-emerald-600 text-white font-semibold shadow-sm shadow-emerald-600/30'
                          : isToday ? 'text-emerald-700 font-semibold bg-emerald-50 ring-1 ring-emerald-300'
                          : 'text-slate-700 hover:bg-slate-100'}`}>
                      {day}
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
              <div className="flex items-center gap-2.5 text-sm text-slate-400 py-1">
                <CalendarX2 size={16} {...ICON} /> No visits on this day.
              </div>
            ) : (
              <ul key={selectedDay} className="space-y-2.5">
                {daySchedules.map((sc, i) => (
                  <li key={sc.id} className="sc-rise flex gap-3" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="w-14 flex-shrink-0 pt-2.5 text-right">
                      <p className="text-xs font-semibold text-slate-800 tabular-nums">{fmtTime(sc.start_time)}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">{fmtTime(sc.end_time)}</p>
                    </div>
                    <div className="relative flex-1 min-w-0 rounded-xl border border-slate-200 bg-white pl-4 pr-3 py-2.5 hover:border-slate-300 transition-colors">
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