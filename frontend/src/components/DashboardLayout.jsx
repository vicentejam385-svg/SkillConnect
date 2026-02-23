import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HardHat, Menu, X, LogOut, ChevronRight,
  Shield, Users
} from 'lucide-react'

const ROLE_COLOR = {
  super_admin: { accent: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500', pill: 'bg-amber-500/10 text-amber-400' },
  admin:       { accent: 'text-blue-400',  bg: 'bg-blue-500',  border: 'border-blue-400',  pill: 'bg-blue-500/10 text-blue-400'   },
  worker:      { accent: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-400', pill: 'bg-emerald-500/10 text-emerald-400' },
}

const ROLE_ICON = { super_admin: Shield, admin: Users, worker: HardHat }
const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', worker: 'Worker' }

export default function DashboardLayout({ navItems, children, title }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role = user?.loginRole || 'admin'
  const colors = ROLE_COLOR[role] || ROLE_COLOR.admin
  const RoleIcon = ROLE_ICON[role] || Users

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6 border-b border-steel-700">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${colors.bg} flex items-center justify-center flex-shrink-0`}>
            <HardHat size={18} className="text-steel-900" />
          </div>
          <div>
            <div className="font-display font-bold text-lg text-slate-100 leading-none tracking-wider uppercase">
              Skill<span className={colors.accent}>Connect</span>
            </div>
            <div className="font-body text-[10px] text-slate-500 leading-none tracking-widest uppercase mt-1">
              Emerald Builders
            </div>
          </div>
        </div>
      </div>

      <div className={`mx-4 mt-5 mb-4 p-3 bg-steel-900/60 border ${colors.border} border-opacity-30 flex items-center gap-3`}>
        <div className={`w-9 h-9 ${colors.bg} bg-opacity-20 ${colors.border} border flex items-center justify-center flex-shrink-0`}>
          <RoleIcon size={16} className={colors.accent} />
        </div>
        <div className="overflow-hidden">
          <div className="font-body font-semibold text-sm text-slate-200 truncate">{user?.name || user?.username}</div>
          <div className={`text-xs font-display font-semibold tracking-widest uppercase ${colors.accent}`}>
            {ROLE_LABEL[role]}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.type === 'section') {
            return (
              <div key={item.label} className="pt-5 pb-2 px-2">
                <span className="font-display font-semibold text-[10px] tracking-[0.2em] uppercase text-slate-600">
                  {item.label}
                </span>
              </div>
            )
          }
          const Icon = item.icon
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSidebarOpen(false) }}
              className={`sidebar-link w-full text-left ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} className={isActive ? colors.accent : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="flex-1 text-sm">{item.label}</span>
              {isActive && <ChevronRight size={14} className={`${colors.accent} ml-auto`} />}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-steel-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 font-body text-sm"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-steel-950 flex">
      <aside className="hidden lg:flex flex-col w-64 bg-steel-900 border-r border-steel-800 fixed inset-y-0 left-0 z-40">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-steel-900 border-r border-steel-800 z-50 flex flex-col">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-200">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-steel-900/90 backdrop-blur-sm border-b border-steel-800 h-16 flex items-center px-6 gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-amber-400 transition-colors">
            <Menu size={22} />
          </button>
          <h1 className="font-display font-bold text-xl text-slate-100 tracking-wide">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs font-display font-semibold tracking-widest uppercase rounded-full ${colors.pill}`}>
              <RoleIcon size={12} />
              {ROLE_LABEL[role]}
            </span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}