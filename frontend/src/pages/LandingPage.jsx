import { useState, useEffect, useCallback, useRef } from 'react'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import { useNavigate } from 'react-router-dom'
import {
  HardHat, ClipboardList, ArrowRight, CheckCircle2, Building2, Wrench, Shield, Send,
  AlertCircle, Mail, Phone, MapPin, Clock, Zap, Award, Hammer, TreePine,
  PaintBucket, Layers, Droplets, LayoutGrid, Menu, X, ChevronDown, Loader2,
  UserCheck, LineChart, Star, Users,
} from 'lucide-react'

const ICON = { strokeWidth: 1.75 }
const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ── Page-level animation styles ── */
const styles = `
  .lp, .lp h1, .lp h2, .lp h3, .lp h4 { font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  @keyframes lp-up    { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes lp-zoom  { from { transform: scale(1.1); } to { transform: scale(1); } }
  @keyframes lp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes lp-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
  @keyframes lp-bar   { from { width: 0; } }
  .lp-up     { animation: lp-up .8s cubic-bezier(.2,.7,.2,1) both; }
  .lp-zoom   { animation: lp-zoom 14s ease-out both; }
  .lp-float  { animation: lp-float 6s ease-in-out infinite; }
  .lp-marquee { animation: lp-marquee 38s linear infinite; }
  .lp-marquee-wrap:hover .lp-marquee { animation-play-state: paused; }
  .lp-pulse  { animation: lp-pulse 2s infinite; }
  .lp-bar    { animation: lp-bar 1.6s cubic-bezier(.2,.7,.2,1) .9s both; }
  @keyframes lp-fade  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lp-sheet { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
  .lp-fade  { animation: lp-fade .25s ease both; }
  .lp-sheet { animation: lp-sheet .4s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes lp-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 60%, 100% { transform: translateX(260%) skewX(-20deg); } }
  .lp-shine { position: relative; overflow: hidden; isolation: isolate; }
  .lp-shine::after { content: ''; position: absolute; inset: 0; width: 40%; z-index: -1;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
    animation: lp-shine 3.6s ease-in-out infinite; pointer-events: none; }
  @keyframes lp-word { from { opacity: 0; transform: translateY(60%); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
  .lp-word { display: inline-block; animation: lp-word .55s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes lp-ring { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(1.6); opacity: 0; } }
  .lp-ring { animation: lp-ring 2.2s cubic-bezier(.2,.7,.2,1) infinite; }
  @keyframes lp-wiggle { 0%, 88%, 100% { transform: rotate(0); } 91% { transform: rotate(-12deg); } 94% { transform: rotate(10deg); } 97% { transform: rotate(-6deg); } }
  .lp-wiggle { animation: lp-wiggle 4s ease-in-out infinite; transform-origin: 50% 60%; }
  .lp-noscroll::-webkit-scrollbar { display: none; }
  .lp-noscroll { scrollbar-width: none; }
  @media (prefers-reduced-motion: reduce) {
    .lp-up, .lp-zoom, .lp-float, .lp-fade, .lp-sheet, .lp-word, .lp-ring, .lp-wiggle, .lp-shine::after, .lp-marquee, .lp-pulse, .lp-bar { animation: none !important; }
    html { scroll-behavior: auto; }
  }
`

/* ── Reveal on scroll ── */
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReduced()) { setShown(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${className} transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)] ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
    >
      {children}
    </Tag>
  )
}

/* ── Count-up ── */
function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    if (prefersReduced()) { setCount(target); return }
    let startTime = null, raf
    const step = ts => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      setCount(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, start])
  return count
}

