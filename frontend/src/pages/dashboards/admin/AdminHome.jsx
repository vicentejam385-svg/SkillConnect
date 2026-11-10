import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Inbox, Briefcase, Contact, HardHat, CalendarClock, ShieldCheck,
  ArrowUpRight, Check, X, Loader2, RotateCw, Clock, ArrowRight,
} from 'lucide-react'
import { apiGet } from '../../../utils/api'

const REVIEW_URL =
  'https://saddlebrown-swan-877763.hostingersite.com/backend/api/schedules/reschedule-requests/review.php'

const ICON = { strokeWidth: 1.75 }

// ── Local styles (shimmer, entrance, ring) ─────────────────────
const styles = `
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #eef1f0; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  @keyframes sc-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-rise .45s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes sc-out { to { opacity: 0; transform: translateX(16px); height: 0; padding-top: 0; padding-bottom: 0; } }
  .sc-out { animation: sc-out .35s ease forwards; overflow: hidden; }
  .sc-bar  { transition: width .9s cubic-bezier(.2,.7,.2,1); }
  .sc-ring { transition: stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1); }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-out { animation: none; }
    .sc-bar, .sc-ring { transition: none; }
  }
`

// ── Admin-aware navigate ───────────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

// ── Count-up number ────────────────────────────────────────────
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setValue(target); from.current = target; return }
    const start = performance.now()
    const begin = from.current
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(begin + (target - begin) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function Num({ value }) {
  const n = useCountUp(value)
  return <>{value == null ? '—' : n.toLocaleString()}</>
}

// ── Helpers ────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtDateTime(str) {
  if (!str) return '—'
  const d = new Date(str.replace(' ', 'T'))
  if (isNaN(d)) return str
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]

function Avatar({ name, seed, size = 'w-8 h-8' }) {
  const tone = AVATAR_TONES[(Number(seed) || 0) % AVATAR_TONES.length]
  return (
    <div className={`${size} rounded-full ring-1 flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${tone}`}>
      {initials(name)}
    </div>
  )
}

// ── Status Badge ───────────────────────────────────────────────
const STATUS = {
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',   'bg-yellow-500'],
  'Active':       ['bg-emerald-50 text-emerald-700 ring-emerald-200','bg-emerald-500'],
  'Complete':     ['bg-blue-50 text-blue-700 ring-blue-200',         'bg-blue-500'],
  'Completed':    ['bg-blue-50 text-blue-700 ring-blue-200',         'bg-blue-500'],
  'On Hold':      ['bg-orange-50 text-orange-700 ring-orange-200',   'bg-orange-500'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',   'bg-violet-500'],
  'Scheduled':    ['bg-cyan-50 text-cyan-700 ring-cyan-200',         'bg-cyan-500'],
  'In Progress':  ['bg-amber-50 text-amber-700 ring-amber-200',      'bg-amber-500'],
  'Cancelled':    ['bg-red-50 text-red-700 ring-red-200',            'bg-red-500'],
  'New':          ['bg-sky-50 text-sky-700 ring-sky-200',            'bg-sky-500'],
  'Won':          ['bg-emerald-50 text-emerald-700 ring-emerald-200','bg-emerald-500'],
  'Lost':         ['bg-red-50 text-red-700 ring-red-200',            'bg-red-500'],
  'Inactive':     ['bg-gray-50 text-gray-600 ring-gray-200',         'bg-gray-400'],
  'On Leave':     ['bg-orange-50 text-orange-700 ring-orange-200',   'bg-orange-500'],
  'Blacklisted':  ['bg-red-50 text-red-700 ring-red-200',            'bg-red-500'],
}

function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status || '—'}
    </span>
  )
}

// ── Skeletons ──────────────────────────────────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

function StatSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-4 sm:p-5">
      <Skel className="w-9 h-9 rounded-lg" />
      <Skel className="h-7 w-16 mt-4" />
      <Skel className="h-3 w-24 mt-2" />
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="px-5 py-3.5 flex items-center gap-3">
      <Skel className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skel className="h-3 w-1/3" />
        <Skel className="h-2.5 w-1/2" />
      </div>
      <Skel className="h-5 w-20 rounded-md" />
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, tone, onClick, delay }) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className="sc-rise group text-left bg-white rounded-2xl border border-gray-200/70 p-4 sm:p-5 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon size={18} {...ICON} />
        </div>
        <ArrowUpRight size={16} {...ICON} className="text-gray-300 group-hover:text-emerald-600 transition-colors" />
      </div>
      <p className="mt-4 text-2xl sm:text-[28px] leading-none font-semibold text-gray-900 tabular-nums tracking-tight">
        <Num value={value} />
      </p>
      <p className="mt-1.5 text-sm text-gray-500">{label}</p>
    </button>
  )
}

