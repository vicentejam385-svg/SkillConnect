import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import {
  RefreshCw, CheckCircle2, AlertCircle, User, Eye, EyeOff, FileText, Upload, X,
  Mail, Phone, MapPin, Wrench, Lock, ShieldCheck, Trash2, Sparkles, Pencil,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet, apiPut, apiPost } from '../../../utils/api'

const ICON = { strokeWidth: 1.75 }
const HOST = 'https://saddlebrown-swan-877763.hostingersite.com'
const API  = `${HOST}/backend/api`

// ── Local styles ───────────────────────────────────────────────
const styles = `
  .sp-page, .sp-page h1, .sp-page h2, .sp-page h3 {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .sp-page :focus-visible { outline: 2px solid #059669; outline-offset: 2px; border-radius: 8px; }

  @keyframes sp-shimmer { 100% { transform: translateX(100%); } }
  .sp-skel { position: relative; overflow: hidden; background: #e8edf2; border-radius: 8px; }
  .sp-skel::after {
    content: ''; position: absolute; inset: 0; transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
    animation: sp-shimmer 1.2s infinite;
  }
  @keyframes sp-in     { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes sp-slide  { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  @keyframes sp-fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sp-modal  { from { opacity: 0; transform: translateY(18px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes sp-pop    { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes sp-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes sp-drift  { from { background-position: 0 0; } to { background-position: 160px 0; } }
  @keyframes sp-scan   { 0% { top: 8%; } 100% { top: 88%; } }
  @keyframes sp-toast-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }

  .sp-rise   { animation: sp-in .7s cubic-bezier(.16,1,.3,1) both; }
  .sp-tab    { animation: sp-in .45s cubic-bezier(.16,1,.3,1) both; }
  .sp-slide  { animation: sp-slide .55s cubic-bezier(.16,1,.3,1) both; }
  .sp-fadein { animation: sp-fadein .35s ease both; }
  .sp-modal  { animation: sp-modal .4s cubic-bezier(.16,1,.3,1) both; }
  .sp-pop    { animation: sp-pop .5s cubic-bezier(.16,1,.3,1) both; }
  .sp-float  { animation: sp-float 3.6s ease-in-out infinite; }
  .sp-toast-bar { transform-origin: left; animation: sp-toast-bar 3.5s linear forwards; }

  /* Cover: slow drifting diagonal lines, the one decorative moment */
  .sp-cover {
    background-color: #059669;
    background-image:
      repeating-linear-gradient(115deg, rgba(255,255,255,.08) 0 2px, transparent 2px 22px),
      linear-gradient(120deg, #047857, #10b981);
    background-size: 160px 100%, 100% 100%;
    animation: sp-drift 14s linear infinite;
  }

  /* Tab indicator slides between tabs */
  .sp-ind { transition: transform .45s cubic-bezier(.16,1,.3,1); }

  /* Scan beam while AI reads the license */
  .sp-beam { position: absolute; left: 10%; right: 10%; height: 2px; border-radius: 2px;
    background: linear-gradient(90deg, transparent, #10b981, transparent); animation: sp-scan 1.1s ease-in-out infinite alternate; }

  .sp-row { transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s, border-color .3s; }
  .sp-row:hover { transform: translateY(-2px); border-color: #cbd5e1; box-shadow: 0 14px 26px -18px rgba(16,24,40,.28); }

  @media (prefers-reduced-motion: reduce) {
    .sp-skel::after, .sp-rise, .sp-tab, .sp-slide, .sp-fadein, .sp-modal, .sp-pop, .sp-float, .sp-cover, .sp-beam, .sp-toast-bar { animation: none; }
    .sp-ind, .sp-row { transition: none; }
  }
`

const Skel = ({ className = '' }) => <div className={`sp-skel ${className}`} />