/* ── Section heading ── */
function SectionHeading({ eyebrow, title, text, align = 'center', dark = false }) {
  return (
    <Reveal className={`${align === 'center' ? 'text-center mx-auto' : ''} max-w-2xl`}>
      {eyebrow && (
        <p className={`inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
          <span className={`w-6 h-px ${dark ? 'bg-emerald-300' : 'bg-emerald-600'}`} />{eyebrow}
        </p>
      )}
      <h2 className={`mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
      {text && <p className={`mt-4 text-base leading-relaxed ${dark ? 'text-emerald-100/80' : 'text-slate-600'}`}>{text}</p>}
    </Reveal>
  )
}

/* ── Rotating word (hero) ── */
function RotatingWord({ words, interval = 2200 }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (prefersReduced()) return
    const t = setInterval(() => setI(n => (n + 1) % words.length), interval)
    return () => clearInterval(t)
  }, [words.length, interval])
  return <span key={i} className="lp-word">{words[i]}</span>
}

/* ── Inquiry form (same fields, rules and API as before) ── */
const REASONS = [
  'New Construction', 'Renovation & Remodeling', 'Repair & Maintenance', 'Electrical Installation',
  'Plumbing Services', 'Painting & Finishing', 'Carpentry', 'Masonry', 'Roofing', 'Landscaping',
  'Interior Design', 'Project Management', 'Other',
]

function InquiryForm({ initialReason = '' }) {
  const [form, setForm] = useState({
    first_name: '', middle_initial: '', last_name: '', suffix: '',
    email: '', mobile: '+63',
    province: '', city: '', barangay: '', house_street: '',
    description: '', reason: REASONS.includes(initialReason) ? initialReason : '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apiError, setApiError] = useState('')

  const f = (key, val) => { setForm(p => ({ ...p, [key]: val })); setErrors(e => ({ ...e, [key]: undefined })) }

  const NCR_CODE = '1300000000'
  const filteredCities = form.province ? getMunicipalitiesByProvince(form.province) : []
  const filteredBarangays = form.city ? getBarangaysByMunicipality(form.city) : []
  const provinceName = form.province === NCR_CODE ? 'Metro Manila' : getAllProvinces().find(p => p.psgcCode === form.province)?.name ?? ''
  const cityName = filteredCities.find(c => c.psgcCode === form.city)?.name
  const buildAddress = () => [form.house_street, form.barangay, cityName, provinceName].filter(Boolean).join(', ')

  const validate = () => {
    const e = {}
    if (!form.first_name.trim()) e.first_name = 'First name is required.'
    else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.first_name.trim())) e.first_name = 'First name must contain letters only, with no repeated or trailing hyphens.'
    if (!form.last_name.trim()) e.last_name = 'Last name is required.'
    else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.last_name.trim())) e.last_name = 'Last name must contain letters only, with no repeated or trailing hyphens.'
    if (!form.middle_initial.trim()) e.middle_initial = 'Middle initial is required.'
    else if (!/^[A-Za-z]{1,2}\.?$/.test(form.middle_initial.trim())) e.middle_initial = 'Enter a valid middle initial (e.g. A or A.).'
    if (!form.email.trim()) e.email = 'Email address is required.'
    else {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
      const validTLDs = ['com','net','org','edu','gov','ph','io','info','biz','me','tv','us','uk','au','ca','de','fr','jp','sg','nz','in']
      const tld = form.email.trim().split('.').pop().toLowerCase()
      if (!emailRegex.test(form.email.trim())) e.email = 'Enter a valid email address (e.g. name@example.com).'
      else if (!validTLDs.includes(tld)) e.email = 'Enter a valid email domain (e.g. .com, .net, .org, .ph).'
    }
    const m = form.mobile.trim()
    if (!m || m === '+63') e.mobile = 'Mobile number is required.'
    else if (m.startsWith('+63')) { if (!/^\+639\d{9}$/.test(m)) e.mobile = 'Enter a valid PH mobile number (e.g. +639XXXXXXXXX).' }
    else if (m.startsWith('09')) { if (!/^09\d{9}$/.test(m)) e.mobile = 'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).' }
    else e.mobile = 'Mobile number must start with +639 or 09.'
    if (!form.province) e.province = 'Province is required.'
    if (!form.city) e.city = 'City / Municipality is required.'
    if (!form.barangay) e.barangay = 'Barangay is required.'
    if (!form.house_street.trim()) e.house_street = 'House No. & Street is required.'
    if (!form.reason) e.reason = 'Please select a reason for inquiry.'
    if (form.reason === 'Other' && !form.description.trim()) e.description = 'Please specify your reason.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    setApiError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('https://saddlebrown-swan-877763.hostingersite.com/backend/api/inquiries/create.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, address: buildAddress() }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSuccess(true)
      setForm({ first_name: '', middle_initial: '', last_name: '', suffix: '', email: '', mobile: '+63', province: '', city: '', barangay: '', house_street: '', description: '', reason: '' })
    } catch (err) {
      setApiError(err.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const input = key => `w-full h-11 px-3.5 text-sm rounded-lg bg-white text-slate-900 placeholder-slate-400 border transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
    ${errors[key] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20'}`
  const label = 'block text-sm font-medium text-slate-700 mb-1.5'
  const req = <span className="text-red-500">*</span>
  const Err = ({ k }) => errors[k] ? <p className="text-red-600 text-xs mt-1.5 flex items-start gap-1"><AlertCircle size={12} {...ICON} className="mt-0.5 flex-shrink-0" />{errors[k]}</p> : null
  const Chev = () => <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />

  if (success) return (
    <div className="lp-up flex flex-col items-center justify-center text-center py-14 px-4">
      <div className="w-16 h-16 rounded-full bg-emerald-50 ring-8 ring-emerald-50/60 flex items-center justify-center">
        <CheckCircle2 size={32} {...ICON} className="text-emerald-600" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-slate-900">Inquiry received</h3>
      <p className="mt-2 text-slate-600 max-w-sm">Thank you. Our team will review your project and get back to you within one business day.</p>
      <button onClick={() => setSuccess(false)} className="mt-6 h-10 px-5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
        Submit another inquiry
      </button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
      {apiError && (
        <div className="sm:col-span-2 flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} {...ICON} className="mt-0.5 flex-shrink-0" />{apiError}
        </div>
      )}

      <div>
        <label className={label}>First name {req}</label>
        <input className={input('first_name')} value={form.first_name} onChange={e => f('first_name', e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'\-]/g, ''))} placeholder="Juan" />
        <Err k="first_name" />
      </div>
      <div>
        <label className={label}>Middle initial {req}</label>
        <input className={input('middle_initial')} value={form.middle_initial} onChange={e => f('middle_initial', e.target.value)} placeholder="A." maxLength={3} />
        <Err k="middle_initial" />
      </div>
      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <label className={label}>Last name {req}</label>
          <input className={input('last_name')} value={form.last_name} onChange={e => f('last_name', e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'\-]/g, ''))} placeholder="Dela Cruz" />
          <Err k="last_name" />
        </div>
        <div className="w-24">
          <label className={label}>Suffix</label>
          <input className={input('suffix')} value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="Jr." maxLength={10} />
        </div>
      </div>
      <div>
        <label className={label}>Mobile number {req}</label>
        <input
          className={input('mobile')}
          value={form.mobile}
          inputMode="tel"
          onChange={e => {
            let val = e.target.value
            if (!val.startsWith('+63')) val = '+63'
            let digits = val.slice(3).replace(/\D/g, '')
            if (digits.startsWith('0')) digits = digits.slice(1)
            f('mobile', '+63' + digits.slice(0, 10))
          }}
          placeholder="+639XXXXXXXXX"
          maxLength={13}
        />
        <Err k="mobile" />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Email address {req}</label>
        <input className={input('email')} type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="name@email.com" />
        <Err k="email" />
      </div>

      <div className="sm:col-span-2 pt-1">
        <p className="text-sm font-semibold text-slate-900 flex items-center gap-2"><MapPin size={15} {...ICON} className="text-emerald-600" />Project address</p>
      </div>
      <div className="sm:col-span-2">
        <label className={label}>Province {req}</label>
        <div className="relative">
          <select className={`${input('province')} appearance-none pr-9 cursor-pointer`} value={form.province}
            onChange={e => { setForm(p => ({ ...p, province: e.target.value, city: '', barangay: '' })); setErrors(er => ({ ...er, province: undefined })) }}>
            <option value="">Select province</option>
            <option value="1300000000">Metro Manila (NCR)</option>
          </select>
          <Chev />
        </div>
        <Err k="province" />
      </div>
      <div>
        <label className={label}>City / municipality {req}</label>
        <div className="relative">
          <select className={`${input('city')} appearance-none pr-9 cursor-pointer`} value={form.city} disabled={!form.province}
            onChange={e => { setForm(p => ({ ...p, city: e.target.value, barangay: '' })); setErrors(er => ({ ...er, city: undefined })) }}>
            <option value="">{form.province ? 'Select city' : 'Choose a province first'}</option>
            {filteredCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
          </select>
          <Chev />
        </div>
        <Err k="city" />
      </div>
      <div>
        <label className={label}>Barangay {req}</label>
        <div className="relative">
          <select className={`${input('barangay')} appearance-none pr-9 cursor-pointer`} value={form.barangay} disabled={!form.city} onChange={e => f('barangay', e.target.value)}>
            <option value="">{form.city ? 'Select barangay' : 'Choose a city first'}</option>
            {filteredBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <Chev />
        </div>
        <Err k="barangay" />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>House no. and street {req}</label>
        <input className={input('house_street')} value={form.house_street} onChange={e => f('house_street', e.target.value)} placeholder="123 Rizal Street" />
        <Err k="house_street" />
      </div>

      <div className="sm:col-span-2">
        <label className={label}>What do you need help with? {req}</label>
        <div className="relative">
          <select className={`${input('reason')} appearance-none pr-9 cursor-pointer`} value={form.reason} onChange={e => f('reason', e.target.value)}>
            <option value="">Select a service</option>
            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <Chev />
        </div>
        <Err k="reason" />
      </div>
      {form.reason === 'Other' && (
        <div className="sm:col-span-2 lp-up">
          <label className={label}>Tell us more {req}</label>
          <textarea className={`${input('description')} h-auto py-3 resize-none`} rows={3} value={form.description} onChange={e => f('description', e.target.value)} placeholder="Describe your project or what you need" />
          <Err k="description" />
        </div>
      )}

      <div className="sm:col-span-2 pt-1">
        <button onClick={handleSubmit} disabled={submitting}
          className="group w-full h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm shadow-emerald-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
          {submitting
            ? <><Loader2 size={17} className="animate-spin" /> Sending your inquiry…</>
            : <><Send size={16} {...ICON} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /> Submit inquiry</>}
        </button>
        <p className="mt-3 text-xs text-slate-500 text-center">We only use your details to respond to this inquiry.</p>
      </div>
    </div>
  )
}

/* ── Services (text only) ── */
const SERVICES = [
  { icon: Hammer,        title: 'New Construction',        desc: 'Residential, commercial and industrial builds, from plans to handover.', features: ['Residential buildings', 'Commercial installations', 'Industrial facilities', 'Quality assurance'] },
  { icon: Wrench,        title: 'Renovation & Remodeling', desc: 'Transform your space while keeping its structure sound.', features: ['Kitchen renovation', 'Bathroom remodeling', 'Room additions', 'Interior upgrades'] },
  { icon: Shield,        title: 'Repair & Maintenance',    desc: 'Keep your property in top shape with repairs and inspections.', features: ['Structural repairs', 'Preventive maintenance', 'Emergency repairs', 'Regular inspections'] },
  { icon: Zap,           title: 'Electrical Installation', desc: 'Safe, efficient and code-compliant electrical systems.', features: ['Panel installation', 'Commercial fitting', 'Renovation wiring', 'Safety & compliance'] },
  { icon: Droplets,      title: 'Plumbing Services',       desc: 'Reliable water and drainage, from new pipework to leak repairs.', features: ['Pipe installation', 'Leak detection', 'Drain cleaning', 'Water heater service'] },
  { icon: PaintBucket,   title: 'Painting & Finishing',    desc: 'Premium paints and clean finishes that protect your property.', features: ['Interior painting', 'Exterior painting', 'Texture coating', 'Waterproofing'] },
  { icon: Layers,        title: 'Carpentry',               desc: 'Custom woodwork, from built-ins to structural framing.', features: ['Custom furniture', 'Cabinet installation', 'Door and window frames', 'Wooden flooring'] },
  { icon: Building2,     title: 'Masonry',                 desc: 'Brickwork, stonework and concrete built to last.', features: ['Brick and block laying', 'Concrete work', 'Stone masonry', 'Retaining walls'] },
  { icon: HardHat,       title: 'Roofing',                 desc: 'Installation, repair and replacement for lasting protection.', features: ['New installation', 'Roof repair', 'Gutter installation', 'Roof inspection'] },
  { icon: TreePine,      title: 'Landscaping',             desc: 'Beautiful, functional outdoor spaces designed around you.', features: ['Landscape design', 'Garden installation', 'Hardscaping', 'Irrigation systems'] },
  { icon: LayoutGrid,    title: 'Interior Design',         desc: 'Spaces that balance looks and function, tailored to your style.', features: ['Space planning', 'Furniture selection', 'Color consultation', 'Lighting design'] },
  { icon: ClipboardList, title: 'Project Management',      desc: 'End-to-end coordination, on time and on budget.', features: ['Planning & scheduling', 'Budget management', 'Quality control', 'Progress reporting'] },
]

/* Pick a service → its details animate in below the grid (one panel, so no extra scrolling) */
function ServicesSection({ onInquire }) {
  const [active, setActive] = useState(0)
  const [panelKey, setPanelKey] = useState(0)
  const s = SERVICES[active]

  const pick = i => { if (i !== active) { setActive(i); setPanelKey(k => k + 1) } }

  return (
    <section id="services" className="py-16 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <SectionHeading eyebrow="Products & services" title="Every trade your project needs" text="Twelve specialties, delivered by licensed professionals. Pick one to see what’s included." />

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {SERVICES.map((svc, i) => {
            const on = i === active
            return (
              <Reveal key={svc.title} delay={(i % 6) * 60}>
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={on}
                  className={`group relative w-full h-full flex flex-col items-start gap-3 rounded-xl p-3.5 sm:p-4 text-left ring-1 transition-all duration-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                    ${on ? 'bg-emerald-600 ring-emerald-600 shadow-lg shadow-emerald-600/25 -translate-y-0.5'
                         : 'bg-white ring-slate-200 hover:ring-emerald-300 hover:-translate-y-0.5 hover:shadow-md'}`}
                >
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300
                    ${on ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-600 group-hover:scale-110'}`}>
                    <svc.icon size={18} {...ICON} />
                  </span>
                  <span className={`text-[13px] sm:text-sm font-semibold leading-snug ${on ? 'text-white' : 'text-slate-800'}`}>{svc.title}</span>
                </button>
              </Reveal>
            )
          })}
        </div>

        {/* Details panel */}
        <div key={panelKey} className="lp-up mt-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-5 sm:p-6 grid sm:grid-cols-[1fr_auto] gap-5 sm:items-center">
          <div className="flex items-start gap-4 min-w-0">
            <span className="hidden sm:flex w-12 h-12 rounded-xl bg-emerald-600 text-white items-center justify-center flex-shrink-0">
              <s.icon size={22} {...ICON} />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {s.features.map((f, i) => (
                  <li key={f} className="lp-up flex items-center gap-2 text-sm text-slate-700" style={{ animationDelay: `${120 + i * 60}ms` }}>
                    <CheckCircle2 size={15} {...ICON} className="text-emerald-500 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={() => onInquire(s.title)}
            className="lp-shine group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap">
            Inquire about this <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  )
}

/* ── Inquiry popup: bottom sheet on phones, centered on desktop ── */
function InquiryModal({ onClose, service }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="lp-fade absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Submit an inquiry"
        className="lp-sheet relative w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="sm:hidden mx-auto mt-2.5 w-10 h-1.5 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between gap-3 px-5 sm:px-8 pt-4 sm:pt-7 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0"><Send size={18} {...ICON} /></span>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900">Submit an inquiry</h3>
              <p className="text-sm text-slate-500 mt-0.5">{service ? <>About <span className="font-medium text-emerald-700">{service}</span>. We reply within one business day.</> : 'Tell us about your project. We reply within one business day.'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={20} {...ICON} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
          <InquiryForm initialReason={service} />
        </div>
      </div>
    </div>
  )
}

const NAV_LINKS = [
  { id: 'about',    label: 'About us' },
  { id: 'services', label: 'Services' },
  { id: 'contact',  label: 'Contact' },
]

const CONTACTS = [
  { icon: Mail,   title: 'Email',         lines: ['info@emeraldbuilders.com', 'support@emeraldbuilders.com'], href: 'mailto:info@emeraldbuilders.com' },
  { icon: Phone,  title: 'Phone',         lines: ['+63 123 456 7890', '+63 456 654 3210'],                    href: 'tel:+631234567890' },
  { icon: MapPin, title: 'Office',        lines: ['123 Batikan John Avenue, Quezon City, Metro Manila 1010'] },
  { icon: Clock,  title: 'Working hours', lines: ['Monday – Sunday, 8:00 AM – 6:00 PM'] },
]

/* ── Main page ── */
export default function LandingPage() {
  const navigate = useNavigate()
  const [statsVisible, setStatsVisible] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [quoteService, setQuoteService] = useState('')
  const [pastHero, setPastHero] = useState(false)

  const projects = useCountUp(500, 1800, statsVisible)
  const workers  = useCountUp(120, 1800, statsVisible)
  const clients  = useCountUp(85,  1800, statsVisible)
  const years    = useCountUp(12,  1800, statsVisible)

  useEffect(() => { const t = setTimeout(() => setStatsVisible(true), 600); return () => clearTimeout(t) }, [])

  useEffect(() => {
    const onScroll = () => { setScrolled(window.scrollY > 24); setPastHero(window.scrollY > window.innerHeight * 0.7) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) })
    }, { rootMargin: '-45% 0px -50% 0px' })
    NAV_LINKS.forEach(l => { const el = document.getElementById(l.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])

  const scrollTo = id => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: prefersReduced() ? 'auto' : 'smooth' })
  }
  const openQuote = (service = '') => { setMobileMenuOpen(false); setQuoteService(typeof service === 'string' ? service : ''); setQuoteOpen(true) }
  const closeQuote = useCallback(() => setQuoteOpen(false), [])

  const solidNav = scrolled || mobileMenuOpen
  const showSticky = pastHero && !quoteOpen && activeSection !== 'contact'

  return (
    <div className="lp min-h-screen bg-white text-slate-800 antialiased">
      <style>{styles}</style>

      {/* ══════════════ NAV ══════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${solidNav ? 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)]' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button onClick={() => scrollTo('home')} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm ring-1 ring-emerald-700/20 flex items-center justify-center">
              <HardHat size={18} strokeWidth={2} className="text-white" />
            </span>
            <span className="text-left">
              <span className={`block font-semibold text-[15px] leading-tight tracking-tight transition-colors ${solidNav ? 'text-slate-900' : 'text-white'}`}>SkillConnect</span>
              <span className={`block text-xs leading-tight transition-colors ${solidNav ? 'text-slate-500' : 'text-white/70'}`}>Emerald Builders</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 mr-3">
              {NAV_LINKS.map(l => {
                const on = activeSection === l.id
                return (
                  <button key={l.id} onClick={() => scrollTo(l.id)}
                    className={`relative px-3 h-9 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                      ${solidNav ? (on ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100') : (on ? 'text-white' : 'text-white/75 hover:text-white hover:bg-white/10')}`}>
                    {l.label}
                    <span className={`absolute left-3 right-3 -bottom-[1px] h-0.5 rounded-full transition-all duration-300 ${on ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'} ${solidNav ? 'bg-emerald-600' : 'bg-white'}`} />
                  </button>
                )
              })}
            </div>
            <button onClick={() => navigate('/login')}
              className={`hidden sm:inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium transition-colors ${solidNav ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'}`}>
              Sign in
            </button>
            <button onClick={() => setMobileMenuOpen(o => !o)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen}
              className={`md:hidden p-2 rounded-lg transition-colors ${solidNav ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'}`}>
              {mobileMenuOpen ? <X size={22} {...ICON} /> : <Menu size={22} {...ICON} />}
            </button>
          </div>
        </div>

        <div className={`md:hidden grid transition-[grid-template-rows] duration-300 ${mobileMenuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="px-5 pb-5 pt-2 space-y-1 border-t border-slate-100 bg-white">
              {NAV_LINKS.map(l => (
                <button key={l.id} onClick={() => scrollTo(l.id)}
                  className={`w-full text-left px-3 h-11 rounded-lg text-sm font-medium ${activeSection === l.id ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                  {l.label}
                </button>
              ))}
              <button onClick={() => navigate('/login')} className="w-full h-11 mt-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign in</button>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════════ HERO ══════════════ */}
      <section id="home" className="relative min-h-[86vh] flex items-center overflow-hidden bg-slate-900">
        <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1800&q=75" alt="" aria-hidden="true"
          className="lp-zoom absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/80 to-emerald-900/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '56px 56px' }} />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-28 pb-14">
          <div className="max-w-2xl">
            <p className="lp-up inline-flex items-center gap-2 h-8 pl-2 pr-3.5 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur text-xs font-medium text-white" style={{ animationDelay: '100ms' }}>
              <span className="lp-pulse w-2 h-2 rounded-full bg-emerald-400 ml-1" />
              Trusted construction partner in Metro Manila
            </p>
            <h1 className="lp-up mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-[1.05]" style={{ animationDelay: '200ms' }}>
              Building dreams,<br />
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent">connecting skills.</span>
            </h1>
            <p className="lp-up mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl" style={{ animationDelay: '320ms' }}>
              Book skilled construction professionals, manage job orders and follow every site visit in one place, from your first inquiry to project handover.
            </p>
            <p className="lp-up mt-5 text-base sm:text-lg text-white font-medium" style={{ animationDelay: '380ms' }}>
              Need help with{' '}
              <span className="inline-block min-w-[9ch] text-emerald-300 overflow-hidden align-bottom">
                <RotatingWord words={['roofing', 'plumbing', 'renovation', 'electrical work', 'painting', 'carpentry', 'a new build']} />
              </span>
              ?
            </p>
            <div className="lp-up mt-6 flex flex-wrap gap-3" style={{ animationDelay: '440ms' }}>
              <button onClick={() => openQuote()}
                className="lp-shine group inline-flex items-center gap-2 h-12 px-6 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all">
                Submit inquiry <ArrowRight size={16} {...ICON} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => scrollTo('services')}
                className="inline-flex items-center gap-2 h-12 px-6 rounded-lg bg-white/10 hover:bg-white/15 ring-1 ring-white/25 backdrop-blur text-white text-sm font-semibold transition-colors">
                Explore services
              </button>
            </div>
            <div className="lp-up mt-10 grid grid-cols-4 gap-3 sm:gap-6 max-w-xl" style={{ animationDelay: '560ms' }}>
              {[[`${projects}+`, 'Projects'], [`${workers}+`, 'Workers'], [`${clients}+`, 'Clients'], [`${years}`, 'Years']].map(([v, l]) => (
                <div key={l}>
                  <p className="text-xl sm:text-2xl font-semibold text-white tabular-nums">{v}</p>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════ ABOUT ══════════════ */}
      <section id="about" className="py-16 sm:py-20 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-16 items-center">
          <div>
            <SectionHeading align="left" eyebrow="Why Emerald Builders" title="Quality work, from people you can trust"
              text="We connect you with verified professionals and stay accountable from the first inquiry to the final inspection." />
          </div>
          <div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { icon: UserCheck, title: 'Verified workers',   desc: 'Licensed and insured' },
                { icon: Star,      title: 'Quality materials',  desc: 'Premium and tested' },
                { icon: Clock,     title: 'On-time delivery',   desc: 'Timelines we keep' },
                { icon: Award,     title: 'Fair pricing',       desc: 'No hidden charges' },
                { icon: LineChart, title: 'Live tracking',      desc: 'Follow every step' },
                { icon: Users,     title: 'Dedicated support',  desc: 'A real person to talk to' },
              ].map((item, i) => (
                <Reveal key={item.title} delay={i * 60}>
                  <div className="group h-full flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 rounded-xl bg-white ring-1 ring-slate-200 p-3 transition-all duration-300 hover:ring-emerald-300 hover:shadow-md hover:-translate-y-0.5">
                    <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                      <item.icon size={18} {...ICON} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] sm:text-sm font-semibold text-slate-900">{item.title}</span>
                      <span className="block text-xs text-slate-500">{item.desc}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ SERVICES ══════════════ */}
      <ServicesSection onInquire={openQuote} />

      {/* ══════════════ CONTACT ══════════════ */}
      <section id="contact" className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
            <div className="flex flex-col">
              <SectionHeading align="left" eyebrow="Contact us" title="Let’s talk about your project" text="Reach us any way you like, or send an inquiry and we’ll get back to you within one business day." />

              <Reveal delay={100}>
                <ul className="mt-8 rounded-2xl bg-white ring-1 ring-slate-200 divide-y divide-slate-100">
                  {CONTACTS.map(c => {
                    const Wrap = c.href ? 'a' : 'div'
                    return (
                      <li key={c.title}>
                        <Wrap {...(c.href ? { href: c.href } : {})}
                          className={`group flex items-start gap-3.5 px-4 py-3.5 transition-colors ${c.href ? 'hover:bg-emerald-50/50' : ''}`}>
                          <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                            <c.icon size={17} {...ICON} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs text-slate-500">{c.title}</span>
                            {c.lines.map(l => <span key={l} className="block text-sm font-medium text-slate-900 break-words">{l}</span>)}
                          </span>
                          {c.href && <ArrowRight size={15} {...ICON} className="self-center text-slate-300 transition-all group-hover:text-emerald-600 group-hover:translate-x-0.5" />}
                        </Wrap>
                      </li>
                    )
                  })}
                </ul>
              </Reveal>

              <Reveal delay={180}>
                <button onClick={() => openQuote()}
                  className="lp-shine group mt-5 w-full flex items-center justify-between gap-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 px-5 py-4 text-left shadow-lg shadow-emerald-600/20 transition-colors">
                  <span className="flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center"><Send size={18} {...ICON} /></span>
                    <span>
                      <span className="block text-base font-semibold text-white">Submit an inquiry</span>
                      <span className="block text-sm text-emerald-100">Takes about two minutes</span>
                    </span>
                  </span>
                  <ArrowRight size={18} {...ICON} className="text-white transition-transform group-hover:translate-x-1" />
                </button>
              </Reveal>
            </div>

            <Reveal delay={120} className="h-full">
              <div className="h-[220px] sm:h-[300px] lg:h-full lg:min-h-[420px] rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm bg-white">
                <iframe
                  title="office-location-map"
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  srcDoc={`<!DOCTYPE html><html><head>
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                    <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
                  </head><body><div id="map"></div><script>
                    var addressBounds = [[14.4829, 120.9991],[14.4929, 121.0091]];
                    var map = L.map('map', {
                      center: [14.4879, 121.0041], zoom: 17, minZoom: 17, maxZoom: 19,
                      maxBounds: addressBounds, maxBoundsViscosity: 1.0,
                      zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false
                    });
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
                    L.marker([14.4879, 121.0041]).addTo(map)
                      .bindPopup('<b>Emerald Builders</b><br>804 Chaffee St, Moonwalk, Parañaque').openPopup();
                  </script></body></html>`}
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-28 sm:pb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center"><HardHat size={18} strokeWidth={2} className="text-white" /></span>
              <span>
                <span className="block font-semibold text-white text-[15px] leading-tight">SkillConnect</span>
                <span className="block text-xs text-slate-500 leading-tight">Emerald Builders & Construction</span>
              </span>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {NAV_LINKS.map(l => <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-emerald-400 transition-colors">{l.label}</button>)}
              <button onClick={() => navigate('/login')} className="hover:text-emerald-400 transition-colors">Sign in</button>
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Emerald Builders & Construction. All rights reserved.</p>
            <button onClick={() => scrollTo('home')} className="hover:text-emerald-400 transition-colors">Back to top ↑</button>
          </div>
        </div>
      </footer>

      {/* Sticky inquiry prompt */}
      <div className={`sm:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3 bg-gradient-to-t from-white via-white/95 to-white/0 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${showSticky ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <button onClick={() => openQuote()}
          className="lp-shine w-full flex items-center justify-between gap-3 rounded-2xl bg-emerald-600 active:bg-emerald-700 pl-4 pr-3 py-3 shadow-xl shadow-emerald-900/25">
          <span className="text-left">
            <span className="block text-sm font-semibold text-white">Have a project in mind?</span>
            <span className="block text-xs text-emerald-100">Free inquiry · No commitment</span>
          </span>
          <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white text-emerald-700 text-sm font-semibold">
            Submit inquiry <ArrowRight size={15} {...ICON} />
          </span>
        </button>
      </div>

      <div className={`hidden sm:block fixed right-6 bottom-6 z-40 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${showSticky ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-6 opacity-0 scale-95 pointer-events-none'}`}>
        <span className="lp-ring absolute inset-0 rounded-full bg-emerald-500" aria-hidden="true" />
        <button onClick={() => openQuote()}
          className="lp-shine group relative flex items-center gap-2.5 h-14 pl-4 pr-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl shadow-emerald-900/30 transition-colors">
          <span className="lp-wiggle w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"><Send size={17} {...ICON} /></span>
          <span className="text-sm font-semibold">Submit inquiry</span>
        </button>
      </div>

      {quoteOpen && <InquiryModal onClose={closeQuote} service={quoteService} />}
    </div>
  )
}