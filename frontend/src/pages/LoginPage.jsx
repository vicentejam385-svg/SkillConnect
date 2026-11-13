// src/pages/LoginPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, HardHat, User, Lock, Loader2,
  ClipboardList, CalendarDays, LineChart, ShieldAlert,
} from 'lucide-react'

const ICON = { strokeWidth: 1.75 }

const FEATURES = [
  { icon: ClipboardList, title: 'Manage projects',   desc: 'Track every job order in one place' },
  { icon: CalendarDays,  title: 'Schedule services', desc: 'Book site visits and approvals' },
  { icon: LineChart,     title: 'Real-time updates', desc: 'See progress the moment it happens' },
]

const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000 // 15 minutes

function getLockoutState(credential) {
  try {
    const raw = localStorage.getItem(`login_lock_${credential.toLowerCase()}`)
    if (!raw) return { attempts: 0, lockedUntil: null }
    return JSON.parse(raw)
  } catch { return { attempts: 0, lockedUntil: null } }
}
function setLockoutState(credential, state) {
  localStorage.setItem(`login_lock_${credential.toLowerCase()}`, JSON.stringify(state))
}
function clearLockoutState(credential) {
  localStorage.removeItem(`login_lock_${credential.toLowerCase()}`)
}

/* ── Animations (same family as the landing page) ── */
const styles = `
  .lg, .lg h1, .lg h2 { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  @keyframes lg-up    { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes lg-zoom  { from { transform: scale(1.1); } to { transform: scale(1); } }
  @keyframes lg-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes lg-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
  @keyframes lg-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
  @keyframes lg-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%, 100% { transform: translateX(260%) skewX(-20deg); } }
  .lg-up    { animation: lg-up .7s cubic-bezier(.2,.7,.2,1) both; }
  .lg-zoom  { animation: lg-zoom 14s ease-out both; }
  .lg-float { animation: lg-float 6s ease-in-out infinite; }
  .lg-shake { animation: lg-shake .45s ease-in-out both; }
  .lg-pulse { animation: lg-pulse 2s infinite; }
  .lg-shine { position: relative; overflow: hidden; isolation: isolate; }
  .lg-shine::after { content: ''; position: absolute; inset: 0; width: 40%; z-index: -1; pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent);
    animation: lg-shine 3.6s ease-in-out infinite; }
  .lg-shine:disabled::after { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .lg-up, .lg-zoom, .lg-float, .lg-shake, .lg-pulse, .lg-shine::after { animation: none !important; }
  }
`

