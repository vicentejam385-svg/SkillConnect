import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  MessageSquare, MapPin, Calendar, Phone, Mail, FileText, Plus, Search, Eye, User, Wrench, ClipboardList, Hash, RefreshCw, AlertCircle, ChevronDown,
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'
import { getAllProvinces, getMunicipalitiesByProvince, getBarangaysByMunicipality } from '@aivangogh/ph-address'
import {
  ICON, MIN_SKELETON_MS, Skel, Toast, useToast, Modal, ModalHeader, PageHeader, EmptyState, Pill,
  inputCls, labelCls, btnPrimary, btnSecondary, btnSmSecondary, fmtDate, getCustomerInfo,
} from './CustomerUI'

// Customer-friendly names and colors for the inquiry statuses
const STATUS = {
  New:       ['Under review', 'bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  Pending:   ['Under review', 'bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  Reviewed:  ['Under review', 'bg-violet-50 text-violet-700 ring-violet-200',    'bg-violet-500'],
  Won:       ['Accepted',     'bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  Converted: ['Accepted',     'bg-emerald-50 text-emerald-700 ring-emerald-200', 'bg-emerald-500'],
  Lost:      ['Closed',       'bg-slate-50 text-slate-600 ring-slate-200',       'bg-slate-400'],
  Closed:    ['Closed',       'bg-slate-50 text-slate-600 ring-slate-200',       'bg-slate-400'],
  Cancelled: ['Cancelled',    'bg-red-50 text-red-700 ring-red-200',             'bg-red-500'],
}
const statusLabel = s => STATUS[s]?.[0] || s || '—'
function InquiryBadge({ status }) {
  const [label, cls, dot] = STATUS[status] || [status || '—', 'bg-slate-50 text-slate-600 ring-slate-200', 'bg-slate-400']
  return <Pill label={label} cls={cls} dot={dot} />
}

const NCR_CODE = '1300000000'
const EMPTY_INQUIRY = { first_name: '', last_name: '', email: '', mobile: '', province: '', city: '', barangay: '', house_street: '', reason: '', description: '' }

export default function CustomerInquiriesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const customer = getCustomerInfo()
  const [inquiries,    setInquiries]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selected,     setSelected]     = useState(null)
  const [services,     setServices]     = useState([])
  const [toast, showToast] = useToast()

  // Services = the company's specializations
  useEffect(() => {
    apiGet('/api/config/specializations.php')
      .then(d => setServices((d.data || d.specializations || []).map(s => s.name).filter(Boolean)))
      .catch(() => {})
  }, [])

  // ── New inquiry form ──
  const [showForm,    setShowForm]    = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form,        setForm]        = useState(EMPTY_INQUIRY)
  const [tried,       setTried]       = useState(false)

  const cities       = form.province ? getMunicipalitiesByProvince(form.province) : []
  const barangays    = form.city     ? getBarangaysByMunicipality(form.city)      : []
  const provinceName = form.province === NCR_CODE ? 'Metro Manila' : getAllProvinces().find(p => p.psgcCode === form.province)?.name ?? ''
  const cityName     = cities.find(c => c.psgcCode === form.city)?.name ?? ''
  const buildAddress = () => [form.house_street, form.barangay, cityName, provinceName].filter(Boolean).join(', ')
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openForm = async () => {
    // Use the latest saved address; fall back to the login info
    let savedAddress = customer?.address || ''
    try {
      const cData = await apiGet('/api/contacts/list.php', { per_page: 1 })
      savedAddress = cData.contacts?.[0]?.address || savedAddress
    } catch { /* keep the login info */ }

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

    setForm({
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
    setTried(false)
    setShowForm(true)
  }

  const closeForm = () => { if (formLoading) return; setShowForm(false); setForm(EMPTY_INQUIRY); setTried(false) }

  const missing = {
    first_name:   !form.first_name.trim(),
    last_name:    !form.last_name.trim(),
    province:     !form.province,
    city:         !form.city,
    barangay:     !form.barangay,
    house_street: !form.house_street.trim(),
    reason:       !form.reason,
  }
  const hasMissing = Object.values(missing).some(Boolean)
  const bad = k => tried && missing[k] ? '!border-red-300 focus:!ring-red-500/10' : ''

  const submit = async () => {
    setTried(true)
    if (hasMissing || formLoading) return
    setFormLoading(true)
    try {
      const res = await apiPost('/api/inquiries/create.php', { ...form, address: buildAddress() })
      if (!res.success) throw new Error(res.error)
      showToast('Inquiry sent. We will get back to you soon.')
      setShowForm(false); setForm(EMPTY_INQUIRY); setTried(false)
      loadInquiries(true)
    } catch (err) { showToast(err.message || 'Could not send your inquiry.', 'error') }
    setFormLoading(false)
  }

  const loadInquiries = async (quiet = false) => {
    if (!quiet) setLoading(true)
    const started = Date.now()
    try {
      const data = await apiGet('/api/inquiries/list.php', { per_page: 100 })
      setInquiries(data.inquiries || [])
    } catch {
      showToast('Could not load your inquiries.', 'error')
    }
    if (!quiet) {
      const wait = MIN_SKELETON_MS - (Date.now() - started)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      setLoading(false)
    }
  }

  useEffect(() => { loadInquiries() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Opened from the dashboard's "New inquiry" button
  useEffect(() => {
    if (location.state?.newInquiry) {
      openForm()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  const labels = [...new Set(inquiries.map(i => statusLabel(i.status)))]

  const filtered = inquiries.filter(inq => {
    const q = search.trim().toLowerCase()
    const matchSearch = !q || [inq.inquiry_code, inq.reason, inq.description, inq.address].some(v => v?.toLowerCase().includes(q))
    const matchStatus = !filterStatus || statusLabel(inq.status) === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <PageHeader title="My inquiries" sub="Everything you asked us about, and where it stands."
        action={<button onClick={openForm} className={btnPrimary}><Plus size={16} {...ICON} />New inquiry</button>} />

      {/* Search + filter */}
      <div className="cx-rise flex flex-col sm:flex-row gap-3" style={{ animationDelay: '60ms' }}>
        <div className="relative flex-1">
          <Search size={16} {...ICON} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code, service or address"
            aria-label="Search inquiries" className={`${inputCls} pl-9 bg-white`} />
        </div>
        <div className="relative sm:w-48">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filter by status"
            className={`${inputCls} bg-white appearance-none pr-9 cursor-pointer`}>
            <option value="">All statuses</option>
            {labels.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={16} {...ICON} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-3.5">
              <Skel className="w-11 h-11 rounded-xl" />
              <div className="flex-1 space-y-2.5"><Skel className="h-4 w-1/3" /><Skel className="h-3 w-1/4" /><Skel className="h-3 w-2/3" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState icon={MessageSquare}
            title={inquiries.length ? 'No inquiries match' : 'No inquiries yet'}
            text={inquiries.length ? 'Try another search or filter.' : 'Tell us what you need and our team will get back to you.'}
            action={inquiries.length
              ? <button onClick={() => { setSearch(''); setFilterStatus('') }} className={btnSecondary}>Clear filters</button>
              : <button onClick={openForm} className={btnPrimary}><Plus size={16} {...ICON} />New inquiry</button>} />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inq, i) => (
            <article key={inq.id} className="cx-rise bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}>
              <div className="flex items-start gap-3.5">
                <span className="hidden sm:flex w-11 h-11 rounded-xl bg-slate-50 ring-1 ring-slate-200 text-slate-500 items-center justify-center flex-shrink-0"><MessageSquare size={18} {...ICON} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-[15px] font-semibold text-slate-900">{inq.inquiry_code || `INQ-${inq.id}`}</h2>
                        <InquiryBadge status={inq.status} />
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {inq.reason || 'General inquiry'}
                        {inq.status === 'Won' && inq.job_order_code && (
                          <button onClick={() => navigate('/customer/job-orders')}
                            className="ml-2 inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:underline underline-offset-2">
                            <ClipboardList size={13} {...ICON} />Job order {inq.job_order_code}
                          </button>
                        )}
                      </p>
                    </div>
                    <button onClick={() => setSelected(inq)} className={`${btnSmSecondary} flex-shrink-0`}>
                      <Eye size={15} {...ICON} /><span className="hidden sm:inline">Details</span>
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-600">
                    {inq.address && <span className="flex items-center gap-1.5 min-w-0"><MapPin size={13} {...ICON} className="text-slate-400 flex-shrink-0" /><span className="truncate">{inq.address}</span></span>}
                    {inq.created_at && <span className="flex items-center gap-1.5"><Calendar size={13} {...ICON} className="text-slate-400" />Sent {fmtDate(inq.created_at)}</span>}
                    {inq.mobile && <span className="flex items-center gap-1.5"><Phone size={13} {...ICON} className="text-slate-400" />{inq.mobile}</span>}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* New inquiry */}
      {showForm && (
        <Modal onClose={closeForm} maxW="max-w-xl">
          <ModalHeader icon={FileText} title="New inquiry" sub="Tell us what you need and our team will get back to you." onClose={closeForm} />
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">Your details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="iq-first" className={labelCls}>First name <span className="text-red-500">*</span></label>
                  <input id="iq-first" value={form.first_name} onChange={e => setF('first_name', e.target.value)} placeholder="Juan" className={`${inputCls} ${bad('first_name')}`} />
                </div>
                <div>
                  <label htmlFor="iq-last" className={labelCls}>Last name <span className="text-red-500">*</span></label>
                  <input id="iq-last" value={form.last_name} onChange={e => setF('last_name', e.target.value)} placeholder="Dela Cruz" className={`${inputCls} ${bad('last_name')}`} />
                </div>
                <div>
                  <label htmlFor="iq-email" className={labelCls}>Email</label>
                  <input id="iq-email" type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="juan@email.com" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="iq-mobile" className={labelCls}>Mobile</label>
                  <input id="iq-mobile" value={form.mobile} onChange={e => setF('mobile', e.target.value)} placeholder="+639XXXXXXXXX" className={inputCls} />
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-5 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">Where is the work?</h3>
              <div>
                <label htmlFor="iq-prov" className={labelCls}>Province <span className="text-red-500">*</span></label>
                <select id="iq-prov" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value, city: '', barangay: '' }))} className={`${inputCls} ${bad('province')}`}>
                  <option value="">Select province…</option>
                  <option value={NCR_CODE}>Metro Manila</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="iq-city" className={labelCls}>City / municipality <span className="text-red-500">*</span></label>
                  <select id="iq-city" value={form.city} disabled={!form.province} onChange={e => setForm(f => ({ ...f, city: e.target.value, barangay: '' }))} className={`${inputCls} ${bad('city')}`}>
                    <option value="">Select city…</option>
                    {cities.map(c => <option key={c.psgcCode} value={c.psgcCode}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="iq-brgy" className={labelCls}>Barangay <span className="text-red-500">*</span></label>
                  <select id="iq-brgy" value={form.barangay} disabled={!form.city} onChange={e => setF('barangay', e.target.value)} className={`${inputCls} ${bad('barangay')}`}>
                    <option value="">Select barangay…</option>
                    {barangays.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="iq-street" className={labelCls}>House no. &amp; street <span className="text-red-500">*</span></label>
                <input id="iq-street" value={form.house_street} onChange={e => setF('house_street', e.target.value)} placeholder="e.g. 123 Rizal Street" className={`${inputCls} ${bad('house_street')}`} />
              </div>
            </section>

            <section className="space-y-4 pt-5 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">What do you need?</h3>
              <div>
                <label htmlFor="iq-svc" className={labelCls}>Service <span className="text-red-500">*</span></label>
                <select id="iq-svc" value={form.reason} onChange={e => setF('reason', e.target.value)} className={`${inputCls} ${bad('reason')}`}>
                  <option value="">{services.length ? 'Select a service…' : 'Loading services…'}</option>
                  {services.map(sv => <option key={sv} value={sv}>{sv}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="iq-desc" className={labelCls}>Details <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea id="iq-desc" value={form.description} onChange={e => setF('description', e.target.value)} rows={3} maxLength={1000}
                  placeholder="Tell us a little about the work you need…" className={`${inputCls} h-auto py-2.5 resize-none`} />
                <p className="text-[11px] text-slate-400 mt-1 text-right tabular-nums">{form.description.length}/1000</p>
              </div>
            </section>
          </div>
          <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col-reverse sm:flex-row sm:items-center gap-3 flex-shrink-0">
            {tried && hasMissing
              ? <p className="cx-shake flex items-center gap-1.5 text-xs text-red-600 sm:mr-auto"><AlertCircle size={14} {...ICON} />Please fill in the fields marked in red.</p>
              : <p className="text-xs text-slate-400 sm:mr-auto"><span className="text-red-500">*</span> Required</p>}
            <div className="flex gap-3">
              <button onClick={closeForm} disabled={formLoading} className={`${btnSecondary} flex-1 sm:flex-none`}>Cancel</button>
              <button onClick={submit} disabled={formLoading} className={`${btnPrimary} flex-1 sm:flex-none`}>
                {formLoading && <RefreshCw size={15} {...ICON} className="animate-spin" />}{formLoading ? 'Sending…' : 'Send inquiry'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Details */}
      {selected && (
        <Modal onClose={() => setSelected(null)} maxW="max-w-xl">
          <ModalHeader icon={MessageSquare} title={selected.inquiry_code || `INQ-${selected.id}`} sub="Inquiry details"
            badge={<InquiryBadge status={selected.status} />} onClose={() => setSelected(null)} />
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
            <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {[
                { icon: User,          label: 'Name',      value: `${selected.first_name || ''} ${selected.last_name || ''}`.trim() },
                { icon: Mail,          label: 'Email',     value: selected.email },
                { icon: Phone,         label: 'Mobile',    value: selected.mobile },
                { icon: MapPin,        label: 'Address',   value: selected.address },
                { icon: Wrench,        label: 'Service',   value: selected.reason },
                { icon: FileText,      label: 'Details',   value: selected.description },
                { icon: ClipboardList, label: 'Job order', value: selected.job_order_code },
                { icon: Hash,          label: 'Code',      value: selected.inquiry_code },
                { icon: Calendar,      label: 'Sent',      value: selected.created_at ? fmtDate(selected.created_at, { month: 'long', day: 'numeric', year: 'numeric' }) : null },
              ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 px-4 py-3">
                  <Icon size={16} {...ICON} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <dt className="text-xs text-slate-500 w-20 flex-shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-sm text-slate-900 min-w-0 break-words whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end gap-3 flex-shrink-0">
            {selected.status === 'Won' && selected.job_order_code && (
              <button onClick={() => navigate('/customer/job-orders')} className={btnSecondary}><ClipboardList size={16} {...ICON} />Open job order</button>
            )}
            <button onClick={() => setSelected(null)} className={btnSecondary}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}