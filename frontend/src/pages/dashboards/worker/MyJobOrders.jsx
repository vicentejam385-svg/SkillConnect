import { useState, useEffect } from 'react'
import {
  RefreshCw, AlertCircle, ClipboardList, FileText, Upload, X, Eye, Camera, Briefcase,
  ChevronLeft, ChevronRight, MapPin, CalendarDays, CalendarCheck2, CheckCircle2, User, Hammer, Clock,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }
const HOST = 'https://saddlebrown-swan-877763.hostingersite.com'
const API  = `${HOST}/backend/api`

// Skeleton stays visible at least this long (ms). Set to 0 to show data as soon as it arrives.
const MIN_SKELETON_MS = 1000
const JOB_PER_PAGE = 3

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .sc-page, .sc-page h1, .sc-page h2, .sc-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .sc-page :focus-visible { outline: 2px solid #059669; outline-offset: 2px; border-radius: 8px; }

  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
    animation: sc-shimmer 1.2s infinite;
  }

  @keyframes sc-in     { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes sc-slide  { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  @keyframes sc-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-modal  { from { opacity: 0; transform: translateY(18px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes sc-grow   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes sc-pulse  { 0% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); } 70%,100% { box-shadow: 0 0 0 7px rgba(245,158,11,0); } }
  @keyframes sc-sheen  { from { transform: translateX(-120%) skewX(-20deg); } to { transform: translateX(260%) skewX(-20deg); } }
  @keyframes sc-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes sc-toast-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .sc-rise   { animation: sc-in .7s cubic-bezier(.16,1,.3,1) both; }
  .sc-slide  { animation: sc-slide .55s cubic-bezier(.16,1,.3,1) both; }
  .sc-fadein { animation: sc-fadein .35s ease both; }
  .sc-modal  { animation: sc-modal .4s cubic-bezier(.16,1,.3,1) both; }
  .sc-float  { animation: sc-float 3.6s ease-in-out infinite; }

  /* Progress bar fills from the left once the card appears */
  .sc-bar { transform-origin: left; animation: sc-grow 1.1s cubic-bezier(.16,1,.3,1) .35s both; }
  .sc-bar-live::after {
    content: ''; position: absolute; inset: 0; width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
    animation: sc-sheen 2.2s ease-in-out 1.4s infinite;
  }
  .sc-dot-live { animation: sc-pulse 1.8s infinite; }
  .sc-toast-bar { transform-origin: left; animation: sc-toast-bar 3.2s linear forwards; }

  /* Job card: status rail + lift on hover */
  .sc-card { position: relative; transition: transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s, border-color .35s; }
  .sc-card::before {
    content: ''; position: absolute; left: 0; top: 16px; bottom: 16px; width: 3px; border-radius: 0 3px 3px 0;
    background: var(--rail, #cbd5e1); transform: scaleY(.4); opacity: .6;
    transition: transform .45s cubic-bezier(.16,1,.3,1), opacity .3s;
  }
  .sc-card:hover { transform: translateY(-3px); border-color: #cbd5e1; box-shadow: 0 18px 32px -18px rgba(16,24,40,.28); }
  .sc-card:hover::before { transform: scaleY(1); opacity: 1; }

  .sc-drop-on { border-color: #10b981 !important; background: rgba(16,185,129,.06) !important; transform: scale(1.01); }

  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-slide, .sc-fadein, .sc-modal, .sc-bar, .sc-bar-live::after,
    .sc-dot-live, .sc-toast-bar, .sc-float { animation: none; }
    .sc-card, .sc-card::before { transition: none; }
  }
`

const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

// ── Helpers ────────────────────────────────────────────────────
// [badge classes, dot color, rail color, bar gradient]
const STATUS = {
  'Pending':     ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500',  '#eab308', 'from-yellow-400 to-yellow-500'],
  'Active':      ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500', '#10b981', 'from-emerald-400 to-emerald-600'],
  'Complete':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500',    '#3b82f6', 'from-blue-400 to-blue-600'],
  'Completed':   ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500',    '#3b82f6', 'from-blue-400 to-blue-600'],
  'On Hold':     ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500',  '#f97316', 'from-orange-400 to-orange-500'],
  'In Progress': ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500',   '#f59e0b', 'from-amber-400 to-emerald-500'],
  'Scheduled':   ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500',    '#06b6d4', 'from-cyan-400 to-cyan-600'],
  'Cancelled':   ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500',     '#ef4444', 'from-red-400 to-red-500'],
}
const statusOf = s => STATUS[s] || ['bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400', '#94a3b8', 'from-slate-300 to-slate-400']
const isDone = s => s === 'Complete' || s === 'Completed'

function StatusBadge({ status }) {
  const [cls, dot] = statusOf(status)
  const live = status === 'In Progress' || status === 'Active'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${live ? 'sc-dot-live' : ''}`} />{status || '—'}
    </span>
  )
}

function progressPercent(status, start_date, end_date, uploadedPhotos = []) {
  if (isDone(status)) return 100
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

const fmtDate = (s) => {
  if (!s) return '—'
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  return isNaN(d) ? s : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
const todayStr = () => new Date().toISOString().slice(0, 10)
const esc = s => String(s || '').replace(/[\\'"<>&\r\n`$]/g, ' ')

// Counts up to `target` once (respects reduced motion)
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setN(target)
    let raf, t0
    const tick = t => {
      t0 = t0 ?? t
      const p = Math.min(1, (t - t0) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return n
}

// ── Small UI pieces ────────────────────────────────────────────
function Stat({ icon: Icon, label, value, tone, delay }) {
  const n = useCountUp(value)
  return (
    <div style={{ animationDelay: `${delay}ms` }}
      className="sc-rise flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}><Icon size={17} {...ICON} /></span>
      <div>
        <p className="text-xl font-semibold text-slate-900 leading-none tabular-nums">{n}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="mt-0.5 w-7 h-7 rounded-lg bg-white ring-1 ring-slate-200 text-emerald-600 flex items-center justify-center flex-shrink-0"><Icon size={14} {...ICON} /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="text-[13px] font-medium text-slate-800 break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-words">{value || '—'}</p>
    </div>
  )
}

function ProgressBar({ pct, status }) {
  const grad = statusOf(status)[3]
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-500">Progress</span>
        <span className="text-xs font-semibold text-slate-800 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div style={{ width: `${pct}%` }}
          className={`sc-bar ${pct > 0 && pct < 100 ? 'sc-bar-live' : ''} relative h-full rounded-full overflow-hidden bg-gradient-to-r ${grad}`} />
      </div>
    </div>
  )
}

function Modal({ onBackdrop, children }) {
  return (
    <div className="sc-fadein fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onMouseDown={e => { if (onBackdrop && e.target === e.currentTarget) onBackdrop() }}>
      <div role="dialog" aria-modal="true"
        className="sc-modal relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-[0_32px_80px_-20px_rgba(16,24,40,0.45)] overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ job, onClose }) {
  return (
    <div className="relative flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-emerald-50/80 via-white to-white">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-[0_8px_16px_-8px_rgba(5,150,105,.7)]"><Briefcase size={20} {...ICON} /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight truncate">{job.contract_type || 'Construction Project'}</h2>
          <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{job.job_order_code}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={job.status} />
        <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:rotate-90 active:scale-90 transition duration-300">
          <X size={18} {...ICON} />
        </button>
      </div>
    </div>
  )
}

function JobsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex justify-between gap-4">
            <div className="flex gap-3"><Skel className="w-11 h-11 rounded-xl" /><div className="space-y-2"><Skel className="h-4 w-44" /><Skel className="h-3 w-28" /></div></div>
            <Skel className="h-6 w-24 rounded-full" />
          </div>
          <Skel className="h-16 w-full rounded-xl" />
          <Skel className="h-2 w-full rounded-full" />
          <div className="flex justify-end gap-2"><Skel className="h-9 w-20 rounded-lg" /><Skel className="h-9 w-36 rounded-lg" /></div>
        </div>
      ))}
    </div>
  )
}

// ── MY JOB ORDERS ──────────────────────────────────────────────
export default function MyJobOrders() {
  const { user } = useAuth()
  const [jobs,           setJobs]           = useState([])
  const [loading,        setLoading]        = useState(true)
  const [viewJob,        setViewJob]        = useState(null)
  const [photoError,     setPhotoError]     = useState(null)
  const [progressJob,    setProgressJob]    = useState(null)
  const [progressVal,    setProgressVal]    = useState(0)
  const [mapCoords,      setMapCoords]      = useState(null)
  const [mapLoading,     setMapLoading]     = useState(false)
  const [progressPhotos, setProgressPhotos] = useState([])
  const [jobPhotos,      setJobPhotos]      = useState({}) // { [job_order_id]: [photos] }
  const [jobPage,        setJobPage]        = useState(1)
  const [saving,         setSaving]         = useState(false)
  const [toast,          setToast]          = useState(null)
  const [dragOver,       setDragOver]       = useState(false)

  // Load the worker's jobs
  useEffect(() => {
    const t0 = Date.now()
    apiGet('/api/workers/list.php')
      .then(wData => {
        const workers = wData.workers || []
        const worker  = workers.find(w =>
          String(w.id)           === String(user?.id)   ||
          String(w.user_id)      === String(user?.id)   ||
          String(w.contact_code) === String(user?.contact_code)
        )
        if (!worker) return setJobs([])
        return apiGet('/api/job-orders/list.php', { per_page: 100 }).then(d => {
          const mine = (d.job_orders || []).filter(jo =>
            String(jo.worker_contact_id) === String(worker.contact_id) ||
            String(jo.worker_contact_id) === String(worker.id)         ||
            String(jo.worker_name)       === String(worker.full_name)
          )
          setJobs(mine)
        })
      })
      .catch(err => console.error('MyJobOrders error:', err))
      .finally(() => setTimeout(() => setLoading(false), Math.max(0, MIN_SKELETON_MS - (Date.now() - t0))))
  }, [])

  // Load progress photos for all jobs
  useEffect(() => {
    if (jobs.length === 0) return
    const token = JSON.parse(localStorage.getItem('sc_user'))?.token
    Promise.all(
      jobs.map(jo =>
        fetch(`${API}/job-orders/get-progress.php?job_order_id=${jo.id}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => ({ id: jo.id, photos: d.photos || [] }))
          .catch(() => ({ id: jo.id, photos: [] }))
      )
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.id] = r.photos })
      setJobPhotos(map)
    })
  }, [jobs])

  // Auto-complete jobs past their end date
  useEffect(() => {
    const today = todayStr()
    jobs.forEach(async jo => {
      if (
        jo.end_date &&
        jo.end_date.slice(0, 10) < today &&
        jo.status !== 'Complete' &&
        jo.status !== 'Completed' &&
        jo.status !== 'Cancelled'
      ) {
        try {
          const token = JSON.parse(localStorage.getItem('sc_user'))?.token
          await fetch(`${API}/job-orders/update.php?id=${jo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status_id: 'Complete' }),
          })
          setJobs(prev => prev.map(j => j.id === jo.id ? { ...j, status: 'Complete' } : j))
        } catch (err) {
          console.error('Auto-complete failed for job', jo.id, err)
        }
      }
    })
  }, [jobs])

  // Esc closes modals · toast auto-hides
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { setViewJob(null); setProgressJob(null); setPhotoError(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  // ── Actions ──
  const openView = (jo) => {
    setMapCoords(null)
    setMapLoading(false)
    setViewJob(jo)
    const addr = jo.client_address || jo.location
    if (!addr) return
    setMapLoading(true)
    const cleanAddr = addr.replace(/\s+/g, ' ').trim()
    const geocode = (query) =>
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=ph&accept-language=en`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'SkillConnect/1.0' }
      }).then(r => r.json())

    geocode(cleanAddr)
      .then(data => {
        if (data?.[0]) return data
        // fallback: try just the city portion (last 2 comma-parts)
        const fallback = cleanAddr.split(',').slice(-2).join(',').trim()
        return geocode(fallback)
      })
      .then(data => { if (data?.[0]) setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }) })
      .catch(err => console.error('Geocode error:', err))
      .finally(() => setMapLoading(false))
  }

  const openProgress = async (jo, pct) => {
    setProgressVal(pct)
    setProgressJob(jo)
    setProgressPhotos([])
    setPhotoError(null)
    try {
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res = await fetch(`${API}/job-orders/get-progress.php?job_order_id=${jo.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setProgressPhotos(data.photos || [])
    } catch (err) { console.error('Failed to load photos:', err) }
  }

  const MAX_SIZE_MB = 50
  const pickPhoto = (f) => {
    if (!f) return false
    if (!f.type.startsWith('image/')) { setPhotoError('Only image files (JPG, PNG) are allowed.'); return false }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setPhotoError(`Photo must be under ${MAX_SIZE_MB}MB. Your file is ${(f.size / 1024 / 1024).toFixed(2)}MB.`)
      return false
    }
    setPhotoError(null)
    setProgressJob(prev => ({ ...prev, _photo: f, _photoDate: todayStr(), status: 'In Progress' }))
    return true
  }

  const saveProgress = async () => {
    setSaving(true)
    try {
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token

      // Upload photo if present
      if (progressJob._photo) {
        if (progressJob._photo.size > MAX_SIZE_MB * 1024 * 1024) {
          setPhotoError(`Photo must be under ${MAX_SIZE_MB}MB. Your file is ${(progressJob._photo.size / 1024 / 1024).toFixed(2)}MB.`)
          setSaving(false)
          return
        }
        setPhotoError(null)
        const formData = new FormData()
        formData.append('photo', progressJob._photo)
        formData.append('job_order_id', progressJob.id)
        formData.append('upload_date', todayStr())
        await fetch(`${API}/job-orders/upload-progress.php`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
      }

      // Refresh jobs list
      setJobs(prev => prev.map(j => j.id === progressJob.id ? { ...j, status: progressJob.status } : j))

      // Refresh photos for this job so progress updates immediately
      const photoRes = await fetch(`${API}/job-orders/get-progress.php?job_order_id=${progressJob.id}`, { headers: { Authorization: `Bearer ${token}` } })
      const photoData = await photoRes.json()
      if (photoData.success) {
        setJobPhotos(prev => ({ ...prev, [progressJob.id]: photoData.photos || [] }))
        setProgressPhotos(photoData.photos || [])
      }

      setProgressJob(null)
      setToast({ type: 'success', msg: 'Progress saved' })
    } catch (err) {
      setToast({ type: 'error', msg: 'Could not save progress: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  // Upload rules for the progress modal
  const today = todayStr()
  const pStart = progressJob?.start_date?.slice(0, 10)
  const pEnd   = progressJob?.end_date?.slice(0, 10)
  const withinRange = !!(pStart && pEnd && today >= pStart && today <= pEnd)
  const alreadyUploaded = progressJob?._photoDate === today && progressJob?._photo
  const blocked = !withinRange || alreadyUploaded

  const totalJobPages = Math.ceil(jobs.length / JOB_PER_PAGE)
  const pagedJobs = jobs.slice((jobPage - 1) * JOB_PER_PAGE, jobPage * JOB_PER_PAGE)

  const doneCount   = jobs.filter(j => isDone(j.status)).length
  const activeCount = jobs.filter(j => !isDone(j.status) && j.status !== 'Cancelled').length

  return (
    <div className="sc-page w-full space-y-6">
      <style>{styles}</style>

      {/* Header */}
      <div className="sc-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">Job orders</h1>
          <p className="text-sm text-slate-500 mt-1">Jobs assigned to you. Upload one photo a day to track progress.</p>
        </div>
      </div>

      {/* Summary */}
      {!loading && jobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat icon={ClipboardList} label="Total jobs"  value={jobs.length}  tone="bg-slate-100 text-slate-600"     delay={80} />
          <Stat icon={Hammer}        label="In the field" value={activeCount} tone="bg-amber-50 text-amber-600"      delay={160} />
          <Stat icon={CheckCircle2}  label="Completed"    value={doneCount}   tone="bg-emerald-50 text-emerald-600"  delay={240} />
        </div>
      )}

      {loading ? <JobsSkeleton /> : jobs.length === 0 ? (
        <div className="sc-fadein bg-white rounded-2xl border border-dashed border-slate-300 py-16 flex flex-col items-center text-center px-6">
          <div className="sc-float w-14 h-14 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center"><ClipboardList size={24} {...ICON} /></div>
          <p className="mt-4 text-sm font-semibold text-slate-900">No job orders assigned yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">When a job is assigned to you, it will appear here with its schedule and location.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedJobs.map((jo, i) => {
            const pct = progressPercent(jo.status, jo.start_date, jo.end_date, jobPhotos[jo.id] || [])
            return (
              <article key={`${jobPage}-${jo.id}`} style={{ animationDelay: `${300 + i * 120}ms`, '--rail': statusOf(jo.status)[2] }}
                className="sc-rise sc-card bg-white rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                {/* Title */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 ring-1 ring-emerald-100"><Briefcase size={20} {...ICON} /></span>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight truncate">{jo.contract_type || 'Construction Project'}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">{jo.job_order_code}</p>
                    </div>
                  </div>
                  <StatusBadge status={jo.status} />
                </div>

                {/* Info */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-3.5">
                  <InfoItem icon={MapPin}         label="Location"   value={jo.client_address || jo.location} />
                  <InfoItem icon={CalendarDays}   label="Start date" value={fmtDate(jo.start_date)} />
                  <InfoItem icon={CalendarCheck2} label="Completion" value={fmtDate(jo.end_date)} />
                </div>

                {/* Progress */}
                <div className="mt-4"><ProgressBar pct={pct} status={jo.status} /></div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button onClick={e => { e.stopPropagation(); openView(jo) }}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[.97] transition-all">
                    <Eye size={15} {...ICON} /> View
                  </button>
                  <button onClick={e => { e.stopPropagation(); openProgress(jo, pct) }}
                    className="group inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium shadow-[0_6px_14px_-6px_rgba(5,150,105,.7)] hover:shadow-[0_10px_20px_-6px_rgba(5,150,105,.8)] active:scale-[.97] transition-all">
                    <Camera size={15} {...ICON} className="group-hover:-rotate-12 transition-transform" /> Update progress
                  </button>
                </div>
              </article>
            )
          })}

          {/* Pagination */}
          {totalJobPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500">
                Showing {(jobPage - 1) * JOB_PER_PAGE + 1}–{Math.min(jobPage * JOB_PER_PAGE, jobs.length)} of {jobs.length} jobs
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setJobPage(p => Math.max(1, p - 1))} disabled={jobPage === 1} aria-label="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition">
                  <ChevronLeft size={15} {...ICON} />
                </button>
                {Array.from({ length: totalJobPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setJobPage(p)} aria-current={jobPage === p ? 'page' : undefined}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-[13px] font-medium tabular-nums transition-all active:scale-90
                      ${jobPage === p ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setJobPage(p => Math.min(totalJobPages, p + 1))} disabled={jobPage === totalJobPages} aria-label="Next page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition">
                  <ChevronRight size={15} {...ICON} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── View Job Order Modal ── */}
      {viewJob && (
        <Modal onBackdrop={() => setViewJob(null)}>
          <ModalHeader job={viewJob} onClose={() => setViewJob(null)} />
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-3">Project details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-4">
                <Field label="Customer"   value={viewJob.client_name} />
                <Field label="Location"   value={viewJob.client_address || viewJob.location} />
                <Field label="Start date" value={fmtDate(viewJob.start_date)} />
                <Field label="Completion" value={fmtDate(viewJob.end_date)} />
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 mb-3">Map</p>
              <div className="rounded-xl overflow-hidden border border-slate-200 h-[260px] flex flex-col">
                {mapLoading ? (
                  <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={18} {...ICON} className="animate-spin text-emerald-500" />
                    <p className="text-xs text-slate-500">Loading map…</p>
                  </div>
                ) : mapCoords ? (
                  <iframe
                    key={`map-${mapCoords.lat}-${mapCoords.lng}`}
                    title="job-location-map"
                    className="sc-fadein"
                    width="100%"
                    height="100%"
                    style={{ border: 'none', flex: 1 }}
                    srcDoc={`<!DOCTYPE html><html><head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body><div id="map"></div><script>
  var map = L.map('map', {
    center: [${mapCoords.lat}, ${mapCoords.lng}],
    zoom: 15,
    minZoom: 12,
    maxZoom: 18,
    maxBounds: [[14.35, 120.85],[14.78, 121.20]],
    maxBoundsViscosity: 1.0
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  L.marker([${mapCoords.lat}, ${mapCoords.lng}]).addTo(map)
    .bindPopup('<b>${esc(viewJob.client_name) || 'Job Location'}</b><br>${esc(viewJob.client_address || viewJob.location)}').openPopup();
</script></body></html>`}
                  />
                ) : (
                  <div className="flex-1 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                    <span className="w-11 h-11 rounded-full bg-white ring-1 ring-slate-200 text-slate-300 flex items-center justify-center"><MapPin size={20} {...ICON} /></span>
                    <p className="mt-3 text-sm font-medium text-slate-700">{viewJob.client_address || viewJob.location || 'No location set'}</p>
                    <p className="text-xs text-slate-400 mt-1">We couldn’t place this address on the map.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
            <button onClick={() => setViewJob(null)} className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 active:scale-[.97] transition-all">Close</button>
          </div>
        </Modal>
      )}

      {/* ── Update Progress Modal ── */}
      {progressJob && (
        <Modal>
          <ModalHeader job={progressJob} onClose={() => { setProgressJob(null); setPhotoError(null) }} />

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Current progress */}
            <ProgressBar pct={progressVal} status={progressJob.status} />

            {/* Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-4">
              <Field label="Customer"   value={progressJob.client_name} />
              <Field label="Location"   value={progressJob.client_address || progressJob.location} />
              <Field label="Start date" value={fmtDate(progressJob.start_date)} />
              <Field label="Completion" value={fmtDate(progressJob.end_date)} />
            </div>

            {/* Photo upload */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-sm font-semibold text-slate-900">Progress photo</p>
                <span className="text-[11px] text-slate-400">JPG or PNG, up to {MAX_SIZE_MB}MB</span>
              </div>

              {!withinRange && (
                <p className="sc-fadein mb-2.5 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
                  <Clock size={13} {...ICON} className="flex-shrink-0" />
                  Uploads are only allowed between {fmtDate(pStart)} and {fmtDate(pEnd)}.
                </p>
              )}

              <div
                onDragOver={e => { if (!blocked) { e.preventDefault(); setDragOver(true) } }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (blocked) return; pickPhoto(e.dataTransfer.files[0]) }}
                onClick={() => { if (!blocked) document.getElementById('progress-photo-input').click() }}
                className={`rounded-xl border-2 border-dashed p-7 text-center transition-all duration-200
                  ${dragOver ? 'sc-drop-on' : ''}
                  ${blocked ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                    : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer group'}`}>
                <input
                  id="progress-photo-input"
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png"
                  onChange={e => { if (!pickPhoto(e.target.files[0] || null)) e.target.value = '' }}
                />
                {progressJob._photo ? (
                  <div className="sc-modal inline-flex items-center gap-2.5 rounded-lg bg-white ring-1 ring-emerald-200 px-3 py-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileText size={16} {...ICON} /></span>
                    <div className="text-left min-w-0">
                      <p className="text-[13px] font-medium text-slate-800 truncate max-w-[220px]">{progressJob._photo.name}</p>
                      <p className="text-[11px] text-slate-400">{(progressJob._photo.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setProgressJob(prev => ({ ...prev, _photo: null })) }}
                      aria-label="Remove photo" className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X size={14} {...ICON} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="mx-auto w-11 h-11 rounded-full bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:-translate-y-1 flex items-center justify-center transition-all duration-300"><Upload size={20} {...ICON} /></span>
                    <p className="mt-3 text-sm text-slate-600">Drop a photo here or <span className="text-emerald-700 font-semibold">browse</span></p>
                    <p className="text-xs text-slate-400 mt-1">One photo per day counts toward progress</p>
                  </>
                )}
              </div>

              {photoError && (
                <p className="sc-fadein mt-2 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={13} {...ICON} /> {photoError}</p>
              )}
            </div>

            {/* Uploaded photos */}
            {progressPhotos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-semibold text-slate-900">Uploaded photos</p>
                  <span className="text-[11px] text-slate-400">{progressPhotos.length} total</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-0.5">
                  {progressPhotos.map((photo, i) => (
                    <button key={photo.id} type="button" style={{ animationDelay: `${i * 50}ms` }}
                      className="sc-rise relative group rounded-lg overflow-hidden border border-slate-200 text-left"
                      onClick={() => window.open(`${HOST}/${photo.file_path}`, '_blank')}>
                      <img src={`${HOST}/${photo.file_path}`} alt={`Progress ${photo.upload_date}`}
                        className="w-full h-24 object-cover group-hover:scale-110 transition-transform duration-500" />
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/40">
                        <Eye size={20} {...ICON} className="text-white" />
                      </span>
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/60 text-[10px] font-medium text-white">{fmtDate(photo.upload_date)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex gap-3 justify-end">
            <button onClick={() => { setProgressJob(null); setPhotoError(null) }} disabled={saving}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-[.97] transition-all">
              Close
            </button>
            <button onClick={saveProgress} disabled={saving}
              className="inline-flex items-center justify-center gap-2 h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-[13px] font-semibold shadow-[0_6px_14px_-6px_rgba(5,150,105,.7)] active:scale-[.97] transition-all">
              {saving && <RefreshCw size={14} {...ICON} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save progress'}
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" className={`sc-slide fixed bottom-5 right-5 z-[60] overflow-hidden flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_16px_40px_-10px_rgba(16,24,40,0.3)] bg-white
          ${toast.type === 'success' ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-700'}`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={18} {...ICON} className="text-emerald-600" />
            : <AlertCircle size={18} {...ICON} className="text-red-500" />}
          {toast.msg}
          <span className={`sc-toast-bar absolute left-0 bottom-0 h-0.5 w-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
        </div>
      )}
    </div>
  )
}