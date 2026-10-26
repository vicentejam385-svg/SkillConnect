import { useState, useEffect, useRef } from 'react'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import { useNavigate } from 'react-router-dom'
import {
  HardHat, Users, ClipboardList, ArrowRight, CheckCircle,
  Building2, Wrench, Shield, Send, AlertCircle, Mail,
  Phone, MapPin, Clock, ChevronDown, Calendar, Star,
  Zap, Award, Hammer, TreePine, PaintBucket, Layers,
  Settings, Droplets, LayoutGrid
} from 'lucide-react'

/* ── Count-up hook ── */
function useCountUp(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      setCount(Math.floor(p * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

/* ── Inquiry Form (moved to Contact Us section) ── */
function InquiryForm() {
  const [form, setForm] = useState({
    first_name: '', middle_initial: '', last_name: '', suffix: '',
    email: '', mobile: '+63',
    province: '', city: '', barangay: '', house_street: '',
    description: '', reason: ''
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apiError, setApiError] = useState('')

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const NCR_CODE = '1300000000'
  const filteredCities = form.province ? getMunicipalitiesByProvince(form.province) : []
  const filteredBarangays = form.city ? getBarangaysByMunicipality(form.city) : []
  const provinceName = form.province === NCR_CODE
    ? 'Metro Manila'
    : getAllProvinces().find(p => p.psgcCode === form.province)?.name ?? ''
  const cityName = filteredCities.find(c => c.psgcCode === form.city)?.name

  const buildAddress = () =>
    [form.house_street, form.barangay, cityName, provinceName].filter(Boolean).join(', ')

  const validate = () => {
    const e = {}
    if (!form.first_name.trim()) {
      e.first_name = 'First name is required.'
    } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.first_name.trim())) {
      e.first_name = 'First name must contain letters only, with no repeated or trailing hyphens.'
    }
    if (!form.last_name.trim()) {
      e.last_name = 'Last name is required.'
    } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(['\-\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(form.last_name.trim())) {
      e.last_name = 'Last name must contain letters only, with no repeated or trailing hyphens.'
    }
    if (!form.middle_initial.trim()) {
      e.middle_initial = 'Middle initial is required.'
    } else if (!/^[A-Za-z]{1,2}\.?$/.test(form.middle_initial.trim())) {
      e.middle_initial = 'Enter a valid middle initial (e.g. A or A.).'
    }
    if (!form.email.trim()) {
      e.email = 'Email address is required.'
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
      const validTLDs = ['com','net','org','edu','gov','ph','io','info','biz','me','tv','us','uk','au','ca','de','fr','jp','sg','nz','in']
      const tld = form.email.trim().split('.').pop().toLowerCase()
      if (!emailRegex.test(form.email.trim())) {
        e.email = 'Enter a valid email address (e.g. name@example.com).'
      } else if (!validTLDs.includes(tld)) {
        e.email = 'Enter a valid email domain (e.g. .com, .net, .org, .ph).'
      }
    }
    const mobileDigits = form.mobile.trim()
    if (!mobileDigits || mobileDigits === '+63') {
      e.mobile = 'Mobile number is required.'
    } else if (mobileDigits.startsWith('+63')) {
      if (!/^\+639\d{9}$/.test(mobileDigits)) {
        e.mobile = 'Enter a valid PH mobile number (e.g. +639XXXXXXXXX).'
      }
    } else if (mobileDigits.startsWith('09')) {
      if (!/^09\d{9}$/.test(mobileDigits)) {
        e.mobile = 'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).'
      }
    } else {
      e.mobile = 'Mobile number must start with +639 or 09.'
    }
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
      const res = await fetch('http://localhost/skillconnect/backend/api/inquiries/create.php', {
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

  if (success) return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle size={32} className="text-emerald-600" />
      </div>
      <h3 className="font-bold text-2xl text-gray-800">Inquiry Submitted!</h3>
      <p className="text-gray-500 text-center max-w-sm">Thank you! Our team will get in touch with you shortly.</p>
      <button onClick={() => setSuccess(false)}
        className="mt-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded text-sm hover:bg-emerald-700 transition-colors">
        Submit Another
      </button>
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {apiError && (
        <div className="md:col-span-2 flex items-center gap-2 p-3 rounded bg-red-50 border border-red-200 text-red-600 text-sm">
          <AlertCircle size={14} />{apiError}
        </div>
      )}
      {/* First Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
        <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          value={form.first_name} onChange={e => f('first_name', e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'\-]/g, ''))} placeholder="First Name" />
        {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
      </div>
      {/* Middle Initial */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Middle Initial <span className="text-red-500">*</span></label>
        <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          value={form.middle_initial} onChange={e => f('middle_initial', e.target.value)} placeholder="e.g. A." maxLength={3} />
        {errors.middle_initial && <p className="text-red-500 text-xs mt-1">{errors.middle_initial}</p>}
      </div>
      {/* Last Name + Suffix */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            value={form.last_name} onChange={e => f('last_name', e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'\-]/g, ''))} placeholder="Last Name" />
          {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
        </div>
        <div className="w-24">
          <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
          <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            value={form.suffix} onChange={e => f('suffix', e.target.value)} placeholder="e.g. Jr." maxLength={10} />
        </div>
      </div>
     {/* Mobile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number <span className="text-red-500">*</span></label>
        <input
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          value={form.mobile}
          onChange={e => {
            let val = e.target.value
            if (!val.startsWith('+63')) val = '+63'
            let digits = val.slice(3).replace(/\D/g, '')
            if (digits.startsWith('0')) digits = digits.slice(1)
            val = '+63' + digits.slice(0, 10)
            f('mobile', val)
          }}
          placeholder="+639XXXXXXXXX"
          maxLength={13}
        />
        {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
      </div>
      {/* Email */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
        <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="Email" />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>
      {/* Province */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Province <span className="text-red-500">*</span></label>
        <select className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value, city: '', barangay: '' }))}>
          <option value="">Select province...</option>
          <option value="1300000000">Metro Manila (NCR)</option>
        </select>
        {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province}</p>}
      </div>
      {/* City */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City / Municipality <span className="text-red-500">*</span></label>
        <select className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white disabled:opacity-50"
          value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value, barangay: '' }))} disabled={!form.province}>
          <option value="">Select city...</option>
          {filteredCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
        </select>
        {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
      </div>
      {/* Barangay */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Barangay <span className="text-red-500">*</span></label>
        <select className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white disabled:opacity-50"
          value={form.barangay} onChange={e => f('barangay', e.target.value)} disabled={!form.city}>
          <option value="">Select barangay...</option>
          {filteredBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
        </select>
        {errors.barangay && <p className="text-red-500 text-xs mt-1">{errors.barangay}</p>}
      </div>
      {/* House No. & Street */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">House No. & Street <span className="text-red-500">*</span></label>
        <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          value={form.house_street} onChange={e => f('house_street', e.target.value)} placeholder="e.g. 123 Rizal Street" />
        {errors.house_street && <p className="text-red-500 text-xs mt-1">{errors.house_street}</p>}
      </div>
      {/* Reason */}
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Inquiry <span className="text-red-500">*</span></label>
        <select className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          value={form.reason} onChange={e => f('reason', e.target.value)}>
          <option value="">Select a reason...</option>
<option value="New Construction">New Construction</option>
<option value="Renovation & Remodeling">Renovation & Remodeling</option>
<option value="Repair & Maintenance">Repair & Maintenance</option>
<option value="Electrical Installation">Electrical Installation</option>
<option value="Plumbing Services">Plumbing Services</option>
<option value="Painting & Finishing">Painting & Finishing</option>
<option value="Carpentry">Carpentry</option>
<option value="Masonry">Masonry</option>
<option value="Roofing">Roofing</option>
<option value="Landscaping">Landscaping</option>
<option value="Interior Design">Interior Design</option>
<option value="Project Management">Project Management</option>
<option value="Other">Other</option>
        </select>
        {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
      </div>
      {form.reason === 'Other' && (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Please specify <span className="text-red-500">*</span></label>
          <input className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            value={form.description} onChange={e => f('description', e.target.value)} placeholder="Tell us about your inquiry..." />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
        </div>
      )}
      {/* Submit */}
      <div className="md:col-span-2">
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {submitting ? <span className="animate-pulse">Submitting...</span> : <><Send size={16} />Submit Inquiry</>}
        </button>
      </div>
    </div>
  )
}

/* ── Service Card ── */
function ServiceCard({ icon: Icon, title, desc, features }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-emerald-200 transition-all duration-200">
      <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center mb-4">
        <Icon size={22} className="text-emerald-600" />
      </div>
      <h3 className="font-bold text-gray-800 text-base mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-4">{desc}</p>
      {features && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Key Features</p>
          <ul className="space-y-1">
            {features.map(feat => (
              <li key={feat} className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function LandingPage() {
  const navigate = useNavigate()
  const statsRef = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const projects = useCountUp(500, 2000, statsVisible)
  const workers  = useCountUp(120, 2000, statsVisible)
  const clients  = useCountUp(85,  2000, statsVisible)
  const years    = useCountUp(12,  2000, statsVisible)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id) => {
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  /* ── Nav link style ── */
  const navLink = (id) =>
    `text-sm font-medium transition-colors cursor-pointer px-1 pb-0.5 border-b-2 ${
      activeSection === id
        ? 'text-gray-900 border-emerald-500'
        : 'text-gray-600 hover:text-gray-900 border-transparent'
    }`

  return (
    <div className="min-h-screen bg-white text-gray-800" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
  {/* Logo */}
  <div className="flex items-center gap-2">
    <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center">
      <span className="text-white font-black text-xs">EB</span>
    </div>
    <div>
      <span className="font-bold text-gray-800 text-sm">SkillConnect</span>
      <p className="text-gray-400 text-[10px] leading-none">Emerald Builders</p>
    </div>
  </div>
  {/* Links + Sign In (grouped right) */}
  <div className="flex items-center gap-3">
    <div className="hidden md:flex items-center gap-6">
      <button onClick={() => scrollTo('home')} className={navLink('home')}>About Us</button>
      <button onClick={() => scrollTo('services')} className={navLink('services')}>Products & Services</button>
      <button onClick={() => scrollTo('contact')} className={navLink('contact')}>Contact Us</button>
    </div>
    <button onClick={() => navigate('/login')}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded transition-colors">
      Sign In
    </button>
    <button
      className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
      onClick={() => setMobileMenuOpen(p => !p)}
      aria-label="Toggle menu"
    >
      <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
      <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
      <span className={`block w-5 h-0.5 bg-gray-700 transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
    </button>
  </div>
</div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-md md:hidden">
          <div className="flex flex-col px-6 py-4 gap-4">
            <button onClick={() => { scrollTo('home'); setMobileMenuOpen(false) }} className="text-sm font-medium text-gray-700 text-left py-1">About Us</button>
            <button onClick={() => { scrollTo('services'); setMobileMenuOpen(false) }} className="text-sm font-medium text-gray-700 text-left py-1">Products & Services</button>
            <button onClick={() => { scrollTo('contact'); setMobileMenuOpen(false) }} className="text-sm font-medium text-gray-700 text-left py-1">Contact Us</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          HERO (Home / About Us section)
      ══════════════════════════════════════════ */}
      <section id="home" className="pt-14">
        {/* Hero with construction background via unsplash */}
        <div className="relative h-[420px] sm:h-[500px] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80"
            alt="Construction site"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Green overlay */}
          <div className="absolute inset-0 bg-emerald-700/75" />
          <div className="relative z-10 h-full flex flex-col justify-center px-8 sm:px-16 max-w-3xl">
            <h1 className="text-white font-black text-3xl sm:text-5xl leading-tight mb-4">
              Building Dreams,<br />Connecting Skills
            </h1>
            <p className="text-emerald-100 text-xs sm:text-base leading-relaxed mb-6 max-w-xl">
              Your premier multi-service booking and workforce management for construction excellence.
              Connect with skilled professionals and manage your projects seamlessly.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/login')}
                className="px-5 py-2.5 bg-white text-emerald-700 font-semibold text-sm rounded hover:bg-gray-100 transition-colors">
                Get Started
              </button>
              <button onClick={() => scrollTo('contact')}
                className="px-5 py-2.5 border border-white/60 text-white font-semibold text-sm rounded hover:bg-white/10 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Services (Home page — 4 cards) ── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="font-bold text-2xl text-gray-800 mb-2">Our Services</h2>
            <p className="text-gray-500 text-sm">Comprehensive construction solutions tailored to your needs.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { icon: Calendar,      title: 'Flexible Scheduling',   desc: 'Book services at your convenience with real-time availability tracking.' },
              { icon: ClipboardList, title: 'Job Management',        desc: 'Efficient job-order processing and project management from start to finish.' },
              { icon: Users,         title: 'Skilled Workforce',     desc: 'Access to verified and experienced construction professionals and tradespeople.' },
              { icon: Building2,     title: 'Construction Services', desc: 'Professional construction and renovation services for residential and commercial projects.' },
            ].map(s => (
              <div key={s.title} className="border border-gray-200 rounded-lg p-5 hover:shadow-sm hover:border-emerald-200 transition-all">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
                  <s.icon size={20} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1.5">{s.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Emerald Builders ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left text */}
            <div>
              <h2 className="font-bold text-2xl text-gray-800 mb-3">Why Choose Emerald Builders?</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                We connect you with the best construction professionals and provide a seamless
                experience from inquiry to project completion.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Verified Professional Workers',
                  'Real-time Project Tracking',
                  'Competitive Pricing',
                  'Quality Assurance',
                  '24/7 Customer Support',
                  'Flexible Payment Options',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Right image */}
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&q=80"
                alt="Construction worker"
                className="w-full h-64 object-cover rounded-lg shadow-md"
              />
              <div className="absolute bottom-4 left-4 bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2 shadow-lg">
                <CheckCircle size={16} />
                <span className="font-bold text-sm">500+ Completed Projects</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section ref={statsRef} className="py-16 bg-emerald-600">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: projects, label: 'Projects Completed', suffix: '+' },
              { value: workers,  label: 'Skilled Workers',    suffix: '+' },
              { value: clients,  label: 'Happy Clients',      suffix: '+' },
              { value: years,    label: 'Years Experience',   suffix: '' },
            ].map(s => (
              <div key={s.label}>
                <div className="font-black text-3xl sm:text-4xl text-white mb-1">{s.value}{s.suffix}</div>
              <div className="text-emerald-100 text-[10px] sm:text-xs uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ready To Start CTA ── */}
      <section className="py-14 bg-emerald-600">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-bold text-2xl text-white mb-2">Ready to Start Your Project?</h2>
          <p className="text-emerald-100 text-sm mb-6">Get in touch with us today and let's build something amazing together.</p>
          <button onClick={() => scrollTo('contact')}
            className="px-8 py-3 bg-white text-emerald-700 font-semibold text-sm rounded hover:bg-gray-100 transition-colors">
            Contact Us Today
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRODUCTS & SERVICES SECTION
      ══════════════════════════════════════════ */}
      <section id="services">
        {/* Section hero */}
        <div className="bg-emerald-600 py-12 px-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-white" />
          </div>
          <h2 className="font-bold text-2xl sm:text-3xl text-white mb-3">Products & Services</h2>
          <p className="text-emerald-100 text-sm max-w-xl mx-auto leading-relaxed">
            Comprehensive construction and renovation services delivered by skilled professionals.
            From new construction to maintenance, we've got you covered.
          </p>
        </div>

        <div className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h3 className="font-bold text-2xl text-gray-800 mb-2">Our Services</h3>
              <p className="text-gray-500 text-sm">We offer a wide range of construction services to meet all your building needs.</p>
            </div>

            {/* First 6 services */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <ServiceCard icon={Hammer} title="New Construction"
                desc="Complete building construction services. We handle residential, commercial, and industrial projects with expert planning, quality materials, and skilled workforce."
                features={['Residential buildings', 'Commercial installations', 'Industrial facilities', 'Project management', 'Quality assurance']} />
              <ServiceCard icon={Wrench} title="Renovation & Remodeling"
                desc="Transform your living space with our comprehensive renovation services. We bring your vision to life while maintaining structural integrity."
                features={['Kitchen renovation', 'Bathroom remodeling', 'Room additions', 'Structure modifications', 'Interior upgrades']} />
              <ServiceCard icon={Shield} title="Repair & Maintenance"
                desc="Keep your property in top condition with our professional repair and maintenance services. We address structural issues and preventive maintenance."
                features={['Structural repairs', 'Preventive maintenance', 'Emergency repairs', 'Regular inspections', 'Damage restoration']} />
              <ServiceCard icon={Zap} title="Electrical Installation"
                desc="Complete electrical services from installation to maintenance. We ensure safe, efficient, and code-compliant electrical systems."
                features={['Home panel framing', 'Commercial fitting', 'Renovation projects', 'Industrial panel fitting', 'Safety & compliance']} />
              <ServiceCard icon={Droplets} title="Plumbing Services"
                desc="Professional plumbing solutions for all your water and drainage needs. From installation to repairs, our expert team delivers reliable service."
                features={['Pipe installation', 'Leak detection', 'Drain cleaning', 'Water heater service', 'Leak search & repair']} />
              <ServiceCard icon={PaintBucket} title="Painting & Finishing"
                desc="Expert painting services that add beauty and protection to your property. We use premium paints and modern techniques for superior finishes."
                features={['Interior painting', 'Exterior painting', 'Texture coating', 'Waterproofing', 'Decorative finishes']} />
            </div>

            {/* Second 6 services */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ServiceCard icon={Layers} title="Carpentry"
                desc="Custom carpentry services for all your woodworking needs. From furniture to structural woodwork, we create durable and beautiful wooden solutions."
                features={['Custom furniture', 'Cabinet installation', 'Door and window frames', 'Wooden flooring', 'Deck construction']} />
              <ServiceCard icon={Building2} title="Masonry"
                desc="Professional masonry work including brickwork, stonework, and concrete structures. We build strong, durable structures that stand the test of time."
                features={['Brick and block laying', 'Concrete work', 'Stone masonry', 'Retaining walls', 'Repointing work']} />
              <ServiceCard icon={HardHat} title="Roofing"
                desc="Complete roofing solutions from installation to replacement. We use high-quality roofing materials to provide durable weather and protection for your property."
                features={['New installation', 'Roof repair', 'Gutter installation', 'Waterproofing', 'Roof inspection']} />
              <ServiceCard icon={TreePine} title="Landscaping"
                desc="Transform your outdoor spaces with professional landscaping services. We design and create beautiful, functional landscapes for your property's appeal."
                features={['Landscape design', 'Garden installation', 'Hardscaping', 'Irrigation systems', 'Lawn maintenance']} />
              <ServiceCard icon={LayoutGrid} title="Interior Design"
                desc="Professional interior design services that combine aesthetics with functionality. We create beautiful, livable spaces tailored to your style and needs."
                features={['Space planning', 'Furniture selection', 'Color consultation', 'Lighting design', '3D visualization']} />
              <ServiceCard icon={ClipboardList} title="Project Management"
                desc="Comprehensive project management services ensuring smooth execution from start to finish. All aspects of your construction project is handled."
                features={['Planning & scheduling', 'Budget management', 'Quality control', 'Contractor coordination', 'Progress reporting']} />
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h3 className="font-bold text-2xl text-gray-800 mb-2">Why Choose Us</h3>
              <p className="text-gray-500 text-sm">What sets us apart in the construction industry</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { icon: Building2,     title: 'Construction Services', desc: 'Professional construction and renovation services for residential and commercial projects.' },
                { icon: Star,          title: 'Quality Materials',     desc: 'We only use premium, tested materials trusted by all projects.' },
                { icon: Clock,         title: 'On-Time Delivery',      desc: 'Committed to completing projects within agreed timelines.' },
                { icon: Award,         title: 'Competitive Pricing',   desc: 'Professional services at rates that fit your budget without compromise.' },
                { icon: Users,         title: 'Support',               desc: 'Dedicated client support for your peace of mind.' },
                { icon: Shield,        title: 'Licensed',              desc: 'Professional, licensed, and insured for your protection.' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-emerald-200 transition-colors">
                  <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm mb-0.5">{item.title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CONTACT US SECTION
      ══════════════════════════════════════════ */}
      <section id="contact">
        {/* Section hero */}
        <div className="bg-emerald-600 py-16 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={28} className="text-white" />
          </div>
          <h2 className="font-bold text-3xl text-white mb-3">Contact Us</h2>
          <p className="text-emerald-100 text-sm">Get in touch with our team. We're here to help you with your construction needs.</p>
        </div>

        {/* Contact info cards */}
        <div className="py-12 bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { icon: Mail,    title: 'Email Us',       lines: ['info@emeraldbuilders.com', 'support@emeraldbuilders.com'] },
                { icon: Phone,   title: 'Call Us',        lines: ['+63 123 456 7890', '+63 456 654 3210'] },
                { icon: MapPin,  title: 'Visit Us',       lines: ['123 Batikan John Avenue', 'Quezon City, Metro Manila 1010'] },
                { icon: Clock,   title: 'Working Hours',  lines: ['Monday – Sunday', '8:00 AM – 6:00 PM'] },
              ].map(info => (
                <div key={info.title} className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                    <info.icon size={20} className="text-emerald-600" />
                  </div>
                  <p className="font-semibold text-gray-800 text-sm mb-1">{info.title}</p>
                  {info.lines.map(l => <p key={l} className="text-gray-500 text-xs">{l}</p>)}
                </div>
              ))}
            </div>
          </div>
        </div>

       {/* Map */}
        <div className="bg-gray-50 py-6">
          <div className="max-w-5xl mx-auto px-6">
            <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: '320px' }}>
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
      center: [14.4879, 121.0041],
      zoom: 17,
      minZoom: 17,
      maxZoom: 19,
      maxBounds: addressBounds,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    L.marker([14.4879, 121.0041]).addTo(map)
      .bindPopup('<b>Emerald Builders</b><br>804 Chaffee St, Moonwalk, Parañaque').openPopup();
  </script></body></html>`}
/>
            </div>
          </div>
        </div>
        

        {/* ── Inquiry Form ── */}
        <div className="py-14 bg-gray-50 border-t border-gray-100">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-8">
              <h3 className="font-bold text-2xl text-gray-800 mb-2">Submit an Inquiry</h3>
              <p className="text-gray-500 text-sm">Tell us about your project and we'll get back to you right away.</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-8 shadow-sm">
              <InquiryForm />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-gray-900 text-gray-300 pt-12 pb-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-emerald-600 rounded flex items-center justify-center">
                  <span className="text-white font-black text-xs">EB</span>
                </div>
                <span className="font-bold text-white text-sm">SkillConnect</span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed mb-2">
                Emerald Builders & Construction – Your trusted partner in construction excellence.
              </p>
              <p className="text-gray-600 text-xs">© 2026 Emerald Builders & Construction. All rights reserved.</p>
            </div>
            {/* Quick Links */}
            <div>
              <p className="font-semibold text-white text-sm mb-3">Quick Links</p>
              <ul className="space-y-2">
                {['Home', 'Inquiry', 'Contact'].map(l => (
                  <li key={l}><button onClick={() => scrollTo(l === 'Home' ? 'home' : l === 'Inquiry' ? 'contact' : 'contact')}
                    className="text-gray-500 hover:text-emerald-400 text-xs transition-colors">{l}</button></li>
                ))}
              </ul>
            </div>
            {/* Services */}
            <div>
              <p className="font-semibold text-white text-sm mb-3">Services</p>
              <ul className="space-y-2">
                {['Job Orders', 'Scheduling'].map(l => (
                  <li key={l}><button onClick={() => scrollTo('services')}
                    className="text-gray-500 hover:text-emerald-400 text-xs transition-colors">{l}</button></li>
                ))}
              </ul>
            </div>
            {/* Contact */}
            <div>
              <p className="font-semibold text-white text-sm mb-3">Contact</p>
              <ul className="space-y-2 text-xs text-gray-500">
                <li>Email: info@emeraldbuilders.com</li>
                <li>Phone: +63 123 456 7890</li>
                <li>Mon–Sat: 8AM – 6PM</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-5 text-center">
            <p className="text-gray-600 text-xs">© 2026 Emerald Builders & Construction. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}