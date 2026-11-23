import { useState, useEffect, useMemo } from 'react'
import {
  ClipboardList, MapPin, Calendar, Search, CheckCircle2, Image as ImageIcon, Flag,
  CalendarCheck, CalendarDays, Hourglass, HardHat, FileText, Hash, Wallet, ChevronDown, AlertCircle, RefreshCw, Eye,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'
import {
  ICON, MIN_SKELETON_MS, Skel, Toast, useToast, Modal, ModalHeader, PageHeader, EmptyState, StatusBadge,
  inputCls, btnSecondary, btnSmPrimary, btnSmSecondary, fmtDate, fmtTime, ymd, isWeekend,
} from './CustomerUI'

const HOST = 'https://saddlebrown-swan-877763.hostingersite.com'

const FILTERS = [
  { key: '',         label: 'All' },
  { key: 'waiting',  label: 'Waiting',   match: s => ['Pending', 'Under Review', 'On Hold'].includes(s) },
  { key: 'ongoing',  label: 'Ongoing',   match: s => ['Scheduled', 'In Progress', 'Active'].includes(s) },
  { key: 'complete', label: 'Completed', match: s => s === 'Complete' },
  { key: 'cancelled', label: 'Cancelled', match: s => s === 'Cancelled' },
]

export default function CustomerJobOrdersPage() {
  const [jobOrders, setJobOrders] = useState([])
  const [visits,    setVisits]    = useState([])
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [toast, showToast] = useToast()

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true)
    const started = Date.now()
    try {
      // The server only returns this customer's own job orders
      const [data, vData] = await Promise.all([
        apiGet('/api/job-orders/list.php', { per_page: 200, mine: 1 }),
        apiGet('/api/schedules/list.php', { per_page: 200, mine: 1 }).catch(() => ({ schedules: [] })),
      ])
      setJobOrders(data.job_orders || [])
      setVisits(vData.schedules || [])
    } catch {
      showToast('Could not load your job orders.', 'error')
    }
    if (!quiet) {
      const wait = MIN_SKELETON_MS - (Date.now() - started)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.key, f.match ? jobOrders.filter(j => f.match(j.status)).length : jobOrders.length])), [jobOrders])

  const filtered = jobOrders.filter(jo => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [jo.job_order_code, jo.description, jo.service, jo.worker_name, jo.contract_type]
      .some(v => v?.toLowerCase().includes(q))
    const f = FILTERS.find(x => x.key === filter)
    return matchSearch && (!f?.match || f.match(jo.status))
  })

  const done = (msg, type) => { showToast(msg, type); if (type !== 'error') load(true) }

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <PageHeader title="My job orders" sub="Follow your projects, site visits and finished work." />

      {/* Filters */}
      <div className="cx-rise flex flex-col sm:flex-row gap-3" style={{ animationDelay: '60ms' }}>
        <div className="relative flex-1">
          <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job order, service or worker"
            aria-label="Search job orders" className={`${inputCls} pl-9 bg-white`} />
        </div>
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-lg overflow-x-auto">
          {FILTERS.filter(f => !f.match || counts[f.key] > 0 || filter === f.key).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors
                ${filter === f.key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}>
              {f.label}<span className={`text-[11px] tabular-nums ${filter === f.key ? 'text-emerald-600' : 'text-slate-400'}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex justify-between"><Skel className="h-5 w-40" /><Skel className="h-9 w-24" /></div>
              <Skel className="h-3.5 w-1/3" /><Skel className="h-14 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState icon={ClipboardList}
            title={jobOrders.length ? 'No job orders match' : 'No job orders yet'}
            text={jobOrders.length ? 'Try another search or filter.' : 'When your inquiry is accepted, your job order shows up here.'}
            action={jobOrders.length ? <button onClick={() => { setSearch(''); setFilter('') }} className={btnSecondary}>Clear filters</button> : null} />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((jo, i) => (
            <article key={jo.id} className="cx-rise bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <div className="flex items-start gap-3.5">
                <span className="hidden sm:flex w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 items-center justify-center flex-shrink-0"><ClipboardList size={19} {...ICON} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[15px] font-semibold text-slate-900">{jo.job_order_code}</h2>
                        <StatusBadge status={jo.status} />
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 truncate">{jo.service || jo.description || jo.contract_type || 'Project'}</p>
                    </div>
                    <button onClick={() => setSelected(jo)} className={`${btnSmSecondary} flex-shrink-0`}>
                      <Eye size={15} {...ICON} /><span className="hidden sm:inline">Details</span>
                    </button>
                  </div>

                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                    <Meta icon={MapPin} label="Address" value={jo.client_address || jo.location} wide />
                    <Meta icon={Calendar} label="Dates" value={jo.start_date ? `${fmtDate(jo.start_date, { month: 'short', day: 'numeric' })} – ${fmtDate(jo.end_date)}` : null} />
                    <Meta icon={HardHat} label="Worker" value={jo.worker_name} />
                  </dl>

                  {visitsFor(visits, jo.id).map(v => <VisitCard key={v.id} visit={v} onDone={done} />)}
                  {jo.finished_at && jo.status === 'In Progress' && <ConfirmCard jo={jo} onDone={done} />}
                  {!jo.finished_at && jo.issue_note && jo.status === 'In Progress' && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3.5 py-3 text-[13px] text-amber-800">
                      <AlertCircle size={16} {...ICON} className="flex-shrink-0 mt-0.5" />
                      <span>Still to do: “{jo.issue_note}”. The worker is working on it.</span>
                    </p>
                  )}
                  {jo.status === 'Complete' && jo.completed_at && (
                    <p className="mt-4 flex items-center gap-2 text-[13px] text-emerald-700">
                      <CheckCircle2 size={16} {...ICON} />Completed on {fmtDate(jo.completed_at)}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && <JobDetails jo={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Meta({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-1.5 min-w-0 text-slate-500">
      <Icon size={13} {...ICON} className="flex-shrink-0 text-slate-400" />
      <dt className="sr-only">{label}</dt>
      <dd className="truncate text-slate-600">{value}</dd>
    </div>
  )
}

// ── Details ────────────────────────────────────────────────────
function JobDetails({ jo, onClose }) {
  const rows = [
    { icon: FileText,  label: 'Service',       value: jo.service || jo.description },
    { icon: FileText,  label: 'Contract',      value: jo.contract_type },
    { icon: HardHat,   label: 'Worker',        value: jo.worker_name },
    { icon: MapPin,    label: 'Address',       value: jo.client_address || jo.location },
    { icon: Calendar,  label: 'Start date',    value: jo.start_date ? fmtDate(jo.start_date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : null },
    { icon: Calendar,  label: 'End date',      value: jo.end_date ? fmtDate(jo.end_date, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : null },
    { icon: Wallet,    label: 'Budget',        value: jo.budget ? `₱${Number(jo.budget).toLocaleString('en-PH')}` : null },
    { icon: Hash,      label: 'Inquiry',       value: jo.inquiry_code },
    { icon: Calendar,  label: 'Created',       value: jo.created_at ? fmtDate(jo.created_at) : null },
  ].filter(r => r.value)

  return (
    <Modal onClose={onClose} maxW="max-w-2xl">
      <ModalHeader icon={ClipboardList} title={jo.job_order_code} sub="Job order details" badge={<StatusBadge status={jo.status} />} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
        {jo.description && jo.service && jo.description !== jo.service && (
          <p className="text-sm text-slate-700 leading-relaxed">{jo.description}</p>
        )}
        <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3">
              <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <dt className="text-xs text-slate-500 w-24 flex-shrink-0 pt-0.5">{label}</dt>
              <dd className="text-sm text-slate-900 min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <ProgressPhotos jobId={jo.id} />
      </div>
      <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end flex-shrink-0">
        <button onClick={onClose} className={btnSecondary}>Close</button>
      </div>
    </Modal>
  )
}

// ── Site visit date (agree with the worker) ────────────────────
const VISIT_LABEL = { ocular: 'Site visit (ocular inspection)', progress: 'Progress check', other: 'Site visit' }

// Visits the customer should see on a job card: being agreed, or planned and not yet over
function visitsFor(visits, jobId) {
  const now = new Date()
  return visits.filter(v => String(v.job_order_id) === String(jobId) && (
    v.waiting_for || (v.status === 'Scheduled' && new Date(String(v.end_time).replace(' ', 'T')) >= now)
  ))
}

function VisitCard({ visit, onDone }) {
  const [mode, setMode] = useState(null)   // null | 'suggest'
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const tomorrow = ymd(new Date(Date.now() + 86400000))
  const min = [tomorrow, (visit.job_start_date || '').slice(0, 10)].filter(Boolean).sort().pop()
  const max = (visit.job_end_date || '').slice(0, 10) || undefined
  const left = Number(visit.suggests_left ?? 0)

  const send = async (action) => {
    setError(null)
    if (action === 'counter') {
      if (!date) return setError('Please pick a date.')
      if (isWeekend(date)) return setError('Site visits are Monday to Friday only.')
      if (date < min || (max && date > max)) return setError('Please pick a date within your job order dates.')
    }
    setBusy(action)
    try {
      const res = await apiPost('/api/schedules/propose.php', { schedule_id: visit.id, action, date: action === 'counter' ? date : undefined })
      if (res?.success === false) throw new Error(res.error)
      onDone(res?.message || 'Thank you!', 'success')
    } catch (e) { onDone(e.message || 'Something went wrong. Please try again.', 'error') }
    setBusy(null)
  }

  const planned = !visit.waiting_for
  const myTurn  = visit.my_turn
  const lastBy  = (visit.proposals || []).filter(p => p.action !== 'escalate').slice(-1)[0]?.by
  const label   = VISIT_LABEL[visit.visit_type] || 'Site visit'
  const Icon    = planned ? CalendarCheck : myTurn ? CalendarDays : Hourglass

  return (
    <div className={`mt-4 rounded-xl p-3.5 sm:p-4 ring-1 ${myTurn ? 'bg-emerald-50/70 ring-emerald-200' : 'bg-slate-50 ring-slate-200'}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 bg-white ${myTurn || planned ? 'text-emerald-600 ring-emerald-200' : 'text-slate-400 ring-slate-200'}`}>
          <Icon size={17} {...ICON} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${myTurn ? 'text-emerald-900' : 'text-slate-900'}`}>
            {planned ? `${label} is confirmed` : myTurn ? 'Please confirm the date of your site visit' : `${label}: date not final yet`}
          </p>
          <p className={`text-[13px] mt-0.5 ${myTurn ? 'text-emerald-800' : 'text-slate-700'}`}>
            {fmtDate(visit.start_time, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {fmtTime(visit.start_time)} – {fmtTime(visit.end_time)}
          </p>
          <p className={`text-xs mt-1.5 ${myTurn ? 'text-emerald-800/80' : 'text-slate-500'}`}>
            {planned ? `${visit.worker_name || 'Our worker'} will visit you on this date.`
              : myTurn ? (lastBy === 'worker' ? 'The worker suggested this date. Is it okay for you?' : 'Our worker will visit to check the site before the work starts. Is this date okay for you?')
              : visit.waiting_for === 'admin' ? 'Our admin will choose the date and let you know by email.'
              : 'Waiting for the worker to confirm. We will email you when the date is final.'}
          </p>

          {myTurn && (mode === 'suggest' ? (
            <div className="cx-pop mt-3.5">
              <label htmlFor={`sg-${visit.id}`} className="block text-xs font-medium text-emerald-900 mb-1.5">Pick a date that works for you</label>
              <input id={`sg-${visit.id}`} type="date" min={min} max={max} value={date} onChange={e => { setDate(e.target.value); setError(null) }}
                className={`${inputCls} bg-white sm:max-w-[240px]`} />
              <p className="text-xs text-emerald-800/80 mt-1.5">
                Monday to Friday, 9:00–11:00 AM{max ? `, until ${fmtDate(max)}` : ''}. {left <= 1 ? 'This is the last time you can suggest a date.' : `You can suggest a date ${left} more times.`}
              </p>
              {error && <p className="cx-shake mt-2 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={13} {...ICON} />{error}</p>}
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button onClick={() => send('counter')} disabled={!!busy} className={btnSmPrimary}>
                  {busy === 'counter' && <RefreshCw size={14} {...ICON} className="animate-spin" />}{busy === 'counter' ? 'Sending…' : 'Send this date'}
                </button>
                <button onClick={() => { setMode(null); setDate(''); setError(null) }} disabled={!!busy} className={btnSmSecondary}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
              <button onClick={() => send('accept')} disabled={!!busy} className={btnSmPrimary}>
                {busy === 'accept' ? <RefreshCw size={14} {...ICON} className="animate-spin" /> : <CheckCircle2 size={15} {...ICON} />}{busy === 'accept' ? 'Saving…' : 'Accept this date'}
              </button>
              {visit.can_suggest
                ? <button onClick={() => setMode('suggest')} disabled={!!busy} className={btnSmSecondary}><CalendarDays size={15} {...ICON} />Suggest another date</button>
                : <button onClick={() => send('escalate')} disabled={!!busy} className={btnSmSecondary}>{busy === 'escalate' ? 'Sending…' : 'Let the admin choose'}</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Confirm the finished work ──────────────────────────────────
function ConfirmCard({ jo, onDone }) {
  const [mode, setMode] = useState(null)   // null | 'confirm' | 'issue'
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const send = async (action) => {
    setError(null)
    if (action === 'issue' && !note.trim()) return setError('Tell us what still needs to be done.')
    setBusy(true)
    try {
      const res = await apiPost('/api/job-orders/confirm.php', { id: jo.id, action, note: note.trim() })
      if (res?.success === false) throw new Error(res.error)
      onDone(res?.message || 'Thank you!', 'success')
    } catch (e) { onDone(e.message || 'Something went wrong. Please try again.', 'error') }
    setBusy(false)
  }

  return (
    <div className="mt-4 rounded-xl p-3.5 sm:p-4 bg-emerald-50/70 ring-1 ring-emerald-200">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-white ring-1 ring-emerald-200 text-emerald-600 flex items-center justify-center flex-shrink-0"><Flag size={17} {...ICON} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-900">The worker finished this job on {fmtDate(jo.finished_at)}</p>
          {jo.finish_note && <p className="text-[13px] text-emerald-800 mt-0.5">“{jo.finish_note}”</p>}
          {jo.finish_photo_path && (
            <a href={`${HOST}/${jo.finish_photo_path}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[13px] font-medium text-emerald-700 hover:underline underline-offset-2">
              <ImageIcon size={15} {...ICON} />View the final photo
            </a>
          )}
          <p className="text-xs text-emerald-800/80 mt-1.5">Please check the work. Is everything done?</p>

          {mode === 'issue' ? (
            <div className="cx-pop mt-3.5">
              <label htmlFor={`issue-${jo.id}`} className="sr-only">What still needs to be done?</label>
              <textarea id={`issue-${jo.id}`} rows={3} maxLength={500} value={note} onChange={e => { setNote(e.target.value); setError(null) }}
                placeholder="What still needs to be done?" className={`${inputCls} h-auto py-2.5 resize-none bg-white`} />
              {error && <p className="cx-shake mt-2 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={13} {...ICON} />{error}</p>}
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button onClick={() => send('issue')} disabled={busy} className={btnSmPrimary}>{busy ? 'Sending…' : 'Send to the worker'}</button>
                <button onClick={() => { setMode(null); setNote(''); setError(null) }} disabled={busy} className={btnSmSecondary}>Cancel</button>
              </div>
            </div>
          ) : mode === 'confirm' ? (
            <div className="cx-pop flex flex-col sm:flex-row sm:items-center gap-2 mt-3.5">
              <span className="text-[13px] font-medium text-emerald-900 sm:mr-1">Confirm that the job is complete?</span>
              <button onClick={() => send('confirm')} disabled={busy} className={btnSmPrimary}><CheckCircle2 size={15} {...ICON} />{busy ? 'Saving…' : 'Yes, confirm'}</button>
              <button onClick={() => setMode(null)} disabled={busy} className={btnSmSecondary}>Cancel</button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 mt-3.5">
              <button onClick={() => setMode('confirm')} className={btnSmPrimary}><CheckCircle2 size={15} {...ICON} />Confirm it's done</button>
              <button onClick={() => setMode('issue')} className={btnSmSecondary}>Report a problem</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Progress photos in the details view ────────────────────────
function ProgressPhotos({ jobId }) {
  const [photos, setPhotos] = useState(null)
  const [all, setAll] = useState(false)
  useEffect(() => {
    let alive = true
    apiGet('/api/job-orders/get-progress.php', { job_order_id: jobId })
      .then(d => { if (alive) setPhotos(d.photos || []) })
      .catch(() => { if (alive) setPhotos([]) })
    return () => { alive = false }
  }, [jobId])

  if (photos === null) {
    return <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{[0, 1, 2].map(i => <Skel key={i} className="h-24" />)}</div>
  }
  if (photos.length === 0) return null
  const shown = all ? photos : photos.slice(0, 8)
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
        <ImageIcon size={15} {...ICON} className="text-emerald-600" />Progress photos <span className="text-slate-400 font-normal">({photos.length})</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {shown.map(p => (
          <a key={p.id} href={`${HOST}/${p.file_path}`} target="_blank" rel="noreferrer"
            className="group relative block rounded-lg overflow-hidden ring-1 ring-slate-200 bg-slate-100">
            <img src={`${HOST}/${p.file_path}`} alt={`Progress photo from ${fmtDate(p.upload_date)}`} loading="lazy"
              className="w-full h-28 object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[10px] font-medium">
              {p.is_final ? 'Final · ' : ''}{fmtDate(p.upload_date, { month: 'short', day: 'numeric' })}
            </span>
          </a>
        ))}
      </div>
      {photos.length > 8 && (
        <button onClick={() => setAll(a => !a)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:underline underline-offset-2">
          {all ? 'Show fewer' : `Show all ${photos.length} photos`}<ChevronDown size={15} {...ICON} className={all ? 'rotate-180' : ''} />
        </button>
      )}
    </div>
  )
}