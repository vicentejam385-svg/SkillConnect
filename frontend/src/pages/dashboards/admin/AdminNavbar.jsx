import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate as useRouterNavigate, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Contact, HardHat, BadgeCheck, Inbox, Briefcase,
  CalendarClock, Settings, Menu, LogOut, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, X, ArrowLeftRight,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'

const ICON = { strokeWidth: 1.75 }

const styles = `
  @keyframes sc-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-menu { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
  .sc-fade { animation: sc-fade .2s ease both; }
  .sc-menu { animation: sc-menu .16s cubic-bezier(.2,.7,.2,1) both; transform-origin: top right; }
  @media (prefers-reduced-motion: reduce) { .sc-fade, .sc-menu { animation: none; } }
`

// ── useNavigate (admin wrapper) ────────────────────────────────
function useNavigate() {
  const nav = useRouterNavigate()
  const loc = useLocation()
  return (to, opts) =>
    typeof to === 'string' && to.startsWith('/admin') && loc.pathname.startsWith('/worker')
      ? nav('/worker' + to, opts)
      : nav(to, opts)
}

// ── Nav Items ──────────────────────────────────────────────────
export const NAV_ITEMS = [
  { type: 'section', label: 'Workspace' },
  { path: '/admin/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/admin/inquiries',  label: 'Inquiries',     icon: Inbox           },
  { path: '/admin/job-orders', label: 'Job Orders',    icon: Briefcase       },
  { path: '/admin/scheduling', label: 'Scheduling',    icon: CalendarClock   },
  { type: 'section', label: 'People' },
  { path: '/admin/contacts',   label: 'Contacts',      icon: Contact         },
  { path: '/admin/workers',    label: 'Workers',       icon: HardHat         },
  { path: '/admin/licenses',   label: 'Licenses',      icon: BadgeCheck      },
  { type: 'section', label: 'System' },
  { path: '/admin/config',     label: 'Configuration', icon: Settings        },
]

const isActivePath = (pathname, path) =>
  pathname === path || pathname.startsWith(path + '/') ||
  pathname.endsWith(path) || pathname.includes(path + '/')

// ── Desktop detection (lg = 1024px) ────────────────────────────
function useIsDesktop() {
  const q = '(min-width: 1024px)'
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(q).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(q)
    const fn = e => setIsDesktop(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isDesktop
}

// ── Sidebar ────────────────────────────────────────────────────
export function Sidebar({ collapsed: collapsedProp, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation()
  const isDesktop = useIsDesktop()
  const collapsed = collapsedProp && isDesktop // phones always show full labels

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = e => e.key === 'Escape' && onMobileClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      <style>{styles}</style>

      {mobileOpen && (
        <div className="sc-fade fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`flex flex-col bg-white border-r border-slate-200 flex-shrink-0
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
          transition-[width,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand */}
        <div className={`h-16 flex items-center gap-3 border-b border-slate-200 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-5'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm ring-1 ring-emerald-700/20 flex items-center justify-center flex-shrink-0">
            <HardHat size={18} strokeWidth={2} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-[15px] leading-tight tracking-tight">SkillConnect</p>
              <p className="text-xs text-slate-500 leading-tight truncate">Emerald Builders</p>
            </div>
          )}
          <button
            onClick={onMobileClose}
            aria-label="Close menu"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={18} {...ICON} />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-4 ${collapsed ? 'overflow-visible' : 'overflow-y-auto custom-scroll'}`} aria-label="Admin">
          {NAV_ITEMS.map((item, idx) => {
            if (item.type === 'section') {
              return collapsed ? (
                idx > 0 && <div key={idx} className="mx-4 my-3 h-px bg-slate-100" />
              ) : (
                <p key={idx} className={`px-5 pb-1.5 text-xs font-medium text-slate-400 ${idx > 0 ? 'pt-5' : ''}`}>
                  {item.label}
                </p>
              )
            }

            const Icon = item.icon
            const active = isActivePath(location.pathname, item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 mx-3 mb-0.5 rounded-lg text-sm font-medium transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                  ${collapsed ? 'justify-center h-10' : 'h-9 px-3'}
                  ${active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                {active && !collapsed && (
                  <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-600" />
                )}
                <Icon size={18} {...ICON} className={active ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'} />
                {!collapsed && <span className="truncate">{item.label}</span>}

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-lg opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 transition-all z-50">
                    {item.label}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="hidden lg:block border-t border-slate-200 p-3 flex-shrink-0">
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-3 h-9 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${collapsed ? 'justify-center' : 'px-3'}`}
          >
            {collapsed ? <PanelLeftOpen size={18} {...ICON} /> : <PanelLeftClose size={18} {...ICON} />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  )
}

// ── User Dropdown ──────────────────────────────────────────────
function UserDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { backToWorker, logout } = useAuth()

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('sc_user')) || {} } catch { return {} }
  })()

  const cameFromWorker = !!localStorage.getItem('sc_worker_session')

  useEffect(() => {
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  const handleSignOut = () => {
    logout()
    localStorage.removeItem('sc_worker_session')
    navigate('/login')
  }

  const handleBackToWorker = () => {
    const workerUser = backToWorker()
    setOpen(false)
    if (workerUser) navigate('/worker/dashboard')
  }

  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AU'
  const displayName = user?.name || 'Admin User'
  const displayRole = user?.type === 'super_admin' ? 'Super Admin' : 'Admin'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${open ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
      >
        <div className="w-8 h-8 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-slate-900 leading-tight">{displayName}</p>
          <p className="text-xs text-slate-500 leading-tight">{displayRole}</p>
        </div>
        <ChevronDown size={16} {...ICON} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="sc-menu absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl ring-1 ring-slate-900/5 z-50 overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.username ? `@${user.username}` : user?.email || ''}</p>
              <span className="inline-flex mt-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium">{displayRole}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 p-1.5">
            {cameFromWorker && (
              <button
                role="menuitem"
                onClick={handleBackToWorker}
                className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeftRight size={16} {...ICON} className="text-slate-400" />
                Switch to worker view
              </button>
            )}
            <button
              role="menuitem"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={16} {...ICON} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Top Bar ────────────────────────────────────────────────────
export function TopBar({ onMenuToggle }) {
  const location = useLocation()
  const current = NAV_ITEMS.find(i => i.path && isActivePath(location.pathname, i.path)) || NAV_ITEMS[1]
  const CurrentIcon = current.icon

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between gap-3 px-4 lg:px-6 flex-shrink-0 relative z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          aria-label="Open menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Menu size={20} {...ICON} />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-500">Admin</span>
          <ChevronRight size={14} {...ICON} className="hidden sm:block text-slate-300 flex-shrink-0" />
          <span className="flex items-center gap-2 font-medium text-slate-900 truncate">
            <CurrentIcon size={16} {...ICON} className="text-emerald-600 flex-shrink-0" />
            {current.label}
          </span>
        </nav>
      </div>

      <UserDropdown />
    </header>
  )
}