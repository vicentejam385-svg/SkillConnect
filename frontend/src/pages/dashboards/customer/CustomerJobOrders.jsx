import { useState, useEffect } from 'react'
import {
  RefreshCw, ClipboardList, MapPin, Calendar, Clock,
  DollarSign, X, CheckCircle, AlertCircle, Image as ImageIcon, Flag,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

const HOST = 'https://saddlebrown-swan-877763.hostingersite.com'
const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  return isNaN(d) ? s : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Responsive Hook ────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

// ── Design Tokens ──────────────────────────────────────────────
const C = {
  green: '#16a34a', greenLight: '#dcfce7', greenDark: '#15803d',
  blue: '#2563eb', blueLight: '#dbeafe',
  purpleLight: '#f3e8ff',
  red: '#dc2626', redLight: '#fee2e2',
  cyanLight: '#cffafe',
  bg: '#f3f4f6', card: '#ffffff', border: '#e5e7eb',
  text: '#111827', textMid: '#374151', textSub: '#6b7280', textFaint: '#9ca3af',
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      background: toast.type === 'success' ? C.greenLight : C.redLight,
      color:      toast.type === 'success' ? C.greenDark  : C.red,
      border:     `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
    }}>
      {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {toast.msg}
    </div>
  )
}

const STATUS_COLORS = {
  'Pending':      { bg: '#fef9c3', color: '#854d0e',  border: '#fde047' },
  'Active':       { bg: C.greenLight, color: C.greenDark, border: '#86efac' },
  'Complete':     { bg: C.greenLight, color: C.greenDark, border: '#86efac' },
  'On Hold':      { bg: '#ffedd5', color: '#9a3412',  border: '#fdba74' },
  'Under Review': { bg: C.purpleLight, color: '#6b21a8', border: '#d8b4fe' },
  'Scheduled':    { bg: C.cyanLight, color: '#164e63', border: '#67e8f9' },
  'In Progress':  { bg: C.blueLight, color: '#1e40af', border: '#93c5fd' },
  'Cancelled':    { bg: C.redLight, color: C.red, border: '#fca5a5' },
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.02em', background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {status || '—'}
    </span>
  )
}
export default function CustomerJobOrdersPage() {
  const isMobile       = useWindowWidth() < 640
  const [jobOrders,    setJobOrders]    = useState([])
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [selected,     setSelected]     = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      // The server only returns this customer's own job orders
      const data = await apiGet('/api/job-orders/list.php', { per_page: 200, mine: 1 })
      setJobOrders(data.job_orders || [])
    } catch {
      showToast('Failed to load job orders.', 'error')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = jobOrders.filter(jo => {
    const matchSearch = !search ||
      jo.job_order_code?.toLowerCase().includes(search.toLowerCase()) ||
      jo.description?.toLowerCase().includes(search.toLowerCase()) ||
      jo.worker_name?.toLowerCase().includes(search.toLowerCase()) ||
      jo.contract_type?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || jo.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: C.text, margin: 0 }}>My Job Orders</h2>
        <p style={{ fontSize: 12, color: C.textSub, margin: '3px 0 0' }}>Track your active and past projects</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12, color: C.textSub }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading your orders...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: C.textSub }}>
          <ClipboardList size={36} style={{ color: C.textFaint, margin: '0 auto 12px', display: 'block' }} />
          No job orders found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(jo => (
            <div key={jo.id} style={{
              background: C.card, borderRadius: 12,
              border: `1px solid ${C.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: '18px 22px',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#d1d5db' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = C.border }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{jo.job_order_code}</span>
                    <StatusBadge status={jo.status} />
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub, fontWeight: 400 }}>
                    {jo.description || jo.contract_type || 'Construction Project'}
                  </div>
                </div>

                <button
                  onClick={() => setSelected(jo)}
                  style={{
                    padding: '5px 12px', borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: '#fff', fontSize: 11, fontWeight: 600, color: C.green,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.greenLight}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  View Details
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginBottom: 2, marginTop: 8 }}>
                {(jo.client_address || jo.location) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <MapPin size={11} color={C.textFaint} />
                    {jo.client_address || jo.location}
                  </div>
                )}
                {jo.start_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <Calendar size={11} color={C.textFaint} />
                    <span style={{ fontSize: 10, color: C.textFaint }}>Start Date</span>
                    <span>{jo.start_date}</span>
                  </div>
                )}
                {jo.end_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <Clock size={11} color={C.textFaint} />
                    <span style={{ fontSize: 10, color: C.textFaint }}>Completion</span>
                    <span>{jo.end_date}</span>
                  </div>
                )}
                {jo.budget && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <DollarSign size={11} color={C.textFaint} />
                    <span style={{ fontSize: 10, color: C.textFaint }}>Budget</span>
                    <span>{Number(jo.budget).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {jo.finished_at && jo.status === 'In Progress' && (
                <ConfirmCard jo={jo} isMobile={isMobile} onDone={(msg, type) => { showToast(msg, type); if (type !== 'error') load() }} />
              )}
              {!jo.finished_at && jo.issue_note && jo.status === 'In Progress' && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
                  Still to do: “{jo.issue_note}”. The worker is working on it.
                </div>
              )}
              {jo.status === 'Complete' && jo.completed_at && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.greenDark }}>
                  <CheckCircle size={13} /> Completed on {fmtDate(jo.completed_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal - FULLSCREEN */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.bg, overflowY: 'auto' }}>
          <div style={{ background: C.card, minHeight: '100vh', maxWidth: 900, margin: '0 auto', boxShadow: '0 0 40px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{selected.job_order_code}</span>
                  <StatusBadge status={selected.status} />
                </div>
                <p style={{ fontSize: 11, color: C.textSub, margin: 0 }}>Job Order Details</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.textSub, padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '8px 0' }}>
              {[
                { label: 'Description',     value: selected.description    },
                { label: 'Contract Type',   value: selected.contract_type  },
                { label: 'Assigned Worker', value: selected.worker_name    },
                { label: 'Start Date',      value: selected.start_date     },
                { label: 'End Date',        value: selected.end_date       },
                { label: 'Inquiry Ref',     value: selected.inquiry_code   },
                { label: 'Created',         value: selected.created_at?.slice(0, 10) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 16, padding: '12px 24px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.textSub, width: 130, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{value || '—'}</span>
                </div>
              ))}
            </div>

            <ProgressPhotos jobId={selected.id} />

            <div style={{ padding: '16px 24px' }}>
              <button onClick={() => setSelected(null)} style={{
                width: '100%', padding: '10px', borderRadius: 8,
                border: `1px solid ${C.border}`, background: '#fff',
                fontSize: 13, fontWeight: 600, color: C.textMid, cursor: 'pointer',
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
// ── Confirm the finished work ──────────────────────────────────
function ConfirmCard({ jo, isMobile, onDone }) {
  const [mode, setMode] = useState(null)   // null | 'confirm' | 'issue'
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (action) => {
    if (action === 'issue' && !note.trim()) return onDone('Tell us what still needs to be done.', 'error')
    setBusy(true)
    try {
      const res = await apiPost('/api/job-orders/confirm.php', { id: jo.id, action, note: note.trim() })
      if (res?.success === false) throw new Error(res.error)
      onDone(res?.message || 'Thank you!', 'success')
    } catch (e) { onDone(e.message || 'Something went wrong. Please try again.', 'error') }
    setBusy(false)
  }

  const btn = (primary) => ({
    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
    border: primary ? 'none' : `1px solid ${C.border}`, background: primary ? C.green : '#fff',
    color: primary ? '#fff' : C.textMid, opacity: busy ? 0.7 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 6,
  })

  return (
    <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Flag size={16} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>The worker finished this job on {fmtDate(jo.finished_at)}</div>
          {jo.finish_note && <div style={{ fontSize: 12, color: '#047857', marginTop: 3 }}>“{jo.finish_note}”</div>}
          {jo.finish_photo_path && (
            <a href={`${HOST}/${jo.finish_photo_path}`} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 12, fontWeight: 600, color: C.greenDark }}>
              <ImageIcon size={13} /> View final photo
            </a>
          )}
          <div style={{ fontSize: 12, color: '#047857', marginTop: 6 }}>Please check the work. Is everything done?</div>
        </div>
      </div>

      {mode === 'issue' ? (
        <div style={{ marginTop: 12 }}>
          <textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)}
            placeholder="What still needs to be done?"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box', resize: 'none', background: '#fff' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => send('issue')} disabled={busy} style={btn(true)}>{busy ? 'Sending…' : 'Send to the worker'}</button>
            <button onClick={() => { setMode(null); setNote('') }} disabled={busy} style={btn(false)}>Cancel</button>
          </div>
        </div>
      ) : mode === 'confirm' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>Confirm that the job is complete?</span>
          <button onClick={() => send('confirm')} disabled={busy} style={btn(true)}><CheckCircle size={13} />{busy ? 'Saving…' : 'Yes, confirm'}</button>
          <button onClick={() => setMode(null)} disabled={busy} style={btn(false)}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <button onClick={() => setMode('confirm')} style={{ ...btn(true), justifyContent: 'center' }}><CheckCircle size={13} />Confirm it's done</button>
          <button onClick={() => setMode('issue')} style={{ ...btn(false), justifyContent: 'center' }}>Report a problem</button>
        </div>
      )}
    </div>
  )
}

// ── Progress photos in the details view ────────────────────────
function ProgressPhotos({ jobId }) {
  const [photos, setPhotos] = useState(null)
  useEffect(() => {
    let alive = true
    apiGet('/api/job-orders/get-progress.php', { job_order_id: jobId })
      .then(d => { if (alive) setPhotos(d.photos || []) })
      .catch(() => { if (alive) setPhotos([]) })
    return () => { alive = false }
  }, [jobId])

  if (!photos || photos.length === 0) return null
  return (
    <div style={{ padding: '16px 24px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Progress photos ({photos.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
        {photos.map(p => (
          <a key={p.id} href={`${HOST}/${p.file_path}`} target="_blank" rel="noreferrer"
            style={{ position: 'relative', display: 'block', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            <img src={`${HOST}/${p.file_path}`} alt={`Progress ${p.upload_date}`} style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }} />
            <span style={{ position: 'absolute', left: 6, bottom: 6, padding: '1px 6px', borderRadius: 4, background: 'rgba(15,23,42,.65)', color: '#fff', fontSize: 10, fontWeight: 600 }}>
              {p.is_final ? 'Final · ' : ''}{fmtDate(p.upload_date)}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}