import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, HardHat, UserRound, ScrollText, ShieldCheck,
  Key, Eye, EyeOff, RefreshCw, CheckCircle,
  ChevronDown, ChevronRight, LogOut, Menu, X, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { validate } from '../../../utils/validators'

import SAHome from './SAHome'
import AdminUsersPage from './AdminUsersPage'
import WorkerAccessPage from './WorkerAccessPage'
import ClientsPage from './ClientsPage'
import AuditLogsPage from './AuditLogsPage'

const ICON = { strokeWidth: 1.75 }

const layoutStyles = `
  .sa-shell, .sa-shell h1, .sa-shell h2, .sa-shell h3, .sa-shell h4 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  @keyframes sa-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sa-menu { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
  .sa-fade { animation: sa-fade .2s ease both; }
  .sa-menu { animation: sa-menu .16s cubic-bezier(.2,.7,.2,1) both; transform-origin: top right; }
  @media (prefers-reduced-motion: reduce) { .sa-fade, .sa-menu { animation: none; } }
`

// ─── Mobile detection ──────────────────────────────────────────────────────────
export function useIsMobile(bp = 768) {
  const q = `(max-width: ${bp}px)`
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const fn = e => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [q])
  return isMobile
}

function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const fn = e => setIsDesktop(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isDesktop
}

