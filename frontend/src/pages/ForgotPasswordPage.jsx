// src/pages/ForgotPasswordPage.jsx
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Check, Mail, Lock, Eye, EyeOff,
  HardHat, Loader2, KeyRound, ShieldCheck, MailCheck, RotateCcw, Clock,
} from 'lucide-react'
import { BASE_URL } from '../utils/api'
import { validatePassword } from '../utils/validators'

const ICON = { strokeWidth: 1.75 }

// Same server address as the rest of the app (…/backend) + /api, like every other endpoint
const API_BASE = `${BASE_URL}/api`

// POST helper: clear messages when the server can't be reached or sends back an error page
async function postJson(path, body, fallbackMsg) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Can't reach the server right now. Check your connection and try again.")
  }
  let data = {}
  try { data = await res.json() } catch { /* not JSON (e.g. a server error page) */ }
  if (!res.ok || data.success === false) throw new Error(data.error || fallbackMsg)
  return data
}

// Shows "ju***@gmail.com" so people can check the address without exposing it fully
const maskEmail = e => {
  const [user, domain] = String(e).split('@')
  if (!domain) return e
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, user.length - 2)))}@${domain}`
}

/* ── Animations (same family as the login page) ── */
const styles = `
  .fp, .fp h1, .fp h2 { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  @keyframes fp-up    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes fp-zoom  { from { transform: scale(1.1); } to { transform: scale(1); } }
  @keyframes fp-step  { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
  @keyframes fp-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
  @keyframes fp-pop   { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes fp-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
  .fp-up    { animation: fp-up .6s cubic-bezier(.2,.7,.2,1) both; }
  .fp-zoom  { animation: fp-zoom 14s ease-out both; }
  .fp-step  { animation: fp-step .45s cubic-bezier(.2,.7,.2,1) both; }
  .fp-shake { animation: fp-shake .45s ease-in-out both; }
  .fp-pop   { animation: fp-pop .5s cubic-bezier(.2,.7,.2,1) both; }
  .fp-pulse { animation: fp-pulse 2s infinite; }
  @media (prefers-reduced-motion: reduce) {
    .fp-up, .fp-zoom, .fp-step, .fp-shake, .fp-pop, .fp-pulse { animation: none !important; }
  }
`

// ── Steps ────────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Email',        icon: Mail },
  { label: 'Verify code',  icon: ShieldCheck },
  { label: 'New password', icon: KeyRound },
]

function StepBar({ current }) {
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current, active = i === current
        return (
          <li key={s.label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}
            aria-current={active ? 'step' : undefined}>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 flex-shrink-0
                ${done ? 'bg-emerald-600 text-white' : active ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={`hidden sm:block text-xs font-medium whitespace-nowrap ${active ? 'text-slate-900' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="flex-1 min-w-[20px] h-0.5 mx-2 rounded-full bg-slate-200 overflow-hidden">
                <span className={`block h-full bg-emerald-500 transition-all duration-500 ${done ? 'w-full' : 'w-0'}`} />
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── 6-digit code input ───────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled, invalid, onComplete }) {
  const digits = 6
  const refs = useRef([])
  const arr = value.split('').concat(Array(digits).fill('')).slice(0, digits)

  useEffect(() => { refs.current[0]?.focus() }, [])

  const setAt = (idx, char) => {
    const next = arr.slice()
    next[idx] = char
    onChange(next.join(''))
    if (next.every(Boolean)) onComplete?.(next.join(''))
  }

  const handleKey = (e, idx) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (arr[idx]) setAt(idx, '')
      else if (idx > 0) { const next = arr.slice(); next[idx - 1] = ''; onChange(next.join('')); refs.current[idx - 1]?.focus() }
      return
    }
    if (e.key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < digits - 1) refs.current[idx + 1]?.focus()
  }

  const handleChange = (e, idx) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    if (!char) return
    setAt(idx, char)
    if (idx < digits - 1) refs.current[idx + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, digits)
    if (!pasted) return
    onChange(pasted)
    refs.current[Math.min(pasted.length, digits - 1)]?.focus()
    if (pasted.length === digits) onComplete?.(pasted)
  }

  return (
    <div className="flex gap-2 sm:gap-2.5 justify-between" role="group" aria-label="6-digit code">
      {arr.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(e, i)}
          onKeyDown={e => handleKey(e, i)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          className={`w-full max-w-[52px] aspect-[5/6] text-center text-xl font-semibold tabular-nums rounded-xl border bg-white text-slate-900 shadow-sm outline-none transition-all duration-150
            focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed
            ${invalid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : d ? 'border-emerald-400 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/20'
              : 'border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20'}`}
        />
      ))}
    </div>
  )
}

