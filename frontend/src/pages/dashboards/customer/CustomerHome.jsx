import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, CheckCircle, Clock, Zap, RefreshCw } from 'lucide-react'
import { apiGet } from '../../../utils/api'

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
  purple: '#9333ea', purpleLight: '#f3e8ff',
  red: '#dc2626', redLight: '#fee2e2',
  cyanLight: '#cffafe',
  card: '#ffffff', border: '#e5e7eb',
  text: '#111827', textSub: '#6b7280', textFaint: '#9ca3af',
}

function getCustomerContactId() {
  try { return JSON.parse(localStorage.getItem('sc_user') || '{}')?.contact_id || null }
  catch { return null }
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
// ── Stats Card ─────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, iconColor }) {
  return (
    <div style={{
      background: C.card, borderRadius: 10, padding: '16px 18px',
      border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div>
        <div style={{ fontSize: 11, color: C.textSub, fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color={iconColor} strokeWidth={2.2} />
      </div>
    </div>
  )
}

// ── Customer Dashboard Home ────────────────────────────────────
export default function CustomerHome() {
  const navigate  = useNavigate()
  const contactId = getCustomerContactId()
  const isMobile  = useWindowWidth() < 640
  const [jobOrders, setJobOrders] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const joData = await apiGet('/api/job-orders/list.php', { per_page: 100 })
        const all  = joData.job_orders || []
        const mine = contactId
          ? all.filter(jo => String(jo.client_contact_id) === String(contactId))
          : all
        setJobOrders(mine)
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const total     = jobOrders.length
  const active    = jobOrders.filter(jo => ['Active', 'In Progress', 'Scheduled'].includes(jo.status)).length
  const completed = jobOrders.filter(jo => jo.status === 'Complete').length
  const pending   = jobOrders.filter(jo => jo.status === 'Pending').length
  const recent    = [...jobOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6)

  // Matches screenshot stat order: Total Projects | In Projects | Completed | Too Projects
  const stats = [
  { label: 'Total Projects', value: total,     icon: ClipboardList, iconBg: C.blueLight,   iconColor: C.blue   },
  { label: 'In Progress',    value: active,    icon: Zap,           iconBg: C.greenLight,  iconColor: C.green  },
  { label: 'Completed',      value: completed, icon: CheckCircle,   iconBg: C.greenLight,  iconColor: C.green  },
 { label: 'Pending', value: pending, icon: Clock, iconBg: C.purpleLight, iconColor: C.purple },
]

  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      {/* Stats Row — 2-col on mobile, 4-col on desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Recent Activity Card */}
      <div style={{
        background: C.card, borderRadius: 12,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Recent Activity</h3>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.textSub }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            Loading...
          </div>
        ) : recent.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.textSub }}>
            <ClipboardList size={32} style={{ marginBottom: 8, color: C.textFaint, display: 'block', margin: '0 auto 8px' }} />
            No job orders yet.
          </div>
        ) : (
          <div>
            {recent.map((jo, i) => (
              <div key={jo.id}
                onClick={() => navigate('/customer/job-orders')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 22px',
                  borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Green icon box */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8, background: C.greenLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <ClipboardList size={15} color={C.green} />
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                    {jo.job_order_code} – {jo.description || jo.contract_type || 'Construction'}
                  </div>
                  <div style={{ fontSize: 11, color: C.textSub }}>
                    {jo.client_address || jo.location || 'Parañaque City'}
                  </div>
                </div>

                {/* Status badge — right aligned */}
                <StatusBadge status={jo.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}