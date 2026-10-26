import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, ListChecks, MessageSquare, UserCircle } from 'lucide-react'

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
  red: '#dc2626', redLight: '#fee2e2',
  card: '#ffffff', border: '#e5e7eb',
  text: '#111827', textMid: '#374151', textSub: '#6b7280',
}

function getCustomerInfo() {
  try { return JSON.parse(localStorage.getItem('sc_user') || '{}') }
  catch { return {} }
}
// ── Top Navigation Bar ─────────────────────────────────────────
export default function TopNav() {
  const navigate      = useNavigate()
  const location      = useLocation()
  const customer      = getCustomerInfo()
  const initial       = (customer?.first_name?.[0] || customer?.name?.[0] || 'U').toUpperCase()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef   = useRef(null)
  const isMobile      = useWindowWidth() < 640

   const links = [
    { path: '/customer/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
    { path: '/customer/job-orders', label: 'My Job Order',  icon: ListChecks      },
    { path: '/customer/inquiries',  label: 'My Inquiries',  icon: MessageSquare   },
  ]

  const isActive = (path) => location.pathname.startsWith(path)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('sc_user')
    localStorage.removeItem('sc_token')
    navigate('/login')
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#fff', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
      padding: isMobile ? '0 12px' : '0 24px', height: 52,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: isMobile ? 0 : 32 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: C.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 11, color: '#fff', letterSpacing: '-0.5px',
        }}>EB</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>SkillConnect</div>
          <div style={{ fontSize: 9, color: C.textSub, lineHeight: 1 }}>Client App</div>
        </div>
      </div>

      {/* Spacer to push content right */}
<div style={{ flex: 1 }} />

{/* Nav Links — icon-only on mobile */}
<div style={{ display: 'flex', gap: isMobile ? 2 : 4, marginRight: isMobile ? 8 : 16 }}>
  {links.map(({ path, label, icon: Icon }) => (
    <button key={path} onClick={() => navigate(path)} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: isMobile ? '6px 8px' : '5px 14px',
      borderRadius: 6, border: 'none', cursor: 'pointer',
      fontSize: 12, fontWeight: 600,
      background: isActive(path) ? C.green : 'transparent',
      color: isActive(path) ? '#fff' : C.textMid,
      transition: 'all 0.15s',
    }}>
      <Icon size={13} />
      {!isMobile && label}
    </button>
  ))}
</div>

{/* Right: Customer label + Avatar */}
<div ref={dropdownRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setDropdownOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            padding: '4px 6px', borderRadius: 8, transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {!isMobile && <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>Client User</span>}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: C.green,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 12, color: '#fff',
          }}>{initial}</div>
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 200, overflow: 'hidden', zIndex: 999,
          }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid #f3f4f6` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                {customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}`.trim() : 'Client User'}
              </div>
              <div style={{ fontSize: 11, color: C.textSub, marginTop: 1 }}>
                {customer?.email || 'Client Account'}
              </div>
            </div>
            <div
              onClick={() => { setDropdownOpen(false); navigate('/customer/profile') }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: C.textMid, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <UserCircle size={15} color={C.textSub} />
              My Profile
            </div>
            <div style={{ height: 1, background: '#f3f4f6' }} />
            <div
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontSize: 13, color: C.red, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = C.redLight}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}