import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, Calendar, Users, CheckCircle, X, ArrowRight, Inbox, HardHat, ShieldCheck,
} from 'lucide-react'
import { apiGet } from '../../../utils/api'
import {
  PageHeader, Card, CardHeader, StatusBadge, Avatar, Button, TextButton, Loading,
  EmptyState, Code, Table, Toast, IconTile, trCls, tdCls,
} from './ui'

// ── useNavigate (admin wrapper) ────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon, label, value, tone = 'emerald' }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-stone-900">
        {value ?? <span className="text-stone-300">—</span>}
      </p>
    </Card>
  )
}

// ── License status bar ─────────────────────────────────────────
function LicenseBar({ valid, expiring, expired }) {
  const v = valid ?? 0, s = expiring ?? 0, e = expired ?? 0
  const total = v + s + e
  const pct = n => (total ? (n / total) * 100 : 0)
  const rows = [
    { label: 'Valid',         value: valid,    dot: 'bg-emerald-500' },
    { label: 'Expiring soon', value: expiring, dot: 'bg-amber-500'   },
    { label: 'Expired',       value: expired,  dot: 'bg-red-500'     },
  ]
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
        <div className="bg-emerald-500 transition-all" style={{ width: `${pct(v)}%` }} />
        <div className="bg-amber-500 transition-all"   style={{ width: `${pct(s)}%` }} />
        <div className="bg-red-500 transition-all"     style={{ width: `${pct(e)}%` }} />
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map(r => (
          <li key={r.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-stone-600">
              <span className={`h-2 w-2 rounded-full ${r.dot}`} />{r.label}
            </span>
            <span className="font-semibold tabular-nums text-stone-900">{r.value ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const fmtTime = (s) => s?.slice(0, 16).replace('T', ' ') || '—'

// ── Admin Home ─────────────────────────────────────────────────
export default function AdminHome() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ inquiries: null, jobOrders: null, contacts: null, workers: null, schedules: null, licensesValid: null, licensesExpiring: null, licensesExpired: null, pendingReschedules: null })
  const [rescheduleRequests, setRescheduleRequests] = useState([])
  const [reviewSaving, setReviewSaving] = useState(null) // id being saved
  const [recentJobOrders, setRecentJobOrders] = useState([])
  const [joStats, setJoStats] = useState({ total: 0, completed: 0, inProgress: 0 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [inqData, joData, contactsData, schedData] = await Promise.all([
          apiGet('/api/inquiries/list.php',   { per_page: 1 }),
          apiGet('/api/job-orders/list.php',  { per_page: 50 }),
          apiGet('/api/contacts/list.php',    { per_page: 1 }),
          apiGet('/api/schedules/list.php',   { per_page: 1 }),
        ])

        setCounts(p => ({
          ...p,
          inquiries: inqData.pagination?.total ?? 0,
          jobOrders: joData.pagination?.total ?? 0,
          contacts:  contactsData.pagination?.total ?? 0,
          schedules: schedData.pagination?.total ?? 0,
        }))

        const allJO = joData.job_orders || []
        setRecentJobOrders(allJO.slice(0, 3))

        const completed  = allJO.filter(jo => jo.status === 'Complete' || jo.status === 'Completed').length
        const inProgress = allJO.filter(jo => jo.status === 'In Progress' || jo.status === 'Active').length
        setJoStats({ total: allJO.length, completed, inProgress })

        // Fetch workers count
        const workersData = await apiGet('/api/contacts/list.php', { per_page: 1, type: 'worker' })
        setCounts(p => ({ ...p, workers: workersData.pagination?.total ?? 0 }))

        // Fetch license stats
        const licData = await apiGet('/api/licenses/list.php', { per_page: 100 })
        const allLic = licData.licenses || []
        const now = new Date()
        const soon = 60 * 24 * 60 * 60 * 1000
        const licensesExpired  = allLic.filter(l => l.expiry_date && new Date(l.expiry_date) < now).length
        const licensesExpiring = allLic.filter(l => l.expiry_date && new Date(l.expiry_date) >= now && (new Date(l.expiry_date) - now) < soon).length
        const licensesValid    = allLic.filter(l => l.expiry_date && new Date(l.expiry_date) >= now && (new Date(l.expiry_date) - now) >= soon).length
        setCounts(p => ({ ...p, licensesExpired, licensesExpiring, licensesValid }))

        // Fetch pending reschedule requests
        const rrData = await apiGet('/api/schedules/reschedule-requests/list.php', { status: 'pending' })
        const pending = rrData.requests || []
        setRescheduleRequests(pending)
        setCounts(p => ({ ...p, pendingReschedules: pending.length }))

      } catch (e) {
        console.warn('Dashboard load error:', e)
      }
      setLoading(false)
    }
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const reviewRequest = async (req, action) => {
    setReviewSaving(req.id)
    try {
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res = await fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/schedules/reschedule-requests/review.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request_id: req.id, action }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setRescheduleRequests(prev => prev.filter(r => r.id !== req.id))
      setCounts(p => ({ ...p, pendingReschedules: (p.pendingReschedules || 1) - 1 }))
      showToast(action === 'approve' ? 'Reschedule request approved.' : 'Reschedule request rejected.')
    } catch (e) { showToast('Could not update the request: ' + e.message, 'error') }
    setReviewSaving(null)
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <PageHeader
        title="Welcome to SkillConnect Admin"
        subtitle="Emerald Builders & Construction. Here's your overview for today."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Inbox}         label="Total inquiries" value={counts.inquiries} tone="emerald" />
        <StatCard icon={ClipboardList} label="Job orders"      value={counts.jobOrders} tone="blue"    />
        <StatCard icon={Users}         label="All contacts"    value={counts.contacts}  tone="amber"   />
        <StatCard icon={HardHat}       label="Workers"         value={counts.workers}   tone="violet"  />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* Recent Job Orders */}
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="Recent job orders"
            subtitle="Latest projects"
            action={
              <TextButton onClick={() => navigate('/admin/job-orders')}>
                View all <ArrowRight size={14} />
              </TextButton>
            }
          />
          {loading && recentJobOrders.length === 0 ? (
            <Loading />
          ) : recentJobOrders.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No job orders yet" description="Job orders appear here once an inquiry is marked as won." />
          ) : (
            <>
              {/* Mobile */}
              <ul className="divide-y divide-stone-100 sm:hidden">
                {recentJobOrders.map(jo => (
                  <li key={jo.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={jo.worker_name || '?'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Code>{jo.job_order_code}</Code>
                        <StatusBadge status={jo.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-stone-900">{jo.worker_name || '—'}</p>
                      <p className="truncate text-xs text-stone-500">{jo.client_name || '—'}, {jo.contract_type || 'no contract'}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table headers={['Code', 'Worker', 'Client', 'Contract', 'Status']}>
                  {recentJobOrders.map(jo => (
                    <tr key={jo.id} className={trCls}>
                      <td className={tdCls}><Code>{jo.job_order_code}</Code></td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={jo.worker_name || '?'} size="sm" />
                          <span className="font-medium text-stone-900">{jo.worker_name || '—'}</span>
                        </div>
                      </td>
                      <td className={tdCls}>{jo.client_name || '—'}</td>
                      <td className={tdCls}>{jo.contract_type || '—'}</td>
                      <td className={tdCls}><StatusBadge status={jo.status} /></td>
                    </tr>
                  ))}
                </Table>
              </div>
            </>
          )}
        </Card>

        {/* Right column */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-1">
          {/* Job Order Stats */}
          <Card>
            <CardHeader title="Job order stats" subtitle="Current overview" />
            <div className="p-5">
              <div className="grid grid-cols-3 divide-x divide-stone-100 text-center">
                {[
                  { label: 'Total',       value: joStats.total,      color: 'text-stone-900'   },
                  { label: 'Completed',   value: joStats.completed,  color: 'text-emerald-700' },
                  { label: 'In progress', value: joStats.inProgress, color: 'text-amber-600'   },
                ].map(s => (
                  <div key={s.label} className="px-2">
                    <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-stone-600">
                  <Calendar size={15} className="text-cyan-700" />Active schedules
                </span>
                <span className="text-sm font-semibold tabular-nums text-stone-900">{counts.schedules ?? '—'}</span>
              </div>

              <div className="mt-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <ShieldCheck size={15} className="text-stone-500" />License status
                </p>
                <LicenseBar valid={counts.licensesValid} expiring={counts.licensesExpiring} expired={counts.licensesExpired} />
              </div>
            </div>
          </Card>

          {/* Reschedule Requests */}
          <Card className="overflow-hidden">
            <CardHeader
              icon={Calendar}
              tone="amber"
              title="Reschedule requests"
              subtitle={rescheduleRequests.length > 0 ? `${rescheduleRequests.length} waiting for approval` : 'No pending requests'}
            />
            {rescheduleRequests.length === 0 ? (
              <EmptyState icon={CheckCircle} title="All caught up" description="New reschedule requests from workers will show up here." />
            ) : (
              <ul className="divide-y divide-stone-100">
                {rescheduleRequests.map(req => (
                  <li key={req.id} className="px-5 py-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <Code tone="amber">{req.schedule_code}</Code>
                      <span className="truncate text-sm font-medium text-stone-900">{req.worker_name}</span>
                    </div>
                    {req.reason && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{req.reason}</p>}
                    <dl className="mt-3 space-y-1.5 rounded-lg bg-stone-50 p-3 text-xs">
                      <div className="flex gap-2">
                        <dt className="w-20 flex-shrink-0 text-stone-500">Current</dt>
                        <dd className="text-stone-700">{fmtTime(req.current_start_time)} to {fmtTime(req.current_end_time)}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="w-20 flex-shrink-0 font-medium text-amber-700">Requested</dt>
                        <dd className="font-medium text-stone-900">{fmtTime(req.new_start_time)} to {fmtTime(req.new_end_time)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="danger" icon={X} className="flex-1"
                        disabled={reviewSaving === req.id} onClick={() => reviewRequest(req, 'reject')}>
                        Reject
                      </Button>
                      <Button size="sm" icon={CheckCircle} className="flex-1"
                        loading={reviewSaving === req.id} onClick={() => reviewRequest(req, 'approve')}>
                        Approve
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}