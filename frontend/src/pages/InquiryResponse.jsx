// src/pages/InquiryResponse.jsx
// PUBLIC page (no login) opened by the buttons in the "We received your inquiry" email:
//   /inquiry-response?t=<private link>&a=proceed|cancel
// The customer confirms Yes, proceed or No, cancel. The answer is saved on the inquiry;
// the admin still marks it Won or Lost by hand.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HardHat, CheckCircle2, XCircle, Loader2, AlertCircle, ClipboardList, MapPin, Calendar, Wrench, Clock } from 'lucide-react'

const API = 'https://saddlebrown-swan-877763.hostingersite.com/backend/api/inquiries/respond.php'
const ICON = { strokeWidth: 1.75 }

const fmt = (s, opts) => {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  return isNaN(d) ? s : d.toLocaleString('en-PH', opts)
}

export default function InquiryResponse() {
  const [params] = useSearchParams()
  const token  = params.get('t') || ''
  const picked = ['proceed', 'cancel'].includes(params.get('a')) ? params.get('a') : null

  const [inq,     setInq]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [choice,  setChoice]  = useState(picked)
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(null)   // success message after saving

  useEffect(() => {
    let alive = true
    fetch(`${API}?t=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        if (!d.success) setError(d.error || 'This link is not valid.')
        else setInq(d.inquiry)
      })
      .catch(() => alive && setError('We couldn’t load your inquiry. Please check your connection and try again.'))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [token])

  const save = async () => {
    if (!choice || saving) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, answer: choice }) })
      const d = await res.json()
      if (d.inquiry) setInq(d.inquiry)
      if (!d.success) throw new Error(d.error)
      setDone(d.message)
    } catch (e) { setError(e.message || 'Something went wrong. Please try again.') }
    setSaving(false)
  }

  const open = inq?.state === 'open'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto h-16 px-4 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><HardHat size={18} {...ICON} /></span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-slate-900 tracking-tight">SkillConnect</span>
            <span className="block text-[11px] text-slate-500">Emerald Builders</span>
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8 sm:py-12">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 flex flex-col items-center text-slate-500">
            <Loader2 size={24} className="animate-spin text-emerald-600" />
            <p className="text-sm mt-3">Loading your inquiry…</p>
          </div>
        ) : !inq ? (
          <Message icon={AlertCircle} tone="red" title="Link not valid" text={error} />
        ) : done ? (
          <Message icon={inq.answer === 'proceed' ? CheckCircle2 : XCircle} tone={inq.answer === 'proceed' ? 'green' : 'slate'}
            title={inq.answer === 'proceed' ? 'Thank you!' : 'Inquiry cancelled'} text={done}
            foot={inq.answer === 'proceed'
              ? `You can change your answer using the same email link until our team reviews inquiry ${inq.inquiry_code}.`
              : `Inquiry ${inq.inquiry_code} is now closed. If this was a mistake, please contact us or send a new inquiry.`} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 sm:px-6 pt-6 pb-5 border-b border-slate-100">
              <p className="text-sm text-slate-500">Hi {inq.first_name},</p>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight mt-1">
                {open ? 'Do you want to proceed with your inquiry?' : 'Your inquiry'}
              </h1>
            </div>

            <dl className="px-5 sm:px-6 py-4 space-y-3 text-sm">
              <Row icon={ClipboardList} label="Inquiry" value={inq.inquiry_code} />
              <Row icon={Wrench} label="Service" value={inq.service} />
              <Row icon={MapPin} label="Address" value={inq.address} />
              <Row icon={Calendar} label="Sent on" value={fmt(inq.sent_at, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} />
            </dl>

            <div className="px-5 sm:px-6 py-5 border-t border-slate-100 bg-slate-50/60">
              {inq.state === 'closed' ? (
                <p className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 size={18} {...ICON} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  {inq.decision === 'won'
                    ? 'Our team has accepted your inquiry. Please check your email for your SkillConnect login details.'
                    : inq.answer === 'cancel'
                      ? 'You cancelled this inquiry, so it is now closed. If this was a mistake, please contact us or send a new inquiry.'
                      : 'Our team has already reviewed this inquiry. Please contact us if you have any questions.'}
                </p>
              ) : inq.state === 'expired' ? (
                <p className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Clock size={18} {...ICON} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  This link has expired. Please contact us to continue with your inquiry.
                </p>
              ) : (
                <>
                  {inq.answer && (
                    <p className="text-xs text-slate-500 mb-3">
                      Your current answer: <span className="font-medium text-slate-700">{inq.answer === 'proceed' ? 'Yes, proceed' : 'No, cancel'}</span>
                      {inq.answer_at ? ` (${fmt(inq.answer_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})` : ''}. You can change it below.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Your answer">
                    <Choice on={choice === 'proceed'} onClick={() => setChoice('proceed')} icon={CheckCircle2} title="Yes, proceed" text="I still need this service." tone="green" />
                    <Choice on={choice === 'cancel'} onClick={() => setChoice('cancel')} icon={XCircle} title="No, cancel" text="I don't need it anymore." tone="red" />
                  </div>
                  {choice === 'cancel' && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-600">
                      <AlertCircle size={14} {...ICON} className="text-amber-500 flex-shrink-0 mt-px" />
                      Cancelling closes your inquiry right away and can’t be undone.
                    </p>
                  )}
                  {error && <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={14} {...ICON} />{error}</p>}
                  <button onClick={save} disabled={!choice || saving}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {saving ? 'Saving…' : !choice ? 'Choose an answer' : choice === 'proceed' ? 'Confirm: Yes, proceed' : 'Confirm: No, cancel'}
                  </button>
                  {inq.expires_at && (
                    <p className="text-[11px] text-slate-400 text-center mt-3">This link works until {fmt(inq.expires_at, { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} Emerald Builders &amp; Construction</footer>
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
      <dt className="text-slate-500 w-20 flex-shrink-0">{label}</dt>
      <dd className="text-slate-900 min-w-0 break-words">{value}</dd>
    </div>
  )
}

function Choice({ on, onClick, icon: Icon, title, text, tone }) {
  const onCls = tone === 'green' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-red-500 bg-red-50 ring-1 ring-red-500'
  const iconCls = tone === 'green' ? 'text-emerald-600' : 'text-red-500'
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`text-left rounded-xl border px-4 py-3.5 transition-colors ${on ? onCls : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={18} {...ICON} className={iconCls} />{title}</span>
      <span className="block text-xs text-slate-500 mt-1">{text}</span>
    </button>
  )
}

function Message({ icon: Icon, tone, title, text, foot }) {
  const cls = tone === 'green' ? 'bg-emerald-50 text-emerald-600 ring-emerald-100'
    : tone === 'red' ? 'bg-red-50 text-red-500 ring-red-100' : 'bg-slate-50 text-slate-500 ring-slate-200'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-6 py-10 flex flex-col items-center text-center">
      <span className={`w-14 h-14 rounded-2xl ring-1 flex items-center justify-center ${cls}`}><Icon size={26} {...ICON} /></span>
      <h1 className="text-lg font-semibold text-slate-900 mt-4">{title}</h1>
      {text && <p className="text-sm text-slate-600 mt-1.5 max-w-sm">{text}</p>}
      {foot && <p className="text-xs text-slate-400 mt-4 max-w-sm">{foot}</p>}
    </div>
  )
}