// ── Helpers ────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  const ok = toast.type === 'success'
  return (
    <div role="status" className={`sp-slide fixed bottom-5 right-5 z-[60] overflow-hidden flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_16px_40px_-10px_rgba(16,24,40,0.3)] bg-white
      ${ok ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-700'}`}>
      {ok ? <CheckCircle2 size={18} {...ICON} className="text-emerald-600" /> : <AlertCircle size={18} {...ICON} className="text-red-500" />}
      {toast.msg}
      <span className={`sp-toast-bar absolute left-0 bottom-0 h-0.5 w-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
    </div>
  )
}

// Expiry state for a license
function expiryInfo(s) {
  if (!s) return { label: 'No expiry date', cls: 'bg-slate-50 text-slate-500 ring-slate-200', dot: 'bg-slate-300' }
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  if (isNaN(d)) return { label: s, cls: 'bg-slate-50 text-slate-500 ring-slate-200', dot: 'bg-slate-300' }
  const days = Math.ceil((d - new Date().setHours(0, 0, 0, 0)) / 86400000)
  if (days < 0)   return { label: 'Expired',            cls: 'bg-red-50 text-red-700 ring-red-200',         dot: 'bg-red-500' }
  if (days <= 30) return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' }
  return { label: 'Valid', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' }
}
const fmtDate = s => {
  if (!s) return '—'
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00')
  return isNaN(d) ? s : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pwStrength(p) {
  let n = 0
  if (p.length >= 6) n++
  if (p.length >= 10) n++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) n++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) n++
  return n
}
const STRENGTH = [['Too short', 'bg-slate-200'], ['Weak', 'bg-red-400'], ['Fair', 'bg-amber-400'], ['Good', 'bg-emerald-400'], ['Strong', 'bg-emerald-600']]

const inputClass = 'w-full h-10 rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-800 placeholder:text-slate-400 transition focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed read-only:bg-slate-50 read-only:text-slate-600 read-only:focus:ring-0 read-only:focus:border-slate-200'
const labelClass = 'block text-xs font-medium text-slate-600 mb-1.5'

function Card({ children, className = '' }) {
  return <div className={`sp-tab bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>
}

function ReadValue({ icon: Icon, value }) {
  return (
    <div className="flex items-center gap-2.5 min-h-10 rounded-lg bg-slate-50/80 ring-1 ring-slate-100 px-3 py-2">
      <Icon size={14} {...ICON} className="text-emerald-600 flex-shrink-0" />
      <span className="text-sm text-slate-800 break-words min-w-0">{value || '—'}</span>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <Skel className="h-24 rounded-none" />
        <div className="px-6 pb-5"><Skel className="w-20 h-20 rounded-full -mt-10 border-4 border-white" /><Skel className="h-5 w-48 mt-4" /><Skel className="h-3 w-32 mt-2" /></div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 grid sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="space-y-2"><Skel className="h-3 w-20" /><Skel className="h-10 w-full" /></div>)}
      </div>
    </div>
  )
}

