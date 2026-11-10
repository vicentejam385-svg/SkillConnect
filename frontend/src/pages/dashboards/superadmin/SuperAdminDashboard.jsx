import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, HardHat, UserRound,
  Key, Eye, EyeOff,
  RefreshCw, CheckCircle,
  ChevronDown, LogOut, ClipboardList, Menu, X
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { validate } from '../../../utils/validators'

import SAHome from './SAHome'
import AdminUsersPage from './AdminUsersPage'
import WorkerAccessPage from './WorkerAccessPage'
import ClientsPage from './ClientsPage'
import AuditLogsPage from './AuditLogsPage'

// ─── Design Tokens ─────────────────────────────────────────────────────────────
export const GREEN       = '#1a8a50'
export const GREEN_LIGHT = '#e8f5ee'

// ─── Mobile detection ──────────────────────────────────────────────────────────
export function useIsMobile(bp = 768) {
  const q = `(max-width: ${bp}px)`
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(q).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(q)
    const fn = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [q])
  return isMobile
}

// ─── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [
  '#ef4444','#f97316','#eab308','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899','#06b6d4'
]
function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
export function Avatar({ name = '', size = 32 }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      flexShrink: 0, userSelect: 'none'
    }}>
      {initials}
    </div>
  )
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const cfg = {
    Active:         { bg: '#d1fae5', color: '#065f46' },
    Inactive:       { bg: '#f1f5f9', color: '#64748b' },
    Offline:        { bg: '#fee2e2', color: '#991b1b' },
    Suspended:      { bg: '#fee2e2', color: '#991b1b' },
    Blacklisted:    { bg: '#fee2e2', color: '#991b1b' },
    Pending:        { bg: '#fef9c3', color: '#854d0e' },
    'Under Review': { bg: '#dbeafe', color: '#1e40af' },
  }
  const s = cfg[status] ?? cfg.Inactive
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap'
    }}>
      {status ?? 'Active'}
    </span>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
const NAV_TOP = [
  { path: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]
const USER_CHILDREN = [
  { path: '/superadmin/admin-users', label: 'Admin Users',    icon: Users     },
  { path: '/superadmin/workers',     label: 'Workers Access', icon: HardHat   },
  { path: '/superadmin/clients',     label: 'Client Access',  icon: UserRound },
]
const NAV_BOTTOM = [
  { path: '/superadmin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
]

function NavBtn({ icon: Icon, label, on, collapsed, onClick, indent = false, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', padding: '10px 20px', border: 'none',
      paddingLeft: indent && !collapsed ? 40 : 20,
      background: on ? GREEN_LIGHT : 'transparent',
      color: on ? GREEN : '#64748b',
      fontWeight: on ? 700 : 500, fontSize: 13,
      cursor: 'pointer', textAlign: 'left',
      borderLeft: on ? `3px solid ${GREEN}` : '3px solid transparent',
      transition: 'all .15s',
      justifyContent: collapsed ? 'center' : 'flex-start'
    }}
      onMouseEnter={e => { if (!on) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#334155' } }}
      onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' } }}
      title={collapsed ? label : ''}
    >
      <Icon size={16} />
      {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
      {!collapsed && children}
    </button>
  )
}

function Sidebar({ collapsed, setCollapsed, isMobile, mobileOpen, setMobileOpen }) {
  const navigate = useNavigate()
  const location = useLocation()
  const active   = (p) => location.pathname.startsWith(p)
  const usersActive = USER_CHILDREN.some(c => active(c.path))
  const [usersOpen, setUsersOpen] = useState(usersActive)

  // keep the dropdown open while one of its pages is active
  useEffect(() => { if (usersActive) setUsersOpen(true) }, [usersActive])

  const isCollapsed = isMobile ? false : collapsed
  const go = (path) => { navigate(path); if (isMobile) setMobileOpen(false) }

  const sizeStyle = isMobile
    ? {
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 250, zIndex: 70,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .25s ease',
        boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,.15)' : 'none',
        overflowY: 'auto',
      }
    : {
        width: collapsed ? 70 : 220, minHeight: '100vh', flexShrink: 0,
        transition: 'width 0.3s ease',
      }

  return (
    <aside style={{
      background: '#fff', borderRight: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column', ...sizeStyle,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: isCollapsed ? '14px 0' : '18px 20px 14px', borderBottom: '1px solid #e2e8f0',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        flexDirection: isCollapsed ? 'column' : 'row'
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: GREEN,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 12, letterSpacing: '-0.5px', flexShrink: 0
        }}>EB</div>
        {!isCollapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', lineHeight: 1.2 }}>SkillConnect</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Emerald Builders</div>
          </div>
        )}
        <button
          onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed(!collapsed))}
          title={isMobile ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 6, border: 'none', background: 'transparent',
            color: '#64748b', cursor: 'pointer', borderRadius: 6,
            marginLeft: isCollapsed ? 0 : 'auto', transition: 'all .15s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = GREEN }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}
        >
          {isMobile ? <X size={20} /> : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '10px 0' }}>
        {NAV_TOP.map(({ path, label, icon }) => (
          <NavBtn key={path} icon={icon} label={label} collapsed={isCollapsed}
            on={active(path)} onClick={() => go(path)} />
        ))}

        {/* Users dropdown */}
        <NavBtn icon={Users} label="Users" collapsed={isCollapsed}
          on={usersActive && !usersOpen}
          onClick={() => setUsersOpen(o => !o)}>
          <ChevronDown size={14} style={{
            transition: 'transform .2s',
            transform: usersOpen ? 'rotate(180deg)' : 'rotate(0)'
          }} />
        </NavBtn>
        {usersOpen && USER_CHILDREN.map(({ path, label, icon }) => (
          <NavBtn key={path} icon={icon} label={label} collapsed={isCollapsed} indent
            on={active(path)} onClick={() => go(path)} />
        ))}

        {NAV_BOTTOM.map(({ path, label, icon }) => (
          <NavBtn key={path} icon={icon} label={label} collapsed={isCollapsed}
            on={active(path)} onClick={() => go(path)} />
        ))}
      </nav>
    </aside>
  )
}

