import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  HardHat, Users, Calendar, ClipboardList,
  Building2, ChevronRight, Shield, Zap, Globe, ArrowRight
} from 'lucide-react'

function useCounter(target, duration = 2000, start = false) {
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

function StatCard({ value, label, suffix = '' }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  const count = useCounter(value, 1800, visible)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="text-center">
      <div className="font-display font-bold text-5xl lg:text-6xl text-amber-400 tabular-nums">
        {count}{suffix}
      </div>
      <div className="font-body text-slate-400 text-sm tracking-widest uppercase mt-1">{label}</div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="group relative bg-steel-800 border border-steel-700 hover:border-amber-500/40 p-6 transition-all duration-300 hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="w-12 h-12 bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors duration-300">
        <Icon size={22} className="text-amber-400" />
      </div>
      <h3 className="font-display font-bold text-xl text-slate-100 mb-2 tracking-wide">{title}</h3>
      <p className="font-body text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function RoleCard({ icon: Icon, role, access, color, badge }) {
  return (
    <div className="relative overflow-hidden bg-steel-800 border border-steel-700 p-6">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-steel-700">
          <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-display font-bold text-lg text-slate-100 tracking-wide">{role}</span>
            <span className="text-xs font-display font-semibold tracking-widest uppercase px-2 py-0.5 bg-steel-700 text-slate-400">
              {badge}
            </span>
          </div>
          <ul className="space-y-1.5">
            {access.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-400 font-body">
                <ChevronRight size={12} className={color.replace('bg-', 'text-')} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-steel-950 overflow-x-hidden">
      <div className="fixed inset-0 bg-grid-steel bg-grid opacity-40 pointer-events-none z-0" />

      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-steel-950/95 backdrop-blur-sm border-b border-steel-800' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 flex items-center justify-center">
              <HardHat size={18} className="text-steel-900" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-slate-100 leading-none tracking-wider uppercase">
                Skill<span className="text-amber-400">Connect</span>
              </div>
              <div className="font-body text-[10px] text-slate-500 leading-none tracking-widest uppercase">
                Emerald Builders
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Roles', 'About'].map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`}
                className="font-body text-sm text-slate-400 hover:text-amber-400 transition-colors duration-200 tracking-wide">
                {link}
              </a>
            ))}
          </div>
          <button onClick={() => navigate('/login')} className="btn-primary text-sm flex items-center gap-2">
            <span>Login</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center pt-16 z-10">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-px bg-amber-500" />
              <span className="font-display font-semibold text-amber-400 tracking-[0.3em] text-xs uppercase">
                Workforce Marketplace System
              </span>
            </div>
            <h1 className="font-display font-bold text-6xl md:text-7xl lg:text-8xl text-slate-100 leading-none tracking-tight mb-6">
              SKILL<span className="text-amber-400">CONNECT</span>
              <span className="block text-slate-400 font-light text-4xl md:text-5xl mt-2">
                for Emerald Builders
              </span>
            </h1>
            <p className="font-body text-slate-400 text-lg leading-relaxed max-w-xl mb-10">
              A centralised web-based platform for multi-service booking, workforce scheduling,
              and contractor management — purpose-built for construction excellence.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => navigate('/login')} className="btn-primary flex items-center gap-2 text-sm">
                <span>Access System</span>
                <ArrowRight size={16} />
              </button>
              <a href="#features" className="btn-ghost text-sm flex items-center gap-2">
                <span>Learn More</span>
                <ChevronRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-steel-700 bg-steel-900/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value={500} suffix="+" label="Workforce Managed" />
          <StatCard value={120} suffix="+" label="Projects Delivered" />
          <StatCard value={98} suffix="%" label="Scheduling Accuracy" />
          <StatCard value={24} suffix="/7" label="System Availability" />
        </div>
      </section>

      <section id="features" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-px bg-amber-500" />
              <span className="font-display font-semibold text-amber-400 tracking-[0.3em] text-xs uppercase">Platform Features</span>
            </div>
            <h2 className="font-display font-bold text-5xl text-slate-100 tracking-wide">
              Everything you need to<br />
              <span className="text-amber-400">manage your workforce</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard icon={Users} title="Contact Management" desc="Manage clients, subcontractors, and workers with type-based profiles, license tracking, and expiry alerts." />
            <FeatureCard icon={ClipboardList} title="Job Orders" desc="Create, assign, and track job orders across your workforce with real-time status updates." />
            <FeatureCard icon={Calendar} title="Smart Scheduling" desc="Visual scheduling system to prevent conflicts and optimise crew deployment." />
            <FeatureCard icon={Shield} title="License Monitoring" desc="AI-assisted document scanning with automatic expiry detection and flagging." />
            <FeatureCard icon={Building2} title="Organisation Types" desc="Classify subcontractors by type — ManPower, Heavy Equipment, Materials, and more." />
            <FeatureCard icon={Zap} title="Role-Based Access" desc="Super Admin, Admin, and Worker portals with tailored permissions and dashboards." />
          </div>
        </div>
      </section>

      <section id="roles" className="relative z-10 py-24 bg-steel-900/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-px bg-amber-500" />
              <span className="font-display font-semibold text-amber-400 tracking-[0.3em] text-xs uppercase">Access Levels</span>
            </div>
            <h2 className="font-display font-bold text-5xl text-slate-100 tracking-wide">
              Three roles,<br />
              <span className="text-amber-400">one ecosystem</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RoleCard icon={Shield} role="Super Admin" badge="Full Control" color="bg-amber-500"
              access={['Create & manage Admin users', 'Create contacts with Admin access', 'Reset Worker passwords', 'Full system oversight']} />
            <RoleCard icon={Users} role="Admin" badge="Operations" color="bg-blue-400"
              access={['Manage all Contacts (CRUD)', 'Create & track Job Orders', 'Workforce Scheduling', 'Configuration tables']} />
            <RoleCard icon={HardHat} role="Worker" badge="Field Access" color="bg-emerald-400"
              access={['View assigned Job Orders', 'Update task progress', 'View scheduling & assignments', 'Profile & status management']} />
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative overflow-hidden bg-steel-800 border border-steel-700 p-12 md:p-16">
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-px bg-amber-500" />
                <span className="font-display font-semibold text-amber-400 tracking-[0.3em] text-xs uppercase">About the System</span>
              </div>
              <h2 className="font-display font-bold text-5xl text-slate-100 tracking-wide mb-6">
                Built for<br />
                <span className="text-amber-400">Emerald Builders</span><br />
                & Construction
              </h2>
              <p className="font-body text-slate-400 leading-relaxed mb-8">
                SkillConnect is a purpose-built workforce marketplace that streamlines how Emerald Builders
                manages its multi-skilled workforce, subcontractor network, and project scheduling.
              </p>
              <button onClick={() => navigate('/login')} className="btn-primary flex items-center gap-2">
                <span>Get Started</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-steel-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-amber-500 flex items-center justify-center">
              <HardHat size={14} className="text-steel-900" />
            </div>
            <span className="font-display font-bold text-slate-300 tracking-wider uppercase text-sm">
              Skill<span className="text-amber-400">Connect</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm font-body">
            <Globe size={14} />
            <span>Emerald Builders & Construction — {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}