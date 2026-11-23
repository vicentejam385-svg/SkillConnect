import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, MessageSquare, UserCircle, LogOut, HardHat, ChevronDown } from 'lucide-react'
import { ICON, getCustomerInfo } from './CustomerUI'

const LINKS = [
  { path: '/customer/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/customer/job-orders', label: 'My job orders', short: 'Job orders', icon: ClipboardList },
  { path: '/customer/inquiries',  label: 'My inquiries',  short: 'Inquiries',  icon: MessageSquare },
]

// ── Top navigation (bottom tab bar on phones) ──────────────────
export default function TopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const customer = getCustomerInfo()
  const fullName = customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}`.trim() : (customer?.name || 'Customer')
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'C'
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const isActive = path => location.pathname.startsWith(path)

  useEffect(() => {
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    const onKey  = e => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  const logout = () => {
    localStorage.removeItem('sc_user')
    localStorage.removeItem('sc_token')
    navigate('/login')
  }

  return (
    <>
      <header className="cx-nav sticky top-0 z-[100] bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center gap-6">
          {/* Logo */}
          <button onClick={() => navigate('/customer/dashboard')} className="flex items-center gap-2.5 flex-shrink-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm"><HardHat size={18} {...ICON} /></span>
            <span className="text-left leading-tight">
              <span className="block text-[15px] font-semibold text-slate-900 tracking-tight">SkillConnect</span>
              <span className="block text-[11px] text-slate-500">Emerald Builders</span>
            </span>
          </button>

          {/* Links (desktop) */}
          <nav className="hidden sm:flex items-center gap-1 ml-2" aria-label="Main">
            {LINKS.map(({ path, label, icon: Icon }) => {
              const on = isActive(path)
              return (
                <button key={path} onClick={() => navigate(path)} aria-current={on ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-colors
                    ${on ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                  <Icon size={16} {...ICON} />{label}
                </button>
              )
            })}
          </nav>

          <div className="flex-1" />

          {/* Account */}
          <div ref={menuRef} className="relative">
            <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
              className="flex items-center gap-2.5 h-10 pl-1 pr-2 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="w-8 h-8 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 text-xs font-semibold flex items-center justify-center">{initials}</span>
              <span className="hidden md:block text-left leading-tight">
                <span className="block text-sm font-medium text-slate-900 max-w-[160px] truncate">{fullName}</span>
                <span className="block text-[11px] text-slate-500">Customer</span>
              </span>
              <ChevronDown size={15} {...ICON} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div role="menu" className="cx-pop absolute right-0 top-[calc(100%+8px)] w-60 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{fullName}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{customer?.email || 'Customer account'}</p>
                </div>
                <div className="p-1.5">
                  <button role="menuitem" onClick={() => { setOpen(false); navigate('/customer/profile') }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                    <UserCircle size={16} {...ICON} className="text-slate-400" />My profile
                  </button>
                  <button role="menuitem" onClick={logout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
                    <LogOut size={16} {...ICON} />Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Bottom tab bar (phones) */}
      <nav className="cx-nav sm:hidden fixed bottom-0 inset-x-0 z-[100] bg-white border-t border-slate-200 grid grid-cols-3 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {LINKS.map(({ path, label, short, icon: Icon }) => {
          const on = isActive(path)
          return (
            <button key={path} onClick={() => navigate(path)} aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 h-14 text-[11px] font-medium ${on ? 'text-emerald-700' : 'text-slate-500'}`}>
              <Icon size={20} {...ICON} />{short || label}
            </button>
          )
        })}
      </nav>
    </>
  )
}