// ─── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ isMobile, onMenu }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const handleSignOut = () => {
    logout()   // records the logout in the audit log, then clears the session
    navigate('/login')
  }

  return (
    <div style={{
      height: 52, background: '#fff', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center',
      justifyContent: isMobile ? 'space-between' : 'flex-end',
      padding: isMobile ? '0 12px' : '0 24px', position: 'sticky', top: 0, zIndex: 40
    }}>
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onMenu} aria-label="Open menu" style={{
            display: 'flex', padding: 6, border: 'none', background: 'transparent',
            color: '#475569', cursor: 'pointer', borderRadius: 6
          }}>
            <Menu size={22} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>SkillConnect</span>
        </div>
      )}

      {/* User Dropdown on Right */}
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
          borderRadius: 6
        }}>
          <Avatar name="Super Admin" size={30} />
          {!isMobile && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Super Admin</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Super Admin</div>
            </div>
          )}
          <ChevronDown size={14} color="#94a3b8" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} />
        </button>

        {open && (
          <div style={{
            position: 'absolute', right: 0, top: '110%',
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,.12)',
            minWidth: 160, overflow: 'hidden', zIndex: 100
          }}>
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 16px', border: 'none',
                background: 'none', cursor: 'pointer', fontSize: 13,
                color: '#ef4444', fontWeight: 500, textAlign: 'left'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }) {
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = useIsMobile()

  // close the drawer when going back to desktop size
  useEffect(() => { if (!isMobile) setMobileOpen(false) }, [isMobile])

  // stop the page behind the drawer from scrolling
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#f4f6f8',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
    }}>
      <Sidebar
        collapsed={collapsed} setCollapsed={setCollapsed}
        isMobile={isMobile} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}
      />
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 65
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar isMobile={isMobile} onMenu={() => setMobileOpen(true)} />
        <main style={{ flex: 1, padding: isMobile ? 14 : 24 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 999,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', background: '#f0fdf4',
      border: '1px solid #bbf7d0', borderRadius: 8,
      color: '#15803d', fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 12px rgba(0,0,0,.08)'
    }}>
      <CheckCircle size={15} />{msg}
    </div>
  )
}