// ─── Navigation ────────────────────────────────────────────────────────────────
const NAV = [
  { type: 'section', label: 'Overview' },
  { path: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { type: 'section', label: 'Access' },
  { type: 'group', label: 'Users', icon: Users, children: [
    { path: '/superadmin/admin-users', label: 'Admin users',   icon: ShieldCheck },
    { path: '/superadmin/workers',     label: 'Worker access', icon: HardHat },
    { path: '/superadmin/clients',     label: 'Client access', icon: UserRound },
  ] },
  { type: 'section', label: 'Security' },
  { path: '/superadmin/audit-logs', label: 'Audit logs', icon: ScrollText },
]
const ALL_LINKS = NAV.flatMap(i => i.children || (i.path ? [i] : []))

const isActive = (pathname, path) => pathname === path || pathname.startsWith(path + '/')

function NavItem({ item, active, collapsed, onClick, indent = false }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors text-left
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
        ${collapsed ? 'justify-center h-10' : `h-9 ${indent ? 'pl-9 pr-3' : 'px-3'}`}
        ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {active && !collapsed && <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-600" />}
      <Icon size={indent ? 16 : 18} {...ICON} className={active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-lg opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 transition-all z-50">
          {item.label}
        </span>
      )}
    </button>
  )
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ collapsed: collapsedProp, onToggle, mobileOpen, onMobileClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isDesktop = useIsDesktop()
  const collapsed = collapsedProp && isDesktop

  const group = NAV.find(i => i.type === 'group')
  const groupActive = group.children.some(c => isActive(pathname, c.path))
  const [groupOpen, setGroupOpen] = useState(true)
  useEffect(() => { if (groupActive) setGroupOpen(true) }, [groupActive])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = e => e.key === 'Escape' && onMobileClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  const go = path => { navigate(path); onMobileClose() }

  return (
    <>
      {mobileOpen && <div className="sa-fade fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 lg:hidden" onClick={onMobileClose} />}

      <aside className={`flex flex-col bg-white border-r border-slate-200 flex-shrink-0
        fixed lg:sticky top-0 left-0 h-screen z-50 lg:z-auto
        transition-[width,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]
        ${collapsed ? 'w-[72px]' : 'w-64'}
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>

        {/* Brand */}
        <div className={`h-16 flex items-center gap-3 border-b border-slate-200 flex-shrink-0 ${collapsed ? 'justify-center' : 'px-5'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm ring-1 ring-emerald-700/20 flex items-center justify-center flex-shrink-0">
            <HardHat size={18} strokeWidth={2} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-[15px] leading-tight tracking-tight">SkillConnect</p>
              <p className="text-xs text-slate-500 leading-tight truncate">Super admin</p>
            </div>
          )}
          <button onClick={onMobileClose} aria-label="Close menu" className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={18} {...ICON} />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-4 px-3 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`} aria-label="Super admin">
          {NAV.map((item, idx) => {
            if (item.type === 'section') {
              return collapsed
                ? (idx > 0 && <div key={idx} className="mx-1 my-3 h-px bg-slate-100" />)
                : <p key={idx} className={`px-2 pb-1.5 text-xs font-medium text-slate-400 ${idx > 0 ? 'pt-5' : ''}`}>{item.label}</p>
            }
            if (item.type === 'group') {
              if (collapsed) {
                return (
                  <div key={item.label} className="space-y-0.5">
                    {item.children.map(c => <NavItem key={c.path} item={c} collapsed active={isActive(pathname, c.path)} onClick={() => go(c.path)} />)}
                  </div>
                )
              }
              return (
                <div key={item.label} className="mb-0.5">
                  <button
                    onClick={() => setGroupOpen(o => !o)}
                    aria-expanded={groupOpen}
                    className={`group w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                      ${groupActive && !groupOpen ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <item.icon size={18} {...ICON} className={groupActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={15} {...ICON} className={`text-slate-400 transition-transform duration-200 ${groupOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ${groupOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="relative mt-0.5 space-y-0.5 before:absolute before:left-[21px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                        {item.children.map(c => <NavItem key={c.path} item={c} indent active={isActive(pathname, c.path)} onClick={() => go(c.path)} />)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return <div key={item.path} className="mb-0.5"><NavItem item={item} collapsed={collapsed} active={isActive(pathname, item.path)} onClick={() => go(item.path)} /></div>
          })}
        </nav>

        {/* Collapse (desktop) */}
        <div className="hidden lg:block border-t border-slate-200 p-3 flex-shrink-0">
          <button onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-3 h-9 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${collapsed ? 'justify-center' : 'px-3'}`}>
            {collapsed ? <PanelLeftOpen size={18} {...ICON} /> : <PanelLeftClose size={18} {...ICON} />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  )
}

// ─── User menu ─────────────────────────────────────────────────────────────────
function UserMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { logout } = useAuth()
  const navigate = useNavigate()

  const user = (() => { try { return JSON.parse(localStorage.getItem('sc_user')) || {} } catch { return {} } })()
  const name = user?.name || 'Super Admin'
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  const handleSignOut = () => {
    logout() // records the logout in the audit log, then clears the session
    navigate('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className={`flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${open ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
        <div className="w-8 h-8 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">{initials}</div>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-slate-900 leading-tight">{name}</p>
          <p className="text-xs text-slate-500 leading-tight">Super admin</p>
        </div>
        <ChevronDown size={16} {...ICON} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="sa-menu absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-slate-900/5 z-50 overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold">{initials}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.username ? `@${user.username}` : user?.email || ''}</p>
              <span className="inline-flex mt-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">Super admin</span>
            </div>
          </div>
          <div className="border-t border-slate-100 p-1.5">
            <button role="menuitem" onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={16} {...ICON} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Top bar ───────────────────────────────────────────────────────────────────
function TopBar({ onMenu }) {
  const { pathname } = useLocation()
  const current = ALL_LINKS.find(l => isActive(pathname, l.path)) || ALL_LINKS[0]
  const inUsers = NAV.find(i => i.type === 'group').children.some(c => c.path === current.path)
  const CurrentIcon = current.icon

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between gap-3 px-4 lg:px-6 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenu} aria-label="Open menu" className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
          <Menu size={20} {...ICON} />
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-500">Super admin</span>
          {inUsers && (
            <>
              <ChevronRight size={14} {...ICON} className="hidden sm:block text-slate-300 flex-shrink-0" />
              <span className="hidden sm:inline text-slate-500">Users</span>
            </>
          )}
          <ChevronRight size={14} {...ICON} className="hidden sm:block text-slate-300 flex-shrink-0" />
          <span className="flex items-center gap-2 font-medium text-slate-900 truncate">
            <CurrentIcon size={16} {...ICON} className="text-emerald-600 flex-shrink-0" />
            {current.label}
          </span>
        </nav>
      </div>
      <UserMenu />
    </header>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }) {
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isDesktop = useIsDesktop()

  useEffect(() => { if (isDesktop) setMobileOpen(false) }, [isDesktop])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="sa-shell flex min-h-screen bg-slate-50">
      <style>{layoutStyles}</style>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy shared helpers
// The redesigned pages no longer use these, but they stay exported so any other
// file that still imports them keeps working.
// ═══════════════════════════════════════════════════════════════════════════════
export const GREEN       = '#1a8a50'
export const GREEN_LIGHT = '#e8f5ee'

const AVATAR_PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
function avatarColor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
export function Avatar({ name = '', size = 32 }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, userSelect: 'none' }}>
      {initials}
    </div>
  )
}

