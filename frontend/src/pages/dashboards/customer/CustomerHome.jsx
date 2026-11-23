import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, CheckCircle2, Clock, Hammer, ArrowRight, CalendarCheck, Flag, Plus, ChevronRight, MapPin } from 'lucide-react'
import { apiGet } from '../../../utils/api'
import { ICON, MIN_SKELETON_MS, Skel, StatusBadge, EmptyState, btnPrimary, getCustomerInfo, fmtDate, fmtTime } from './CustomerUI'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// ── Customer Dashboard Home ────────────────────────────────────
export default function CustomerHome() {
  const navigate  = useNavigate()
  const customer  = getCustomerInfo()
  const firstName = customer?.first_name || customer?.name?.split(' ')[0] || ''
  const [jobOrders, setJobOrders] = useState([])
  const [visits,    setVisits]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const started = Date.now()
      try {
        // The server only returns this customer's own records
        const [joData, vData] = await Promise.all([
          apiGet('/api/job-orders/list.php', { per_page: 200, mine: 1 }),
          apiGet('/api/schedules/list.php', { per_page: 200, mine: 1 }).catch(() => ({ schedules: [] })),
        ])
        if (!alive) return
        setJobOrders(joData.job_orders || [])
        setVisits(vData.schedules || [])
      } catch { /* empty state */ }
      const wait = MIN_SKELETON_MS - (Date.now() - started)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [])

  const total     = jobOrders.length
  const active    = jobOrders.filter(jo => ['Active', 'In Progress', 'Scheduled'].includes(jo.status)).length
  const completed = jobOrders.filter(jo => jo.status === 'Complete').length
  const pending   = jobOrders.filter(jo => ['Pending', 'Under Review'].includes(jo.status)).length
  const toConfirm = jobOrders.filter(jo => jo.finished_at && jo.status === 'In Progress')
  const dateToAnswer = visits.filter(v => v.my_turn)
  const nextVisit = visits
    .filter(v => v.status === 'Scheduled' && !v.waiting_for && new Date(String(v.start_time).replace(' ', 'T')) >= new Date())
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))[0]
  const recent = [...jobOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)

  const stats = [
    { label: 'All job orders', value: total,     icon: ClipboardList, tone: 'bg-slate-50 text-slate-600 ring-slate-200' },
    { label: 'Ongoing',        value: active,    icon: Hammer,        tone: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
    { label: 'Completed',      value: completed, icon: CheckCircle2,  tone: 'bg-blue-50 text-blue-600 ring-blue-100' },
    { label: 'Waiting',        value: pending,   icon: Clock,         tone: 'bg-amber-50 text-amber-600 ring-amber-100' },
  ]

  return (
    <div className="space-y-6">
      <div className="cx-rise flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{greeting()}{firstName ? ',' : ''}</p>
          <h1 className="text-2xl sm:text-[30px] leading-tight font-semibold text-slate-900 tracking-tight">{firstName || 'Welcome back'}</h1>
        </div>
        <button onClick={() => navigate('/customer/inquiries', { state: { newInquiry: true } })} className={btnPrimary}>
          <Plus size={16} {...ICON} />New inquiry
        </button>
      </div>

      {/* Stats */}
      <div className="cx-rise grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" style={{ animationDelay: '60ms' }}>
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm text-slate-500">{label}</p>
              {loading ? <Skel className="h-8 w-10 mt-2" /> : <p className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight mt-1 tabular-nums">{value}</p>}
            </div>
            <span className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${tone}`}><Icon size={18} {...ICON} /></span>
          </div>
        ))}
      </div>

      {/* Things that need the customer */}
      {!loading && (dateToAnswer.length > 0 || toConfirm.length > 0 || nextVisit) && (
        <div className="cx-rise space-y-3" style={{ animationDelay: '120ms' }}>
          {dateToAnswer.length > 0 && (
            <ActionRow icon={CalendarCheck} onClick={() => navigate('/customer/job-orders')}
              title={dateToAnswer.length === 1 ? 'Please confirm the date of your site visit' : `Please confirm ${dateToAnswer.length} site visit dates`}
              text="Accept the date or suggest another one that works for you." cta="Answer" />
          )}
          {toConfirm.length > 0 && (
            <ActionRow icon={Flag} onClick={() => navigate('/customer/job-orders')}
              title={toConfirm.length === 1 ? `${toConfirm[0].job_order_code} is finished. Please check the work.` : `${toConfirm.length} jobs are finished. Please check the work.`}
              text="Look at the final photo, then confirm or tell us what still needs fixing." cta="Check" />
          )}
          {nextVisit && (
            <button onClick={() => navigate('/customer/job-orders')}
              className="w-full flex items-center gap-3.5 text-left bg-white rounded-2xl border border-slate-200 px-4 sm:px-5 py-4 hover:border-slate-300 transition-colors">
              <span className="w-11 h-11 rounded-xl bg-slate-50 ring-1 ring-slate-200 flex flex-col items-center justify-center flex-shrink-0 leading-none">
                <span className="text-[10px] font-medium text-emerald-700 uppercase">{fmtDate(nextVisit.start_time, { month: 'short' })}</span>
                <span className="text-base font-semibold text-slate-900 mt-0.5">{fmtDate(nextVisit.start_time, { day: 'numeric' })}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-slate-900">Next site visit</span>
                <span className="block text-xs text-slate-500 mt-0.5 truncate">
                  {fmtDate(nextVisit.start_time, { weekday: 'long', month: 'short', day: 'numeric' })} · {fmtTime(nextVisit.start_time)} – {fmtTime(nextVisit.end_time)}
                  {nextVisit.worker_name ? ` · ${nextVisit.worker_name}` : ''}
                </span>
              </span>
              <ChevronRight size={18} {...ICON} className="text-slate-300 flex-shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Recent job orders */}
      <section className="cx-rise bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ animationDelay: '160ms' }}>
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Recent job orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your latest projects with us.</p>
          </div>
          {total > 0 && (
            <button onClick={() => navigate('/customer/job-orders')} className="text-[13px] font-medium text-emerald-700 hover:underline underline-offset-2 whitespace-nowrap">View all</button>
          )}
        </header>

        {loading ? (
          <div className="p-5 space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3"><Skel className="w-10 h-10 rounded-xl" /><div className="flex-1 space-y-2"><Skel className="h-3.5 w-1/3" /><Skel className="h-3 w-1/2" /></div><Skel className="h-5 w-20" /></div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No job orders yet"
            text="Send us an inquiry. Once it's accepted, your job order shows up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map(jo => (
              <li key={jo.id}>
                <button onClick={() => navigate('/customer/job-orders')} className="w-full flex items-center gap-3.5 px-5 py-3.5 text-left hover:bg-slate-50/70 transition-colors">
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><ClipboardList size={17} {...ICON} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900 truncate">{jo.job_order_code} · {jo.service || jo.description || jo.contract_type || 'Project'}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 truncate">
                      <MapPin size={12} {...ICON} className="flex-shrink-0 text-slate-400" />{jo.client_address || jo.location || '—'}
                    </span>
                  </span>
                  <StatusBadge status={jo.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ActionRow({ icon: Icon, title, text, cta, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3.5 text-left rounded-2xl bg-emerald-50/70 ring-1 ring-emerald-200 px-4 sm:px-5 py-4 hover:bg-emerald-50 transition-colors">
      <span className="w-11 h-11 rounded-xl bg-white ring-1 ring-emerald-200 text-emerald-600 flex items-center justify-center flex-shrink-0"><Icon size={19} {...ICON} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-emerald-900">{title}</span>
        <span className="block text-xs text-emerald-800/80 mt-0.5">{text}</span>
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">{cta}<ArrowRight size={15} {...ICON} /></span>
      <ArrowRight size={16} {...ICON} className="sm:hidden text-emerald-600 flex-shrink-0" />
    </button>
  )
}