export default function LoginPage() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  const [credential,   setCredential]   = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [errorKey,     setErrorKey]     = useState(0)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [lockedUntil,  setLockedUntil]  = useState(null)
  const [countdown,    setCountdown]    = useState('')

  const showError = msg => { setError(msg); setErrorKey(k => k + 1) }

  // Live countdown timer while locked
  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const diff = lockedUntil - Date.now()
      if (diff <= 0) {
        setLockedUntil(null)
        setAttemptsLeft(MAX_ATTEMPTS)
        setError('')
        setCountdown('')
        return
      }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  // Re-check lockout on credential change
  useEffect(() => {
    if (!credential.trim()) {
      setLockedUntil(null)
      setAttemptsLeft(MAX_ATTEMPTS)
      setError('')
      return
    }
    const state = getLockoutState(credential)
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      setLockedUntil(state.lockedUntil)
      setAttemptsLeft(0)
    } else {
      setLockedUntil(null)
      setAttemptsLeft(MAX_ATTEMPTS - (state.attempts || 0))
      setError('')
    }
  }, [credential])

  const isLocked = !!(lockedUntil && Date.now() < lockedUntil)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!credential.trim() || !password.trim()) {
      showError('Please enter your email/username and password.')
      return
    }

    const state = getLockoutState(credential)
    const now   = Date.now()

    if (state.lockedUntil && now < state.lockedUntil) {
      setLockedUntil(state.lockedUntil)
      setAttemptsLeft(0)
      return
    }
    if (state.lockedUntil && now >= state.lockedUntil) {
      clearLockoutState(credential)
      setLockedUntil(null)
      setAttemptsLeft(MAX_ATTEMPTS)
    }

    setLoading(true)
    try {
      const user = await login(credential.trim(), password)

      clearLockoutState(credential)
      setAttemptsLeft(MAX_ATTEMPTS)

      switch (user.loginRole) {
        case 'super_admin': navigate('/superadmin/dashboard'); break
        case 'admin':       navigate('/admin/dashboard');      break
        case 'worker':      navigate('/worker/dashboard');     break
        case 'client':      navigate('/customer/dashboard');   break
        default:            navigate('/worker/dashboard')
      }
    } catch (err) {
      const status = err?.response?.status
      const data   = err?.response?.data ?? {}
      const msg    = data.error ?? err?.message ?? 'Something went wrong. Please try again.'

      if (status === 429) {
        const ts = data.locked_until
          ? data.locked_until * 1000
          : Date.now() + (data.retry_after ?? LOCKOUT_MS / 1000) * 1000
        setLockoutState(credential, { attempts: MAX_ATTEMPTS, lockedUntil: ts })
        setLockedUntil(ts)
        setAttemptsLeft(0)
        showError(msg)
      } else if (status === 401) {
        const fresh    = getLockoutState(credential)
        const attempts = typeof data.attempts_left === 'number'
          ? MAX_ATTEMPTS - data.attempts_left
          : (fresh.attempts || 0) + 1
        const remaining = MAX_ATTEMPTS - attempts

        if (attempts >= MAX_ATTEMPTS) {
          const ts = Date.now() + LOCKOUT_MS
          setLockoutState(credential, { attempts, lockedUntil: ts })
          setLockedUntil(ts)
          setAttemptsLeft(0)
          showError('Too many failed attempts. Account locked for 15 minutes.')
        } else {
          setLockoutState(credential, { attempts, lockedUntil: null })
          setAttemptsLeft(remaining)
          showError(`${msg} — ${remaining} attempt${remaining !== 1 ? 's' : ''} left`)
        }
      } else {
        showError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const inputCls = `w-full h-11 pl-10 pr-4 text-sm rounded-lg bg-white text-slate-900 placeholder-slate-400 border border-slate-200 shadow-sm
    hover:border-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
    disabled:bg-slate-50 disabled:cursor-not-allowed transition-colors`

  return (
    <div className="lg min-h-screen flex bg-white antialiased">
      <style>{styles}</style>

      {/* ── LEFT PANEL (desktop) ── */}
      <aside className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-slate-900">
        <img
          src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=70"
          alt="" aria-hidden="true"
          className="lg-zoom absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/85 to-emerald-900/70" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-14">
          <button onClick={() => navigate('/')} className="lg-up self-start flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm ring-1 ring-white/10 flex items-center justify-center">
              <HardHat size={19} strokeWidth={2} className="text-white" />
            </span>
            <span className="text-left">
              <span className="block font-semibold text-white text-base leading-tight tracking-tight">SkillConnect</span>
              <span className="block text-xs text-white/60 leading-tight">Emerald Builders & Construction</span>
            </span>
          </button>

          <div>
            <p className="lg-up inline-flex items-center gap-2 h-8 pl-2 pr-3.5 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur text-xs font-medium text-white" style={{ animationDelay: '100ms' }}>
              <span className="lg-pulse w-2 h-2 rounded-full bg-emerald-400 ml-1" />
              Your projects, all in one place
            </p>
            <h1 className="lg-up mt-6 text-4xl xl:text-5xl font-semibold text-white tracking-tight leading-[1.08]" style={{ animationDelay: '200ms' }}>
              Welcome back to<br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">SkillConnect.</span>
            </h1>
            <p className="lg-up mt-5 text-base text-slate-300 leading-relaxed max-w-md" style={{ animationDelay: '300ms' }}>
              Sign in to manage job orders, view schedules and work with our skilled workforce.
            </p>

            <ul className="mt-10 space-y-3 max-w-md">
              {FEATURES.map((f, i) => (
                <li key={f.title} className="lg-up" style={{ animationDelay: `${420 + i * 110}ms` }}>
                  <div className="group flex items-center gap-3.5 rounded-xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur px-4 py-3 transition-colors hover:bg-white/10">
                    <span className="w-10 h-10 rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                      <f.icon size={18} {...ICON} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white">{f.title}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">{f.desc}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="lg-up text-xs text-slate-500" style={{ animationDelay: '800ms' }}>
            © {new Date().getFullYear()} Emerald Builders & Construction
          </p>
        </div>
      </aside>

      {/* ── RIGHT PANEL ── */}
      <main className="flex-1 flex flex-col min-h-screen bg-slate-50 lg:bg-white">
        {/* Mobile brand bar */}
        <div className="lg:hidden relative overflow-hidden bg-slate-900 px-5 pt-6 pb-16">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900/80" />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <HardHat size={18} strokeWidth={2} className="text-white" />
              </span>
              <span className="text-left">
                <span className="block font-semibold text-white text-[15px] leading-tight">SkillConnect</span>
                <span className="block text-xs text-white/60 leading-tight">Emerald Builders</span>
              </span>
            </button>
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowLeft size={16} {...ICON} /> Home
            </button>
          </div>
          <h1 className="lg-up relative mt-8 text-2xl font-semibold text-white tracking-tight">Welcome back</h1>
          <p className="lg-up relative mt-1 text-sm text-slate-300" style={{ animationDelay: '100ms' }}>Sign in to continue to your account.</p>
        </div>

        <div className="flex-1 flex items-start lg:items-center justify-center px-5 sm:px-10 -mt-10 lg:mt-0 pb-10 lg:py-10">
          <div className="lg-up w-full max-w-[400px] rounded-2xl lg:rounded-none bg-white lg:bg-transparent ring-1 ring-slate-200 lg:ring-0 shadow-xl shadow-slate-900/5 lg:shadow-none p-6 sm:p-8 lg:p-0" style={{ animationDelay: '150ms' }}>

            <button
              onClick={() => navigate('/')}
              className="hidden lg:inline-flex group items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700 transition-colors mb-10"
            >
              <ArrowLeft size={16} {...ICON} className="transition-transform group-hover:-translate-x-0.5" />
              Back to home
            </button>

            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your credentials to access your account.</p>

            {/* Error / lockout banner */}
            {(error || isLocked) && (
              <div
                key={isLocked ? 'locked' : errorKey}
                role="alert"
                className={`lg-shake mt-6 flex items-start gap-2.5 p-3.5 rounded-lg border text-sm
                  ${isLocked ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                {isLocked
                  ? <ShieldAlert size={17} {...ICON} className="flex-shrink-0 mt-0.5 text-amber-600" />
                  : <AlertCircle size={17} {...ICON} className="flex-shrink-0 mt-0.5 text-red-500" />}
                <div>
                  {isLocked ? (
                    <>
                      <p className="font-semibold">Account temporarily locked</p>
                      <p className="text-xs mt-0.5">Too many failed attempts. Try again in <span className="font-semibold tabular-nums">{countdown}</span>.</p>
                    </>
                  ) : (
                    <span>{error}</span>
                  )}
                </div>
              </div>
            )}

            {/* Attempts indicator */}
            {!isLocked && attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
              <div className="mt-3">
                <div className="flex gap-1">
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i < attemptsLeft ? 'bg-emerald-400' : 'bg-red-300'}`} />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} left before a 15-minute lock</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <div>
                <label htmlFor="credential" className="block text-sm font-medium text-slate-700 mb-1.5">Email or username</label>
                <div className="relative">
                  <User size={17} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="credential"
                    type="text"
                    value={credential}
                    onChange={e => setCredential(e.target.value)}
                    placeholder="you@example.com"
                    disabled={loading}
                    autoComplete="username"
                    autoFocus
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={17} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPass ? <EyeOff size={17} {...ICON} /> : <Eye size={17} {...ICON} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked}
                className="lg-shine group w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg
                           bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-semibold
                           shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              >
                {loading ? (
                  <><Loader2 size={17} className="animate-spin" /> Signing in…</>
                ) : isLocked ? (
                  <><Lock size={16} {...ICON} /> Locked · <span className="tabular-nums">{countdown}</span></>
                ) : (
                  <>Sign in <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" /></>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              New to Emerald Builders?{' '}
              <button onClick={() => navigate('/')} className="font-semibold text-emerald-700 hover:text-emerald-800">
                Send us an inquiry
              </button>
            </p>
          </div>
        </div>

        <p className="lg:hidden pb-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} Emerald Builders & Construction</p>
      </main>
    </div>
  )
}