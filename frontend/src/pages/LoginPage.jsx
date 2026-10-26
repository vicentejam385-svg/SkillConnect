// src/pages/LoginPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'

const FEATURES = [
  { title: 'Manage Projects',   desc: 'Track and manage your construction projects'  },
  { title: 'Schedule Services', desc: 'Book and schedule workforce approvals'          },
  { title: 'Real-Time Updates', desc: 'Get instant notifications on project progress' },
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

export default function LoginPage() {
  const navigate  = useNavigate()
  const { login } = useAuth()

  const [credential,   setCredential]   = useState('')
  const [password,     setPassword]     = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS)
  const [lockedUntil,  setLockedUntil]  = useState(null)
  const [countdown,    setCountdown]    = useState('')

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
      setError('Please enter your email/username and password.')
      return
    }

    // Guard: re-check lockout in case timer just expired
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

      // Success — clear lockout for this credential
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
        // The server locked this account after too many wrong passwords
        const ts = data.locked_until
          ? data.locked_until * 1000
          : Date.now() + (data.retry_after ?? LOCKOUT_MS / 1000) * 1000
        setLockoutState(credential, { attempts: MAX_ATTEMPTS, lockedUntil: ts })
        setLockedUntil(ts)
        setAttemptsLeft(0)
        setError(msg)

      } else if (status === 401) {
        // Wrong username/password: the only case that counts as a failed attempt
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
          setError('Too many failed attempts. Account locked for 15 minutes.')
        } else {
          setLockoutState(credential, { attempts, lockedUntil: null })
          setAttemptsLeft(remaining)
          setError(`${msg} — ${remaining} attempt${remaining !== 1 ? 's' : ''} left`)
        }

      } else {
        // 403 (suspended / inactive / pending), 422, 500, network error:
        // show the message only, no attempt counted
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── LEFT PANEL ── */}
      <div className="hidden md:flex md:w-[44%] bg-emerald-600 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-emerald-500/30 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-emerald-700/40 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M2 18h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2Z"/>
                <path d="M12 2a8 8 0 0 1 8 8v2H4v-2a8 8 0 0 1 8-8Z"/>
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-xl tracking-wide">SkillConnect</span>
              <p className="text-emerald-200 text-[11px] tracking-widest uppercase leading-none mt-0.5">
                Emerald Builders and Construction
              </p>
            </div>
          </div>

          <h1 className="text-white font-bold text-4xl lg:text-5xl leading-tight mb-4">
            Welcome<br />Back!
          </h1>
          <p className="text-emerald-100 text-sm leading-relaxed max-w-xs">
            Access your account to manage job orders, view schedules, and connect with our skilled workforce.
          </p>
        </div>

        <div className="relative z-10 space-y-5">
          {FEATURES.map(({ title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 size={13} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-emerald-200 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center px-5 py-8 sm:p-10 bg-white min-h-screen md:min-h-0">
        <div className="w-full max-w-sm">

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to Home
          </button>

          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M2 18h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2Z"/>
                <path d="M12 2a8 8 0 0 1 8 8v2H4v-2a8 8 0 0 1 8-8Z"/>
              </svg>
            </div>
            <span className="font-bold text-gray-800 text-lg">SkillConnect</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Sign In</h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-5">Enter your credentials to access your account</p>

          {/* Error / Lockout banner */}
          {(error || isLocked) && (
            <div className={`flex items-start gap-2 mb-5 p-3 rounded-lg border text-sm
              ${isLocked
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'bg-red-50 border-red-200 text-red-600'}`}>
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                {isLocked ? (
                  <>
                    <p className="font-semibold">Account temporarily locked</p>
                    <p className="text-xs mt-0.5">Try again in <span className="font-mono font-bold">{countdown}</span></p>
                  </>
                ) : (
                  <span>{error}</span>
                )}
              </div>
            </div>
          )}

          {/* Attempts indicator — only show when attempts have been used */}
          {!isLocked && attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && (
            <div className="flex gap-1 mb-4">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < attemptsLeft ? 'bg-emerald-400' : 'bg-red-300'
                  }`}
                />
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email/Username
              </label>
              <input
                type="text"
                value={credential}
                onChange={e => setCredential(e.target.value)}
                placeholder="Enter your email or username"
                disabled={loading}
                autoComplete="username"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg
                           placeholder-gray-400 text-gray-900
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           disabled:opacity-60 disabled:cursor-not-allowed transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 pr-11 text-sm border border-gray-300 rounded-lg
                             placeholder-gray-400 text-gray-900
                             focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                             disabled:opacity-60 disabled:cursor-not-allowed transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mt-1
                         bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                         text-white text-sm font-semibold rounded-lg
                         transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : isLocked ? (
                <span>Locked — {countdown}</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Emerald Builders & Construction. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}