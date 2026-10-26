import { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle, AlertCircle, Calendar, X,
  ChevronRight, Clock
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet } from '../../../utils/api'

// ── Helpers ────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 font-body text-sm border
      ${toast.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {toast.msg}
    </div>
  )
}
// ── MY SCHEDULES ───────────────────────────────────────────────
export default function MySchedules() {
  const { user }     = useAuth()
  const [toast,       setToast]      = useState(null)
  const [schedules,   setSchedules]  = useState([])
  const [loading,     setLoading]    = useState(true)
  const [viewSchedule, setViewSchedule] = useState(null)
const [rescheduleJob, setRescheduleJob] = useState(null)
const [rescheduleForm, setRescheduleForm] = useState({ start_time: '', end_time: '', reason: '' })
const [rescheduleSaving, setRescheduleSaving] = useState(false)
  const [schPage,      setSchPage]      = useState(1)
  const SCH_PER_PAGE = 3
  

  useEffect(() => {
    apiGet('/api/workers/list.php')
      .then(wData => {
        const worker = (wData.workers || []).find(w => w.id === user?.id)
        if (!worker) return setSchedules([])
        return apiGet('/api/schedules/list.php', { per_page: 100 }).then(d => {
          const mine = (d.schedules || []).filter(sc => sc.worker_contact_code === worker.contact_code)
          setSchedules(mine)
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <Toast toast={toast} />
      <div>
        <h2 className="font-bold text-xl text-slate-800 tracking-tight">Schedule</h2>
        <p className="text-slate-400 text-sm mt-0.5">Your upcoming assignments</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <RefreshCw size={18} className="animate-spin text-emerald-500" />
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <Calendar size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">No schedules assigned</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const totalSchPages = Math.ceil(schedules.length / SCH_PER_PAGE)
            const pagedSch = schedules.slice((schPage - 1) * SCH_PER_PAGE, schPage * SCH_PER_PAGE)
            return (
              <>
              {pagedSch.map(sc => (
            <div key={sc.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
  <span className="font-mono text-sm font-bold text-slate-700">{sc.schedule_code}</span>
</div>
                  <p className="text-sm text-slate-500">{sc.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
  <button
    onClick={() => setViewSchedule(sc)}
    className="px-3 py-1 text-xs bg-white border border-slate-200 text-slate-600 rounded font-medium hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
    View Details
  </button>
  <button
    onClick={() => {
      setRescheduleJob(sc)
      setRescheduleForm({
        start_time: sc.start_time?.slice(0, 16) || '',
        end_time: sc.end_time?.slice(0, 16) || '',
        reason: ''
      })
    }}
    className="px-3 py-1 text-xs bg-amber-500 text-white rounded font-medium hover:bg-amber-600 transition-colors">
    Reschedule
  </button>
</div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <Clock size={13} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Start Time</p>
                    <p className="text-sm font-medium text-slate-700">{sc.start_time?.slice(0, 16).replace('T', ' ') || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={13} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">End Time</p>
                    <p className="text-sm font-medium text-slate-700">{sc.end_time?.slice(0, 16).replace('T', ' ') || '—'}</p>
                  </div>
                </div>
                {sc.client_name && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Client</p>
                    <p className="text-sm font-medium text-slate-700">{sc.client_name}</p>
                  </div>
                )}
              </div>
            </div>
          ))}

              {/* Pagination */}
              {totalSchPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-400">
                    Showing {(schPage - 1) * SCH_PER_PAGE + 1}–{Math.min(schPage * SCH_PER_PAGE, schedules.length)} of {schedules.length} schedules
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSchPage(p => Math.max(1, p - 1))}
                      disabled={schPage === 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={13} className="rotate-180" />
                    </button>
                    {Array.from({ length: totalSchPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setSchPage(p)}
                        className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-medium transition-colors
                          ${schPage === p
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setSchPage(p => Math.min(totalSchPages, p + 1))}
                      disabled={schPage === totalSchPages}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
              </>
            )
          })()}
        </div>
      )}
      {/* ── Reschedule Modal ── */}
      {rescheduleJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Request Reschedule</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{rescheduleJob.schedule_code}</p>
              </div>
              <button onClick={() => setRescheduleJob(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">New Start Time</label>
                <input
                  type="datetime-local"
                  className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 bg-slate-50/60"
                  value={rescheduleForm.start_time}
                  onChange={e => setRescheduleForm(p => ({ ...p, start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">New End Time</label>
                <input
                  type="datetime-local"
                  className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 bg-slate-50/60"
                  value={rescheduleForm.end_time}
                  onChange={e => setRescheduleForm(p => ({ ...p, end_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Reason <span className="text-red-400">*</span></label>
                <textarea
                  rows={3}
                  placeholder="Explain why you need to reschedule..."
                  className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 bg-slate-50/60 resize-none"
                  value={rescheduleForm.reason}
                  onChange={e => setRescheduleForm(p => ({ ...p, reason: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setRescheduleJob(null)}
                  className="flex-1 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button
                  disabled={rescheduleSaving}
                  onClick={async () => {
                    if (!rescheduleForm.start_time) { alert('Please set a new start time.'); return }
                    if (!rescheduleForm.end_time)   { alert('Please set a new end time.'); return }
                    if (!rescheduleForm.reason.trim()) { alert('Please provide a reason.'); return }
                    setRescheduleSaving(true)
                    try {
                      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
                      const res = await fetch(`http://localhost/skillconnect/backend/api/schedules/reschedule-request.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          schedule_id: rescheduleJob.id,
                          schedule_code: rescheduleJob.schedule_code,
                          new_start_time: rescheduleForm.start_time,
                          new_end_time: rescheduleForm.end_time,
                          reason: rescheduleForm.reason,
                        }),
                      })
                      const data = await res.json()
                      if (!data.success) throw new Error(data.error || 'Request failed')
                      setRescheduleJob(null)
                      setToast({ msg: 'Reschedule request sent successfully!', type: 'success' })
                      setTimeout(() => setToast(null), 3500)
                    } catch (err) {
                      setToast({ msg: 'Failed to send request: ' + err.message, type: 'error' })
                      setTimeout(() => setToast(null), 3500)
                    }
                    setRescheduleSaving(false)
                  }}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {rescheduleSaving ? <RefreshCw size={13} className="animate-spin" /> : null}
                  {rescheduleSaving ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    {/* ── View Schedule Modal ── */}
      {viewSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{viewSchedule.schedule_code}</h2>
                <p className="text-sm text-slate-400">{viewSchedule.description || 'No description'}</p>
              </div>
              <button onClick={() => setViewSchedule(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: 'Client',      value: viewSchedule.client_name },
                { label: 'Description', value: viewSchedule.description },
                { label: 'Start Time',  value: viewSchedule.start_time?.slice(0, 16).replace('T', ' ') },
                { label: 'End Time',    value: viewSchedule.end_time?.slice(0, 16).replace('T', ' ')   },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
                </div>
              ))}
              <div className="pt-2">
                <button onClick={() => setViewSchedule(null)}
                  className="w-full py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}