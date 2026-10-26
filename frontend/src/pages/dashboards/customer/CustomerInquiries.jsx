import { useState, useEffect } from 'react'
import {
  RefreshCw, MessageSquare, MapPin, Calendar, Phone, FileText,
  X, CheckCircle, AlertCircle
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
  blue: '#2563eb', blueLight: '#dbeafe',
  purpleLight: '#f3e8ff',
  red: '#dc2626', redLight: '#fee2e2',
  bg: '#f3f4f6', card: '#ffffff', border: '#e5e7eb',
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
export default function CustomerInquiriesPage() {
  const contactId = getCustomerContactId()
  const customer  = getCustomerInfo()
  const isMobile  = useWindowWidth() < 640
  const [inquiries,    setInquiries]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected,     setSelected]     = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── New Inquiry form ──
  const EMPTY_INQUIRY = { first_name: '', last_name: '', email: '', mobile: '', province: '', city: '', barangay: '', house_street: '', reason: '', description: '' }
  const NCR_CODE = '1300000000'
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [inquiryLoading,  setInquiryLoading]  = useState(false)
  const [inquiryForm,     setInquiryForm]     = useState(EMPTY_INQUIRY)

  const inqCities       = inquiryForm.province ? getMunicipalitiesByProvince(inquiryForm.province) : []
  const inqBarangays    = inquiryForm.city     ? getBarangaysByMunicipality(inquiryForm.city)      : []
  const inqProvinceName = inquiryForm.province === NCR_CODE ? 'Metro Manila' : getAllProvinces().find(p => p.psgcCode === inquiryForm.province)?.name ?? ''
  const inqCityName     = inqCities.find(c => c.psgcCode === inquiryForm.city)?.name ?? ''
  const buildInquiryAddress = () => [inquiryForm.house_street, inquiryForm.barangay, inqCityName, inqProvinceName].filter(Boolean).join(', ')

  const openInquiryForm = async () => {
    // Use the latest saved address; fall back to the login info
    let savedAddress = customer?.address || ''
    try {
      const cData = await apiGet('/api/contacts/list.php', { per_page: 1 })
      savedAddress = cData.contacts?.[0]?.address || savedAddress
    } catch {}

    const parts = savedAddress.split(', ').filter(Boolean)
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

    setInquiryForm({
      ...EMPTY_INQUIRY,
      first_name:   customer?.first_name || customer?.name?.split(' ')[0] || '',
      last_name:    customer?.last_name  || customer?.name?.split(' ').slice(1).join(' ') || '',
      email:        customer?.email      || '',
      mobile:       customer?.mobile     || '',
      province:     matchedProv,
      city:         matchedCity,
      barangay:     savedBarangay,
      house_street: savedStreet,
    })
    setShowInquiryForm(true)
  }

  const closeInquiryForm = () => { setShowInquiryForm(false); setInquiryForm(EMPTY_INQUIRY) }

  const handleSubmitInquiry = async () => {
    if (!inquiryForm.first_name.trim() || !inquiryForm.last_name.trim()) { showToast('First and last name are required.', 'error'); return }
    if (!inquiryForm.province || !inquiryForm.city || !inquiryForm.barangay || !inquiryForm.house_street.trim()) { showToast('Complete address is required.', 'error'); return }
    if (!inquiryForm.reason) { showToast('Please select a reason.', 'error'); return }
    if (inquiryForm.reason === 'Other' && !inquiryForm.description.trim()) { showToast('Please specify your reason.', 'error'); return }
    if (inquiryLoading) return
    setInquiryLoading(true)
    try {
      const res = await apiPost('/api/inquiries/create.php', { ...inquiryForm, address: buildInquiryAddress() })
      if (!res.success) throw new Error(res.error)
      showToast('Inquiry submitted successfully!')
      closeInquiryForm()
      loadInquiries()
    } catch (err) { showToast(err.message || 'Failed to submit inquiry.', 'error') }
    setInquiryLoading(false)
  }

  const INQUIRY_STATUS_COLORS = {
    'New':         { bg: C.blueLight,   color: '#1e40af', border: '#93c5fd' },
    'Pending':     { bg: '#fef9c3',     color: '#854d0e', border: '#fde047' },
    'Reviewed':    { bg: C.purpleLight, color: '#6b21a8', border: '#d8b4fe' },
    'Converted':   { bg: C.greenLight,  color: C.greenDark, border: '#86efac' },
    'Cancelled':   { bg: C.redLight,    color: C.red,     border: '#fca5a5' },
    'Closed':      { bg: '#f3f4f6',     color: '#374151', border: '#d1d5db' },
  }

  function InquiryStatusBadge({ status }) {
    const s = INQUIRY_STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.02em', background: s.bg, color: s.color,
        border: `1px solid ${s.border}`,
      }}>
        {status || '—'}
      </span>
    )
  }

  const loadInquiries = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/inquiries/list.php', { per_page: 100 })
      setInquiries(data.inquiries || [])
    } catch {
      showToast('Failed to load inquiries.', 'error')
    }
    setLoading(false)
  }

  useEffect(() => { loadInquiries() }, [])

  const statuses = [...new Set(inquiries.map(i => i.status).filter(Boolean))]

  const filtered = inquiries.filter(inq => {
    const matchSearch = !search ||
      inq.inquiry_code?.toLowerCase().includes(search.toLowerCase()) ||
      inq.reason?.toLowerCase().includes(search.toLowerCase()) ||
      inq.description?.toLowerCase().includes(search.toLowerCase()) ||
      inq.address?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !filterStatus || inq.status === filterStatus
    return matchSearch && matchStatus
  })
  return (
    <div style={{ padding: isMobile ? '16px 14px' : '24px 28px', maxWidth: 860, margin: '0 auto' }}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 10 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: C.text, margin: 0 }}>My Inquiries</h2>
          <p style={{ fontSize: 12, color: C.textSub, margin: '3px 0 0' }}>All your submitted inquiries and their current status</p>
        </div>
        <button
          onClick={openInquiryForm}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: isMobile ? '8px 12px' : '9px 18px', borderRadius: 8,
            flexShrink: 0, border: 'none', background: C.green,
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(22,163,74,0.25)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.greenDark}
          onMouseLeave={e => e.currentTarget.style.background = C.green}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Inquiry
        </button>
      </div>
      {/* Search + Filter */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textFaint }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, reason, address..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, outline: 'none', background: '#fff', minWidth: 140 }}
        >
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12, color: C.textSub }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Loading your inquiries...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: C.textSub }}>
          <MessageSquare size={36} style={{ color: C.textFaint, margin: '0 auto 12px', display: 'block' }} />
          No inquiries found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(inq => (
            <div key={inq.id} style={{
              background: C.card, borderRadius: 12,
              border: `1px solid ${C.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: '16px 20px',
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#d1d5db' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = C.border }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: C.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MessageSquare size={13} color={C.blue} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{inq.inquiry_code || `INQ-${inq.id}`}</span>
                    {/* Use InquiryStatusBadge inline since it's defined inside the component */}
                    {(() => {
                      const s = INQUIRY_STATUS_COLORS[inq.status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {inq.status || '—'}
                        </span>
                      )
                    })()}
                  </div>
                  <div style={{ fontSize: 12, color: C.textSub, marginLeft: 38 }}>
                    {inq.reason || 'General Inquiry'}
                    {inq.description && inq.reason === 'Other' ? ` — ${inq.description}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(inq)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
                    background: '#fff', fontSize: 11, fontWeight: 600, color: C.blue,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.blueLight}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  View Details
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginLeft: 38 }}>
                {inq.address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <MapPin size={11} color={C.textFaint} />
                    {inq.address}
                  </div>
                )}
                {inq.created_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <Calendar size={11} color={C.textFaint} />
                    <span style={{ fontSize: 10, color: C.textFaint }}>Submitted</span>
                    <span>{inq.created_at?.slice(0, 10)}</span>
                  </div>
                )}
                {inq.mobile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textSub }}>
                    <Phone size={11} color={C.textFaint} />
                    {inq.mobile}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Inquiry Modal */}
      {showInquiryForm && (() => {
        const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }
        const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: '#fff', outline: 'none', boxSizing: 'border-box' }
        const twoCol = window.innerWidth < 480 ? '1fr' : '1fr 1fr'
        const setF = (k, v) => setInquiryForm(f => ({ ...f, [k]: v }))
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: '#f9fafb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} color={C.green} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>New Inquiry</div>
                    <div style={{ fontSize: 11, color: C.textSub }}>Tell us what you need</div>
                  </div>
                </div>
                <button onClick={closeInquiryForm} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.textSub, padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: twoCol, gap: 12 }}>
                  <div>
                    <label style={lbl}>First Name *</label>
                    <input value={inquiryForm.first_name} onChange={e => setF('first_name', e.target.value)} placeholder="Juan" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Last Name *</label>
                    <input value={inquiryForm.last_name} onChange={e => setF('last_name', e.target.value)} placeholder="dela Cruz" style={inp} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: twoCol, gap: 12 }}>
                  <div>
                    <label style={lbl}>Email</label>
                    <input type="email" value={inquiryForm.email} onChange={e => setF('email', e.target.value)} placeholder="juan@email.com" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Mobile</label>
                    <input value={inquiryForm.mobile} onChange={e => setF('mobile', e.target.value)} placeholder="+639XXXXXXXXX" style={inp} />
                  </div>
                </div>

                <div>
                  <label style={lbl}>Province *</label>
                  <select value={inquiryForm.province} onChange={e => setInquiryForm(f => ({ ...f, province: e.target.value, city: '', barangay: '' }))} style={inp}>
                    <option value="">Select province...</option>
                    <option value="1300000000">Metro Manila</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: twoCol, gap: 12 }}>
                  <div>
                    <label style={lbl}>City / Municipality *</label>
                    <select value={inquiryForm.city} disabled={!inquiryForm.province}
                      onChange={e => setInquiryForm(f => ({ ...f, city: e.target.value, barangay: '' }))}
                      style={{ ...inp, background: inquiryForm.province ? '#fff' : '#f9fafb', opacity: inquiryForm.province ? 1 : 0.6 }}>
                      <option value="">Select city...</option>
                      {inqCities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Barangay *</label>
                    <select value={inquiryForm.barangay} disabled={!inquiryForm.city}
                      onChange={e => setF('barangay', e.target.value)}
                      style={{ ...inp, background: inquiryForm.city ? '#fff' : '#f9fafb', opacity: inquiryForm.city ? 1 : 0.6 }}>
                      <option value="">Select barangay...</option>
                      {inqBarangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={lbl}>House No. &amp; Street *</label>
                  <input value={inquiryForm.house_street} onChange={e => setF('house_street', e.target.value)} placeholder="e.g. 123 Rizal Street" style={inp} />
                </div>

                <div>
                  <label style={lbl}>Reason for Inquiry *</label>
                  <select value={inquiryForm.reason} onChange={e => setF('reason', e.target.value)} style={inp}>
                    <option value="">Select a reason...</option>
                    <option value="New Construction">New Construction</option>
                    <option value="Renovation & Remodeling">Renovation &amp; Remodeling</option>
                    <option value="Repair & Maintenance">Repair &amp; Maintenance</option>
                    <option value="Electrical Installation">Electrical Installation</option>
                    <option value="Plumbing Services">Plumbing Services</option>
                    <option value="Painting & Finishing">Painting &amp; Finishing</option>
                    <option value="Carpentry">Carpentry</option>
                    <option value="Masonry">Masonry</option>
                    <option value="Roofing">Roofing</option>
                    <option value="Landscaping">Landscaping</option>
                    <option value="Interior Design">Interior Design</option>
                    <option value="Project Management">Project Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {inquiryForm.reason === 'Other' && (
                  <div>
                    <label style={lbl}>Please Specify *</label>
                    <textarea value={inquiryForm.description} onChange={e => setF('description', e.target.value)} rows={3}
                      placeholder="Tell us about your inquiry..." style={{ ...inp, resize: 'none' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: `1px solid ${C.border}`, background: '#fff' }}>
                <button onClick={closeInquiryForm}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, fontWeight: 600, color: C.textMid, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSubmitInquiry} disabled={inquiryLoading}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: C.green, fontSize: 13, fontWeight: 700, color: '#fff', cursor: inquiryLoading ? 'not-allowed' : 'pointer', opacity: inquiryLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {inquiryLoading ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...</> : 'Submit Inquiry'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: C.bg, overflowY: 'auto' }}>
          <div style={{ background: C.card, minHeight: '100vh', maxWidth: 900, margin: '0 auto', boxShadow: '0 0 40px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{selected.inquiry_code || `INQ-${selected.id}`}</span>
                  {(() => {
                    const s = INQUIRY_STATUS_COLORS[selected.status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' }
                    return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{selected.status || '—'}</span>
                  })()}
                </div>
                <p style={{ fontSize: 11, color: C.textSub, margin: 0 }}>Inquiry Details</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.textSub, padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '8px 0' }}>
              {[
                { label: 'Inquiry Code',  value: selected.inquiry_code },
                { label: 'Full Name',     value: `${selected.first_name || ''} ${selected.last_name || ''}`.trim() || '—' },
                { label: 'Email',         value: selected.email        },
                { label: 'Mobile',        value: selected.mobile       },
                { label: 'Address',       value: selected.address      },
                { label: 'Reason',        value: selected.reason       },
                { label: 'Description',   value: selected.description  },
                { label: 'Status',        value: selected.status       },
                { label: 'Submitted',     value: selected.created_at?.slice(0, 10) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 16, padding: '12px 24px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.textSub, width: 130, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{value || '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 24px' }}>
              <button onClick={() => setSelected(null)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 13, fontWeight: 600, color: C.textMid, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}