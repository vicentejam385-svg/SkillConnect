// src/pages/ForgotPasswordPage.jsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, AlertCircle, CheckCircle2, Mail, KeyRound, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

// ── Step indicators ──────────────────────────────────────────────────────────
const STEPS = ['Email', 'Verify OTP', 'New Password']

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
                ${done   ? 'bg-emerald-600 border-emerald-600 text-white'   : ''}
                ${active ? 'bg-white border-emerald-600 text-emerald-600'   : ''}
                ${!done && !active ? 'bg-white border-gray-300 text-gray-400' : ''}`}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap
                ${active ? 'text-emerald-600' : done ? 'text-emerald-500' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all duration-300
                ${done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── OTP digit input ──────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const digits   = 6
  const inputRef = useRef([])
  const arr      = value.split('').concat(Array(digits).fill('')).slice(0, digits)

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      const next = arr.slice()
      if (next[idx]) {
        next[idx] = ''
      } else if (idx > 0) {
        next[idx - 1] = ''
        inputRef.current[idx - 1]?.focus()
      }
      onChange(next.join(''))
      return
    }
    if (e.key === 'ArrowLeft' && idx > 0)  { inputRef.current[idx - 1]?.focus(); return }
    if (e.key === 'ArrowRight' && idx < 5) { inputRef.current[idx + 1]?.focus(); return }
  }

  const handleChange = (e, idx) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    if (!char) return
    const next = arr.slice()
    next[idx]  = char
    onChange(next.join(''))
    if (idx < digits - 1) inputRef.current[idx + 1]?.focus()
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, digits)
    onChange(pasted.padEnd(digits, '').slice(0, digits))
    inputRef.current[Math.min(pasted.length, digits - 1)]?.focus()
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center">
      {arr.map((d, i) => (
        <input
          key={i}
          ref={el => inputRef.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
          className={`w-11 h-12 text-center text-lg font-bold border-2 rounded-lg outline-none transition-all duration-150
            ${d ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white text-gray-900'}
            focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
            disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step,        setStep]       = useState(0)   // 0=email, 1=otp, 2=reset
  const [email,       setEmail]      = useState('')
  const [otp,         setOtp]        = useState('')
  const [password,    setPassword]   = useState('')
  const [confirm,     setConfirm]    = useState('')
  const [showPass,    setShowPass]   = useState(false)
  const [showConfirm, setShowConfirm]= useState(false)
  const [loading,     setLoading]    = useState(false)
  const [error,       setError]      = useState('')
  const [success,     setSuccess]    = useState(false)

  // Resend cooldown
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const clearError = () => setError('')

  // ── Step 0: send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault()
    clearError()
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/forgot-password/send-otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send OTP.')
      setStep(1)
      setCooldown(120)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    clearError()
    if (otp.length < 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/forgot-password/verify-otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Invalid or expired OTP.')
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResend = async () => {
    if (cooldown > 0) return
    clearError()
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/forgot-password/send-otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to resend OTP.')
      setOtp('')
      setCooldown(60)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: reset password ────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault()
    clearError()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const res  = await fetch(`${API_BASE}/forgot-password/reset-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to reset password.')
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Password strength ─────────────────────────────────────────────────────
  const strength = (() => {
    let s = 0
    if (password.length >= 8)          s++
    if (/[A-Z]/.test(password))        s++
    if (/[0-9]/.test(password))        s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-emerald-500'][strength]

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50"
           style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-sm text-gray-500">
            Your password has been updated successfully.<br />Redirecting you to login…
          </p>
          <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-[progress_2.5s_linear_forwards]"
                 style={{ animation: 'shrink 2.5s linear forwards' }} />
          </div>
        </div>
        <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── LEFT PANEL (mirrors LoginPage) ── */}
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
            Forgot<br />Password?
          </h1>
          <p className="text-emerald-100 text-sm leading-relaxed max-w-xs">
            No worries — we'll send a one-time code to your email so you can get back into your account quickly and securely.
          </p>
        </div>

        {/* Info bullets */}
        <div className="relative z-10 space-y-5">
          {[
            { title: 'Step 1 – Enter Email',    desc: 'We verify your account exists'             },
            { title: 'Step 2 – Enter OTP',      desc: 'A 6-digit code is sent to your inbox'      },
            { title: 'Step 3 – New Password',   desc: 'Set a strong password and sign back in'    },
          ].map(({ title, desc }) => (
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
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-sm">

          {/* Back button */}
          <button
            onClick={() => step === 0 ? navigate('/login') : setStep(s => s - 1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors mb-6"
          >
            <ArrowLeft size={15} />
            {step === 0 ? 'Back to Login' : 'Back'}
          </button>

          {/* Mobile logo */}
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

          {/* Step bar */}
          <StepBar current={step} />

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ── STEP 0: Email ── */}
          {step === 0 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter the email address linked to your account and we'll send you a verification code.
              </p>
              <form onSubmit={handleSendOtp} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); clearError() }}
                      placeholder="you@example.com"
                      disabled={loading}
                      autoComplete="email"
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg
                                 placeholder-gray-400 text-gray-900
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                                 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                             bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                             text-white text-sm font-semibold rounded-lg
                             transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending…</span></>
                  ) : (
                    <><span>Send OTP Code</span><ArrowRight size={15} /></>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 1: OTP ── */}
          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Check Your Email</h2>
              <p className="text-sm text-gray-500 mb-1">
                We sent a 6-digit code to
              </p>
              <p className="text-sm font-semibold text-emerald-600 mb-6 truncate">{email}</p>

              <form onSubmit={handleVerifyOtp} noValidate className="space-y-5">
                <OtpInput value={otp} onChange={v => { setOtp(v); clearError() }} disabled={loading} />

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                             bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                             text-white text-sm font-semibold rounded-lg
                             transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Verifying…</span></>
                  ) : (
                    <><KeyRound size={15} /><span>Verify Code</span></>
                  )}
                </button>
              </form>

              {/* Resend */}
              <p className="mt-5 text-center text-sm text-gray-500">
                Didn't receive it?{' '}
                {cooldown > 0 ? (
                  <span className="text-gray-400">Resend in {cooldown}s</span>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-emerald-600 font-semibold hover:underline disabled:opacity-50"
                  >
                    Resend Code
                  </button>
                )}
              </p>
              <p className="mt-2 text-center text-xs text-gray-400">
                Code expires in 5 minutes. Check your spam folder if you don't see it.
              </p>
            </>
          )}

          {/* ── STEP 2: New Password ── */}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Set New Password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Choose a strong password. You'll use it to log in from now on.
              </p>
              <form onSubmit={handleReset} noValidate className="space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); clearError() }}
                      placeholder="Min. 8 characters"
                      disabled={loading}
                      autoComplete="new-password"
                      className="w-full px-4 py-2.5 pr-11 text-sm border border-gray-300 rounded-lg
                                 placeholder-gray-400 text-gray-900
                                 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                                 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {/* Strength meter */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4].map(n => (
                          <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300
                            ${strength >= n ? strengthColor : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className={`text-xs font-medium
                        ${strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-yellow-500' : strength === 3 ? 'text-blue-500' : 'text-emerald-600'}`}>
                        {strengthLabel}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value); clearError() }}
                      placeholder="Re-enter your password"
                      disabled={loading}
                      autoComplete="new-password"
                      className={`w-full px-4 py-2.5 pr-11 text-sm border rounded-lg
                                 placeholder-gray-400 text-gray-900
                                 focus:outline-none focus:ring-2 focus:border-transparent
                                 disabled:opacity-60 disabled:cursor-not-allowed transition
                                 ${confirm && password !== confirm
                                   ? 'border-red-400 focus:ring-red-300'
                                   : confirm && password === confirm
                                   ? 'border-emerald-400 focus:ring-emerald-300'
                                   : 'border-gray-300 focus:ring-emerald-500'}`}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                  )}
                  {confirm && password === confirm && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Passwords match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 mt-1
                             bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]
                             text-white text-sm font-semibold rounded-lg
                             transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Updating…</span></>
                  ) : (
                    <><Lock size={15} /><span>Reset Password</span></>
                  )}
                </button>
              </form>
            </>
          )}

          <p className="mt-10 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Emerald Builders & Construction. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}