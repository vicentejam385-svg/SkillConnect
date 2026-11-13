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

const ICON = { strokeWidth: 1.75 }
const HOST = 'https://saddlebrown-swan-877763.hostingersite.com'

// Shows the profile photo, or the initials if there is no photo (or it fails to load)
function Avatar({ photo, initials, bg, size }) {
  const [broken, setBroken] = useState(false)
  const src = photo ? (/^https?:/.test(photo) ? photo : `${HOST}/${photo}`) : null
  return (
    <div className={`${size} ${bg} rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shadow-sm flex-shrink-0`}>
      {src && !broken
        ? <img src={src} alt="" onError={() => setBroken(true)} className="w-full h-full object-cover" />
        : initials}
    </div>
  )
}

const styles = `
  .lc-root, .lc-root h1, .lc-root h2, .lc-root h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  @keyframes lc-menu { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
  @keyframes lc-page { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes lc-drop { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: none; } }
  .lc-menu { animation: lc-menu .18s cubic-bezier(.16,1,.3,1) both; }
  .lc-page { animation: lc-page .4s cubic-bezier(.16,1,.3,1) both; }
  .lc-drop { animation: lc-drop .5s cubic-bezier(.16,1,.3,1) both; }
  @media (prefers-reduced-motion: reduce) { .lc-menu, .lc-page, .lc-drop { animation: none; } }
`

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
  const [scrolled, setScrolled] = useState(false)
  const userRef = useRef(null)
  const mgmtRef = useRef(null)
  useClickOutside(userRef, () => setUserOpen(false))
  useClickOutside(mgmtRef, () => setMgmtOpen(false))

  // Close menus on route change / Esc; add a soft shadow once the page scrolls
  useEffect(() => { setUserOpen(false); setMgmtOpen(false) }, [location.pathname])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { setUserOpen(false); setMgmtOpen(false) } }
    const onScroll = () => setScrolled(window.scrollY > 4)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll) }
  }, [])

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
  const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const roleText = isDualRole ? 'Worker · Admin' : ROLE_LABEL[role]

  const handleLogout = () => { logout(); navigate('/login') }

  const navBase = 'group relative flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] transition-all duration-200 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
  const navIdle = 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900'

  const renderNav = (item) => {
    const Icon = item.icon
    const active = isActive(item.path)
    return (
      <button key={item.path} onClick={() => navigate(item.path)} aria-current={active ? 'page' : undefined}
        className={`${navBase} ${active ? `${colors.soft} font-semibold` : navIdle}`}>
        <Icon size={16} {...ICON} className={active ? '' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
        <span className="hidden md:inline">{item.label}</span>
      </button>
    )
  }

  const menuItem = 'w-full flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] text-left transition-colors'

  return (
    <div className="lc-root min-h-screen bg-slate-50 flex flex-col">
      <style>{styles}</style>

      <header className={`lc-drop sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200 transition-shadow duration-300 ${scrolled ? 'shadow-[0_4px_16px_-8px_rgba(16,24,40,0.12)]' : ''}`}>
        <div className="h-14 sm:h-16 px-4 sm:px-6 max-w-7xl mx-auto w-full flex items-center gap-3 sm:gap-5">

          {/* Brand */}
          <button onClick={() => mainLinks[0] && navigate(mainLinks[0].path)} className="flex items-center gap-2.5 flex-shrink-0 group text-left">
            <div className={`w-9 h-9 ${colors.bg} rounded-xl flex items-center justify-center shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3`}>
              <HardHat size={18} {...ICON} className="text-white" />
            </div>
            <div className="leading-none hidden sm:block">
              <div className="font-bold text-[13px] text-slate-900 tracking-wide uppercase">
                Skill<span className={colors.accent}>Connect</span>
              </div>
              <div className="mt-1 text-[9px] font-medium text-slate-400 tracking-[0.2em] uppercase">Emerald Builders</div>
            </div>
          </button>

          <span className="hidden sm:block w-px h-6 bg-slate-200 flex-shrink-0" />

          {/* Workspace switcher (dual-role only) */}
          {isDualRole && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
              <button
                onClick={() => navigate('/worker/dashboard')}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-all duration-200
                  ${!inAdminMode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <HardHat size={13} {...ICON} /> <span className="hidden sm:inline">My Work</span>
              </button>
              <button
                onClick={() => navigate('/worker/admin/dashboard')}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-all duration-200
                  ${inAdminMode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Shield size={13} {...ICON} /> <span className="hidden sm:inline">Admin</span>
              </button>
            </div>
          )}

          {/* Primary navigation */}
          <nav className="flex items-center gap-1 flex-1 min-w-0">
            {mainLinks.map(renderNav)}

            {inAdminMode && adminMgmt.length > 0 && (
              <div className="relative" ref={mgmtRef}>
                <button
                  onClick={() => { setMgmtOpen(o => !o); setUserOpen(false) }}
                  aria-haspopup="menu" aria-expanded={mgmtOpen}
                  className={`${navBase} ${mgmtActive || mgmtOpen ? `${colors.soft} font-semibold` : navIdle}`}
                >
                  <Settings size={16} {...ICON} className={mgmtActive || mgmtOpen ? '' : 'text-slate-400 group-hover:text-slate-600 transition-colors'} />
                  <span className="hidden md:inline">Management</span>
                  <ChevronDown size={14} {...ICON} className={`transition-transform duration-200 ${mgmtOpen ? 'rotate-180' : ''}`} />
                </button>
                {mgmtOpen && (
                  <div role="menu" style={{ transformOrigin: 'top left' }}
                    className="lc-menu absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)] p-1.5 z-50">
                    <p className="px-3 pt-1.5 pb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-slate-400">Management</p>
                    {adminMgmt.map(item => {
                      const Icon = item.icon
                      const active = isActive(item.path)
                      return (
                        <button key={item.path} role="menuitem"
                          onClick={() => { navigate(item.path); setMgmtOpen(false) }}
                          className={`${menuItem} ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                          <Icon size={16} {...ICON} className={active ? 'text-blue-600' : 'text-slate-400'} />
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
              onClick={() => { setUserOpen(o => !o); setMgmtOpen(false) }}
              aria-haspopup="menu" aria-expanded={userOpen}
              className={`flex items-center gap-2.5 h-10 pl-1 pr-2.5 rounded-full border bg-white transition-all duration-200 active:scale-[.98]
                ${userOpen ? 'border-slate-300 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <Avatar photo={role === 'worker' ? user?.profile_photo : null} initials={initials} bg={colors.bg} size="w-8 h-8 text-xs" />
              <div className="hidden lg:block text-left leading-none">
                <div className="text-[13px] font-semibold text-slate-900">{displayName}</div>
                <div className={`mt-1 text-[10px] font-semibold tracking-wider uppercase ${colors.accent}`}>{roleText}</div>
              </div>
              <ChevronDown size={14} {...ICON} className={`text-slate-400 transition-transform duration-200 ${userOpen ? 'rotate-180' : ''}`} />
            </button>

            {userOpen && (
              <div role="menu" style={{ transformOrigin: 'top right' }}
                className="lc-menu absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)] overflow-hidden z-50">
                <div className="px-4 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                  <Avatar photo={role === 'worker' ? user?.profile_photo : null} initials={initials} bg={colors.bg} size="w-10 h-10 text-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                    {user?.username && <p className="text-xs text-slate-500 truncate">@{user.username}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${(ROLE_COLOR[role] || ROLE_COLOR.admin).soft}`}>{ROLE_LABEL[role]}</span>
                  {isDualRole && <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${ROLE_COLOR.admin.soft}`}>Admin Access</span>}
                </div>

                <div className="p-1.5 mt-1.5">
                  <button role="menuitem"
                    onClick={() => { navigate(`/${role}/profile`); setUserOpen(false) }}
                    className={`${menuItem} text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
                  >
                    <User size={16} {...ICON} className="text-slate-400" /> My Profile
                  </button>
                  {isDualRole && (
                    <button role="menuitem"
                      onClick={() => { navigate(inAdminMode ? '/worker/dashboard' : '/worker/admin/dashboard'); setUserOpen(false) }}
                      className={`${menuItem} text-slate-600 hover:bg-slate-50 hover:text-slate-900`}
                    >
                      {inAdminMode
                        ? <><HardHat size={16} {...ICON} className="text-slate-400" /> Switch to My Work</>
                        : <><Users size={16} {...ICON} className="text-slate-400" /> Switch to Admin</>}
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-100 p-1.5">
                  <button role="menuitem" onClick={handleLogout} className={`${menuItem} text-red-600 hover:bg-red-50`}>
                    <LogOut size={16} {...ICON} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mode indicator strip (dual-role only) */}
        {isDualRole && <div className={`h-0.5 transition-colors duration-300 ${inAdminMode ? 'bg-blue-600' : 'bg-emerald-500'}`} />}
      </header>

      <main className="flex-1 overflow-auto">
        <div key={location.pathname} className="lc-page max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6">{children}</div>
      </main>
    </div>
  )
}