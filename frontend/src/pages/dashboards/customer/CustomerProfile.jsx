import { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle, AlertCircle, UserCircle, Lock,
  KeyRound, Eye, EyeOff
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'

// ── Responsive Hook ────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

// ── Design Tokens ──────────────────────────────────────────────
const C = {
  green: '#16a34a', greenLight: '#dcfce7', greenDark: '#15803d',
  red: '#dc2626', redLight: '#fee2e2',
  card: '#ffffff', border: '#e5e7eb',
  text: '#111827', textMid: '#374151', textSub: '#6b7280', textFaint: '#9ca3af',
}

function getCustomerContactId() {
  try { return JSON.parse(localStorage.getItem('sc_user') || '{}')?.contact_id || null }
  catch { return null }
}
function getCustomerInfo() {
  try { return JSON.parse(localStorage.getItem('sc_user') || '{}') }
  catch { return {} }
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      background: toast.type === 'success' ? C.greenLight : C.redLight,
      color:      toast.type === 'success' ? C.greenDark  : C.red,
      border:     `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
    }}>
      {toast.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {toast.msg}
    </div>
  )
}
function PasswordInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          style={{
            width: '100%', padding: '9px 36px 9px 12px', borderRadius: 8,
            border: `1px solid ${C.border}`, fontSize: 13, color: C.text,
            background: '#fff', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button type="button" onClick={() => setShow(s => !s)} style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          border: 'none', background: 'none', cursor: 'pointer', color: C.textSub, padding: 2,
        }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

// ── Customer Profile Page ──────────────────────────────────────
export default function CustomerProfilePage() {
  const contactId = getCustomerContactId()
  const customer  = getCustomerInfo()
  const isMobile  = useWindowWidth() < 640
  const [contact,   setContact]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [pwForm,    setPwForm]    = useState({ current: '', newPass: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError,   setPwError]   = useState('')
  const [editMode,  setEditMode]  = useState(false)
  const [profileForm, setProfileForm] = useState({ province: '', city: '', barangay: '', house_street: '' })
  const profileCities    = profileForm.province ? getMunicipalitiesByProvince(profileForm.province) : []
  const profileBarangays = profileForm.city     ? getBarangaysByMunicipality(profileForm.city)      : []

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (contactId) {
          const cData = await apiGet('/api/contacts/list.php', { per_page: 100 })
          const found = (cData.contacts || []).find(c => String(c.id) === String(contactId))
          setContact(found || null)
          if (found?.address) {
            const parts = found.address.split(', ')
            setProfileForm(f => ({ ...f, house_street: parts[0] || '', barangay: parts[1] || '' }))
          }
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  // REPLACE this function in CustomerProfilePage:
const handleChangePassword = async () => {
  setPwError('')
  if (!pwForm.current || !pwForm.newPass || !pwForm.confirm) { setPwError('All fields are required.'); return }
  if (pwForm.newPass !== pwForm.confirm) { setPwError('New passwords do not match.'); return }
  if (pwForm.newPass.length < 8) { setPwError('New password must be at least 8 characters.'); return }
  setPwLoading(true)
  try {
    const res = await apiPost('/api/auth/change-password.php', {
      current_password: pwForm.current,
      new_password: pwForm.newPass,
      confirm_password: pwForm.confirm,
    })
    if (res.success) {
      setPwForm({ current: '', newPass: '', confirm: '' })
      showToast('Password changed successfully!', 'success')
      // Re-save token if the backend returns a new one
      if (res.token) {
        localStorage.setItem('sc_token', res.token)
      }
    } else {
      setPwError(res.error || res.message || 'Failed to change password.')
    }
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || 'Failed to change password.'
    setPwError(msg)
  }
  setPwLoading(false)
}

  const fullName = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    : customer?.name || '—'

  const initial = fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 13, color: editMode ? C.text : C.textSub,
    background: editMode ? '#fff' : '#f9fafb', outline: 'none', boxSizing: 'border-box',
    cursor: editMode ? 'text' : 'default',
  }

  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Toast toast={toast} />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12, color: C.textSub }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading profile...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* LEFT — Avatar + Info Form */}
          <div style={{
            background: C.card, borderRadius: 12,
            border: `1px solid ${C.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            padding: '28px 28px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', background: C.green,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>{initial || '?'}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{fullName}</div>
                <div style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>Client Account</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                <input readOnly={!editMode} value={fullName} style={inputStyle} onChange={() => {}} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                <input readOnly={!editMode} value={contact?.email || customer?.email || ''} style={inputStyle} onChange={() => {}} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number</label>
                <input readOnly={!editMode} value={contact?.mobile || customer?.mobile || ''} style={inputStyle} onChange={() => {}} />
              </div>
              
              {!editMode ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</label>
                  <input readOnly value={contact?.address || '—'} style={{ ...inputStyle, background: '#f9fafb', color: C.textSub }} />
                </div>
              ) : (
                <>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Province</label>
                    <select value={profileForm.province} onChange={e => setProfileForm(f => ({ ...f, province: e.target.value, city: '', barangay: '' }))}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select province...</option>
<option value="1300000000">Metro Manila</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>City / Municipality</label>
                    <select disabled={!profileForm.province} value={profileForm.city} onChange={e => setProfileForm(f => ({ ...f, city: e.target.value, barangay: '' }))}
                      style={{ ...inputStyle, cursor: profileForm.province ? 'pointer' : 'default', opacity: profileForm.province ? 1 : 0.6 }}>
                      <option value="">Select city...</option>
                      {profileCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Barangay</label>
                    <select disabled={!profileForm.city} value={profileForm.barangay} onChange={e => setProfileForm(f => ({ ...f, barangay: e.target.value }))}
                      style={{ ...inputStyle, cursor: profileForm.city ? 'pointer' : 'default', opacity: profileForm.city ? 1 : 0.6 }}>
                      <option value="">Select barangay...</option>
                      {profileBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: 11, color: C.textSub, marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>House No. & Street</label>
                    <input value={profileForm.house_street} onChange={e => setProfileForm(f => ({ ...f, house_street: e.target.value }))}
                      placeholder="e.g. 123 Rizal Street" style={inputStyle} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {editMode && (
                <button onClick={() => setEditMode(false)} style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: `1px solid ${C.border}`, background: '#fff',
                  fontSize: 13, fontWeight: 600, color: C.textMid, cursor: 'pointer',
                }}>Cancel</button>
              )}
              <button onClick={async () => {
                if (editMode) {
                  const NCR_CODE = '1300000000'
                  const cities = profileForm.province ? getMunicipalitiesByProvince(profileForm.province) : []
                  const provName = profileForm.province === NCR_CODE ? 'Metro Manila' : getAllProvinces().find(p => p.psgcCode === profileForm.province)?.name ?? ''
                  const cityName = cities.find(c => c.psgcCode === profileForm.city)?.name ?? ''
                  const builtAddress = [profileForm.house_street, profileForm.barangay, cityName, provName].filter(Boolean).join(', ')
                  try {
                    const res = await apiPost('/api/contacts/update.php', { id: contactId, address: builtAddress })
                    if (res.success) {
                      setContact(c => ({ ...c, address: builtAddress }))
                      showToast('Profile updated!')
                    } else {
                      showToast(res.error || 'Update failed.', 'error')
                    }
                  } catch { showToast('Update failed.', 'error') }
                  setEditMode(false)
                } else {
                  // Auto-fill from saved address when clicking Edit Profile
                  const saved = contact?.address || ''
                  const parts = saved.split(', ')
                  const total = parts.length
                  const savedProvName  = total >= 1 ? parts[total - 1] : ''
                  const savedCityName  = total >= 2 ? parts[total - 2] : ''
                  const savedBarangay  = total >= 3 ? parts[total - 3] : ''
                  const savedStreet    = total >= 4 ? parts.slice(0, total - 3).join(', ') : ''

                  const NCR_CODE = '1300000000'
                  const allProvs = getAllProvinces()
                  const matchedProv = savedProvName === 'Metro Manila'
                    ? NCR_CODE
                    : allProvs.find(p => p.name.toLowerCase() === savedProvName.toLowerCase())?.psgcCode || ''

                  const allCities = matchedProv ? getMunicipalitiesByProvince(matchedProv) : []
                  const matchedCity = allCities.find(c => c.name.toLowerCase() === savedCityName.toLowerCase())?.psgcCode || ''

                  setProfileForm({
                    province:     matchedProv,
                    city:         matchedCity,
                    barangay:     savedBarangay,
                    house_street: savedStreet,
                  })
                  setEditMode(true)
                }
              }}style={{
                padding: '8px 18px', borderRadius: 8,
                border: `1px solid ${C.green}`, background: C.green,
                fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <UserCircle size={14} />
                {editMode ? 'Save Changes' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {/* RIGHT — Change Password */}
          <div style={{
            background: C.card, borderRadius: 12,
            border: `1px solid ${C.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            padding: '28px 28px 24px',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '0 0 20px' }}>Change Password</h3>
            <PasswordInput label="Current Password"     value={pwForm.current}  onChange={e => setPwForm(f => ({ ...f, current:  e.target.value }))} placeholder="Enter current password" />
            <PasswordInput label="New Password"         value={pwForm.newPass}  onChange={e => setPwForm(f => ({ ...f, newPass:  e.target.value }))} placeholder="Min. 8 characters" />
            <PasswordInput label="Confirm New Password" value={pwForm.confirm}  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Re-enter new password" />

            {pwError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
                background: C.redLight, border: `1px solid #fca5a5`, borderRadius: 8,
                fontSize: 12, color: C.red, marginBottom: 14,
              }}>
                <AlertCircle size={13} /> {pwError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textFaint, marginBottom: 18 }}>
              <Lock size={11} /> Password must be at least 8 characters long.
            </div>

            <button onClick={handleChangePassword} disabled={pwLoading} style={{
              width: '100%', padding: '10px', borderRadius: 8,
              border: 'none', background: C.green,
              fontSize: 13, fontWeight: 700, color: '#fff', cursor: pwLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: pwLoading ? 0.7 : 1,
            }}>
              {pwLoading
                ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</>
                : <><KeyRound size={14} /> Update Password</>
              }
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}