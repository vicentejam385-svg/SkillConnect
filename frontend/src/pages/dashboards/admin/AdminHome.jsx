import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  Inbox, Briefcase, Contact, HardHat, CalendarClock, ShieldCheck,
  ArrowUpRight, ArrowRight, Check, X, Loader2, Clock,
  TrendingUp, TrendingDown, Minus, PieChart, AlertTriangle,
} from 'lucide-react'
import { apiGet } from '../../../utils/api'

const REVIEW_URL =
  'https://saddlebrown-swan-877763.hostingersite.com/backend/api/schedules/reschedule-requests/review.php'

const ICON = { strokeWidth: 1.75 }
const MONTHS = 6
const COLORS = { inquiries: '#0ea5e9', jobOrders: '#10b981' }

// ── Local styles ───────────────────────────────────────────────
const styles = `
  @keyframes sc-shimmer { 100% { transform: translateX(100%); } }
  .sc-skel { position: relative; overflow: hidden; background: #eef2f5; border-radius: 6px; }
  .sc-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.8), transparent);
    animation: sc-shimmer 1.4s infinite;
  }
  @keyframes sc-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .sc-rise { animation: sc-rise .45s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes sc-wipe { to { transform: scaleX(0); } }
  .sc-wipe { transform-box: fill-box; transform-origin: right; animation: sc-wipe 1s cubic-bezier(.4,0,.2,1) .1s forwards; }
  @keyframes sc-out { to { opacity: 0; transform: translateX(16px); } }
  .sc-out { animation: sc-out .3s ease forwards; }
  .sc-bar   { transition: width .9s cubic-bezier(.2,.7,.2,1); }
  .sc-donut { transition: stroke-dasharray 1s cubic-bezier(.2,.7,.2,1), stroke-width .15s ease; }
  @media (prefers-reduced-motion: reduce) {
    .sc-skel::after, .sc-rise, .sc-out { animation: none; }
    .sc-wipe { animation: none; display: none; }
    .sc-bar, .sc-donut { transition: none; }
  }
`

// ── Hooks & helpers ────────────────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (target == null) return
    if (prefersReduced()) { setValue(target); from.current = target; return }
    const start = performance.now()
    const begin = from.current
    let raf
    const tick = now => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(begin + (target - begin) * (1 - Math.pow(1 - t, 3))))
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

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

function useMounted(delay = 60) {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), delay); return () => clearTimeout(t) }, [delay])
  return ready
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function parseDate(str) {
  if (!str) return null
  const d = new Date(String(str).replace(' ', 'T'))
  return isNaN(d) ? null : d
}

function fmtDateTime(str) {
  const d = parseDate(str)
  if (!d) return str || '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Groups records into the last N months using their created date
const recordDate = r => parseDate(r.created_at || r.date_created || r.inquiry_date || r.start_date)

function monthlyBuckets(items, months = MONTHS) {
  const now = new Date()
  const buckets = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: 'short' }), count: 0 })
  }
  items.forEach(it => {
    const d = recordDate(it)
    if (!d) return
    const b = buckets.find(b => b.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (b) b.count++
  })
  return buckets
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

// ── Status ─────────────────────────────────────────────────────
const STATUS = {
  'Pending':      ['bg-yellow-50 text-yellow-800 ring-yellow-200',    'bg-yellow-500'],
  'Active':       ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Complete':     ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'Completed':    ['bg-blue-50 text-blue-700 ring-blue-200',          'bg-blue-500'],
  'On Hold':      ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Under Review': ['bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  'Scheduled':    ['bg-cyan-50 text-cyan-700 ring-cyan-200',          'bg-cyan-500'],
  'In Progress':  ['bg-amber-50 text-amber-700 ring-amber-200',       'bg-amber-500'],
  'Cancelled':    ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'New':          ['bg-sky-50 text-sky-700 ring-sky-200',             'bg-sky-500'],
  'Won':          ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  'Lost':         ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
  'Inactive':     ['bg-gray-50 text-gray-600 ring-gray-200',          'bg-gray-400'],
  'On Leave':     ['bg-orange-50 text-orange-700 ring-orange-200',    'bg-orange-500'],
  'Blacklisted':  ['bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
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

const STATUS_GROUPS = [
  { label: 'Completed',   match: ['Complete', 'Completed'],          color: '#10b981' },
  { label: 'In progress', match: ['In Progress', 'Active'],          color: '#f59e0b' },
  { label: 'Scheduled',   match: ['Scheduled'],                      color: '#06b6d4' },
  { label: 'Pending',     match: ['Pending', 'New', 'Under Review'], color: '#8b5cf6' },
  { label: 'On hold',     match: ['On Hold'],                        color: '#fb923c' },
  { label: 'Cancelled',   match: ['Cancelled'],                      color: '#ef4444' },
]

function groupStatuses(jobOrders) {
  const known = STATUS_GROUPS.flatMap(g => g.match)
  const groups = STATUS_GROUPS.map(g => ({
    label: g.label, color: g.color,
    value: jobOrders.filter(jo => g.match.includes(jo.status)).length,
  }))
  const other = jobOrders.filter(jo => !known.includes(jo.status)).length
  if (other) groups.push({ label: 'Other', color: '#94a3b8', value: other })
  return groups.filter(g => g.value > 0)
}

// ── Building blocks ────────────────────────────────────────────
const Skel = ({ className = '' }) => <div className={`sc-skel ${className}`} />

function Card({ title, subtitle, action, children, className = '', bodyClass = 'px-5 pb-5' }) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col min-w-0 ${className}`}>
      <header className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className={`flex-1 flex flex-col min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  )
}

function LinkButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap focus-visible:outline-none focus-visible:underline"
    >
      {children} <ArrowRight size={14} {...ICON} />
    </button>
  )
}

