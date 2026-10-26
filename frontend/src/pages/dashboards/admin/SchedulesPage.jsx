import { useState, useEffect } from 'react'
import { useLocation, useNavigate as useRouterNavigate } from 'react-router-dom'
import {
  ClipboardList, Calendar, Plus, Search, RefreshCw, CheckCircle,
  AlertCircle, X, ArrowRight, Eye, AlertTriangle
} from 'lucide-react'
import { apiGet, apiPost, apiPut } from '../../../utils/api'

// ── useNavigate (admin wrapper) ────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg border
      ${toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-red-50 border-red-200 text-red-700'}`}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {toast.msg}
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────
function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  const pages = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return (
    <div className="flex items-center justify-between px-1 mt-4">
      <p className="text-xs text-gray-400">
        Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-gray-400 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors
                ${p === page
                  ? 'bg-emerald-500 text-white border border-emerald-500'
                  : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  )
}

// ── Schedules Page
export default function SchedulesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromJobOrder        = location.state?.fromJobOrder        || null
  const highlightWorkerName = location.state?.highlightWorkerName || null
  const highlightWorkerId   = location.state?.highlightWorkerId   || null
 const [schedules,  setSchedules]  = useState([])
  const [jobOrders,  setJobOrders]  = useState([])
  const [contacts,   setContacts]   = useState([])
  const [inquiries,  setInquiries]  = useState([])
  const [contracts,  setContracts]  = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [toast,     setToast]     = useState(null)
  const [calMonth, setCalMonth] = useState(null)
const [today, setToday] = useState(null)
  const [view,         setView]         = useState('calendar') // 'calendar' | 'list'
  const [showFullList,  setShowFullList]  = useState(false)
  const [listSearch,    setListSearch]    = useState('')
  const [viewSchedule,  setViewSchedule]  = useState(null)
  const [listPage,      setListPage]      = useState(1)
  const LIST_PER_PAGE = 3
 const [form, setForm] = useState({ start_time: '', end_time: '', description: '', worker_contact_id: '', client_contact_id: '', status_id: '11', _job_order_code: '', _job_order_id: '', duration_hours: '', priority: '' })

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const load = async () => {
    setLoading(true)
    try {
      const [schData, cData, joData, inqData, ctData] = await Promise.all([
        apiGet('/api/schedules/list.php',        { search, per_page: 100 }),
        apiGet('/api/contacts/list.php',         { per_page: 100 }),
        apiGet('/api/job-orders/list.php',       { per_page: 100 }),
        apiGet('/api/inquiries/list.php',        { per_page: 100 }),
        apiGet('/api/config/contract-types.php'),
      ])
      setSchedules(schData.schedules    || [])
      setContacts(cData.contacts        || [])
      setJobOrders(joData.job_orders    || [])
      setInquiries(inqData.inquiries    || [])
      setContracts(ctData.contract_types || [])
      console.log('SCHEDULES:', schData.schedules)
      console.log('JOB ORDERS:', joData.job_orders)
    } catch { showToast('Failed to load.', 'error') }
    setLoading(false)
  }

 useEffect(() => {
  if (fromJobOrder) {
    setForm(p => ({
      ...p,
      worker_contact_id: fromJobOrder.worker_contact_id || '',
      client_contact_id: fromJobOrder.client_contact_id || '',
      description:       fromJobOrder.description       || '',
      start_time: fromJobOrder.start_date ? `${fromJobOrder.start_date}T08:00` : '',
      end_time:   fromJobOrder.end_date   ? `${fromJobOrder.end_date}T17:00`   : '',
    }))
    setShowForm(true)
  }
}, [])

useEffect(() => {
  if (today && !fromJobOrder && showForm) {
    // Only pre-fill if today is from server (year must be >= 2026)
    if (today.getFullYear() < 2026) return
    const pad = n => String(n).padStart(2, '0')
    const y = today.getFullYear()
    const m = pad(today.getMonth() + 1)
    const d = pad(today.getDate())
    setForm(p => ({ ...p, start_time: `${y}-${m}-${d}T08:00`, end_time: `${y}-${m}-${d}T17:00` }))
  }
}, [today, showForm])
 useEffect(() => {
  fetch('http://localhost/skillconnect/backend/api/time/now.php')
    .then(r => r.json())
    .then(data => {
      if (data?.datetime) {
        const realToday = new Date(data.datetime)
        setToday(realToday)
        setCalMonth(realToday)
      } else {
        throw new Error('No datetime')
      }
    })
    .catch(() => {
      const fallback = new Date()
      setToday(fallback)
      setCalMonth(fallback)
    })
}, [])

useEffect(() => { load() }, [search])

  const clients = contacts.filter(c => c.type === 'client' || c.type === 'organisation')
  const workers = contacts.filter(c => c.type === 'worker')
  const SCHEDULE_STATUSES = [{id:11,l:'Pending'},{id:12,l:'Scheduled'},{id:13,l:'In Progress'},{id:14,l:'Complete'},{id:15,l:'Cancelled'}]

  const isWeekday = (dateStr) => {
    if (!dateStr) return true
    const d = new Date(dateStr)
    const day = d.getDay()
    return day !== 0 && day !== 6
  }

  const nextWeekday = (dateStr) => {
    const d = new Date(dateStr)
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
    return d
  }

  const getWeekdaysBetween = (startStr, endStr) => {
    const dates = []
    const cur = new Date(startStr)
    const end = new Date(endStr)
    while (cur <= end) {
      const day = cur.getDay()
      if (day !== 0 && day !== 6) dates.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }

  const pad = n => String(n).padStart(2, '0')

  const formatDateTime = (d, time = '08:00') => {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${time}`
  }

  const handleCreate = async () => {
    if (!form.start_time || !form.end_time) { showToast('Start and end time are required.', 'error'); return }

    // Block weekend start/end only for manual schedules.
    // From a job order, weekends are skipped automatically when the schedules are generated.
    if (!fromJobOrder) {
      if (!isWeekday(form.start_time)) { showToast('Start time cannot be on a weekend. Please select a weekday.', 'error'); return }
      if (!isWeekday(form.end_time))   { showToast('End time cannot be on a weekend. Please select a weekday.', 'error'); return }
    }

    const contractName = fromJobOrder?.contract_name || contracts.find(c => String(c.id) === String(form.contract_type_id))?.name || ''

    // Count weekdays between two dates (no limit)
    const countWeekdaysBetween = (start, end) => {
      const days = []
      const cur = new Date(start)
      while (cur <= end) {
        const d = cur.getDay()
        if (d !== 0 && d !== 6) days.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
      }
      return days
    }

    // Get exact schedules to create based on contract type and start date
    const getScheduleDays = (contractName, startDate, endDate) => {
      const fixedLimits = {
        '1 Day':  1,
        '2 Days': 2,
        '3 Days': 3,
        '1 Week': 5,
        '2 Weeks': 10,
      }
      if (fixedLimits[contractName] !== undefined) {
        // Count forward from startDate skipping weekends up to limit
        const limit = fixedLimits[contractName]
        const days = []
        const cur = new Date(startDate)
        while (days.length < limit) {
          const d = cur.getDay()
          if (d !== 0 && d !== 6) days.push(new Date(cur))
          cur.setDate(cur.getDate() + 1)
        }
        return days
      }
      // For 1 Month, 3 Months, 6 Months, 1 Year, 5 Years++ → all weekdays between start and end
      return countWeekdaysBetween(startDate, endDate)
    }

    try {
      if (!form.start_time) { showToast('Start time is required.', 'error'); return }

      const startDate = new Date(form.start_time.slice(0, 10))
      const endDate   = form.end_time ? new Date(form.end_time.slice(0, 10)) : new Date(startDate)
      const startTime = form.start_time.slice(11) || '08:00'
      const endTime   = form.end_time?.slice(11)  || '17:00'
      const days      = getScheduleDays(contractName, startDate, endDate)

      if (days.length === 0) { showToast('No weekdays found in the selected range.', 'error'); return }

      let lastScheduleId = null
      for (const day of days) {
        const dayStr   = `${day.getFullYear()}-${pad(day.getMonth()+1)}-${pad(day.getDate())}`
        const dayStart = `${dayStr} ${startTime}:00`
        const dayEnd   = `${dayStr} ${endTime}:00`
        const data = await apiPost('/api/schedules/create.php', {
          ...form,
          start_time: dayStart,
          end_time:   dayEnd,
        })
        if (!data.success) throw new Error(data.error)
        if (data.schedule?.id) lastScheduleId = data.schedule.id
      }

      if (fromJobOrder?.id && lastScheduleId) {
        try { await apiPut('/api/job-orders/update.php', { id: fromJobOrder.id, schedule_id: lastScheduleId }) }
        catch (e) { console.warn('Could not link schedule:', e) }
      }

      showToast(`${days.length} site visit schedule${days.length > 1 ? 's' : ''} created${fromJobOrder ? ' and linked!' : '!'}`)

      setShowForm(false)
      setForm({ start_time: '', end_time: '', description: '', worker_contact_id: '', client_contact_id: '', status_id: '11', _job_order_code: '', _job_order_id: '', duration_hours: '', priority: '' })
      navigate('/admin/scheduling', { replace: true, state: {} }); load()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const handleStatusToggle = async (sc) => {
    const next = sc.status === 'Complete' ? 11 : 14
    try { await apiPut('/api/schedules/update.php', { id: sc.id, status_id: next }); load() }
    catch { showToast('Update failed.', 'error') }
  }

  // ── Calendar helpers
 const year  = (calMonth || today || new Date()).getFullYear()
const month = (calMonth || today || new Date()).getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

const scheduledDays = !today ? new Set() : new Set(
  schedules.map(s => {
    const d = new Date(s.start_time)
    if (d.getFullYear() === year && d.getMonth() === month) return d.getDate()
    return null
  }).filter(Boolean)
)

  // Upcoming schedules sorted by date for sidebar
  const upcomingSchedules = [...schedules]
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 6)

  // Merge job orders into schedule rows for full list (join by worker_contact_id + client_contact_id)
  const filteredSchedules = highlightWorkerName
    ? schedules.filter(sc =>
        sc.worker_name === highlightWorkerName ||
        String(sc.worker_contact_id) === String(highlightWorkerId)
      )
    : schedules

  const fullList = filteredSchedules.map(sc => {
    // Match by client AND worker
    let linkedJO = jobOrders.find(jo =>
      sc.client_contact_id && sc.worker_contact_id &&
      String(jo.worker_contact_id) === String(sc.worker_contact_id) &&
      String(jo.client_contact_id) === String(sc.client_contact_id)
    )
    // Fallback: match by description
    if (!linkedJO && sc.description) {
      linkedJO = jobOrders.find(jo =>
        jo.description && jo.description.trim() === sc.description.trim()
      )
    }
    // Fallback: client only
    if (!linkedJO && sc.client_contact_id) {
      linkedJO = jobOrders.find(jo =>
        String(jo.client_contact_id) === String(sc.client_contact_id)
      )
    }
    // Fallback: worker only
    if (!linkedJO && sc.worker_contact_id) {
      linkedJO = jobOrders.find(jo =>
        String(jo.worker_contact_id) === String(sc.worker_contact_id)
      )
    }

    const linkedInquiry = linkedJO?.inquiry_id
      ? inquiries.find(inq => String(inq.id) === String(linkedJO.inquiry_id))
      : null

    // Project = inquiry reason (or fallback to jo description or sc description)
    const inquiryReason = linkedInquiry
      ? (linkedInquiry.reason === 'Other'
          ? (linkedInquiry.description || 'Other')
          : (linkedInquiry.reason || '—'))
      : (linkedJO?.description || sc.description || '—')

    // Job Order description = inquiry description (the actual text they typed)
    const joDescription = linkedInquiry
      ? (linkedInquiry.description || linkedInquiry.reason || '—')
      : (linkedJO?.description || '—')

    return {
      ...sc,
      job_order_code: linkedJO?.job_order_code || '—',
      jo_description: joDescription,
      inquiry_reason: inquiryReason,
    }
  })

  const colorMap = ['bg-blue-500','bg-emerald-500','bg-purple-500','bg-amber-500','bg-rose-500']
  const workerColor = (name = '') => colorMap[(name.charCodeAt(0) || 0) % colorMap.length]

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-gray-800 placeholder-gray-400"
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider"

  const getPriorityLimit = (contractName) => {
    if (!contractName) return 5
    if (contractName === '1 Day')   return 1
    if (contractName === '2 Days')  return 2
    if (contractName === '3 Days')  return 3
    return 5
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Scheduling for Site Visit</h1>
          <p className="text-sm text-gray-500 mt-0.5">Clients, Workers</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
          <Plus size={16} /> Add Schedule
        </button>
      </div>

      {/* Calendar + Sidebar Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
            <h3 className="font-semibold text-gray-800">{monthNames[month]} {year}</h3>
            <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {!today ? (
              <div className="col-span-7 flex items-center justify-center py-10 gap-2">
                <RefreshCw size={15} className="animate-spin text-emerald-400" />
                <span className="text-xs text-gray-400">Loading date...</span>
              </div>
            ) : (
              <>
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const isToday = today && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
                  const hasSchedule = scheduledDays.has(day)
                  return (
                    <div key={day} className="flex flex-col items-center py-1">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                        ${isToday ? 'bg-emerald-500 text-white font-bold' : 'text-gray-600 hover:bg-gray-100 cursor-pointer'}`}>
                        {day}
                      </div>
                      {hasSchedule && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5" />}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>{/* ← closes the Calendar lg:col-span-2 div */}

        {/* All Schedule Sidebar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="font-semibold text-gray-800">All Schedule</p>
            <button onClick={() => setShowFullList(true)} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1">
  Full List <ArrowRight size={11} />
</button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <RefreshCw size={15} className="animate-spin text-emerald-400" />
                <span className="text-xs text-gray-400">Loading...</span>
              </div>
            ) : upcomingSchedules.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">No schedules yet</div>
            ) : upcomingSchedules.map(sc => {
              const startDate = new Date(sc.start_time)
              const dateStr = `May ${startDate.getDate()}`
              const linkedJO = jobOrders.find(jo =>
                String(jo.worker_contact_id) === String(sc.worker_contact_id) ||
                String(jo.client_contact_id) === String(sc.client_contact_id)
              )
              return (
                <div key={sc.id} className="px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 truncate">{sc.description || linkedJO?.description || 'Schedule'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-bold text-emerald-600">{linkedJO?.job_order_code || sc.schedule_code}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400 truncate">{sc.worker_name || '—'}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                      {monthNames[startDate.getMonth()].slice(0,3)} {startDate.getDate()}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
        {/* ── Full List Modal ── */}
      {showFullList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFullList(false)} />
          <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Calendar size={16} className="text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">All Schedules</h3>
                  <p className="text-xs text-gray-400">{fullList.length} schedule{fullList.length !== 1 ? 's' : ''} total</p>
                </div>
              </div>
              <button onClick={() => setShowFullList(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-gray-400"
                  placeholder="Search schedules..."
                  value={listSearch}
                  onChange={e => { setListSearch(e.target.value); setListPage(1) }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Project', 'Job Order', 'Worker', 'Client', 'Start', 'End', 'Actions'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = fullList.filter(sc =>
                        !listSearch ||
                        sc.description?.toLowerCase().includes(listSearch.toLowerCase()) ||
                        sc.worker_name?.toLowerCase().includes(listSearch.toLowerCase()) ||
                        sc.client_name?.toLowerCase().includes(listSearch.toLowerCase()) ||
                        sc.job_order_code?.toLowerCase().includes(listSearch.toLowerCase()) ||
                        sc.schedule_code?.toLowerCase().includes(listSearch.toLowerCase())
                      )
                      const paginated = filtered.slice((listPage - 1) * LIST_PER_PAGE, listPage * LIST_PER_PAGE)
                      if (filtered.length === 0) return (
                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">No schedules found</td></tr>
                      )
                      return paginated.map(sc => {
                      const wName = sc.worker_name || '—'
                      const wInitials = wName !== '—' ? wName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '?'
                      const wColor = workerColor(wName)
                      return (
                        <tr key={sc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <p className="text-gray-700 font-medium text-sm">{sc.inquiry_reason}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-gray-500 text-sm">{sc.jo_description !== '—' ? sc.jo_description : '—'}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${wColor}`}>
                                {wInitials}
                              </div>
                              <span className="text-sm text-gray-700">{wName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 text-sm">{sc.client_name || '—'}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{sc.start_time?.slice(0,10) || '—'}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{sc.end_time?.slice(0,10) || '—'}</td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => { setViewSchedule(sc) }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-md hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                            >
                              <Eye size={11} />View
                            </button>
                          </td>
                        </tr>
                      )
                    })
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 pb-2">
              <Pagination
                page={listPage}
                total={fullList.filter(sc =>
                  !listSearch ||
                  sc.description?.toLowerCase().includes(listSearch.toLowerCase()) ||
                  sc.worker_name?.toLowerCase().includes(listSearch.toLowerCase()) ||
                  sc.client_name?.toLowerCase().includes(listSearch.toLowerCase()) ||
                  sc.job_order_code?.toLowerCase().includes(listSearch.toLowerCase()) ||
                  sc.schedule_code?.toLowerCase().includes(listSearch.toLowerCase())
                ).length}
                perPage={LIST_PER_PAGE}
                onChange={setListPage}
              />
            </div>
            <div className="p-5 border-t border-gray-100 bg-white flex justify-end">
              <button onClick={() => setShowFullList(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Schedule Modal */}
      {/* New Schedule Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl z-10 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
                  <Calendar size={16} className="text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">New Schedule</h3>
                  <p className="text-xs text-gray-400">Set the schedule details below</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scroll">
              {fromJobOrder && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Auto-filled from Job Order</p>
                  <p className="text-xs text-amber-700">{fromJobOrder.description || 'Job order details loaded below'}</p>
                </div>
              )}
              <div><label className={labelCls}>Worker</label>
                <select className={inputCls} value={form.worker_contact_id} onChange={e => {
                  const workerId = e.target.value
                  const linked = jobOrders.find(jo =>
                    String(jo.worker_contact_id) === String(workerId) &&
                    (form.client_contact_id ? String(jo.client_contact_id) === String(form.client_contact_id) : true)
                  )
                  setForm(p => ({
                    ...p,
                    worker_contact_id: workerId,
                    description:  linked?.description || p.description || '',
                    start_time:   linked?.start_date  ? `${linked.start_date}T08:00` : p.start_time,
                    end_time:     linked?.end_date    ? `${linked.end_date}T17:00`   : p.end_time,
                    _job_order_code: linked?.job_order_code || '',
                    _job_order_id:   linked?.id            || '',
                  }))
                }}>
                  <option value="">-- Select worker --</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select></div>
              <div><label className={labelCls}>Client / Organisation</label>
                <select className={inputCls} value={form.client_contact_id} onChange={e => {
                  const clientId = e.target.value
                  const linked = jobOrders.find(jo =>
                    String(jo.client_contact_id) === String(clientId) &&
                    (form.worker_contact_id ? String(jo.worker_contact_id) === String(form.worker_contact_id) : true)
                  )
                  setForm(p => ({
                    ...p,
                    client_contact_id: clientId,
                    description:  linked?.description || p.description || '',
                    start_time:   linked?.start_date  ? `${linked.start_date}T08:00` : p.start_time,
                    end_time:     linked?.end_date    ? `${linked.end_date}T17:00`   : p.end_time,
                    _job_order_code: linked?.job_order_code || '',
                    _job_order_id:   linked?.id            || '',
                  }))
                }}>
                  <option value="">-- Select client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select></div>
              {form._job_order_code && (
                <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                  <ClipboardList size={14} className="text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">Linked Job Order</p>
                    <p className="text-xs text-emerald-600">{form._job_order_code}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start Time</label>
                  <input
  type="datetime-local"
  className={inputCls}
  value={form.start_time}
  min={fromJobOrder
  ? fromJobOrder.is_long_contract
    ? `${fromJobOrder.jo_start_date}T00:00`
    : `${fromJobOrder.start_date}T00:00`
  : today
    ? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}T00:00`
    : undefined}
                    max={fromJobOrder?.is_long_contract
                      ? `${fromJobOrder.jo_end_date}T23:59`
                      : undefined}
                    onChange={e => {
                      const newStart = e.target.value
                      if (form.duration_hours && newStart) {
                        const start = new Date(newStart)
                        start.setHours(start.getHours() + Number(form.duration_hours))
                        const pad = n => String(n).padStart(2, '0')
                        const end = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
                        f('end_time', end)
                      }
                      if (fromJobOrder && !fromJobOrder.is_long_contract) {
                        const lockedDate = fromJobOrder.start_date
                        const pickedTime = newStart?.slice(11) || '08:00'
                        f('start_time', `${lockedDate}T${pickedTime}`)
                      } else if (fromJobOrder?.is_long_contract) {
                        // Allow any date within the JO range, auto-set end to start + 3 days
                        const newStart = e.target.value
                        f('start_time', newStart)
                        if (newStart) {
                          const startD = new Date(newStart)
                          startD.setDate(startD.getDate() + 3)
                          const autoEnd = startD.toISOString().slice(0, 10)
                          f('end_time', `${autoEnd}T17:00`)
                        }
                      } else {
                        f('start_time', e.target.value)
                      }
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>End Time</label>
                  <input
                    type="datetime-local"
                    className={`${inputCls} ${fromJobOrder?.is_long_contract ? 'bg-gray-50 text-gray-500' : ''}`}
                    value={form.end_time}
                    readOnly={!!fromJobOrder?.is_long_contract}
                    min={fromJobOrder?.is_long_contract
  ? form.start_time?.slice(0, 10)
    ? `${form.start_time.slice(0, 10)}T00:00`
    : undefined
  : fromJobOrder
    ? `${fromJobOrder.end_date}T00:00`
    : today
      ? `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}T00:00`
      : undefined}
                    max={fromJobOrder?.is_long_contract
                      ? `${fromJobOrder.jo_end_date}T23:59`
                      : undefined}
                    onChange={e => {
                      if (fromJobOrder && !fromJobOrder.is_long_contract) {
                        const lockedDate = fromJobOrder.end_date
                        const pickedTime = e.target.value?.slice(11) || '17:00'
                        f('end_time', `${lockedDate}T${pickedTime}`)
                      } else if (!fromJobOrder?.is_long_contract) {
                        f('end_time', e.target.value)
                      }
                    }}
                  />
                </div>
              </div>

              {/* Weekend warnings */}
              {(!fromJobOrder && form.start_time && !isWeekday(form.start_time)) && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-600 font-medium">Start time is on a weekend — please select a weekday (Mon–Fri)</span>
                </div>
              )}
              {(!fromJobOrder && form.end_time && !isWeekday(form.end_time)) && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-600 font-medium">End time is on a weekend — please select a weekday (Mon–Fri)</span>
                </div>
              )}

              {/* Contract type hint */}
              {fromJobOrder?.is_long_contract && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                  <span className="text-xs text-amber-600">
                    Long contract ({fromJobOrder.contract_name}) — this schedule is for a <span className="font-semibold">Site Visit</span>. You can adjust the start date within the job order period.
                  </span>
                </div>
              )}
            {/* Schedule creation preview */}
              {(() => {
                const cn = fromJobOrder?.contract_name || contracts.find(c => String(c.id) === String(form.contract_type_id))?.name || ''
                if (!cn || !form.start_time) return null
                const fixedLimits = { '1 Day': 1, '2 Days': 2, '3 Days': 3, '1 Week': 5, '2 Weeks': 10 }
                let previewCount = 0
                if (fixedLimits[cn] !== undefined) {
                  previewCount = fixedLimits[cn]
                } else if (form.end_time) {
                  const s = new Date(form.start_time.slice(0, 10))
                  const e = new Date(form.end_time.slice(0, 10))
                  const cur = new Date(s)
                  while (cur <= e) {
                    const d = cur.getDay()
                    if (d !== 0 && d !== 6) previewCount++
                    cur.setDate(cur.getDate() + 1)
                  }
                }
                if (previewCount === 0) return null
                return (
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                    <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-emerald-700 font-medium">
                      Contract: <span className="font-bold">{cn}</span> — will create <span className="font-bold">{previewCount}</span> site visit schedule{previewCount > 1 ? 's' : ''} (Mon–Fri only, skipping weekends)
                    </span>
                  </div>
                )
              })()}

              {/* Duration picker */}
              <div>
                <label className={labelCls}>Duration (Max Hours)</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                  {form.duration_hours === 'custom' ? (
                    <input
                      type="number"
                      min="1"
                      max="999"
                      placeholder="Enter hours"
                      className={inputCls}
                      autoFocus
                      onChange={e => {
                        const val = e.target.value
                        if (!val) return
                        if (form.start_time) {
                          const start = new Date(form.start_time)
                          start.setHours(start.getHours() + Number(val))
                          const pad = n => String(n).padStart(2, '0')
                          const end = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
                          f('end_time', end)
                        }
                        f('duration_hours', val)
                      }}
                      onBlur={e => { if (!e.target.value) f('duration_hours', '') }}
                    />
                  ) : (
                    <select
                      className={inputCls}
                      value={form.duration_hours}
                      onChange={e => {
                        const val = e.target.value
                        if (val === 'custom') { f('duration_hours', 'custom'); return }
                        f('duration_hours', val)
                        if (val && form.start_time) {
                          const start = new Date(form.start_time)
                          start.setHours(start.getHours() + Number(val))
                          const pad = n => String(n).padStart(2, '0')
                          const end = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`
                          f('end_time', end)
                        }
                      }}
                    >
                      <option value="">-- Select hours --</option>
                      {[1,2,3,4,5,6,7,8,9,10,12,16,24].map(h => (
                        <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>
                      ))}
                      <option value="custom">Custom</option>
                    </select>
                  )}
                </div>
                  {/* Priority Checkboxes */}
                  {(() => {
                    const priorityLimit = getPriorityLimit(fromJobOrder?.contract_name)
                    const contractName = fromJobOrder?.contract_name || contracts.find(c => String(c.id) === String(form.contract_type_id))?.name || ''
                    const isWeeklyOrLonger = ['1 Week','2 Weeks','1 Month','3 Months','6 Months','1 Year','5 Years ++'].includes(contractName)
                    const isDailyContract  = ['1 Day','2 Days','3 Days'].includes(contractName)
                    const priorities = isDailyContract || isWeeklyOrLonger ? [
                      { label: isWeeklyOrLonger ? 'Every Mon' : 'Mon' },
                      { label: isWeeklyOrLonger ? 'Every Tue' : 'Tue' },
                      { label: isWeeklyOrLonger ? 'Every Wed' : 'Wed' },
                      { label: isWeeklyOrLonger ? 'Every Thu' : 'Thu' },
                      { label: isWeeklyOrLonger ? 'Every Fri' : 'Fri' },
                    ] : [
                      { label: 'Mon' },
                      { label: 'Tue' },
                      { label: 'Wed' },
                      { label: 'Thu' },
                      { label: 'Fri' },
                    ]
                    const selectedPriorities = form.priority ? form.priority.split(',').filter(Boolean) : []
                  const handlePriorityChange = (label) => {
                      const isChecked = selectedPriorities.includes(label)
                      if (isChecked) {
                        // Uncheck: just remove this one
                        f('priority', selectedPriorities.filter(p => p !== label).join(','))
                      } else {
                        // Check: only allow if under the limit
                        if (selectedPriorities.length < priorityLimit) {
                          f('priority', [...selectedPriorities, label].join(','))
                        }
                      }
                    }
                    return (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {priorities.map(({ label, color, ring }, idx) => {
                          const isChecked = selectedPriorities.includes(label)
                          const isClickable = isChecked || selectedPriorities.length < priorityLimit
                          return (
                            <label key={label} className={`flex flex-col items-center gap-1 ${isClickable ? 'cursor-pointer group' : 'cursor-default'}`}>
                              <input
                                type="checkbox"
                                value={label}
                                className={`w-3.5 h-3.5 ${ring} ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                checked={isChecked}
                                onChange={() => handlePriorityChange(label)}
                              />
                              <span className="text-[9px] font-semibold text-gray-800">{label}</span>
                            </label>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
                {form.duration_hours && form.duration_hours !== 'custom' && <p className="text-[10px] text-emerald-600 mt-1 font-medium">Max {form.duration_hours} hour{Number(form.duration_hours) > 1 ? 's' : ''} — end time auto-calculated</p>}
              </div>

              <div><label className={labelCls}>Description</label><textarea className={`${inputCls} resize-none bg-gray-50 text-gray-500 cursor-not-allowed`} rows={3} value={form.description} readOnly /></div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors">Create Schedule</button>
            </div>
          </div>
        </div>
      )}
      {/* ── View Schedule Modal ── */}
      {viewSchedule && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewSchedule(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">Schedule Details</h3>
                  <span className="text-xs text-gray-400">{viewSchedule.schedule_code}</span>
                </div>
              </div>
              <button onClick={() => setViewSchedule(null)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scroll space-y-0">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Schedule Details</p>
              {[
                { label: 'Project',     value: viewSchedule.inquiry_reason },
                { label: 'Description', value: viewSchedule.jo_description !== '—' ? viewSchedule.jo_description : null },
                { label: 'Job Order',   value: viewSchedule.job_order_code !== '—' ? viewSchedule.job_order_code : null },
                { label: 'Worker',      value: viewSchedule.worker_name },
                { label: 'Client',      value: viewSchedule.client_name },
                { label: 'Start',       value: viewSchedule.start_time?.slice(0, 16).replace('T', ' ') },
                { label: 'End',         value: viewSchedule.end_time?.slice(0, 16).replace('T', ' ') },
              ].filter(({ value }) => value).map(({ label, value }) => (
                <div key={label} className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400 w-28 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-700 break-all">{value || '—'}</span>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-100 bg-white">
              <button onClick={() => setViewSchedule(null)} className="w-full px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}