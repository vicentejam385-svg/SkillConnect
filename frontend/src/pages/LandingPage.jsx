import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HardHat, Users, ClipboardList, ArrowRight, CheckCircle,
  Building2, Wrench, Shield, ChevronDown, Send, AlertCircle, X
} from 'lucide-react'

function useCountUp(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

function InquiryForm() {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    mobile: '', address: '', description: '', reason: ''
  })
  const [errors,    setErrors]    = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [apiError,  setApiError]  = useState('')

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const validate = () => {
    const e = {}
    if (!form.first_name.trim()) e.first_name = 'First name is required.'
    if (!form.last_name.trim())  e.last_name  = 'Last name is required.'
    if (!form.description.trim()) e.description = 'Please describe your inquiry.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    setApiError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('http://localhost/skillconnect/backend/api/inquiries/create.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setSuccess(true)
      setForm({ first_name: '', last_name: '', email: '', mobile: '', address: '', description: '', reason: '' })
    } catch (err) {
      setApiError(err.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <CheckCircle size={32} className="text-emerald-400" />
      </div>
      <h3 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Inquiry Submitted!</h3>
      <p className="font-body text-slate-400 text-center max-w-sm">
        Thank you! Our team will get in touch with you shortly.
      </p>
      <button onClick={() => setSuccess(false)}
        className="btn-primary text-sm mt-2">Submit Another</button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {apiError && (
        <div className="md:col-span-2 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-body">
          <AlertCircle size={14} />{apiError}
        </div>
      )}

      {/* First Name */}
      <div>
        <label className="label-field">First Name <span className="text-red-400">*</span></label>
        <input className="input-field" value={form.first_name}
          onChange={e => f('first_name', e.target.value)} placeholder="Juan" />
        {errors.first_name && <p className="text-red-400 text-xs mt-1 font-body">{errors.first_name}</p>}
      </div>

      {/* Last Name */}
      <div>
        <label className="label-field">Last Name <span className="text-red-400">*</span></label>
        <input className="input-field" value={form.last_name}
          onChange={e => f('last_name', e.target.value)} placeholder="dela Cruz" />
        {errors.last_name && <p className="text-red-400 text-xs mt-1 font-body">{errors.last_name}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="label-field">Email Address</label>
        <input className="input-field" type="email" value={form.email}
          onChange={e => f('email', e.target.value)} placeholder="juan@email.com" />
      </div>

      {/* Mobile */}
      <div>
        <label className="label-field">Mobile Number</label>
        <input className="input-field" value={form.mobile}
          onChange={e => f('mobile', e.target.value)} placeholder="09XX XXX XXXX" />
      </div>

      {/* Address */}
      <div className="md:col-span-2">
        <label className="label-field">Address</label>
        <input className="input-field" value={form.address}
          onChange={e => f('address', e.target.value)} placeholder="Street, City, Province" />
      </div>

      {/* Reason */}
      <div className="md:col-span-2">
        <label className="label-field">Reason for Inquiry</label>
        <select className="input-field" value={form.reason} onChange={e => f('reason', e.target.value)}>
          <option value="">Select a reason...</option>
          <option value="Construction Services">Construction Services</option>
          <option value="Manpower Supply">Manpower Supply</option>
          <option value="Equipment Rental">Equipment Rental</option>
          <option value="Project Consultation">Project Consultation</option>
          <option value="Partnership">Partnership / Subcontracting</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Description */}
      <div className="md:col-span-2">
        <label className="label-field">Message / Description <span className="text-red-400">*</span></label>
        <textarea className="input-field resize-none" rows={4} value={form.description}
          onChange={e => f('description', e.target.value)}
          placeholder="Tell us about your project or inquiry..." />
        {errors.description && <p className="text-red-400 text-xs mt-1 font-body">{errors.description}</p>}
      </div>

      {/* Submit */}
      <div className="md:col-span-2">
        <button onClick={handleSubmit} disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {submitting
            ? <span className="animate-pulse">Submitting...</span>
            : <><Send size={16} />Submit Inquiry</>}
        </button>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate   = useNavigate()
  const statsRef   = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)

  const projects  = useCountUp(250,  2000, statsVisible)
  const workers   = useCountUp(120,  2000, statsVisible)
  const clients   = useCountUp(85,   2000, statsVisible)
  const years     = useCountUp(12,   2000, statsVisible)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-steel-950 text-slate-100">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-steel-950/90 backdrop-blur border-b border-steel-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 flex items-center justify-center">
              <HardHat size={18} className="text-steel-950" />
            </div>
            <span className="font-display font-bold text-lg tracking-wider text-slate-100">
              SKILL<span className="text-amber-400">CONNECT</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#inquiry" className="font-body text-sm text-slate-400 hover:text-slate-100 transition-colors">
              Contact Us
            </a>
            <button onClick={() => navigate('/login')} className="btn-primary text-sm">
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-steel-950" />
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 mb-8">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <span className="font-body text-xs text-amber-400 tracking-widest uppercase">
              Emerald Builders & Construction
            </span>
          </div>
          <h1 className="font-display font-black text-5xl sm:text-7xl text-slate-100 leading-none tracking-tight mb-6">
            BUILD SMARTER.<br />
            <span className="text-amber-400">CONNECT FASTER.</span>
          </h1>
          <p className="font-body text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10">
            The all-in-one workforce and project management platform for construction teams.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/login')} className="btn-primary flex items-center justify-center gap-2 text-base px-8 py-3">
              Get Started <ArrowRight size={18} />
            </button>
            <a href="#inquiry"
              className="flex items-center justify-center gap-2 px-8 py-3 border border-steel-700 text-slate-300 font-display font-semibold tracking-wider text-sm hover:border-amber-500/40 hover:text-slate-100 transition-all">
              Submit Inquiry
            </a>
          </div>
          <div className="mt-16 animate-bounce">
            <ChevronDown size={24} className="text-slate-600 mx-auto" />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section ref={statsRef} className="py-20 border-y border-steel-800 bg-steel-900/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: projects, label: 'Projects Completed', suffix: '+' },
              { value: workers,  label: 'Skilled Workers',    suffix: '+' },
              { value: clients,  label: 'Happy Clients',      suffix: '+' },
              { value: years,    label: 'Years of Experience', suffix: '' },
            ].map(s => (
              <div key={s.label}>
                <div className="font-display font-black text-5xl text-amber-400 mb-2">
                  {s.value}{s.suffix}
                </div>
                <div className="font-body text-sm text-slate-500 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-display font-bold text-4xl text-slate-100 tracking-wide mb-4">
            Everything You Need
          </h2>
          <p className="font-body text-slate-400 max-w-xl mx-auto">
            From workforce management to job order tracking — all in one platform.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Users,         title: 'Workforce Management',  desc: 'Track workers, specializations, licenses, and availability in real time.' },
            { icon: ClipboardList, title: 'Job Order Tracking',    desc: 'Create and monitor job orders from inquiry to completion with full audit trail.' },
            { icon: Building2,     title: 'Client Management',     desc: 'Manage clients, subcontractors, and organisations in one unified contacts system.' },
            { icon: Wrench,        title: 'Scheduling',            desc: 'Plan and assign workers to projects with an intuitive scheduling system.' },
            { icon: Shield,        title: 'Role-Based Access',     desc: 'Super Admin, Admin, and Worker portals with secure JWT authentication.' },
            { icon: CheckCircle,   title: 'Inquiry to Job Order',  desc: 'Convert client inquiries into job orders instantly with auto-populated fields.' },
          ].map(f => (
            <div key={f.title} className="card-steel p-6 hover:border-amber-500/30 transition-all duration-200">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <f.icon size={20} className="text-amber-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-slate-100 tracking-wide mb-2">{f.title}</h3>
              <p className="font-body text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INQUIRY FORM */}
      <section id="inquiry" className="py-24 bg-steel-900/40 border-t border-steel-800">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 mb-6">
              <Send size={14} className="text-amber-400" />
              <span className="font-body text-xs text-amber-400 tracking-widest uppercase">Get In Touch</span>
            </div>
            <h2 className="font-display font-bold text-4xl text-slate-100 tracking-wide mb-4">
              Submit an Inquiry
            </h2>
            <p className="font-body text-slate-400">
              Tell us about your project and we'll get back to you right away.
            </p>
          </div>
          <div className="card-steel p-8">
            <InquiryForm />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-steel-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-500 flex items-center justify-center">
              <HardHat size={13} className="text-steel-950" />
            </div>
            <span className="font-display font-bold text-sm tracking-wider text-slate-400">
              SKILL<span className="text-amber-400">CONNECT</span>
            </span>
          </div>
          <p className="font-body text-xs text-slate-600">
            © 2026 Emerald Builders & Construction. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}