// ── Completion ring ────────────────────────────────────────────
function Ring({ pct }) {
  const r = 34
  const c = 2 * Math.PI * r
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = setTimeout(() => setShown(pct), 60); return () => clearTimeout(t) }, [pct])
  return (
    <div className="relative w-[88px] h-[88px] flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#ecfdf5" strokeWidth="8" />
        <circle
          className="sc-ring" cx="40" cy="40" r={r} fill="none" stroke="#10b981" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold text-gray-900 tabular-nums"><Num value={pct} />%</span>
        <span className="text-[10px] text-gray-400 -mt-0.5">done</span>
      </div>
    </div>
  )
}

// ── License health bar ─────────────────────────────────────────
function LicenseBar({ valid, expiring, expired }) {
  const total = (valid || 0) + (expiring || 0) + (expired || 0)
  const pct = n => (total ? (n / total) * 100 : 0)
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t) }, [])
  const rows = [
    { label: 'Valid',          value: valid,    dot: 'bg-emerald-500', text: 'text-gray-900' },
    { label: 'Expiring in 60 days', value: expiring, dot: 'bg-amber-400',   text: 'text-amber-700' },
    { label: 'Expired',        value: expired,  dot: 'bg-red-500',     text: 'text-red-600' },
  ]
  return (
    <div>
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100 gap-0.5">
        <div className="sc-bar bg-emerald-500" style={{ width: ready ? `${pct(valid)}%` : 0 }} />
        <div className="sc-bar bg-amber-400"   style={{ width: ready ? `${pct(expiring)}%` : 0 }} />
        <div className="sc-bar bg-red-500"     style={{ width: ready ? `${pct(expired)}%` : 0 }} />
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-500">
              <span className={`w-2 h-2 rounded-full ${r.dot}`} />{r.label}
            </span>
            <span className={`font-semibold tabular-nums ${r.text}`}><Num value={r.value} /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Admin Home ─────────────────────────────────────────────────
export default function AdminHome() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({
    inquiries: null, jobOrders: null, contacts: null, workers: null, schedules: null,
    licensesValid: null, licensesExpiring: null, licensesExpired: null, pendingReschedules: null,
  })
  const [rescheduleRequests, setRescheduleRequests] = useState([])
  const [reviewSaving, setReviewSaving] = useState(null)   // { id, action }
  const [leaving, setLeaving] = useState([])               // ids animating out
  const [recentJobOrders, setRecentJobOrders] = useState([])
  const [joStats, setJoStats] = useState({ total: 0, completed: 0, inProgress: 0 })
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const [inqData, joData, contactsData, schedData] = await Promise.all([
        apiGet('/api/inquiries/list.php',  { per_page: 1 }),
        apiGet('/api/job-orders/list.php', { per_page: 50 }),
        apiGet('/api/contacts/list.php',   { per_page: 1 }),
        apiGet('/api/schedules/list.php',  { per_page: 1 }),
      ])

      setCounts(p => ({
        ...p,
        inquiries: inqData.pagination?.total ?? 0,
        jobOrders: joData.pagination?.total ?? 0,
        contacts:  contactsData.pagination?.total ?? 0,
        schedules: schedData.pagination?.total ?? 0,
      }))

      const allJO = joData.job_orders || []
      setRecentJobOrders(allJO.slice(0, 5))
      const completed  = allJO.filter(jo => jo.status === 'Complete' || jo.status === 'Completed').length
      const inProgress = allJO.filter(jo => jo.status === 'In Progress' || jo.status === 'Active').length
      setJoStats({ total: allJO.length, completed, inProgress })

      const [workersData, licData, rrData] = await Promise.all([
        apiGet('/api/contacts/list.php', { per_page: 1, type: 'worker' }),
        apiGet('/api/licenses/list.php', { per_page: 100 }),
        apiGet('/api/schedules/reschedule-requests/list.php', { status: 'pending' }),
      ])

      const allLic = licData.licenses || []
      const now = new Date()
      const soon = 60 * 24 * 60 * 60 * 1000
      const exp = l => new Date(l.expiry_date)
      setCounts(p => ({
        ...p,
        workers: workersData.pagination?.total ?? 0,
        licensesExpired:  allLic.filter(l => l.expiry_date && exp(l) < now).length,
        licensesExpiring: allLic.filter(l => l.expiry_date && exp(l) >= now && exp(l) - now < soon).length,
        licensesValid:    allLic.filter(l => l.expiry_date && exp(l) >= now && exp(l) - now >= soon).length,
      }))

      const pending = rrData.requests || []
      setRescheduleRequests(pending)
      setCounts(p => ({ ...p, pendingReschedules: pending.length }))
      setUpdatedAt(new Date())
    } catch (e) {
      console.warn('Dashboard load error:', e)
    }
    setInitialLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const reviewRequest = async (req, action) => {
    setReviewSaving({ id: req.id, action })
    try {
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res = await fetch(REVIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request_id: req.id, action }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setLeaving(l => [...l, req.id])
      setTimeout(() => {
        setRescheduleRequests(prev => prev.filter(r => r.id !== req.id))
        setLeaving(l => l.filter(id => id !== req.id))
        setCounts(p => ({ ...p, pendingReschedules: Math.max(0, (p.pendingReschedules || 1) - 1) }))
      }, 350)
    } catch (e) {
      alert(`Could not ${action} request: ${e.message}`)
    }
    setReviewSaving(null)
  }

  const completionPct = joStats.total ? Math.round((joStats.completed / joStats.total) * 100) : 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const stats = [
    { icon: Inbox,     label: 'Inquiries',  value: counts.inquiries, tone: 'bg-emerald-50 text-emerald-600', to: '/admin/inquiries' },
    { icon: Briefcase, label: 'Job orders', value: counts.jobOrders, tone: 'bg-sky-50 text-sky-600',         to: '/admin/job-orders' },
    { icon: Contact,   label: 'Contacts',   value: counts.contacts,  tone: 'bg-amber-50 text-amber-600',     to: '/admin/contacts' },
    { icon: HardHat,   label: 'Workers',    value: counts.workers,   tone: 'bg-violet-50 text-violet-600',   to: '/admin/workers' },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <style>{styles}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{today}</p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-gray-900 tracking-tight mt-0.5">
            {greeting()}, welcome back
          </h1>
          <p className="text-sm text-gray-500 mt-1">Emerald Builders & Construction · SkillConnect</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={refreshing}
          className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
        >
          <RotateCw size={14} {...ICON} className={refreshing ? 'animate-spin' : ''} />
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
            : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {initialLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s, i) => (
              <StatCard key={s.label} {...s} delay={i * 60} onClick={() => navigate(s.to)} />
            ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6 items-start">
        {/* Recent job orders */}
        <section className="xl:col-span-3 bg-white rounded-2xl border border-gray-200/70 overflow-hidden min-w-0">
          <header className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Recent job orders</h2>
              <p className="text-xs text-gray-500 mt-0.5">The latest five projects</p>
            </div>
            <button
              onClick={() => navigate('/admin/job-orders')}
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:underline"
            >
              View all <ArrowRight size={14} {...ICON} />
            </button>
          </header>

          {initialLoading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
            </div>
          ) : recentJobOrders.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-center px-6">
              <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                <Briefcase size={20} {...ICON} />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-700">No job orders yet</p>
              <p className="text-xs text-gray-500 mt-1">Create one from an approved inquiry to see it here.</p>
            </div>
          ) : (
            <>
              {/* Mobile list */}
              <ul className="sm:hidden divide-y divide-gray-100">
                {recentJobOrders.map((jo, i) => (
                  <li key={jo.id} className="sc-rise px-4 py-3.5 flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                    <Avatar name={jo.worker_name} seed={jo.id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{jo.worker_name || 'Unassigned'}</p>
                        <StatusBadge status={jo.status} />
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        <span className="font-medium text-emerald-700">{jo.job_order_code}</span>
                        {' · '}{jo.client_name || '—'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 bg-gray-50/60">
                      {['Code', 'Worker', 'Client', 'Contract', 'Status'].map(h => (
                        <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentJobOrders.map((jo, i) => (
                      <tr key={jo.id} className="sc-rise hover:bg-gray-50/70 transition-colors" style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="px-5 py-3 font-medium text-emerald-700 tabular-nums whitespace-nowrap">{jo.job_order_code}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={jo.worker_name} seed={jo.id} size="w-7 h-7" />
                            <span className="text-gray-900 font-medium whitespace-nowrap">{jo.worker_name || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{jo.client_name || '—'}</td>
                        <td className="px-5 py-3 text-gray-500">{jo.contract_type || '—'}</td>
                        <td className="px-5 py-3"><StatusBadge status={jo.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Right column */}
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6 items-start">
          {/* Project progress */}
          <section className="bg-white rounded-2xl border border-gray-200/70 p-5">
            <h2 className="font-semibold text-gray-900">Project progress</h2>
            <p className="text-xs text-gray-500 mt-0.5">Across your latest 50 job orders</p>

            {initialLoading ? (
              <div className="mt-4 flex items-center gap-5">
                <Skel className="w-[88px] h-[88px] rounded-full" />
                <div className="flex-1 space-y-3">
                  <Skel className="h-3 w-full" /><Skel className="h-3 w-4/5" /><Skel className="h-3 w-3/5" />
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-5">
                <Ring pct={completionPct} />
                <dl className="flex-1 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-500">Total</dt><dd className="font-semibold text-gray-900 tabular-nums"><Num value={joStats.total} /></dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Completed</dt><dd className="font-semibold text-emerald-700 tabular-nums"><Num value={joStats.completed} /></dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">In progress</dt><dd className="font-semibold text-amber-600 tabular-nums"><Num value={joStats.inProgress} /></dd></div>
                </dl>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-500">
                <CalendarClock size={16} {...ICON} className="text-cyan-600" /> Active schedules
              </span>
              {initialLoading ? <Skel className="h-4 w-8" /> : (
                <span className="font-semibold text-gray-900 tabular-nums"><Num value={counts.schedules} /></span>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={16} {...ICON} className="text-emerald-600" />
                <span className="text-sm font-medium text-gray-700">License health</span>
              </div>
              {initialLoading ? (
                <div className="space-y-3"><Skel className="h-2 w-full rounded-full" /><Skel className="h-3 w-2/3" /><Skel className="h-3 w-1/2" /></div>
              ) : (
                <LicenseBar valid={counts.licensesValid} expiring={counts.licensesExpiring} expired={counts.licensesExpired} />
              )}
            </div>
          </section>

          {/* Reschedule requests */}
          <section className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden">
            <header className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Reschedule requests</h2>
                <p className="text-xs text-gray-500 mt-0.5">Workers asking to move a shift</p>
              </div>
              {rescheduleRequests.length > 0 && (
                <span className="relative inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold ring-1 ring-inset ring-amber-200">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping motion-reduce:hidden" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </span>
                  {rescheduleRequests.length} pending
                </span>
              )}
            </header>

            {initialLoading ? (
              <div className="divide-y divide-gray-100">{[0, 1].map(i => <RowSkeleton key={i} />)}</div>
            ) : rescheduleRequests.length === 0 ? (
              <div className="py-10 flex flex-col items-center text-center px-6">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Check size={20} {...ICON} />
                </div>
                <p className="mt-3 text-sm font-medium text-gray-700">All caught up</p>
                <p className="text-xs text-gray-500 mt-1">New requests from workers will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto custom-scroll">
                {rescheduleRequests.map(req => {
                  const saving = reviewSaving?.id === req.id
                  return (
                    <li key={req.id} className={`px-5 py-4 ${leaving.includes(req.id) ? 'sc-out' : ''}`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={req.worker_name} seed={req.id} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{req.worker_name}</p>
                          <p className="text-xs text-gray-500">{req.schedule_code}</p>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-2">“{req.reason}”</p>
                      )}

                      <div className="mt-3 rounded-lg bg-gray-50 p-3 space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <Clock size={14} {...ICON} className="text-gray-400 mt-px flex-shrink-0" />
                          <div>
                            <p className="text-gray-500">Current</p>
                            <p className="text-gray-500 line-through decoration-gray-300">
                              {fmtDateTime(req.current_start_time)} – {fmtDateTime(req.current_end_time)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CalendarClock size={14} {...ICON} className="text-amber-500 mt-px flex-shrink-0" />
                          <div>
                            <p className="text-amber-700">Requested</p>
                            <p className="text-gray-900 font-medium">
                              {fmtDateTime(req.new_start_time)} – {fmtDateTime(req.new_end_time)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={saving}
                          onClick={() => reviewRequest(req, 'approve')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          {saving && reviewSaving.action === 'approve'
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Check size={14} {...ICON} />}
                          Approve
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => reviewRequest(req, 'reject')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-sm font-medium bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          {saving && reviewSaving.action === 'reject'
                            ? <Loader2 size={14} className="animate-spin" />
                            : <X size={14} {...ICON} />}
                          Reject
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}