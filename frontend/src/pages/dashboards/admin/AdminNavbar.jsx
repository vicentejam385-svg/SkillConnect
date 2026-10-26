import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate as useRouterNavigate, NavLink } from 'react-router-dom'
import {
  ClipboardList, Calendar, Users, FileText, HardHat, Settings,
  Menu, LayoutDashboard, LogOut, ChevronDown
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'

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
  { type: 'section', label: 'Menu' },
  { path: '/admin/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/admin/contacts',   label: 'Contacts',      icon: Users           },
  { path: '/admin/workers',    label: 'Workers',       icon: HardHat         },
  { path: '/admin/licenses',   label: 'Licenses',      icon: FileText        },
  { path: '/admin/inquiries',  label: 'Inquiries',     icon: FileText        },
  { path: '/admin/job-orders', label: 'Job Orders',    icon: ClipboardList   },
  { path: '/admin/scheduling', label: 'Scheduling',    icon: Calendar        },
  { type: 'section', label: 'System' },
  { path: '/admin/config',     label: 'Configuration', icon: Settings        },
]

// ── Sidebar ────────────────────────────────────────────────────
export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation()

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`flex flex-col bg-white border-r border-gray-100 shadow-sm transition-all duration-300 ease-in-out flex-shrink-0
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
          ${collapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ minHeight: '100vh' }}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">SC</span>
          </div>
          {!collapsed && (
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">SkillConnect</p>
              <p className="text-xs text-gray-400 leading-tight">Emerald Builders</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map((item, idx) => {
            if (item.type === 'section') {
              if (item.label === 'System') {
                if (collapsed) return null
                return (
                  <p key={idx} className="px-4 pt-5 pb-1 text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    {item.label}
                  </p>
                )
              }
              return (
                <div key={idx}>
                  <button
                    onClick={onToggle}
                    className={`hidden lg:flex items-center gap-2 w-full px-4 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all text-sm ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Menu size={18} />
                    {!collapsed && <span className="text-[10px] font-bold tracking-widest uppercase">{item.label}</span>}
                  </button>
                </div>
              )
            }
            const Icon = item.icon
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onMobileClose}
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-sm font-medium
                  ${active ? 'bg-emerald-50 text-emerald-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}
                  ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className={active ? 'text-emerald-500' : ''} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>
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

  // Only true if this admin session originated from a worker's "Admin Access" hop
  const cameFromWorker = !!localStorage.getItem('sc_worker_session')

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
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
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AU'

  const displayName = user?.name || 'Admin User'
  const displayRole = user?.type === 'super_admin' ? 'Super Admin' : 'Admin'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-gray-700 leading-tight">{displayName}</p>
          <p className="text-xs text-emerald-500 font-medium leading-tight">{displayRole}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{initials}</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                <p className="text-xs text-gray-400 truncate">{user?.username ? `@${user.username}` : displayRole}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 py-1.5">
            {cameFromWorker && (
              <button
                onClick={handleBackToWorker}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors font-medium"
              >
                <HardHat size={15} />
                <span>Back to Worker</span>
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Top Bar ────────────────────────────────────────────────────
export function TopBar({ onMenuToggle }) {
  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0">
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1 lg:flex-none" />
      <UserDropdown />
    </header>
  )
}