export function StatusBadge({ status }) {
  const cfg = {
    Active: { bg: '#d1fae5', color: '#065f46' }, Inactive: { bg: '#f1f5f9', color: '#64748b' },
    Offline: { bg: '#fee2e2', color: '#991b1b' }, Suspended: { bg: '#fee2e2', color: '#991b1b' },
    Blacklisted: { bg: '#fee2e2', color: '#991b1b' }, Pending: { bg: '#fef9c3', color: '#854d0e' },
    'Under Review': { bg: '#dbeafe', color: '#1e40af' },
  }
  const s = cfg[status] ?? cfg.Inactive
  return <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{status ?? 'Active'}</span>
}

export function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#15803d', fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
      <CheckCircle size={15} />{msg}
    </div>
  )
}

export function Modal({ onClose, children, accentColor = GREEN }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,.18)', borderTop: `4px solid ${accentColor}` }}>
        {children}
      </div>
    </div>
  )
}

export const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1e293b', background: '#fff' }
export const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5 }
export const errText    = { margin: '4px 0 0', fontSize: 11, color: '#ef4444' }
export const greenBtn   = { padding: '8px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
export const ghostBtn   = { flex: 1, padding: '8px 18px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
export const redBtn     = { padding: '8px 18px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }

export function ResetPasswordModal({ label, onClose, onReset }) {
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const generatePassword = () => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower = 'abcdefghijklmnopqrstuvwxyz', numbers = '0123456789', special = '!@#$%^&*'
    const all = upper + lower + numbers + special
    let pwd = [upper, lower, numbers, special].map(s => s[Math.floor(Math.random() * s.length)])
    for (let i = 0; i < 6; i++) pwd.push(all[Math.floor(Math.random() * all.length)])
    setNewPassword(pwd.sort(() => Math.random() - 0.5).join('')); setShowPass(true); setError('')
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
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Set new password for <strong style={{ color: '#1e293b' }}>{label}</strong></p>
      {error && <p style={{ ...errText, marginBottom: 12, fontSize: 12 }}>{error}</p>}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password" style={{ ...inputStyle, paddingRight: 38 }} />
        <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
          {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>Min 8 chars, uppercase, lowercase, number &amp; special character</p>
      <button type="button" onClick={generatePassword} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '7px 12px', marginBottom: 20, border: `1px dashed ${GREEN}`, borderRadius: 6, background: GREEN_LIGHT, color: GREEN, fontSize: 12, fontWeight: 600, cursor: 'pointer', justifyContent: 'center' }}>
        <RefreshCw size={13} /> Auto-generate Password
      </button>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={handleReset} disabled={saving} style={{ ...greenBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />} Reset Password
        </button>
      </div>
    </Modal>
  )
}

export function TableShell({ headers, children }) {
  const ref = useRef(null)
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
              {headers.map((h, i) => <th key={h || i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>)}
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
    <tr style={{ borderBottom: last ? 'none' : '1px solid #f1f5f9', background: hover ? '#f8fafc' : '#fff', transition: 'background .1s' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {children}
    </tr>
  )
}

export const TD = ({ children, mono, small }) => (
  <td style={{ padding: '12px 16px', color: '#475569', fontFamily: mono ? 'monospace' : 'inherit', fontSize: small ? 12 : 13 }}>
    <div className="sa-td">{children}</div>
  </td>
)

export function IconBtn({ onClick, children, hoverColor = '#334155' }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? `${hoverColor}15` : 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 4, color: hover ? hoverColor : '#94a3b8', display: 'flex', alignItems: 'center', transition: 'all .15s' }}>
      {children}
    </button>
  )
}

if (typeof document !== 'undefined' && !document.getElementById('sa-styles')) {
  const s = document.createElement('style')
  s.id = 'sa-styles'
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg) } }
    @media (max-width: 768px) {
      .sa-table thead { display: none; }
      .sa-table, .sa-table tbody, .sa-table tr { display: block; width: 100%; }
      .sa-table tr { padding: 12px 16px; }
      .sa-table td { display: grid; grid-template-columns: 105px minmax(0, 1fr); gap: 10px; align-items: center; padding: 6px 0 !important; max-width: none !important; white-space: normal !important; word-break: break-word; }
      .sa-table td::before { content: attr(data-label); font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; }
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
        <Route path="dashboard"   element={<SAHome />} />
        <Route path="admin-users" element={<AdminUsersPage />} />
        <Route path="workers"     element={<WorkerAccessPage />} />
        <Route path="clients"     element={<ClientsPage />} />
        <Route path="audit-logs"  element={<AuditLogsPage />} />
        <Route path="*"           element={<SAHome />} />
      </Routes>
    </Layout>
  )
}