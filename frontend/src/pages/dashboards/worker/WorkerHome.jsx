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
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #eef2f5; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  @keyframes sc-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes sc-pop  { from { opacity: 0; transform: scale(.985); } to { opacity: 1; transform: none; } }
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
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
const toKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// "2026-11-10 10:00:00" → "10 AM" / "10:30 AM"
const timeShort = s => {
  if (!s) return ''
  const [h, m] = String(s).slice(11, 16).split(':').map(Number)
  if (isNaN(h)) return ''
  const ap  = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ap}` : `${h12} ${ap}`
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

// ── SCHEDULE CALENDAR (month grid) ─────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MAX_CHIPS = 2

const KINDS = {
  planned:   { label: 'Planned',     chip: 'bg-emerald-50 text-emerald-800 border-emerald-500', dot: 'bg-emerald-500' },
  progress:  { label: 'In progress', chip: 'bg-amber-50 text-amber-800 border-amber-500',       dot: 'bg-amber-400'   },
  complete:  { label: 'Complete',    chip: 'bg-blue-50 text-blue-800 border-blue-500',          dot: 'bg-blue-500'    },
  cancelled: { label: 'Cancelled',   chip: 'bg-red-50 text-red-800 border-red-500',             dot: 'bg-red-500'     },
}
const kindOf = (status = '') => {
  const s = String(status).toLowerCase()
  if (s.includes('cancel'))   return 'cancelled'
  if (s.includes('complete')) return 'complete'
  if (s.includes('progress')) return 'progress'
  return 'planned'
}
const keyOf   = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const titleOf = sc => sc.client_name || sc.description || sc.schedule_code || 'Site visit'

function ScheduleCalendar({ schedules, year, month, selectedDay, today, onSelect, onPrev, onNext, onToday, onViewAll }) {
  const byDay = useMemo(() => {
    const map = {}
    schedules.forEach(sc => {
      const k = sc.start_time?.slice(0, 10)
      if (!k) return
      ;(map[k] ||= []).push(sc)
    })
    Object.values(map).forEach(list => list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))))
    return map
  }, [schedules])

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const selected = byDay[selectedDay] || []

  return (
    <section className="sc-rise bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden" style={{ animationDelay: '220ms' }}>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight tabular-nums truncate">{MONTHS[month]} {year}</h2>
          <button onClick={onToday} className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">Today</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onViewAll} className="hidden sm:inline-flex items-center gap-1 mr-1 text-sm font-medium text-emerald-700 hover:text-emerald-800">
            View all <ArrowRight size={14} {...ICON} />
          </button>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden divide-x divide-slate-200">
            <button onClick={onPrev} aria-label="Previous month" className="w-9 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"><ChevronLeft size={16} {...ICON} /></button>
            <button onClick={onNext} aria-label="Next month"     className="w-9 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"><ChevronRight size={16} {...ICON} /></button>
          </div>
        </div>
      </header>

      {/* Weekday row */}
      <div className="grid grid-cols-7 border-y border-slate-100 bg-slate-50/70">
        {DAYS.map((d, i) => (
          <div key={d} className={`py-2 text-center text-[11px] sm:text-xs font-medium tracking-wide ${i === 0 || i === 6 ? 'text-slate-400' : 'text-slate-500'}`}>{d}</div>
        ))}
      </div>

      {/* Month grid */}
      <div key={`${year}-${month}`} className="sc-pop grid grid-cols-7">
        {cells.map((day, i) => {
          const weekend = i % 7 === 0 || i % 7 === 6
          const lastCol = i % 7 === 6
          const lastRow = i >= cells.length - 7
          const base = `border-slate-100 ${lastCol ? '' : 'border-r'} ${lastRow ? '' : 'border-b'}`

          if (!day) return <div key={`e${i}`} className={`min-h-[64px] sm:min-h-[96px] bg-slate-50/60 ${base}`} />

          const key     = keyOf(year, month, day)
          const events  = byDay[key] || []
          const isToday = key === today
          const isSel   = key === selectedDay
          const shown   = events.slice(0, MAX_CHIPS)
          const extra   = events.length - shown.length

          return (
            <button key={key} onClick={() => onSelect(key)} aria-pressed={isSel}
              className={`relative flex flex-col items-stretch text-left min-h-[64px] sm:min-h-[96px] p-1 sm:p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500
                ${base} ${isSel ? 'bg-emerald-50/60' : weekend ? 'bg-slate-50/60 hover:bg-slate-100/70' : 'bg-white hover:bg-slate-50'}`}>
              {isSel && <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-emerald-500/70" />}

              <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm tabular-nums self-start
                ${isToday ? 'bg-emerald-600 text-white font-semibold shadow-sm' : weekend ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                {day}
              </span>

              {/* Desktop chips */}
              <span className="hidden sm:flex flex-col gap-1 mt-1.5">
                {shown.map(sc => (
                  <span key={sc.id} title={`${timeShort(sc.start_time)} ${titleOf(sc)}`}
                    className={`block truncate rounded-[5px] border-l-2 px-1.5 py-[3px] text-[11px] leading-tight font-medium ${KINDS[kindOf(sc.status)].chip}`}>
                    {timeShort(sc.start_time)} {titleOf(sc)}
                  </span>
                ))}
                {extra > 0 && <span className="px-1 text-[11px] font-medium text-slate-500">+{extra} more</span>}
              </span>

              {/* Mobile dots */}
              {events.length > 0 && (
                <span className="sm:hidden flex items-center justify-center gap-0.5 mt-1">
                  {events.slice(0, 3).map(sc => <span key={sc.id} className={`w-1.5 h-1.5 rounded-full ${KINDS[kindOf(sc.status)].dot}`} />)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 sm:px-5 py-3 border-t border-slate-100">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Object.values(KINDS).map(k => (
            <li key={k.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className={`w-2.5 h-2.5 rounded-[3px] ${k.dot}`} />{k.label}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">Select a day to see its visits</p>
      </footer>

      {/* Selected day details */}
      <div className="px-4 sm:px-5 py-4 border-t border-slate-100 bg-slate-50/40">
        <p className="text-sm font-semibold text-slate-900">{fmtDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        {selected.length === 0 ? (
          <div className="flex items-center gap-2 mt-2 text-sm text-slate-400"><CalendarX2 size={16} {...ICON} /> No visits on this day</div>
        ) : (
          <ul key={selectedDay} className="mt-3 grid gap-2 sm:grid-cols-2">
            {selected.map((sc, i) => {
              const k = KINDS[kindOf(sc.status)]
              return (
                <li key={sc.id} className="sc-rise flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className={`w-1 self-stretch rounded-full ${k.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{sc.description || sc.schedule_code || 'Site visit'}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} {...ICON} />{timeShort(sc.start_time)}{sc.end_time ? ` – ${timeShort(sc.end_time)}` : ''}
                    </p>
                    {sc.client_name && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={12} {...ICON} />{sc.client_name}</p>}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">{k.label}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
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

  const firstName = (user?.name || user?.full_name || '').split(' ')[0]

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

      <div className="grid grid-cols-1 gap-4 sm:gap-5 items-start">
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
            <div className="py-12 flex flex-col items-center text-center px-6">
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

        {/* Schedule calendar */}
        <ScheduleCalendar
          schedules={schedules}
          year={calYear}
          month={calMonth}
          selectedDay={selectedDay}
          today={today}
          onSelect={setSelectedDay}
          onPrev={prevMonth}
          onNext={nextMonth}
          onToday={goToday}
          onViewAll={() => navigate('/worker/schedules')}
        />
      </div>
    </div>
  )
}