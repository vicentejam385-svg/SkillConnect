import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HardHat, LogOut, ChevronRight,
  Shield, Users, User
} from 'lucide-react'

const ROLE_COLOR = {
  super_admin: { accent: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500', pill: 'bg-amber-500/10 text-amber-400' },
  admin:       { accent: 'text-blue-400',  bg: 'bg-blue-500',  border: 'border-blue-400',  pill: 'bg-blue-500/10 text-blue-400'   },
  worker:      { accent: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-400', pill: 'bg-emerald-500/10 text-emerald-400' },
}

const ROLE_ICON = { super_admin: Shield, admin: Users, worker: HardHat }
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', worker: 'Worker' }

export default function DashboardLayout({ navItems, adminNavItems = [], children, title }) {
  const { user, logout, adminAccess } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
 const [switching, setSwitching] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const role = user?.loginRole || 'admin'
  const colors = ROLE_COLOR[role] || ROLE_COLOR.admin

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

     const handleAdminAccess = async () => {
    setSwitching(true)
    try {
      const newUser = await adminAccess()
      console.log('adminAccess() resolved with:', newUser)
      setDropdownOpen(false)
      navigate(newUser.loginRole === 'super_admin' ? '/superadmin/dashboard' : '/admin/dashboard')
    } catch (err) {
      console.error('adminAccess() failed:', err)
      alert(err.message || 'Failed to switch to admin access.')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* TOP NAV BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-12 flex items-center px-2 sm:px-4 shadow-sm">
        <div className="flex items-center w-full">
          {/* Logo — LEFT */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-7 h-7 ${colors.bg} flex items-center justify-center rounded`}>
              <HardHat size={14} className="text-white" />
            </div>
            <div className="leading-none">
              <div className="font-bold text-sm text-slate-800 tracking-wide uppercase">
                Skill<span className={colors.accent}>Connect</span>
              </div>
              <div className="text-[9px] text-slate-400 tracking-widest uppercase hidden xs:block">Emerald Builders</div>
            </div>
          </div>

          {/* RIGHT side: nav links + user dropdown */}
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {/* Nav links */}
            {navItems.filter(i => i.type !== 'section').map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all
                    ${isActive
                      ? `${colors.bg} text-white`
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              )
            })}

            {adminNavItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setAdminOpen(o => !o)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all
                    ${location.pathname.startsWith('/worker/admin')
                      ? 'bg-blue-500 text-white'
                      : 'text-blue-600 hover:bg-blue-50'}`}
                >
                  <Shield size={13} />
                  <span className="hidden sm:inline">Admin</span>
                  <ChevronRight size={12} className={`transition-transform duration-200 ${adminOpen ? 'rotate-90' : ''}`} />
                </button>
                {adminOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAdminOpen(false)} />
                    <div className="absolute right-0 top-9 z-50 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden py-1">
                      {adminNavItems.map(item => {
                        const Icon = item.icon
                        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setAdminOpen(false) }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors
                              ${isActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <Icon size={13} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 mx-1 sm:mx-2" />

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-2 border border-slate-200 rounded-full pl-1 pr-3 py-0.5 hover:bg-slate-50 transition-all"
              >
                <div className={`w-6 h-6 ${colors.bg} rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                  {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="leading-none hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-700">{user?.name || user?.username}</div>
                  <div className={`text-[10px] font-bold tracking-widest uppercase ${colors.accent}`}>{role === 'worker' && user?.has_admin_access ? 'Worker/Admin' : ROLE_LABEL[role]}</div>
                </div>
                <ChevronRight size={12} className={`text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-90' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 top-10 z-50 w-44 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-700 truncate">{user?.name || user?.username}</p>
                      <p className={`text-[10px] font-bold tracking-widest uppercase ${colors.accent}`}>{role === 'worker' && user?.has_admin_access ? 'Worker/Admin' : ROLE_LABEL[role]}</p>
                    </div>
                                        <button
                      onClick={() => {
                        const profilePath = `/${role}/profile`
                        navigate(profilePath)
                        setDropdownOpen(false)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <User size={13} className="text-slate-400" />
                      My Profile
                    </button>
                    {false && role === 'worker' && user?.has_admin_access && (
                      <button
                        onClick={handleAdminAccess}
                        disabled={switching}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100 disabled:opacity-50"
                      >
                        <Shield size={13} className="text-blue-400" />
                        {switching ? 'Switching…' : 'Admin Access'}
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors border-t border-slate-100"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {false && adminNavItems.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-1.5 flex items-center gap-1 overflow-x-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mr-2 flex-shrink-0">Admin</span>
          {adminNavItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all
                  ${isActive ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* PAGE CONTENT */}
      <main className="flex-1 p-6 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}