function Legend({ items }) {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  )
}

// ── Sparkline ──────────────────────────────────────────────────
function Sparkline({ values, color }) {
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - (v / max) * 26])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  const id = `spark-${color.replace('#', '')}`
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-9" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100,32 L0,32 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function Trend({ values }) {
  const cur = values[values.length - 1] ?? 0
  const prev = values[values.length - 2] ?? 0
  const up = cur > prev, down = cur < prev
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus
  const tone = up ? 'text-emerald-700 bg-emerald-50' : down ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${tone}`}>
      <Icon size={12} {...ICON} />{cur} this month
    </span>
  )
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, tone, onClick, delay, footer }) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className="sc-rise group text-left bg-white rounded-xl border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 sm:p-5 flex flex-col hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
            <Icon size={16} {...ICON} />
          </span>
          {label}
        </span>
        <ArrowUpRight size={16} {...ICON} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
      </div>
      <p className="mt-3 text-[26px] sm:text-3xl leading-none font-semibold text-slate-900 tabular-nums tracking-tight">
        <Num value={value} />
      </p>
      <div className="mt-3 flex-1 flex flex-col justify-end">{footer}</div>
    </button>
  )
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center gap-2.5"><Skel className="w-8 h-8 rounded-lg" /><Skel className="h-3 w-20" /></div>
      <Skel className="h-7 w-20 mt-4" />
      <Skel className="h-8 w-full mt-3" />
    </div>
  )
}

// ── Area chart ─────────────────────────────────────────────────
function AreaChart({ labels, series, height = 260 }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const pad = { t: 16, r: 12, b: 28, l: 34 }
  const iw = Math.max(0, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const n = labels.length
  const rawMax = Math.max(1, ...series.flatMap(s => s.values))
  const max = Math.ceil(rawMax / 4) * 4
  const x = i => pad.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1))
  const y = v => pad.t + ih - (v / max) * ih

  const line = vals => vals.map((v, i) => {
    if (i === 0) return `M${x(0)},${y(v)}`
    const cx = (x(i - 1) + x(i)) / 2
    return `C${cx},${y(vals[i - 1])} ${cx},${y(v)} ${x(i)},${y(v)}`
  }).join(' ')

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const idx = Math.round(((e.clientX - rect.left - pad.l) / iw) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, idx)))
  }

  const shift = hover === 0 ? '0%' : hover === n - 1 ? '-100%' : '-50%'

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.name} id={`sc-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity=".2" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {[0, 1, 2, 3, 4].map(k => {
            const v = (max / 4) * k
            return (
              <g key={k}>
                <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray={k ? '3 4' : undefined} />
                <text x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text>
              </g>
            )
          })}
          {labels.map((l, i) => (
            <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill={hover === i ? '#334155' : '#94a3b8'}>{l}</text>
          ))}

          {series.map((s, i) => (
            <g key={s.name}>
              <path d={`${line(s.values)} L${x(n - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`} fill={`url(#sc-area-${i})`} />
              <path d={line(s.values)} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinecap="round" />
            </g>
          ))}

          {/* reveal animation */}
          <rect className="sc-wipe" x={pad.l - 2} y={0} width={iw + pad.r + 2} height={pad.t + ih + 1} fill="#fff" pointerEvents="none" />

          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#cbd5e1" />
              {series.map(s => (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      )}

      {hover != null && (
        <div
          className="absolute pointer-events-none bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ left: x(hover), top: 0, transform: `translateX(${shift})` }}
        >
          <p className="font-semibold mb-1">{labels[hover]}</p>
          {series.map(s => (
            <p key={s.name} className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
              <span className="text-slate-300">{s.name}</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums">{s.values[hover]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Donut chart ────────────────────────────────────────────────
function Donut({ data, size = 168, thickness = 20, centerLabel }) {
  const ready = useMounted()
  const [active, setActive] = useState(null)
  const r = (size - thickness - 6) / 2
  const c = 2 * Math.PI * r
  const total = data.reduce((a, d) => a + d.value, 0)
  const gap = data.length > 1 ? 2 : 0
  let acc = 0
  const focus = active != null ? data[active] : null

  return (
    <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {data.map((d, i) => {
            const len = (d.value / total) * c
            const seg = Math.max(len - gap, 0.01)
            const offset = -acc
            acc += len
            return (
              <circle
                key={d.label}
                className="sc-donut cursor-pointer"
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={d.color}
                strokeWidth={active === i ? thickness + 6 : thickness}
                strokeDasharray={`${ready ? seg : 0} ${c}`}
                strokeDashoffset={offset}
                opacity={active == null || active === i ? 1 : 0.35}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-semibold text-slate-900 tabular-nums">
            {focus ? `${Math.round((focus.value / total) * 100)}%` : <Num value={centerLabel.value} />}
          </span>
          <span className="text-xs text-slate-500">{focus ? focus.label : centerLabel.text}</span>
        </div>
      </div>

      <ul className="w-full space-y-1">
        {data.map((d, i) => (
          <li
            key={d.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded-md text-sm cursor-default transition-colors ${active === i ? 'bg-slate-50' : ''}`}
          >
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />{d.label}
            </span>
            <span className="tabular-nums">
              <span className="font-semibold text-slate-900">{d.value}</span>
              <span className="text-slate-400 ml-2 text-xs">{Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── License health ─────────────────────────────────────────────
function LicenseHealth({ valid, expiring, expired }) {
  const ready = useMounted(80)
  const total = (valid || 0) + (expiring || 0) + (expired || 0)
  const pct = v => (total ? (v / total) * 100 : 0)
  const segments = [
    { label: 'Valid',             value: valid,    color: 'bg-emerald-500', text: 'text-slate-900' },
    { label: 'Expiring in 60 days', value: expiring, color: 'bg-amber-400',   text: 'text-amber-700' },
    { label: 'Expired',           value: expired,  color: 'bg-red-500',     text: 'text-red-600' },
  ]
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-slate-900 tabular-nums">{Math.round(pct(valid))}%</span>
        <span className="text-sm text-slate-500">of {total} licenses are valid</span>
      </div>
      <div className="mt-4 flex h-3 w-full rounded-full overflow-hidden bg-slate-100 gap-0.5">
        {segments.map(s => (
          <div key={s.label} className={`sc-bar ${s.color}`} style={{ width: ready ? `${pct(s.value)}%` : 0 }} />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {segments.map(s => (
          <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="truncate">{s.label}</span>
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${s.text}`}><Num value={s.value} /></p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="px-5 py-3.5 flex items-center gap-3">
      <Skel className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-2"><Skel className="h-3 w-1/3" /><Skel className="h-2.5 w-1/2" /></div>
      <Skel className="h-5 w-20 rounded-md" />
    </div>
  )
}

function EmptyState({ icon: Icon, title, text, tone = 'bg-slate-50 text-slate-400' }) {
  return (
    <div className="flex-1 py-10 flex flex-col items-center justify-center text-center px-6">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}><Icon size={20} {...ICON} /></div>
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-[240px]">{text}</p>
    </div>
  )
}

// ── Admin Home ─────────────────────────────────────────────────
export default function AdminHome() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({
    inquiries: null, jobOrders: null, contacts: null, workers: null, schedules: null,
    licensesValid: null, licensesExpiring: null, licensesExpired: null,
  })
  const [allJobOrders, setAllJobOrders] = useState([])
  const [monthly, setMonthly] = useState({ labels: [], inquiries: [], jobOrders: [] })
  const [rescheduleRequests, setRescheduleRequests] = useState([])
  const [reviewSaving, setReviewSaving] = useState(null) // { id, action }
  const [leaving, setLeaving] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [inqData, joData, contactsData, schedData, workersData, licData, rrData] = await Promise.all([
        apiGet('/api/inquiries/list.php',  { per_page: 100 }),
        apiGet('/api/job-orders/list.php', { per_page: 50 }),
        apiGet('/api/contacts/list.php',   { per_page: 1 }),
        apiGet('/api/schedules/list.php',  { per_page: 1 }),
        apiGet('/api/contacts/list.php',   { per_page: 1, type: 'worker' }),
        apiGet('/api/licenses/list.php',   { per_page: 100 }),
        apiGet('/api/schedules/reschedule-requests/list.php', { status: 'pending' }),
      ])

      const allJO = joData.job_orders || []
      const inq = monthlyBuckets(inqData.inquiries || [])
      const jo = monthlyBuckets(allJO)
      setAllJobOrders(allJO)
      setMonthly({ labels: inq.map(b => b.label), inquiries: inq.map(b => b.count), jobOrders: jo.map(b => b.count) })

      const allLic = licData.licenses || []
      const now = new Date()
      const soon = 60 * 24 * 60 * 60 * 1000
      const exp = l => new Date(l.expiry_date)

      setCounts({
        inquiries: inqData.pagination?.total ?? 0,
        jobOrders: joData.pagination?.total ?? 0,
        contacts:  contactsData.pagination?.total ?? 0,
        schedules: schedData.pagination?.total ?? 0,
        workers:   workersData.pagination?.total ?? 0,
        licensesExpired:  allLic.filter(l => l.expiry_date && exp(l) < now).length,
        licensesExpiring: allLic.filter(l => l.expiry_date && exp(l) >= now && exp(l) - now < soon).length,
        licensesValid:    allLic.filter(l => l.expiry_date && exp(l) >= now && exp(l) - now >= soon).length,
      })
      setRescheduleRequests(rrData.requests || [])
    } catch (e) {
      console.warn('Dashboard load error:', e)
    }
    setLoading(false)
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
      }, 300)
    } catch (e) {
      alert(`Could not ${action} request: ${e.message}`)
    }
    setReviewSaving(null)
  }

  const recentJobOrders = allJobOrders.slice(0, 6)
  const statusData = groupStatuses(allJobOrders)
  const workerShare = counts.contacts ? Math.round(((counts.workers || 0) / counts.contacts) * 100) : 0
  const hasActivity = monthly.inquiries.some(Boolean) || monthly.jobOrders.some(Boolean)
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const stats = [
    {
      icon: Inbox, label: 'Inquiries', value: counts.inquiries, tone: 'bg-sky-50 text-sky-600', to: '/admin/inquiries',
      footer: <div><Sparkline values={monthly.inquiries} color={COLORS.inquiries} /><div className="mt-1"><Trend values={monthly.inquiries} /></div></div>,
    },
    {
      icon: Briefcase, label: 'Job orders', value: counts.jobOrders, tone: 'bg-emerald-50 text-emerald-600', to: '/admin/job-orders',
      footer: <div><Sparkline values={monthly.jobOrders} color={COLORS.jobOrders} /><div className="mt-1"><Trend values={monthly.jobOrders} /></div></div>,
    },
    {
      icon: Contact, label: 'Contacts', value: counts.contacts, tone: 'bg-amber-50 text-amber-600', to: '/admin/contacts',
      footer: (
        <div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="sc-bar h-full bg-amber-400 rounded-full" style={{ width: `${workerShare}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">{workerShare}% are workers</p>
        </div>
      ),
    },
    {
      icon: HardHat, label: 'Workers', value: counts.workers, tone: 'bg-violet-50 text-violet-600', to: '/admin/workers',
      footer: counts.licensesExpiring || counts.licensesExpired ? (
        <span className="inline-flex items-center gap-1.5 self-start px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
          <AlertTriangle size={12} {...ICON} />
          {(counts.licensesExpiring || 0) + (counts.licensesExpired || 0)} licenses need attention
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 self-start px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
          <ShieldCheck size={12} {...ICON} /> All licenses valid
        </span>
      ),
    },
  ]

  return (
    <div className="max-w-7xl space-y-5">
      <style>{styles}</style>

      {/* Header */}
      <div className="pb-1">
        <p className="text-sm text-slate-500">{today}</p>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight mt-0.5">{greeting()}, welcome back</h1>
        <p className="text-sm text-slate-500 mt-1">Here’s how Emerald Builders & Construction is doing.</p>
      </div>

      {/* Row 1 — KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s, i) => <StatCard key={s.label} {...s} delay={i * 60} onClick={() => navigate(s.to)} />)}
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <Card
          className="xl:col-span-2"
          title="Activity"
          subtitle={`Inquiries and job orders over the last ${MONTHS} months`}
          action={<div className="hidden sm:block"><Legend items={[{ label: 'Inquiries', color: COLORS.inquiries }, { label: 'Job orders', color: COLORS.jobOrders }]} /></div>}
        >
          {loading ? (
            <Skel className="h-[260px] w-full rounded-lg" />
          ) : hasActivity ? (
            <AreaChart
              labels={monthly.labels}
              series={[
                { name: 'Inquiries',  color: COLORS.inquiries, values: monthly.inquiries },
                { name: 'Job orders', color: COLORS.jobOrders, values: monthly.jobOrders },
              ]}
            />
          ) : (
            <EmptyState icon={TrendingUp} title="No activity yet" text="New inquiries and job orders will be charted here by month." />
          )}
        </Card>

        <Card title="Job order status" subtitle="Your latest 50 job orders">
          {loading ? (
            <div className="flex flex-col items-center gap-5">
              <Skel className="w-[168px] h-[168px] rounded-full" />
              <div className="w-full space-y-2.5"><Skel className="h-3 w-full" /><Skel className="h-3 w-4/5" /><Skel className="h-3 w-3/5" /></div>
            </div>
          ) : statusData.length ? (
            <Donut data={statusData} centerLabel={{ value: allJobOrders.length, text: 'job orders' }} />
          ) : (
            <EmptyState icon={PieChart} title="No job orders yet" text="Status breakdown appears once job orders are created." />
          )}
        </Card>
      </div>

      {/* Row 3 — Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <Card
          className="xl:col-span-2"
          title="Recent job orders"
          subtitle="The six most recent projects"
          action={<LinkButton onClick={() => navigate('/admin/job-orders')}>View all</LinkButton>}
          bodyClass=""
        >
          {loading ? (
            <div className="divide-y divide-slate-100 border-t border-slate-100">{Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}</div>
          ) : recentJobOrders.length === 0 ? (
            <EmptyState icon={Briefcase} title="No job orders yet" text="Create one from an approved inquiry to see it here." />
          ) : (
            <>
              <ul className="sm:hidden divide-y divide-slate-100 border-t border-slate-100">
                {recentJobOrders.map((jo, i) => (
                  <li key={jo.id} className="sc-rise px-4 py-3.5 flex items-center gap-3" style={{ animationDelay: `${i * 40}ms` }}>
                    <Avatar name={jo.worker_name} seed={jo.id} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{jo.worker_name || 'Unassigned'}</p>
                        <StatusBadge status={jo.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        <span className="font-medium text-emerald-700">{jo.job_order_code}</span> · {jo.client_name || '—'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 bg-slate-50 border-y border-slate-100">
                      {['Code', 'Worker', 'Client', 'Contract', 'Status'].map(h => (
                        <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentJobOrders.map((jo, i) => (
                      <tr key={jo.id} className="sc-rise hover:bg-slate-50/70 transition-colors" style={{ animationDelay: `${i * 40}ms` }}>
                        <td className="px-5 py-3 font-medium text-emerald-700 tabular-nums whitespace-nowrap">{jo.job_order_code}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={jo.worker_name} seed={jo.id} size="w-7 h-7" />
                            <span className="text-slate-900 font-medium whitespace-nowrap">{jo.worker_name || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{jo.client_name || '—'}</td>
                        <td className="px-5 py-3 text-slate-500">{jo.contract_type || '—'}</td>
                        <td className="px-5 py-3"><StatusBadge status={jo.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Matches the height of the job orders card on desktop; the list scrolls inside */}
        <div className="relative xl:min-h-[400px]">
          <Card
            className="xl:absolute xl:inset-0"
            title="Reschedule requests"
            subtitle="Workers asking to move a shift"
            bodyClass="min-h-0"
            action={rescheduleRequests.length > 0 && (
              <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md bg-amber-50 text-amber-700 text-xs font-semibold ring-1 ring-inset ring-amber-200 whitespace-nowrap">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-amber-400 opacity-75 animate-ping motion-reduce:hidden" />
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-amber-500" />
                </span>
                {rescheduleRequests.length} pending
              </span>
            )}
          >
            {loading ? (
              <div className="divide-y divide-slate-100 border-t border-slate-100">{[0, 1, 2].map(i => <RowSkeleton key={i} />)}</div>
            ) : rescheduleRequests.length === 0 ? (
              <EmptyState icon={Check} tone="bg-emerald-50 text-emerald-600" title="All caught up" text="New requests from workers will appear here." />
            ) : (
              <ul className="flex-1 min-h-0 max-h-[460px] xl:max-h-none overflow-y-auto custom-scroll divide-y divide-slate-100 border-t border-slate-100">
                {rescheduleRequests.map(req => {
                  const saving = reviewSaving?.id === req.id
                  return (
                    <li key={req.id} className={`px-5 py-4 ${leaving.includes(req.id) ? 'sc-out' : ''}`}>
                      <div className="flex items-center gap-3">
                        <Avatar name={req.worker_name} seed={req.id} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{req.worker_name}</p>
                          <p className="text-xs text-slate-500">{req.schedule_code}</p>
                        </div>
                      </div>
                      {req.reason && <p className="mt-2.5 text-sm text-slate-600 line-clamp-2">“{req.reason}”</p>}
                      <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 space-y-1.5 text-xs">
                        <p className="flex items-center gap-2 text-slate-500">
                          <Clock size={13} {...ICON} className="text-slate-400 flex-shrink-0" />
                          <span className="line-through decoration-slate-300">{fmtDateTime(req.current_start_time)} – {fmtDateTime(req.current_end_time)}</span>
                        </p>
                        <p className="flex items-center gap-2 text-slate-900 font-medium">
                          <CalendarClock size={13} {...ICON} className="text-amber-500 flex-shrink-0" />
                          {fmtDateTime(req.new_start_time)} – {fmtDateTime(req.new_end_time)}
                        </p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={saving}
                          onClick={() => reviewRequest(req, 'approve')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          {saving && reviewSaving.action === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} {...ICON} />}
                          Approve
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => reviewRequest(req, 'reject')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 text-sm font-medium bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-60"
                        >
                          {saving && reviewSaving.action === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} {...ICON} />}
                          Reject
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Row 4 — Compliance & scheduling */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        <Card
          className="xl:col-span-2"
          title="License health"
          subtitle="Worker licenses by expiry"
          action={<LinkButton onClick={() => navigate('/admin/licenses')}>Manage</LinkButton>}
        >
          {loading ? (
            <div className="space-y-4"><Skel className="h-8 w-40" /><Skel className="h-3 w-full rounded-full" /><div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skel key={i} className="h-16" />)}</div></div>
          ) : (
            <LicenseHealth valid={counts.licensesValid} expiring={counts.licensesExpiring} expired={counts.licensesExpired} />
          )}
        </Card>

        <Card title="Scheduling" subtitle="Shifts across all job sites" action={<LinkButton onClick={() => navigate('/admin/scheduling')}>Open</LinkButton>}>
          {loading ? (
            <div className="space-y-3"><Skel className="h-16 w-full" /><Skel className="h-16 w-full" /></div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-1 gap-3">
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
                <span className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><CalendarClock size={18} {...ICON} /></span>
                <div>
                  <p className="text-xl font-semibold text-slate-900 tabular-nums"><Num value={counts.schedules} /></p>
                  <p className="text-xs text-slate-500">Active schedules</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
                <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Clock size={18} {...ICON} /></span>
                <div>
                  <p className="text-xl font-semibold text-slate-900 tabular-nums"><Num value={rescheduleRequests.length} /></p>
                  <p className="text-xs text-slate-500">Awaiting your review</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}