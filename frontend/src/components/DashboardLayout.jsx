import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HardHat, LogOut, ChevronDown, Shield, Users, User, Settings,
} from 'lucide-react'

const ROLE_COLOR = {
  super_admin: { accent: 'text-amber-600',   bg: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-700'     },
  admin:       { accent: 'text-blue-600',    bg: 'bg-blue-600',    soft: 'bg-blue-50 text-blue-700'       },
  worker:      { accent: 'text-emerald-600', bg: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700' },
}
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', worker: 'Worker' }

// Admin pages that are NOT duplicated in the worker menu → grouped under "Management"
const MANAGEMENT_KEYS = ['contacts', 'workers', 'licenses', 'inquiries', 'config']

// Close a dropdown when clicking outside
function useClickOutside(ref, onClose) {
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

export default function DashboardLayout({ navItems, adminNavItems = [], children }) {
  const { user, logout } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [userOpen, setUserOpen] = useState(false)
  const [mgmtOpen, setMgmtOpen] = useState(false)
  const userRef = useRef(null)
  const mgmtRef = useRef(null)
  useClickOutside(userRef, () => setUserOpen(false))
  useClickOutside(mgmtRef, () => setMgmtOpen(false))

  const role        = user?.loginRole || 'admin'
  const isDualRole  = role === 'worker' && adminNavItems.length > 0
  const inAdminMode = isDualRole && location.pathname.startsWith('/worker/admin')
  const colors      = inAdminMode ? ROLE_COLOR.admin : (ROLE_COLOR[role] || ROLE_COLOR.admin)

  const workerLinks = navItems.filter(i => i.path)

  // In admin mode: core links (Dashboard / Job Orders / Scheduling) + Management dropdown
  const adminCore = adminNavItems.filter(i => !MANAGEMENT_KEYS.some(k => i.path.endsWith('/' + k)))
  const adminMgmt = adminNavItems.filter(i =>  MANAGEMENT_KEYS.some(k => i.path.endsWith('/' + k)))
  const mgmtActive = adminMgmt.some(i => location.pathname.startsWith(i.path))

  const mainLinks = inAdminMode ? adminCore : workerLinks

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const displayName = user?.name || user?.username || 'User'
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const roleText = isDualRole ? 'Worker · Admin' : ROLE_LABEL[role]

  const handleLogout = () => { logout(); navigate('/login') }

  const NavButton = ({ item }) => {
    const Icon = item.icon
    const active = isActive(item.path)
    return (
      <button
        onClick={() => navigate(item.path)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
          ${active ? `${colors.bg} text-white shadow-sm` : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
      >
        <Icon size={15} />
        <span className="hidden md:inline">{item.label}</span>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="h-14 px-3 sm:px-6 flex items-center gap-3 sm:gap-6">

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className={`w-8 h-8 ${colors.bg} rounded-lg flex items-center justify-center`}>
              <HardHat size={16} className="text-white" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-bold text-sm text-slate-800 tracking-wide uppercase">
                Skill<span className={colors.accent}>Connect</span>
              </div>
              <div className="text-[9px] text-slate-400 tracking-widest uppercase">Emerald Builders</div>
            </div>
          </div>

          {/* Workspace switcher (dual-role only) */}
          {isDualRole && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
              <button
                onClick={() => navigate('/worker/dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                  ${!inAdminMode ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <HardHat size={13} /> <span className="hidden sm:inline">My Work</span>
              </button>
              <button
                onClick={() => navigate('/worker/admin/dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                  ${inAdminMode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Shield size={13} /> <span className="hidden sm:inline">Admin</span>
              </button>
            </div>
          )}

          {/* Primary navigation */}
          <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            {mainLinks.map(item => <NavButton key={item.path} item={item} />)}

            {inAdminMode && adminMgmt.length > 0 && (
              <div className="relative" ref={mgmtRef}>
                <button
                  onClick={() => setMgmtOpen(o => !o)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${mgmtActive ? `${colors.bg} text-white shadow-sm` : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Settings size={15} />
                  <span className="hidden md:inline">Management</span>
                  <ChevronDown size={13} className={`transition-transform ${mgmtOpen ? 'rotate-180' : ''}`} />
                </button>
                {mgmtOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                    <p className="px-4 pt-1.5 pb-1 text-[10px] font-bold tracking-widest uppercase text-slate-400">
                      Management
                    </p>
                    {adminMgmt.map(item => {
                      const Icon = item.icon
                      const active = isActive(item.path)
                      return (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setMgmtOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                            ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <Icon size={15} className={active ? 'text-blue-600' : 'text-slate-400'} />
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User menu */}
          <div className="relative flex-shrink-0" ref={userRef}>
            <button
              onClick={() => setUserOpen(o => !o)}
              className="flex items-center gap-2.5 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <div className={`w-7 h-7 ${colors.bg} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                {initials}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <div className="text-xs font-semibold text-slate-800">{displayName}</div>
                <div className={`text-[10px] font-semibold tracking-wide uppercase ${colors.accent}`}>{roleText}</div>
              </div>
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${userOpen ? 'rotate-180' : ''}`} />
            </button>

            {userOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                  {user?.username && <p className="text-xs text-slate-400 truncate">@{user.username}</p>}
                  <div className="flex gap-1.5 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLOR.worker.soft}`}>
                      {ROLE_LABEL[role] === 'Worker' ? 'Worker' : ROLE_LABEL[role]}
                    </span>
                    {isDualRole && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLOR.admin.soft}`}>
                        Admin Access
                      </span>
                    )}
                  </div>
                </div>

                <div className="py-1.5">
                  <button
                    onClick={() => { navigate(`/${role}/profile`); setUserOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <User size={15} className="text-slate-400" /> My Profile
                  </button>
                  {isDualRole && (
                    <button
                      onClick={() => {
                        navigate(inAdminMode ? '/worker/dashboard' : '/worker/admin/dashboard')
                        setUserOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      {inAdminMode
                        ? <><HardHat size={15} className="text-slate-400" /> Switch to My Work</>
                        : <><Users size={15} className="text-slate-400" /> Switch to Admin</>}
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-100 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mode indicator strip (dual-role only) */}
        {isDualRole && (
          <div className={`h-0.5 ${inAdminMode ? 'bg-blue-600' : 'bg-emerald-500'}`} />
        )}
      </header>

      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  )
}