// ── MY PROFILE ─────────────────────────────────────────────────
export default function MyProfile() {
  const { user }   = useAuth()
  const [profile,  setProfile]   = useState(null)
  const [licenses, setLicenses]  = useState([])
  const [loading,  setLoading]   = useState(true)
  const [toast,    setToast]     = useState(null)
  const [editing,  setEditing]   = useState(false)
  const [activeTab, setActiveTab] = useState('info') // 'info' | 'password' | 'licenses'
  const location = useLocation()
  useEffect(() => {
    if (location.state?.tab === 'licenses') setActiveTab('licenses')
  }, [location.state])

  const [pwForm,   setPwForm]    = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showPw,   setShowPw]    = useState({ current: false, new: false, confirm: false })
  const [pwSaving, setPwSaving]  = useState(false)

  const [editForm,   setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [specializations, setSpecializations] = useState([])
  const [confirmDel, setConfirmDel] = useState(null) // license pending delete
  const [deleting,   setDeleting]   = useState(false)

  const filteredCities    = editForm.province ? getMunicipalitiesByProvince(editForm.province) : []
  const filteredBarangays = editForm.city     ? getBarangaysByMunicipality(editForm.city)      : []

  const showToast = (msg, type = 'success') => setToast({ msg, type, id: Date.now() })
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setConfirmDel(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      const provinceName = editForm.province === '1300000000'
        ? 'Metro Manila'
        : getAllProvinces().find(p => p.psgcCode === editForm.province)?.name || ''
      const cityName = getMunicipalitiesByProvince(editForm.province || '')
        .find(c => c.psgcCode === editForm.city)?.name || ''
      const builtAddress = [
        editForm.house_street,
        editForm.barangay,
        cityName,
        provinceName,
      ].filter(Boolean).join(', ')

      const payload = {
        first_name:        editForm.first_name,
        last_name:         editForm.last_name,
        email:             editForm.email,
        mobile:            editForm.mobile,
        specialization_id: editForm.specialization_id,
        address:           builtAddress || editForm.house_street || profile?.address || '',
      }
      const res = await apiPut(`/api/workers/update.php?id=${profile?.id}`, payload)
      if (!res.success) throw new Error(res.error)
      showToast('Profile updated')
      localStorage.setItem(`onboarded_${user?.id}`, '1')
      const wData = await apiGet('/api/workers/list.php', { per_page: 100 })
      const w = (wData.workers || []).find(w => String(w.id) === String(user?.id))
      if (w) {
        setProfile(w)
        setEditForm({
          first_name:        w.full_name?.split(' ')[0] || '',
          last_name:         w.full_name?.split(' ').slice(1).join(' ') || '',
          email:             w.email   || '',
          mobile:            w.mobile  || '',
          address:           w.address || '',
          specialization_id: '',
        })
      }
      setEditing(false)
    } catch (err) { showToast(err.message || 'Could not update your profile.', 'error') }
    setEditSaving(false)
  }

  useEffect(() => {
    const load = async () => {
      const t0 = Date.now()
      try {
        const wData = await apiGet('/api/workers/list.php')
        const workers = wData.workers || []
        const worker = workers.find(w =>
          String(w.id)      === String(user?.id) ||
          String(w.user_id) === String(user?.id)
        )
        if (!worker) { setLoading(false); return }
        setProfile(worker)

        const [lData, sData] = await Promise.all([
          apiGet('/api/licenses/list.php', { per_page: 50 }).catch(() => ({ licenses: [] })),
          apiGet('/api/config/specializations.php').catch(() => ({ specializations: [] })),
        ])

        const workerLicenses = (lData.licenses || []).filter(l =>
          String(l.user_id ?? l.contact_id) === String(worker.id)
        )
        setLicenses(workerLicenses)
        setSpecializations(sData.data || sData.specializations || [])

        setEditForm({
          first_name:        worker.full_name?.split(' ')[0] || '',
          last_name:         worker.full_name?.split(' ').slice(1).join(' ') || '',
          email:             worker.email   || '',
          mobile:            worker.mobile  || '',
          province:          '',
          city:              '',
          barangay:          '',
          house_street:      worker.address || '',
          specialization_id: '',
        })
      } catch { showToast('Could not load your profile.', 'error') }
      setTimeout(() => setLoading(false), Math.max(0, 800 - (Date.now() - t0)))
    }
    load()
  }, [])

  const handlePasswordChange = async () => {
    if (!pwForm.current_password)          { showToast('Enter your current password.', 'error'); return }
    if (pwForm.new_password.length < 6)    { showToast('New password must be at least 6 characters.', 'error'); return }
    if (pwForm.new_password !== pwForm.confirm_password) { showToast('Passwords do not match.', 'error'); return }
    setPwSaving(true)
    try {
      const res = await apiPost('/api/auth/reset-password.php', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
        confirm_password: pwForm.confirm_password,
      })
      if (!res.success) throw new Error(res.error)
      showToast('Password changed')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      localStorage.setItem(`onboarded_${user?.id}`, '1')
    } catch (err) { showToast(err.message || 'Could not change your password.', 'error') }
    setPwSaving(false)
  }

  const pw = (key, val) => setPwForm(p => ({ ...p, [key]: val }))

  const [licForm,      setLicForm]      = useState({ document_name: '', expiry_date: '' })
  const [licFile,      setLicFile]      = useState(null)
  const [licSaving,    setLicSaving]    = useState(false)
  const [dragOver,     setDragOver]     = useState(false)
  const [aiScanning,   setAiScanning]   = useState(false)
  const fileRef = useRef()

  const scanLicenseWithAI = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setAiScanning(true)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = () => rej(new Error('Read failed'))
        r.readAsDataURL(file)
      })
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const response = await fetch(`${API}/licenses/scan.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ image: base64, mime_type: file.type })
      })
      const data = await response.json()
      if (data.success && data.expiry_date) {
        setLicForm(p => ({ ...p, expiry_date: data.expiry_date }))
        showToast('Expiry date read from your photo')
      } else {
        const noDate = /no expiry date/i.test(data.error || '')
        showToast(
          noDate
            ? 'No expiry date found. Enter it manually.'
            : 'Automatic scan is unavailable right now. Enter the expiry date manually.',
          'error'
        )
      }
    } catch (err) {
      console.error('AI scan error:', err)
      showToast('Could not read the expiry date. Enter it manually.', 'error')
    }
    setAiScanning(false)
  }

  const pickLicense = f => {
    if (!f) { setLicFile(null); return false }
    if (!f.type.startsWith('image/')) { showToast('Only image files (JPG, PNG) are allowed.', 'error'); return false }
    setLicFile(f); scanLicenseWithAI(f)
    return true
  }

  const handleLicenseUpload = async () => {
    if (!licFile)                      { showToast('Choose a file to upload.', 'error'); return }
    if (!licForm.expiry_date)          { showToast('Add an expiry date, or use a clearer photo.', 'error'); return }
    setLicSaving(true)
    try {
      const formData = new FormData()
      formData.append('document',    licFile)
      formData.append('expiry_date', licForm.expiry_date)
      formData.append('user_id',     profile?.id || '')
      formData.append('contact_id',  profile?.id || '')   // old name, kept for compatibility
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res   = await fetch(`${API}/licenses/create.php`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('License uploaded')
      setLicForm({ document_name: '', expiry_date: '' })
      setLicFile(null)
      const lData = await apiGet('/api/licenses/list.php', { per_page: 50 }).catch(() => ({ licenses: [] }))
      setLicenses((lData.licenses || []).filter(l => String(l.user_id ?? l.contact_id) === String(profile?.id)))
    } catch (err) { showToast(err.message || 'Could not upload the license.', 'error') }
    setLicSaving(false)
  }

  const deleteLicense = async () => {
    const lic = confirmDel
    if (!lic) return
    setDeleting(true)
    try {
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res = await fetch(`${API}/licenses/delete.php?id=${lic.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Delete failed')
      setLicenses(prev => prev.filter(l => l.id !== lic.id))
      showToast('License deleted')
      setConfirmDel(null)
    } catch (err) {
      showToast(err.message || 'Could not delete the license.', 'error')
    }
    setDeleting(false)
  }

  if (loading) return <div className="sp-page w-full"><style>{styles}</style><ProfileSkeleton /></div>

  const displayName = user?.name || user?.username || '—'
  const TABS = [
    { id: 'info',     label: 'Profile',  icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'licenses', label: 'Licenses', icon: ShieldCheck, count: licenses.length },
  ]
  const tabIndex = TABS.findIndex(t => t.id === activeTab)
  const strength = pwStrength(pwForm.new_password)
  const mismatch = pwForm.confirm_password && pwForm.confirm_password !== pwForm.new_password

  return (
    <div className="sp-page w-full space-y-5">
      <style>{styles}</style>
      <Toast toast={toast} />

      {/* ── Profile Card ── */}
      <div className="sp-rise bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="sp-cover h-24" />
        <div className="px-6">
          <div className="flex items-end justify-between gap-3 -mt-10 flex-wrap">
            <div className="sp-pop w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full border-4 border-white flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(5,150,105,.7)] flex-shrink-0">
              <span className="font-semibold text-3xl text-white">{displayName.charAt(0).toUpperCase()}</span>
            </div>
            <button
              onClick={() => { setActiveTab('info'); setEditing(e => !e) }}
              className="mb-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium shadow-[0_6px_14px_-6px_rgba(5,150,105,.7)] active:scale-[.97] transition-all">
              {editing ? <><X size={14} {...ICON} /> Cancel edit</> : <><Pencil size={14} {...ICON} /> Edit profile</>}
            </button>
          </div>

          <div className="mt-3">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight leading-tight">{displayName}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {profile?.specialization || 'Worker account'}
              {(profile?.worker_code || profile?.user_code) && <span className="font-mono text-xs text-slate-400"> · {profile?.worker_code || profile?.user_code}</span>}
            </p>
          </div>

          {/* Tabs */}
          <div role="tablist" className="relative mt-5 flex border-b border-slate-100">
            {TABS.map(t => (
              <button key={t.id} role="tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 sm:flex-none sm:w-36 inline-flex items-center justify-center gap-1.5 h-11 text-[13px] font-medium transition-colors
                  ${activeTab === t.id ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}>
                <t.icon size={15} {...ICON} /> {t.label}
                {t.count > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold flex items-center justify-center tabular-nums">{t.count}</span>}
              </button>
            ))}
            <span className="sp-ind absolute bottom-[-1px] left-0 h-0.5 bg-emerald-600 rounded-full w-1/3 sm:w-36"
              style={{ transform: `translateX(${tabIndex * 100}%)` }} />
          </div>
        </div>
      </div>

      {/* ── Info Tab ── */}
      {activeTab === 'info' && (
        <Card className="p-6" key="info">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Full name</label>
              {editing ? (
                <div className="flex gap-2">
                  <input className={inputClass} placeholder="First name"
                    value={editForm.first_name || ''}
                    onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} />
                  <input className={inputClass} placeholder="Last name"
                    value={editForm.last_name || ''}
                    onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} />
                </div>
              ) : <ReadValue icon={User} value={profile?.full_name} />}
            </div>

            <div>
              <label className={labelClass}>Email address</label>
              {editing ? (
                <input className={inputClass} type="email" placeholder="email@example.com"
                  value={editForm.email || ''}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              ) : <ReadValue icon={Mail} value={editForm.email} />}
            </div>

            <div>
              <label className={labelClass}>Phone number</label>
              {editing ? (
                <input className={inputClass} placeholder="09XXXXXXXXX"
                  value={editForm.mobile || ''}
                  onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))} />
              ) : <ReadValue icon={Phone} value={editForm.mobile} />}
            </div>

            <div>
              <label className={labelClass}>Specialization</label>
              {editing ? (
                <select className={inputClass}
                  value={editForm.specialization_id || ''}
                  onChange={e => setEditForm(p => ({ ...p, specialization_id: e.target.value }))}>
                  <option value="">Keep current ({profile?.specialization || 'None'})</option>
                  {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : <ReadValue icon={Wrench} value={profile?.specialization} />}
            </div>
          </div>

          <div className="mb-2">
            <label className={labelClass}>Address</label>
            {editing ? (
              <div className="space-y-2 sp-fadein">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select className={inputClass}
                    value={editForm.province || ''}
                    onChange={e => setEditForm(p => ({ ...p, province: e.target.value, city: '', barangay: '' }))}>
                    <option value="">Province</option>
                    <option value="1300000000">Metro Manila</option>
                  </select>
                  <select className={inputClass}
                    value={editForm.city || ''} disabled={!editForm.province}
                    onChange={e => setEditForm(p => ({ ...p, city: e.target.value, barangay: '' }))}>
                    <option value="">City or municipality</option>
                    {filteredCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                  </select>
                  <select className={inputClass}
                    value={editForm.barangay || ''} disabled={!editForm.city}
                    onChange={e => setEditForm(p => ({ ...p, barangay: e.target.value }))}>
                    <option value="">Barangay</option>
                    {filteredBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <input className={inputClass} placeholder="House number and street (e.g. 123 Rizal Street)"
                  value={editForm.house_street || ''}
                  onChange={e => setEditForm(p => ({ ...p, house_street: e.target.value }))} />
              </div>
            ) : <ReadValue icon={MapPin} value={profile?.address} />}
          </div>

          {editing && (
            <div className="sp-fadein mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(false)}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 active:scale-[.97] transition-all">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-[13px] font-semibold shadow-[0_6px_14px_-6px_rgba(5,150,105,.7)] active:scale-[.97] transition-all">
                {editSaving && <RefreshCw size={14} {...ICON} className="animate-spin" />}
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Password Tab ── */}
      {activeTab === 'password' && (
        <Card className="p-6" key="password">
          <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">Use at least 6 characters. Longer passwords with mixed case, numbers and symbols are stronger.</p>
          <div className="max-w-md space-y-4">
            {[
              { key: 'current_password', label: 'Current password', show: showPw.current, toggle: () => setShowPw(p => ({ ...p, current: !p.current })) },
              { key: 'new_password',     label: 'New password',     show: showPw.new,     toggle: () => setShowPw(p => ({ ...p, new: !p.new }))         },
              { key: 'confirm_password', label: 'Confirm password', show: showPw.confirm, toggle: () => setShowPw(p => ({ ...p, confirm: !p.confirm }))  },
            ].map(({ key, label, show, toggle }) => (
              <div key={key}>
                <label htmlFor={key} className={labelClass}>{label}</label>
                <div className="relative">
                  <input id={key} type={show ? 'text' : 'password'} className={`${inputClass} pr-10`}
                    value={pwForm[key]} onChange={e => pw(key, e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={toggle} aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    {show ? <EyeOff size={15} {...ICON} /> : <Eye size={15} {...ICON} />}
                  </button>
                </div>
                {key === 'new_password' && pwForm.new_password && (
                  <div className="sp-fadein mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${strength >= i ? STRENGTH[strength][1] : 'bg-slate-100'}`} />
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{STRENGTH[strength][0]}</p>
                  </div>
                )}
                {key === 'confirm_password' && mismatch && (
                  <p className="sp-fadein mt-1.5 text-[11px] text-red-600 flex items-center gap-1"><AlertCircle size={12} {...ICON} /> Passwords do not match.</p>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button onClick={handlePasswordChange} disabled={pwSaving}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-[13px] font-semibold shadow-[0_6px_14px_-6px_rgba(5,150,105,.7)] active:scale-[.97] transition-all">
                {pwSaving && <RefreshCw size={14} {...ICON} className="animate-spin" />}
                {pwSaving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Licenses Tab ── */}
      {activeTab === 'licenses' && (
        <Card className="p-6" key="licenses">
          <h3 className="text-sm font-semibold text-slate-900">Licenses and documents</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">Upload a photo of your license. We read the expiry date for you.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload form */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Upload new</h4>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pickLicense(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
                className={`group relative overflow-hidden border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200
                  ${dragOver ? 'border-emerald-500 bg-emerald-50 scale-[1.01]' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/40'}`}>
                <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png"
                  onChange={e => { if (!pickLicense(e.target.files[0] || null)) e.target.value = '' }} />
                {aiScanning && <span className="sp-beam" />}
                {licFile ? (
                  <div className="sp-modal flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-2.5 rounded-lg bg-white ring-1 ring-emerald-200 px-3 py-2">
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileText size={16} {...ICON} /></span>
                      <div className="text-left min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate max-w-[180px]">{licFile.name}</p>
                        <p className="text-[11px] text-slate-400">{(licFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setLicFile(null); setAiScanning(false) }} aria-label="Remove file"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <X size={14} {...ICON} />
                      </button>
                    </div>
                    {aiScanning && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <Sparkles size={13} {...ICON} className="animate-pulse" /> Reading expiry date…
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <span className="mx-auto w-11 h-11 rounded-full bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 group-hover:-translate-y-1 flex items-center justify-center transition-all duration-300"><Upload size={20} {...ICON} /></span>
                    <p className="mt-3 text-sm text-slate-600">Drop a photo here or <span className="text-emerald-700 font-semibold">browse</span></p>
                    <p className="text-xs text-slate-400 mt-1">JPG or PNG</p>
                  </>
                )}
              </div>

              <div>
                <label htmlFor="lic-expiry" className={labelClass}>Expiry date <span className="text-red-500">*</span></label>
                <input id="lic-expiry" type="date" className={inputClass}
                  value={licForm.expiry_date}
                  onChange={e => setLicForm(p => ({ ...p, expiry_date: e.target.value }))} />
                {licForm.expiry_date && <p className="sp-fadein text-[11px] text-slate-500 mt-1">{fmtDate(licForm.expiry_date)}</p>}
              </div>

              <button onClick={handleLicenseUpload} disabled={licSaving}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-[13px] font-semibold shadow-[0_6px_14px_-6px_rgba(5,150,105,.7)] active:scale-[.98] transition-all">
                {licSaving ? <RefreshCw size={14} {...ICON} className="animate-spin" /> : <Upload size={14} {...ICON} />}
                {licSaving ? 'Uploading…' : 'Upload license'}
              </button>
            </div>

            {/* License list */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">On file</h4>
              {licenses.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-300 rounded-xl">
                  <div className="sp-float mx-auto w-12 h-12 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center"><ShieldCheck size={22} {...ICON} /></div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">No licenses on file</p>
                  <p className="text-xs text-slate-500 mt-1">Upload one to keep your documents current.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-0.5">
                  {licenses.map((lic, i) => {
                    const ex = expiryInfo(lic.expiry_date)
                    return (
                      <div key={lic.id} style={{ animationDelay: `${i * 70}ms` }}
                        className="sp-rise sp-row flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl bg-white">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 bg-emerald-50 ring-1 ring-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0"><FileText size={17} {...ICON} className="text-emerald-600" /></span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-800 truncate">{lic.document_name}</p>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                              <span className="text-[11px] text-slate-500">Expires {fmtDate(lic.expiry_date)}</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ring-1 ring-inset text-[10px] font-medium ${ex.cls}`}>
                                <span className={`w-1 h-1 rounded-full ${ex.dot}`} />{ex.label}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {lic.file_path && (
                            <button onClick={() => window.open(`${HOST}/${lic.file_path}`, '_blank')} aria-label="View license"
                              className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center active:scale-90 transition-all">
                              <Eye size={15} {...ICON} />
                            </button>
                          )}
                          <button onClick={() => setConfirmDel(lic)} aria-label="Delete license"
                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center active:scale-90 transition-all">
                            <Trash2 size={15} {...ICON} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDel && (
        <div className="sp-fadein fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget && !deleting) setConfirmDel(null) }}>
          <div role="alertdialog" aria-modal="true" className="sp-modal w-full max-w-sm bg-white rounded-2xl shadow-[0_32px_80px_-20px_rgba(16,24,40,0.45)] p-6">
            <span className="w-11 h-11 rounded-xl bg-red-50 ring-1 ring-red-100 text-red-600 flex items-center justify-center"><Trash2 size={19} {...ICON} /></span>
            <h3 className="mt-4 text-base font-semibold text-slate-900">Delete this license?</h3>
            <p className="text-sm text-slate-500 mt-1 break-words">{confirmDel.document_name} will be removed from your profile. This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} disabled={deleting}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-[.97] transition-all">Keep</button>
              <button onClick={deleteLicense} disabled={deleting}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-70 text-white text-[13px] font-semibold active:scale-[.97] transition-all">
                {deleting && <RefreshCw size={14} {...ICON} className="animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete license'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}