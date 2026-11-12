import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, HardHat, Contact, ArrowRight, ArrowUpRight, Users } from 'lucide-react'
import { apiGet } from '../../../utils/api'

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
  @keyframes sc-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-rise .4s cubic-bezier(.2,.7,.2,1) both; }
  @media (prefers-reduced-motion: reduce) { .sc-skel::after, .sc-rise { animation: none; } }
`

const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

// ── Count-up number ────────────────────────────────────────────
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null || isNaN(target)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setValue(target); return }
    const start = performance.now(), begin = from.current
    let raf
    const tick = now => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(begin + (target - begin) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = target
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

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// ── Avatar & status (same look as the admin pages) ─────────────
const AVATAR_TONES = [
  'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'bg-sky-50 text-sky-700 ring-sky-100',
  'bg-violet-50 text-violet-700 ring-violet-100',
  'bg-amber-50 text-amber-700 ring-amber-100',
  'bg-rose-50 text-rose-700 ring-rose-100',
]
function Avatar({ name }) {
  const ini = (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`w-9 h-9 text-xs rounded-full ring-1 flex items-center justify-center font-semibold flex-shrink-0 ${AVATAR_TONES[((name || '?').charCodeAt(0) || 0) % AVATAR_TONES.length]}`}>
      {ini}
    </div>
  )
}

const STATUS = {
  'Active':    ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Inactive':  ['bg-gray-50 text-gray-600 ring-gray-200',          'bg-gray-400'],
  'Suspended': ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'On Leave':  ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Pending':   ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
}
function StatusBadge({ status }) {
  const [cls, dot] = STATUS[status] || ['bg-gray-50 text-gray-600 ring-gray-200', 'bg-gray-400']
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-xs font-medium whitespace-nowrap ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{status || '—'}
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, tone, onClick, delay, loading }) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className="sc-rise group text-left bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}><Icon size={18} {...ICON} /></span>
          {label}
        </span>
        <ArrowUpRight size={16} {...ICON} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
      </div>
      {loading
        ? <Skel className="h-8 w-16 mt-4" />
        : <p className="mt-4 text-3xl leading-none font-semibold text-slate-900 tabular-nums tracking-tight"><Num value={value} /></p>}
    </button>
  )
}

// ── Recent list card ───────────────────────────────────────────
function RecentList({ title, subtitle, items, loading, nameKey, subKey, onViewAll, emptyText, delay }) {
  return (
    <section className="sc-rise bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col" style={{ animationDelay: `${delay}ms` }}>
      <header className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-slate-100">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button onClick={onViewAll} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap focus-visible:outline-none focus-visible:underline">
          View all <ArrowRight size={14} {...ICON} />
        </button>
      </header>

      {loading ? (
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <Skel className="w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-2"><Skel className="h-3 w-36" /><Skel className="h-2.5 w-24" /></div>
              <Skel className="h-5 w-14 rounded-md" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 py-12 flex flex-col items-center justify-center text-center px-6">
          <div className="w-11 h-11 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-slate-400 flex items-center justify-center"><Users size={20} {...ICON} /></div>
          <p className="mt-3 text-sm font-medium text-slate-700">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((u, i) => (
            <li key={u.id ?? i} className="sc-rise px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${delay + i * 30}ms` }}>
              <Avatar name={u[nameKey]} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{u[nameKey] || '—'}</p>
                <p className="text-xs text-slate-500 truncate">{u[subKey] ? `@${u[subKey]}` : u.email || '—'}</p>
              </div>
              <StatusBadge status={u.status ?? 'Active'} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Super Admin Home ───────────────────────────────────────────
export default function SAHome() {
  const navigate = useNavigate()
  const [stats,         setStats]         = useState({ admin_users: null, workers: null, contacts: null })
  const [recentAdmins,  setRecentAdmins]  = useState([])
  const [recentWorkers, setRecentWorkers] = useState([])
  const [loading,       setLoading]       = useState({ stats: true, admins: true, workers: true })

  useEffect(() => {
    apiGet('/api/users/stats.php').then(data => {
      if (data.success) setStats({
        admin_users: Number(data.admin_users) || 0,
        workers:     Number(data.workers) || 0,
        contacts:    Number(data.contacts) || 0,
      })
    }).catch(() => {}).finally(() => setLoading(l => ({ ...l, stats: false })))

    apiGet('/api/users/list.php').then(d => {
      setRecentAdmins((d.users || []).slice(0, 6))
    }).catch(() => {}).finally(() => setLoading(l => ({ ...l, admins: false })))

    apiGet('/api/workers/list.php').then(d => {
      setRecentWorkers((d.workers || []).slice(0, 6))
    }).catch(() => {}).finally(() => setLoading(l => ({ ...l, workers: false })))
  }, [])

  const cards = [
    { icon: ShieldCheck, label: 'Admin users', value: stats.admin_users, tone: 'bg-sky-50 text-sky-600',         to: '/superadmin/admin-users' },
    { icon: HardHat,     label: 'Workers',     value: stats.workers,     tone: 'bg-emerald-50 text-emerald-600', to: '/superadmin/workers' },
    { icon: Contact,     label: 'Contacts',    value: stats.contacts,    tone: 'bg-amber-50 text-amber-600',     to: null },
  ]

  return (
    <div className="sc-page max-w-7xl space-y-5">
      <style>{styles}</style>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight">{greeting()}, welcome back</h1>
        <p className="text-sm text-slate-500 mt-1">Super admin overview for Emerald Builders & Construction.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 60} loading={loading.stats}
            onClick={() => c.to && navigate(c.to)} />
        ))}
      </div>

      {/* Recent users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <RecentList
          title="Recent admin users"
          subtitle="People who manage SkillConnect"
          items={recentAdmins}
          loading={loading.admins}
          nameKey="name"
          subKey="username"
          emptyText="No admin users yet"
          onViewAll={() => navigate('/superadmin/admin-users')}
          delay={120}
        />
        <RecentList
          title="Recent worker users"
          subtitle="Workers with a SkillConnect login"
          items={recentWorkers}
          loading={loading.workers}
          nameKey="full_name"
          subKey="username"
          emptyText="No workers yet"
          onViewAll={() => navigate('/superadmin/workers')}
          delay={180}
        />
      </div>
    </div>
  )
}