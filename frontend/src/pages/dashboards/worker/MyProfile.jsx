import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import {
  RefreshCw, CheckCircle, AlertCircle, User, Eye, EyeOff,
  FileText, Upload, X
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet, apiPut, apiPost } from '../../../utils/api'

// ── Helpers ────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 font-body text-sm border
      ${toast.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {toast.msg}
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
  if (location.state?.tab === 'licenses') {
    setActiveTab('licenses')
  }
}, [location.state])

  const [pwForm,   setPwForm]    = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [showPw,   setShowPw]    = useState({ current: false, new: false, confirm: false })
  const [pwSaving, setPwSaving]  = useState(false)

  const [editForm,   setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [specializations, setSpecializations] = useState([])

  const NCR_CODE          = '1300000000'
  const filteredCities    = editForm.province ? getMunicipalitiesByProvince(editForm.province) : []
  const filteredBarangays = editForm.city     ? getBarangaysByMunicipality(editForm.city)      : []

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

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
      showToast('Profile updated!')
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
    } catch (err) { showToast(err.message || 'Failed to update profile.', 'error') }
    setEditSaving(false)
  }

  useEffect(() => {
    const load = async () => {
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

        // contact_id may not be in the view — derive it from contact_code (strip 'C' + leading zeros)
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
      } catch { showToast('Failed to load profile.', 'error') }
      setLoading(false)
    }
    load()
  }, [])

  const handlePasswordChange = async () => {
    if (!pwForm.current_password)          { showToast('Current password is required.', 'error'); return }
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
      showToast('Password changed successfully!')
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
      localStorage.setItem(`onboarded_${user?.id}`, '1')
    } catch (err) { showToast(err.message || 'Failed to change password.', 'error') }
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
    console.log('scanLicenseWithAI called, file:', file?.name, file?.type)
    if (!file || !file.type.startsWith('image/')) {
      console.log('Skipping — not an image or no file')
      return
    }
    setAiScanning(true)
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = () => rej(new Error('Read failed'))
        r.readAsDataURL(file)
      })
     const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const response = await fetch('http://localhost/skillconnect/backend/api/licenses/scan.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64, mime_type: file.type })
      })
      const data = await response.json()
      console.log('scan.php response:', data)
      if (data.success && data.expiry_date) {
        setLicForm(p => ({ ...p, expiry_date: data.expiry_date }))
        showToast('Expiry date extracted automatically!', 'success')
      } else {
        console.warn('AI scan failed:', data.error)
        const noDate = /no expiry date/i.test(data.error || '')
        showToast(
          noDate
            ? 'No expiry date found — please enter it manually.'
            : 'Automatic scan is unavailable right now — please enter the expiry date manually.',
          'error'
        )
      }
    } catch (err) {
      console.error('AI scan error:', err)
      showToast('Could not read expiry date — please enter manually.', 'error')
    }
    setAiScanning(false)
  }

  const handleLicenseUpload = async () => {
    if (!licFile)                      { showToast('Please select a file.', 'error'); return }
if (!licForm.expiry_date)          { showToast('No expiry date found. Please enter it manually or use a clearer image.', 'error'); return }
    setLicSaving(true)
    try {
      const formData = new FormData()
      // contact_code is 'C00023' → strip 'C' and leading zeros → 23
formData.append('document',    licFile)
formData.append('expiry_date', licForm.expiry_date)
formData.append('user_id',     profile?.id || '')
formData.append('contact_id',  profile?.id || '')   // old name, kept for compatibility
      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const res   = await fetch('http://localhost/skillconnect/backend/api/licenses/create.php', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      showToast('License uploaded!')
      setLicForm({ document_name: '', expiry_date: '' })
      setLicFile(null)
      const lData = await apiGet('/api/licenses/list.php', { per_page: 50 }).catch(() => ({ licenses: [] }))
      const refreshed = (lData.licenses || []).filter(l =>
        String(l.user_id ?? l.contact_id) === String(profile?.id)
      )
      setLicenses(refreshed)
    } catch (err) { showToast(err.message || 'Failed to upload license.', 'error') }
    setLicSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3">
      <RefreshCw size={18} className="animate-spin text-emerald-500" />
      <span className="text-slate-400 text-sm">Loading profile...</span>
    </div>
  )

  const inputClass = "w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 bg-slate-50/60 placeholder:text-slate-300"
  const labelClass = "block text-xs font-medium text-slate-500 mb-1.5"

  return (
    <div className="space-y-4">
      <Toast toast={toast} />

      {/* ── Profile Card ── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        {/* Header strip */}
        <div className="h-20 bg-gradient-to-r from-emerald-500 to-emerald-600 relative" />

        {/* Avatar + name row */}
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-4">
            {/* Avatar */}
            <div className="w-20 h-20 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center shadow-md flex-shrink-0">
              <span className="font-bold text-2xl text-white">
                {(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            {/* Edit / tab buttons */}
            <div className="flex items-center gap-2 pb-1 flex-wrap">
              <button
                onClick={() => { setActiveTab('password') }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all
                  ${activeTab === 'password'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}>
                Change Password
              </button>
              <button
                onClick={() => { setActiveTab('licenses') }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all
                  ${activeTab === 'licenses'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}>
                Licenses
              </button>
              <button
                onClick={() => { setActiveTab('info'); setEditing(e => !e) }}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-md transition-colors shadow-sm">
                <User size={13} />
                {editing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {/* Name + role */}
          <div>
            <h2 className="font-bold text-lg text-slate-800 leading-tight">{user?.name || user?.username || '—'}</h2>
            <p className="text-sm text-slate-400">{profile?.specialization || 'Workers Account'} · <span className="font-mono text-xs">{profile?.worker_code || profile?.user_code || ''}</span></p>
          </div>
        </div>
      </div>

      {/* ── Info Tab ── */}
      {activeTab === 'info' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Full Name */}
            <div>
              <label className={labelClass}>Full Name</label>
              {editing ? (
                <div className="flex gap-2">
                  <input className={inputClass} placeholder="First name"
                    value={editForm.first_name || ''}
                    onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} />
                  <input className={inputClass} placeholder="Last name"
                    value={editForm.last_name || ''}
                    onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} />
                </div>
              ) : (
                <div className={`${inputClass} text-slate-600`}>{profile?.full_name || '—'}</div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className={labelClass}>Email Address</label>
              <input className={inputClass} type="email" placeholder="email@example.com"
                value={editForm.email || ''} readOnly={!editing}
                onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Phone Number</label>
              <input className={inputClass} placeholder="09XXXXXXXXX"
                value={editForm.mobile || ''} readOnly={!editing}
                onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value }))} />
            </div>

            {/* Company / Specialization */}
            <div>
              <label className={labelClass}>Specialization</label>
              {editing ? (
                <select className={inputClass}
                  value={editForm.specialization_id || ''}
                  onChange={e => setEditForm(p => ({ ...p, specialization_id: e.target.value }))}>
                  <option value="">— Keep current ({profile?.specialization || 'None'}) —</option>
                  {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div className={`${inputClass} text-slate-600`}>{profile?.specialization || '—'}</div>
              )}
            </div>
          </div>

          {/* Address (full width) */}
          <div className="mb-6">
            <label className={labelClass}>Address</label>
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select className={inputClass}
  value={editForm.province || ''}
  onChange={e => setEditForm(p => ({ ...p, province: e.target.value, city: '', barangay: '' }))}>
  <option value="">Province...</option>
  <option value="1300000000">Metro Manila</option>
</select>
                  <select className={inputClass}
                    value={editForm.city || ''} disabled={!editForm.province}
                    onChange={e => setEditForm(p => ({ ...p, city: e.target.value, barangay: '' }))}>
                    <option value="">City / Municipality...</option>
                    {filteredCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                  </select>
                  <select className={inputClass}
                    value={editForm.barangay || ''} disabled={!editForm.city}
                    onChange={e => setEditForm(p => ({ ...p, barangay: e.target.value }))}>
                    <option value="">Barangay...</option>
                    {filteredBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <input className={inputClass} placeholder="House No. & Street (e.g. 123 Rizal Street)"
                  value={editForm.house_street || ''}
                  onChange={e => setEditForm(p => ({ ...p, house_street: e.target.value }))} />
              </div>
            ) : (
              <div className={`${inputClass} text-slate-600`}>{profile?.address || '—'}</div>
            )}
          </div>

          {/* Action buttons */}
          {editing && (
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setEditing(false)}
                className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={editSaving}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-md transition-colors disabled:opacity-60 flex items-center gap-2">
                {editSaving ? <RefreshCw size={13} className="animate-spin" /> : null}
                {editSaving ? 'Saving...' : 'Update'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Password Tab ── */}
      {activeTab === 'password' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-sm text-slate-700 mb-4">Change Password</h3>
          <div className="max-w-md space-y-4">
            {[
              { key: 'current_password', label: 'Current Password', show: showPw.current, toggle: () => setShowPw(p => ({ ...p, current: !p.current })) },
              { key: 'new_password',     label: 'New Password',     show: showPw.new,     toggle: () => setShowPw(p => ({ ...p, new: !p.new }))         },
              { key: 'confirm_password', label: 'Confirm Password', show: showPw.confirm, toggle: () => setShowPw(p => ({ ...p, confirm: !p.confirm }))  },
            ].map(({ key, label, show, toggle }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} className={inputClass}
                    value={pwForm[key]} onChange={e => pw(key, e.target.value)} placeholder="••••••••" />
                  <button type="button" onClick={toggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <button onClick={handlePasswordChange} disabled={pwSaving}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2">
                {pwSaving ? <RefreshCw size={13} className="animate-spin" /> : null}
                {pwSaving ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Licenses Tab ── */}
      {activeTab === 'licenses' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-sm text-slate-700 mb-4">Licenses & Documents</h3>
          <div className="flex flex-col gap-6">
            {/* Upload form */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upload New</h4>
              <div className="space-y-1">
  <label className="block text-xs text-slate-400">Expiry Date *</label>
  <input
    type="date"
    className={inputClass}
    value={licForm.expiry_date}
    placeholder="dd/mm/yyyy"
    onChange={e => setLicForm(p => ({ ...p, expiry_date: e.target.value }))}
  />
  {licForm.expiry_date && (
    <p className="text-[10px] text-slate-400">
      {new Date(licForm.expiry_date).toLocaleDateString('en-GB')}
    </p>
  )}
</div>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
  e.preventDefault(); setDragOver(false)
  const f = e.dataTransfer.files[0]
  if (f) {
    if (!f.type.startsWith('image/')) { showToast('Only image files (JPG, PNG) are allowed.', 'error'); return }
    setLicFile(f); scanLicenseWithAI(f)
  }
}}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'}`}>
                <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png"
                  onChange={e => {
  const f = e.target.files[0] || null
  if (f && !f.type.startsWith('image/')) { showToast('Only image files (JPG, PNG) are allowed.', 'error'); e.target.value = ''; return }
  setLicFile(f)
  if (f) scanLicenseWithAI(f)
}} />
                {licFile ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <FileText size={14} className="text-emerald-500" />
                      <span className="text-sm text-slate-600 truncate max-w-[160px]">{licFile.name}</span>
                      <button onClick={e => { e.stopPropagation(); setLicFile(null); setAiScanning(false) }} className="text-slate-400 hover:text-red-500">
                        <X size={13} />
                      </button>
                    </div>
                    {aiScanning && (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <RefreshCw size={11} className="animate-spin" />
                        <span className="text-[10px] font-medium">Reading expiry date...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload size={20} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-400">Drop file or <span className="text-emerald-600 font-medium">browse</span></p>
                    <p className="text-xs text-slate-300 mt-1">PDF, JPG, PNG</p>
                  </>
                )}
              </div>
              <button onClick={handleLicenseUpload} disabled={licSaving}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {licSaving ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                {licSaving ? 'Uploading...' : 'Upload License'}
              </button>
            </div>

            {/* License list */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">On File</h4>
              {licenses.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg">
                  <FileText size={28} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-sm text-slate-400">No licenses on file</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {licenses.map(lic => (
                    <div key={lic.id} className="flex items-center justify-between gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-md flex items-center justify-center flex-shrink-0">
                          <FileText size={14} className="text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{lic.document_name}</p>
                          <p className="text-[10px] text-slate-400">Expires: {lic.expiry_date || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {lic.file_path && (
                          <button
                            onClick={() => window.open(`http://localhost/skillconnect/${lic.file_path}`, '_blank')}
                            className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 text-slate-500 rounded hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-1">
                            <Eye size={10} />View
                          </button>
                        )}
                       <button
                                          onClick={async () => {
                    if (!window.confirm('Delete this license?')) return
                    try {
                      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
                      const res = await fetch(`http://localhost/skillconnect/backend/api/licenses/delete.php?id=${lic.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      })
                      const data = await res.json()
                      if (!data.success) throw new Error(data.error || 'Delete failed')
                      setLicenses(prev => prev.filter(l => l.id !== lic.id))
                      showToast('License deleted.', 'success')
                    } catch (err) {
                      showToast(err.message || 'Failed to delete license.', 'error')
                    }
                  }}
                        className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 text-slate-500 rounded hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1">
                        <X size={10} />Delete
                      </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}