import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, Pencil, Lock, KeyRound, Eye, EyeOff, Mail, Phone, MapPin, User, Check } from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import {
  ICON, MIN_SKELETON_MS, Skel, Toast, useToast, PageHeader, inputCls, labelCls, btnPrimary, btnSecondary, getCustomerInfo,
} from './CustomerUI'

const NCR_CODE = '1300000000'

function PasswordInput({ id, label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete}
          placeholder={placeholder || '••••••••'} className={`${inputCls} pr-10`} />
        <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700">
          {show ? <EyeOff size={16} {...ICON} /> : <Eye size={16} {...ICON} />}
        </button>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="w-9 h-9 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0"><Icon size={16} {...ICON} /></span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-900 mt-0.5 break-words">{value || '—'}</p>
      </div>
    </div>
  )
}

// ── Customer Profile Page ──────────────────────────────────────
export default function CustomerProfilePage() {
  const customer = getCustomerInfo()
  const [contact,   setContact]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [pwForm,    setPwForm]    = useState({ current: '', newPass: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError,   setPwError]   = useState('')
  const [editMode,  setEditMode]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [profileForm, setProfileForm] = useState({ province: '', city: '', barangay: '', house_street: '' })
  const [toast, showToast] = useToast()
  const profileCities    = profileForm.province ? getMunicipalitiesByProvince(profileForm.province) : []
  const profileBarangays = profileForm.city     ? getBarangaysByMunicipality(profileForm.city)      : []

  useEffect(() => {
    const load = async () => {
      const started = Date.now()
      try {
        // The server only returns the logged-in customer's own record
        const cData = await apiGet('/api/contacts/list.php', { per_page: 1 })
        setContact((cData.contacts || [])[0] || null)
      } catch { /* show what we have from the login */ }
      const wait = MIN_SKELETON_MS - (Date.now() - started)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      setLoading(false)
    }
    load()
  }, [])

  const startEdit = () => {
    // Fill the form from the saved address
    const parts = (contact?.address || '').split(', ')
    const total = parts.length
    const savedProvName = total >= 1 ? parts[total - 1] : ''
    const savedCityName = total >= 2 ? parts[total - 2] : ''
    const savedBarangay = total >= 3 ? parts[total - 3] : ''
    const savedStreet   = total >= 4 ? parts.slice(0, total - 3).join(', ') : ''
    const matchedProv = savedProvName === 'Metro Manila'
      ? NCR_CODE
      : getAllProvinces().find(p => p.name.toLowerCase() === savedProvName.toLowerCase())?.psgcCode || ''
    const allCities   = matchedProv ? getMunicipalitiesByProvince(matchedProv) : []
    const matchedCity = allCities.find(c => c.name.toLowerCase() === savedCityName.toLowerCase())?.psgcCode || ''
    setProfileForm({ province: matchedProv, city: matchedCity, barangay: savedBarangay, house_street: savedStreet })
    setEditMode(true)
  }

  const saveAddress = async () => {
    if (!profileForm.province || !profileForm.city || !profileForm.barangay || !profileForm.house_street.trim()) {
      showToast('Please complete your address.', 'error')
      return
    }
    const cities   = getMunicipalitiesByProvince(profileForm.province)
    const provName = profileForm.province === NCR_CODE ? 'Metro Manila' : getAllProvinces().find(p => p.psgcCode === profileForm.province)?.name ?? ''
    const cityName = cities.find(c => c.psgcCode === profileForm.city)?.name ?? ''
    const builtAddress = [profileForm.house_street.trim(), profileForm.barangay, cityName, provName].filter(Boolean).join(', ')
    setSaving(true)
    try {
      const res = await apiPost('/api/contacts/update.php', { id: contact?.id, address: builtAddress })
      if (!res.success) throw new Error(res.error)
      setContact(c => ({ ...c, address: builtAddress }))
      showToast('Address updated.')
      setEditMode(false)
    } catch (e) { showToast(e.message || 'Could not update your address.', 'error') }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (!pwForm.current || !pwForm.newPass || !pwForm.confirm) { setPwError('Please fill in all three fields.'); return }
    if (pwForm.newPass.length < 8) { setPwError('The new password must be at least 8 characters.'); return }
    if (pwForm.newPass !== pwForm.confirm) { setPwError('The new passwords don’t match.'); return }
    setPwLoading(true)
    try {
      const res = await apiPost('/api/auth/change-password.php', {
        current_password: pwForm.current,
        new_password: pwForm.newPass,
        confirm_password: pwForm.confirm,
      })
      if (res.success) {
        setPwForm({ current: '', newPass: '', confirm: '' })
        showToast('Password changed.')
        if (res.token) localStorage.setItem('sc_token', res.token)
      } else {
        setPwError(res.error || res.message || 'Could not change the password.')
      }
    } catch (err) {
      setPwError(err?.response?.data?.error || err?.message || 'Could not change the password.')
    }
    setPwLoading(false)
  }

  const fullName = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    : (customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}`.trim() : customer?.name || '—')
  const initials = fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  const strength = pwForm.newPass.length === 0 ? 0 : pwForm.newPass.length < 8 ? 1 : (/[A-Z]/.test(pwForm.newPass) && /\d/.test(pwForm.newPass) ? 3 : 2)

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <PageHeader title="My profile" sub="Your contact details and password." />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Details */}
        <section className="cx-rise lg:col-span-3 bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ animationDelay: '60ms' }}>
          <div className="px-5 sm:px-6 py-5 flex items-center gap-4 border-b border-slate-100">
            {loading ? <Skel className="w-14 h-14 rounded-full" /> : (
              <span className="w-14 h-14 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 text-lg font-semibold flex items-center justify-center flex-shrink-0">{initials || '?'}</span>
            )}
            <div className="min-w-0">
              {loading ? <><Skel className="h-4 w-40" /><Skel className="h-3 w-24 mt-2" /></> : <>
                <h2 className="text-lg font-semibold text-slate-900 truncate">{fullName}</h2>
                <p className="text-sm text-slate-500">Customer account</p>
              </>}
            </div>
          </div>

          <div className="px-5 sm:px-6 py-2">
            {loading ? (
              <div className="py-3 space-y-4">{[0, 1, 2, 3].map(i => <Skel key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                <InfoRow icon={User}  label="Full name" value={fullName} />
                <InfoRow icon={Mail}  label="Email"     value={contact?.email || customer?.email} />
                <InfoRow icon={Phone} label="Mobile"    value={contact?.mobile || customer?.mobile} />
                {!editMode ? (
                  <div className="flex items-start gap-3 py-3">
                    <span className="w-9 h-9 rounded-lg bg-slate-50 ring-1 ring-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0"><MapPin size={16} {...ICON} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">Address</p>
                      <p className="text-sm text-slate-900 mt-0.5 break-words">{contact?.address || '—'}</p>
                    </div>
                    {contact && (
                      <button onClick={startEdit} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium text-emerald-700 hover:bg-emerald-50 flex-shrink-0">
                        <Pencil size={14} {...ICON} />Edit
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cx-pop py-4 space-y-4">
                    <p className="text-sm font-semibold text-slate-900">Edit address</p>
                    <div>
                      <label htmlFor="pf-prov" className={labelCls}>Province</label>
                      <select id="pf-prov" value={profileForm.province} onChange={e => setProfileForm(f => ({ ...f, province: e.target.value, city: '', barangay: '' }))} className={inputCls}>
                        <option value="">Select province…</option>
                        <option value={NCR_CODE}>Metro Manila</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="pf-city" className={labelCls}>City / municipality</label>
                        <select id="pf-city" disabled={!profileForm.province} value={profileForm.city} onChange={e => setProfileForm(f => ({ ...f, city: e.target.value, barangay: '' }))} className={inputCls}>
                          <option value="">Select city…</option>
                          {profileCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="pf-brgy" className={labelCls}>Barangay</label>
                        <select id="pf-brgy" disabled={!profileForm.city} value={profileForm.barangay} onChange={e => setProfileForm(f => ({ ...f, barangay: e.target.value }))} className={inputCls}>
                          <option value="">Select barangay…</option>
                          {profileBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="pf-street" className={labelCls}>House no. &amp; street</label>
                      <input id="pf-street" value={profileForm.house_street} onChange={e => setProfileForm(f => ({ ...f, house_street: e.target.value }))}
                        placeholder="e.g. 123 Rizal Street" className={inputCls} />
                    </div>
                    <div className="flex justify-end gap-3 pt-1">
                      <button onClick={() => setEditMode(false)} disabled={saving} className={btnSecondary}>Cancel</button>
                      <button onClick={saveAddress} disabled={saving} className={btnPrimary}>
                        {saving ? <RefreshCw size={15} {...ICON} className="animate-spin" /> : <Check size={16} {...ICON} />}{saving ? 'Saving…' : 'Save address'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500">
            To change your name, email or mobile number, please contact us.
          </p>
        </section>

        {/* Password */}
        <section className="cx-rise lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ animationDelay: '120ms' }}>
          <header className="px-5 sm:px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-600 flex items-center justify-center"><Lock size={18} {...ICON} /></span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Change password</h2>
              <p className="text-xs text-slate-500 mt-0.5">At least 8 characters.</p>
            </div>
          </header>
          <form className="px-5 sm:px-6 py-5 space-y-4" onSubmit={e => { e.preventDefault(); handleChangePassword() }}>
            <PasswordInput id="pw-cur"  label="Current password" value={pwForm.current} autoComplete="current-password"
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter your current password" />
            <div>
              <PasswordInput id="pw-new" label="New password" value={pwForm.newPass} autoComplete="new-password"
                onChange={e => setPwForm(f => ({ ...f, newPass: e.target.value }))} placeholder="At least 8 characters" />
              {strength > 0 && (
                <div className="mt-2 flex items-center gap-2" aria-live="polite">
                  <div className="flex-1 grid grid-cols-3 gap-1">
                    {[1, 2, 3].map(n => (
                      <span key={n} className={`h-1 rounded-full ${n <= strength ? (strength === 1 ? 'bg-red-400' : strength === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500 w-14 text-right">{['', 'Too short', 'Okay', 'Strong'][strength]}</span>
                </div>
              )}
            </div>
            <PasswordInput id="pw-conf" label="Confirm new password" value={pwForm.confirm} autoComplete="new-password"
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Type the new password again" />

            {pwError && (
              <p className="cx-shake flex items-center gap-2 text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} {...ICON} className="flex-shrink-0" />{pwError}
              </p>
            )}

            <button type="submit" disabled={pwLoading} className={`${btnPrimary} w-full`}>
              {pwLoading ? <RefreshCw size={15} {...ICON} className="animate-spin" /> : <KeyRound size={16} {...ICON} />}
              {pwLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}