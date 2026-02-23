import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HardHat, Eye, EyeOff, Shield, Users, AlertCircle, ArrowLeft } from 'lucide-react'

const ROLES = [
  { key: 'super_admin', label: 'Super Admin', icon: Shield, desc: 'Full system access & user management', accent: 'amber' },
  { key: 'admin',       label: 'Admin',       icon: Users,  desc: 'Contacts, job orders & scheduling',   accent: 'blue'  },
  { key: 'worker',      label: 'Worker',      icon: HardHat,desc: 'View and manage your job orders',     accent: 'emerald'},
]

const ACCENT = {
  amber:   { tab: 'border-amber-500 text-amber-400',     icon: 'text-amber-400',   btn: 'bg-amber-500 hover:bg-amber-400 text-steel-900', bar: 'bg-amber-500'   },
  blue:    { tab: 'border-blue-400 text-blue-400',       icon: 'text-blue-400',    btn: 'bg-blue-500 hover:bg-blue-400 text-white',        bar: 'bg-blue-400'    },
  emerald: { tab: 'border-emerald-400 text-emerald-400', icon: 'text-emerald-400', btn: 'bg-emerald-500 hover:bg-emerald-400 text-white',   bar: 'bg-emerald-400' },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [activeRole, setActiveRole] = useState('super_admin')
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const role   = ROLES.find(r => r.key === activeRole)
  const accent = ACCENT[role.accent]

  const handleRoleSwitch = (key) => {
    setActiveRole(key)
    setError('')
    setUsername('')
    setPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }
    setLoading(true)
    try {
      const user = await login(username.trim(), password, activeRole)
      if (user.loginRole === 'super_admin') navigate('/superadmin/dashboard')
      else if (user.loginRole === 'admin')  navigate('/admin/dashboard')
      else                                  navigate('/worker/dashboard')
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-steel-950 flex overflow-hidden">
      <div className="fixed inset-0 bg-grid-steel bg-grid opacity-30 pointer-events-none" />

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 border-r border-steel-800">
        <div className="relative z-10">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-500 hover:text-amber-400 transition-colors mb-16 font-body text-sm">
            <ArrowLeft size={14} />Back to Home
          </button>
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 bg-amber-500 flex items-center justify-center">
              <HardHat size={28} className="text-steel-900" />
            </div>
            <div>
              <div className="font-display font-bold text-3xl text-slate-100 leading-none tracking-wider uppercase">
                Skill<span className="text-amber-400">Connect</span>
              </div>
              <div className="font-body text-xs text-slate-500 tracking-widest uppercase mt-1">
                Emerald Builders & Construction
              </div>
            </div>
          </div>
          <h2 className="font-display font-bold text-4xl text-slate-100 leading-tight tracking-wide mb-4">
            Workforce<br />
            <span className="text-amber-400">Marketplace</span><br />
            System
          </h2>
          <p className="font-body text-slate-400 leading-relaxed max-w-sm">
            Manage your construction workforce, schedule job orders, and track subcontractors — all in one platform.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-6">
          {[{ v: '3', l: 'Role Levels' }, { v: '∞', l: 'Job Orders' }, { v: '24/7', l: 'Availability' }].map(({ v, l }) => (
            <div key={l} className="border-t border-steel-700 pt-4">
              <div className="font-display font-bold text-2xl text-amber-400">{v}</div>
              <div className="font-body text-xs text-slate-500 tracking-wide uppercase mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative z-10">
        <button onClick={() => navigate('/')} className="lg:hidden self-start flex items-center gap-2 text-slate-500 hover:text-amber-400 transition-colors mb-8 font-body text-sm">
          <ArrowLeft size={14} />Back to Home
        </button>

        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-amber-500 flex items-center justify-center">
              <HardHat size={20} className="text-steel-900" />
            </div>
            <div className="font-display font-bold text-2xl text-slate-100 tracking-wider uppercase">
              Skill<span className="text-amber-400">Connect</span>
            </div>
          </div>

          <h3 className="font-display font-bold text-3xl text-slate-100 tracking-wide mb-2">Sign In</h3>
          <p className="font-body text-slate-400 text-sm mb-8">Select your access level to continue</p>

          {/* Role Tabs */}
          <div className="grid grid-cols-3 gap-2 mb-8">
            {ROLES.map((r) => {
              const Icon = r.icon
              const ac   = ACCENT[r.accent]
              const isActive = activeRole === r.key
              return (
                <button key={r.key} onClick={() => handleRoleSwitch(r.key)}
                  className={`relative flex flex-col items-center gap-2 p-3 border transition-all duration-200
                    ${isActive ? `${ac.tab} border-current bg-steel-800` : 'border-steel-700 text-slate-500 hover:border-steel-500 hover:text-slate-300 bg-steel-900/50'}`}>
                  {isActive && <div className={`absolute top-0 left-0 right-0 h-0.5 ${ac.bar}`} />}
                  <Icon size={18} className={isActive ? ac.icon : 'text-current'} />
                  <span className="font-display font-semibold text-xs tracking-wider uppercase leading-none text-center">{r.label}</span>
                </button>
              )
            })}
          </div>

          {/* Role description */}
          <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-steel-800/60 border border-steel-700">
            <role.icon size={14} className={accent.icon} />
            <span className="font-body text-xs text-slate-400">{role.desc}</span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 mb-6 p-3 bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="font-body text-sm">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="label-field">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username" className="input-field" disabled={loading} />
            </div>
            <div>
              <label className="label-field">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" className="input-field pr-12" disabled={loading} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 font-display font-bold tracking-widest uppercase text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${accent.btn}`}>
              {loading ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /><span>Authenticating...</span></>
              ) : (
                <span>Sign In as {role.label}</span>
              )}
            </button>
          </form>

          <p className="mt-8 text-center font-body text-xs text-slate-600">
            SkillConnect · Emerald Builders & Construction · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}