// ── Password field with show/hide ────────────────────────────────────────────
function PasswordField({ id, label, value, onChange, show, onToggle, placeholder, autoComplete, invalid, autoFocus, disabled }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <Lock size={17} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          maxLength={64}
          className={`w-full h-11 pl-10 pr-11 text-sm rounded-lg bg-white text-slate-900 placeholder-slate-400 border shadow-sm transition-colors
            focus:outline-none focus:ring-2 disabled:bg-slate-50
            ${invalid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20'}`}
        />
        <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-md text-slate-400 hover:text-slate-700 transition-colors">
          {show ? <EyeOff size={17} {...ICON} /> : <Eye size={17} {...ICON} />}
        </button>
      </div>
    </div>
  )
}

const RULES = [
  { label: '8 or more characters', test: p => p.length >= 8 },
  { label: 'An uppercase letter',  test: p => /[A-Z]/.test(p) },
  { label: 'A lowercase letter',   test: p => /[a-z]/.test(p) },
  { label: 'A number',             test: p => /\d/.test(p) },
]

const btnPrimary = `group w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]
  text-white text-sm font-semibold shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2`

// ── Main page ────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step,        setStep]        = useState(0)   // 0 = email, 1 = code, 2 = new password
  const [email,       setEmail]       = useState('')
  const [otp,         setOtp]         = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [errorKey,    setErrorKey]    = useState(0)
  const [notice,      setNotice]      = useState('')
  const [success,     setSuccess]     = useState(false)
  const [cooldown,    setCooldown]    = useState(0)
  const [redirectIn,  setRedirectIn]  = useState(5)

  const showError = msg => { setError(msg); setErrorKey(k => k + 1); setNotice('') }
  const clearMsgs = () => { setError(''); setNotice('') }

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // After success: count down, then go to sign in
  useEffect(() => {
    if (!success) return
    if (redirectIn <= 0) { navigate('/login'); return }
    const t = setTimeout(() => setRedirectIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [success, redirectIn, navigate])

  // ── Step 0: send code ──
  const handleSendOtp = async (e) => {
    e.preventDefault()
    clearMsgs()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { showError('Enter a valid email address.'); return }
    setLoading(true)
    try {
      await postJson('/forgot-password/send-otp.php', { email: email.trim() }, 'Failed to send the code.')
      setOtp('')
      setStep(1)
      setCooldown(60)
    } catch (err) { showError(err.message) }
    finally { setLoading(false) }
  }

  // ── Step 1: verify code ──
  const verify = async (code = otp) => {
    if (loading) return
    clearMsgs()
    if (code.length < 6) { showError('Enter the full 6-digit code.'); return }
    setLoading(true)
    try {
      await postJson('/forgot-password/verify-otp.php', { email: email.trim(), otp: code }, 'That code is not correct.')
      setStep(2)
    } catch (err) { showError(err.message); setOtp('') }
    finally { setLoading(false) }
  }
  const handleVerifyOtp = e => { e.preventDefault(); verify() }

  const handleResend = async () => {
    if (cooldown > 0 || loading) return
    clearMsgs()
    setLoading(true)
    try {
      await postJson('/forgot-password/send-otp.php', { email: email.trim() }, 'Failed to resend the code.')
      setOtp('')
      setCooldown(60)
      setNotice('A new code is on its way. Codes expire after 5 minutes.')
    } catch (err) { showError(err.message) }
    finally { setLoading(false) }
  }

  // ── Step 2: new password ──
  const handleReset = async (e) => {
    e.preventDefault()
    clearMsgs()
    const pwErr = validatePassword(password)   // same rule as the server: 8–64, upper, lower, number
    if (pwErr) { showError(pwErr); return }
    if (password !== confirm) { showError('The passwords don’t match.'); return }
    setLoading(true)
    try {
      await postJson('/forgot-password/reset-password.php', { email: email.trim(), otp, password }, 'Failed to reset the password.')
      setSuccess(true)
    } catch (err) { showError(err.message) }
    finally { setLoading(false) }
  }

  const goBack = () => {
    clearMsgs()
    if (step === 0) navigate('/login')
    else if (step === 1) { setStep(0); setOtp('') }
    else { setStep(1); setPassword(''); setConfirm('') }
  }

  const passed = RULES.filter(r => r.test(password)).length
  const mismatch = confirm.length > 0 && confirm !== password
  const fmtCooldown = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}`

  const HEAD = [
    { icon: KeyRound,    title: 'Forgot your password?', text: 'Enter the email on your account and we’ll send you a 6-digit code.' },
    { icon: MailCheck,   title: 'Check your email',      text: <>We sent a code to <span className="font-medium text-slate-800">{maskEmail(email.trim())}</span>. It expires in 5 minutes.</> },
    { icon: ShieldCheck, title: 'Set a new password',    text: 'Choose a strong password you haven’t used here before.' },
  ][step]

  return (
    <div className="fp min-h-screen flex bg-white antialiased">
      <style>{styles}</style>

      {/* ── LEFT PANEL (desktop) ── */}
      <aside className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-slate-900">
        <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=70"
          alt="" aria-hidden="true" className="fp-zoom absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/85 to-emerald-900/70" />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-14">
          <button onClick={() => navigate('/')} className="fp-up self-start flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm ring-1 ring-white/10 flex items-center justify-center">
              <HardHat size={19} strokeWidth={2} className="text-white" />
            </span>
            <span className="text-left">
              <span className="block font-semibold text-white text-base leading-tight tracking-tight">SkillConnect</span>
              <span className="block text-xs text-white/60 leading-tight">Emerald Builders & Construction</span>
            </span>
          </button>

          <div>
            <p className="fp-up inline-flex items-center gap-2 h-8 pl-2 pr-3.5 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur text-xs font-medium text-white" style={{ animationDelay: '100ms' }}>
              <span className="fp-pulse w-2 h-2 rounded-full bg-emerald-400 ml-1" />
              Account recovery
            </p>
            <h1 className="fp-up mt-6 text-4xl xl:text-5xl font-semibold text-white tracking-tight leading-[1.08]" style={{ animationDelay: '200ms' }}>
              Back into your<br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">account in minutes.</span>
            </h1>
            <p className="fp-up mt-5 text-base text-slate-300 leading-relaxed max-w-md" style={{ animationDelay: '300ms' }}>
              Three quick steps. We’ll confirm it’s you with a code sent to your email.
            </p>

            <ul className="mt-10 space-y-3 max-w-md">
              {STEPS.map((s, i) => {
                const done = success || i < step, active = !success && i === step
                return (
                  <li key={s.label} className="fp-up" style={{ animationDelay: `${420 + i * 110}ms` }}>
                    <div className={`flex items-center gap-3.5 rounded-xl ring-1 backdrop-blur px-4 py-3 transition-colors duration-300
                      ${active ? 'bg-white/[0.12] ring-emerald-400/40' : 'bg-white/[0.05] ring-white/10'}`}>
                      <span className={`w-10 h-10 rounded-lg ring-1 flex items-center justify-center flex-shrink-0 transition-colors duration-300
                        ${done ? 'bg-emerald-500 text-white ring-emerald-400' : active ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40' : 'bg-white/5 text-slate-400 ring-white/10'}`}>
                        {done ? <Check size={18} strokeWidth={2.25} /> : <s.icon size={18} {...ICON} />}
                      </span>
                      <span>
                        <span className={`block text-sm font-semibold ${active || done ? 'text-white' : 'text-slate-300'}`}>{i + 1}. {s.label}</span>
                        <span className="block text-xs text-slate-400 mt-0.5">
                          {['Tell us where to send the code', 'Enter the 6-digit code', 'Choose a new password'][i]}
                        </span>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <p className="fp-up text-xs text-slate-500" style={{ animationDelay: '800ms' }}>© {new Date().getFullYear()} Emerald Builders & Construction</p>
        </div>
      </aside>

      {/* ── RIGHT PANEL ── */}
      <main className="relative flex-1 flex flex-col min-h-screen bg-slate-50 overflow-hidden">
        <div aria-hidden="true" className="hidden lg:block pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-200/40 blur-3xl" />
        <div aria-hidden="true" className="hidden lg:block pointer-events-none absolute -bottom-40 -left-24 w-96 h-96 rounded-full bg-teal-100/60 blur-3xl" />

        {/* Mobile brand bar */}
        <div className="lg:hidden relative overflow-hidden bg-slate-900 px-5 pt-6 pb-16">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900/80" />
          <div className="relative flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center"><HardHat size={18} strokeWidth={2} className="text-white" /></span>
              <span className="text-left">
                <span className="block font-semibold text-white text-[15px] leading-tight">SkillConnect</span>
                <span className="block text-xs text-white/60 leading-tight">Emerald Builders</span>
              </span>
            </button>
            <button onClick={() => navigate('/login')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowLeft size={16} {...ICON} /> Sign in
            </button>
          </div>
          <h1 className="relative mt-8 text-2xl font-semibold text-white tracking-tight">Reset your password</h1>
          <p className="relative mt-1 text-sm text-slate-300">Step {success ? 3 : step + 1} of 3</p>
        </div>

        <div className="relative flex-1 flex items-start lg:items-center justify-center px-5 sm:px-10 -mt-10 lg:mt-0 pb-10 lg:py-10">
          <div className="fp-up w-full max-w-[440px] rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)] p-6 sm:p-9" style={{ animationDelay: '150ms' }}>

            {success ? (
              /* ── Done ── */
              <div className="text-center py-4" role="status">
                <span className="fp-pop mx-auto w-16 h-16 rounded-full bg-emerald-50 ring-8 ring-emerald-50/60 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={32} {...ICON} />
                </span>
                <h2 className="mt-6 text-2xl font-semibold text-slate-900 tracking-tight">Password updated</h2>
                <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">You can now sign in with your new password.</p>
                <button onClick={() => navigate('/login')} className={`${btnPrimary} mt-8`}>
                  Go to sign in <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" />
                </button>
                <p className="mt-3 text-xs text-slate-400 tabular-nums">Taking you there in {redirectIn}s…</p>
              </div>
            ) : (
              <>
                <button onClick={goBack} disabled={loading}
                  className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700 transition-colors disabled:opacity-50 mb-7">
                  <ArrowLeft size={16} {...ICON} className="transition-transform group-hover:-translate-x-0.5" />
                  {step === 0 ? 'Back to sign in' : step === 1 ? 'Use a different email' : 'Back'}
                </button>

                <StepBar current={step} />

                <div key={step} className="fp-step mt-8">
                  <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center">
                    <HEAD.icon size={20} {...ICON} />
                  </span>
                  <h2 className="mt-4 text-2xl font-semibold text-slate-900 tracking-tight">{HEAD.title}</h2>
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{HEAD.text}</p>

                  {/* Messages */}
                  {error && (
                    <div key={errorKey} role="alert" className="fp-shake mt-6 flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                      <AlertCircle size={17} {...ICON} className="flex-shrink-0 mt-0.5 text-red-500" /><span>{error}</span>
                    </div>
                  )}
                  {notice && !error && (
                    <div role="status" className="fp-up mt-6 flex items-start gap-2.5 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
                      <CheckCircle2 size={17} {...ICON} className="flex-shrink-0 mt-0.5 text-emerald-600" /><span>{notice}</span>
                    </div>
                  )}

                  {/* ── Step 0: email ── */}
                  {step === 0 && (
                    <form onSubmit={handleSendOtp} noValidate className="mt-6 space-y-5">
                      <div>
                        <label htmlFor="fp-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                        <div className="relative">
                          <Mail size={17} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input id="fp-email" type="email" value={email} autoFocus autoComplete="email" maxLength={150}
                            onChange={e => { setEmail(e.target.value); if (error) setError('') }}
                            placeholder="you@example.com" disabled={loading}
                            className="w-full h-11 pl-10 pr-4 text-sm rounded-lg bg-white text-slate-900 placeholder-slate-400 border border-slate-200 shadow-sm hover:border-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 transition-colors" />
                        </div>
                      </div>
                      <button type="submit" disabled={loading} className={btnPrimary}>
                        {loading ? <><Loader2 size={17} className="animate-spin" /> Sending code…</>
                          : <>Send code <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" /></>}
                      </button>
                    </form>
                  )}

                  {/* ── Step 1: code ── */}
                  {step === 1 && (
                    <form onSubmit={handleVerifyOtp} noValidate className="mt-6 space-y-5">
                      <OtpInput key={errorKey} value={otp} onChange={v => { setOtp(v); if (error) setError('') }} disabled={loading}
                        invalid={!!error} onComplete={code => verify(code)} />

                      <button type="submit" disabled={loading || otp.length < 6} className={btnPrimary}>
                        {loading ? <><Loader2 size={17} className="animate-spin" /> Checking…</>
                          : <>Verify code <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" /></>}
                      </button>

                      <div className="flex items-center justify-between gap-3 pt-1 text-sm">
                        <span className="text-slate-500">Didn’t get it? Check your spam folder.</span>
                        {cooldown > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-400 tabular-nums whitespace-nowrap">
                            <Clock size={14} {...ICON} /> Resend in {fmtCooldown}
                          </span>
                        ) : (
                          <button type="button" onClick={handleResend} disabled={loading}
                            className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap disabled:opacity-50">
                            <RotateCcw size={14} {...ICON} /> Resend code
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  {/* ── Step 2: new password ── */}
                  {step === 2 && (
                    <form onSubmit={handleReset} noValidate className="mt-6 space-y-5">
                      <PasswordField id="fp-pass" label="New password" value={password} autoFocus disabled={loading}
                        onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                        show={showPass} onToggle={() => setShowPass(s => !s)} placeholder="Create a password" autoComplete="new-password" />

                      {/* Strength + checklist */}
                      <div>
                        <div className="flex gap-1">
                          {RULES.map((_, i) => (
                            <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300
                              ${i < passed ? (passed === 4 ? 'bg-emerald-500' : passed >= 3 ? 'bg-sky-500' : passed === 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-slate-200'}`} />
                          ))}
                        </div>
                        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                          {RULES.map(r => {
                            const ok = r.test(password)
                            return (
                              <li key={r.label} className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}>
                                  <Check size={10} strokeWidth={3} />
                                </span>
                                {r.label}
                              </li>
                            )
                          })}
                        </ul>
                      </div>

                      <div>
                        <PasswordField id="fp-confirm" label="Confirm new password" value={confirm} disabled={loading}
                          onChange={e => { setConfirm(e.target.value); if (error) setError('') }}
                          show={showConfirm} onToggle={() => setShowConfirm(s => !s)} placeholder="Type it again" autoComplete="new-password" invalid={mismatch} />
                        {mismatch && <p className="mt-1.5 text-xs text-red-600">The passwords don’t match.</p>}
                        {!mismatch && confirm && confirm === password && <p className="mt-1.5 text-xs text-emerald-700 flex items-center gap-1"><Check size={12} strokeWidth={2.5} /> Passwords match</p>}
                      </div>

                      <button type="submit" disabled={loading} className={btnPrimary}>
                        {loading ? <><Loader2 size={17} className="animate-spin" /> Saving…</>
                          : <>Update password <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" /></>}
                      </button>
                    </form>
                  )}
                </div>

                <p className="mt-8 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
                  Remembered it?{' '}
                  <button onClick={() => navigate('/login')} className="font-semibold text-emerald-700 hover:text-emerald-800">Sign in</button>
                </p>
              </>
            )}
          </div>
        </div>

        <p className="lg:hidden pb-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} Emerald Builders & Construction</p>
      </main>
    </div>
  )
}