// ─── Modal Base ────────────────────────────────────────────────────────────────
export function Modal({ onClose, children, accentColor = GREEN }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)'
      }} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 8px 40px rgba(0,0,0,.18)',
        borderTop: `4px solid ${accentColor}`
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────
export const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  color: '#1e293b', background: '#fff'
}
export const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }
export const errText    = { margin: '4px 0 0', fontSize: 11, color: '#ef4444' }
export const greenBtn   = {
  padding: '8px 18px', background: GREEN, color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
export const ghostBtn = {
  flex: 1, padding: '8px 18px', background: '#f1f5f9', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}
export const redBtn = {
  padding: '8px 18px', background: '#fef2f2', color: '#ef4444',
  border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer'
}

// ─── Reset Password Modal ──────────────────────────────────────────────────────
export function ResetPasswordModal({ label, onClose, onReset }) {
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const generatePassword = () => {
    const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower   = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    const all     = upper + lower + numbers + special
    let pwd = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      special[Math.floor(Math.random() * special.length)],
    ]
    for (let i = 0; i < 6; i++) pwd.push(all[Math.floor(Math.random() * all.length)])
    pwd = pwd.sort(() => Math.random() - 0.5).join('')
    setNewPassword(pwd)
    setShowPass(true)
    setError('')
  }

  const handleReset = async () => {
    setError('')
    const v = validate.password(newPassword)
    if (v !== true) { setError(v); return }
    setSaving(true)
    try { await onReset(newPassword); onClose() }
    catch (err) { setError(err?.response?.data?.error || 'Reset failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Key size={18} color={GREEN} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Reset Password</h3>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Set new password for <strong style={{ color: '#1e293b' }}>{label}</strong>
      </p>
      {error && <p style={{ ...errText, marginBottom: 12, fontSize: 12 }}>{error}</p>}

      {/* Input + eye toggle */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input
          type={showPass ? 'text' : 'password'}
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="New password"
          style={{ ...inputStyle, paddingRight: 38 }}
        />
        <button type="button" onClick={() => setShowPass(!showPass)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2
          }}>
          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        Min 8 chars, uppercase, lowercase, number &amp; special character
      </p>

      {/* Auto-generate button */}
      <button
        type="button"
        onClick={generatePassword}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '7px 12px', marginBottom: 20,
          border: `1px dashed ${GREEN}`, borderRadius: 6,
          background: GREEN_LIGHT, color: GREEN,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', justifyContent: 'center'
        }}
      >
        <RefreshCw size={13} />
        Auto-generate Password
      </button>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={handleReset} disabled={saving}
          style={{ ...greenBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          Reset Password
        </button>
      </div>
    </Modal>
  )
}

// ─── Table Shell ───────────────────────────────────────────────────────────────
export function TableShell({ headers, children }) {
  const ref = useRef(null)

  // Give every cell its column name so the mobile card view can label it
  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.querySelectorAll('tbody > tr').forEach(tr => {
      Array.from(tr.children).forEach((td, i) => td.setAttribute('data-label', headers[i] ?? ''))
    })
  })

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table ref={ref} className="sa-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {headers.map((h, i) => (
                <th key={h || i} style={{
                  padding: '10px 16px', textAlign: 'left', fontSize: 11,
                  fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em',
                  whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function TR({ children, last }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      style={{ borderBottom: last ? 'none' : '1px solid #f1f5f9', background: hover ? '#f8fafc' : '#fff', transition: 'background .1s' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </tr>
  )
}

export const TD = ({ children, mono, small }) => (
  <td style={{ padding: '12px 16px', color: '#475569', fontFamily: mono ? 'monospace' : 'inherit', fontSize: small ? 12 : 13 }}>
    <div className="sa-td">{children}</div>
  </td>
)

// ─── Icon Button ───────────────────────────────────────────────────────────────
export function IconBtn({ onClick, children, hoverColor = '#334155' }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? `${hoverColor}15` : 'none',
        border: 'none', cursor: 'pointer', padding: 5,
        borderRadius: 4, color: hover ? hoverColor : '#94a3b8',
        display: 'flex', alignItems: 'center', transition: 'all .15s'
      }}>
      {children}
    </button>
  )
}

// ─── Global styles (spin + mobile tables) ──────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('sa-styles')) {
  const s = document.createElement('style')
  s.id = 'sa-styles'
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg) } }

    @media (max-width: 768px) {
      .sa-table thead { display: none; }
      .sa-table, .sa-table tbody, .sa-table tr { display: block; width: 100%; }
      .sa-table tr { padding: 12px 16px; }
      .sa-table td {
        display: grid; grid-template-columns: 105px minmax(0, 1fr);
        gap: 10px; align-items: center;
        padding: 6px 0 !important; max-width: none !important;
        white-space: normal !important; word-break: break-word;
      }
      .sa-table td::before {
        content: attr(data-label);
        font-size: 11px; font-weight: 700; color: #94a3b8;
        text-transform: uppercase; letter-spacing: .04em;
      }
      .sa-table td[data-label=""] { grid-template-columns: 1fr; justify-items: end; }
      .sa-table td[data-label=""]::before { display: none; }
      .sa-table td[colspan] { display: block; text-align: center; padding: 24px 0 !important; }
      .sa-table td[colspan]::before { display: none; }
    }
  `
  document.head.appendChild(s)
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  return (
    <Layout>
      <Routes>
        <Route path="dashboard"   element={<SAHome />}          />
        <Route path="admin-users" element={<AdminUsersPage />}  />
        <Route path="workers"     element={<WorkerAccessPage />}/>
        <Route path="clients"     element={<ClientsPage />}     />
        <Route path="audit-logs"  element={<AuditLogsPage />}   />
        <Route path="*"           element={<SAHome />}          />
      </Routes>
    </Layout>
  )
}