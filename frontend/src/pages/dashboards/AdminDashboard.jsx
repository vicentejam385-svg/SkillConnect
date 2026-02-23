import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatsCard from '../../components/StatsCard'
import WorkersPage from './WorkersPage'
import LicensesPage, { ContactLicensesPanel } from './LicensesPage'
import {
  Users, ClipboardList, Calendar, Settings, FileText,
  Plus, Search, Edit2, AlertTriangle, RefreshCw,
  AlertCircle, X, CheckCircle, Building2, HardHat, UserCheck
} from 'lucide-react'
import { validate } from '../../utils/validators'
import { apiGet, apiPost, apiPut } from '../../utils/api'

const NAV_ITEMS = [
  { type: 'section', label: 'Operations' },
  { path: '/admin/dashboard',  label: 'Dashboard',     icon: Users         },
  { path: '/admin/contacts',   label: 'Contacts',      icon: Users         },
  { path: '/admin/workers',    label: 'Workers',        icon: HardHat       },
  { path: '/admin/licenses',   label: 'Licenses',      icon: FileText      },
  { path: '/admin/job-orders', label: 'Job Orders',    icon: ClipboardList },
  { path: '/admin/scheduling', label: 'Scheduling',    icon: Calendar      },
  { type: 'section', label: 'System' },
  { path: '/admin/config',     label: 'Configuration', icon: Settings      },
]

// ─── ORG TYPES & SPECIALIZATIONS (from DB seed) ───────────────────────────────
const ORG_TYPES = [
  { id: 1, name: 'ManPower' }, { id: 2, name: 'Heavy Equipments' },
  { id: 3, name: 'Materials Supplier' }, { id: 4, name: 'Subcontractor - General' },
  { id: 5, name: 'Logistics' },
]
const SPECIALIZATIONS = [
  { id: 1, name: 'Architect' }, { id: 2, name: 'Civil Engineer' },
  { id: 3, name: 'Structural Engineer' }, { id: 4, name: 'Electrical Engineer' },
  { id: 5, name: 'Mechanical Engineer' }, { id: 6, name: 'Plumbing' },
  { id: 7, name: 'Foreman' }, { id: 8, name: 'Carpenter' },
  { id: 9, name: 'Mason' }, { id: 10, name: 'Welder' },
]

// ─── Admin Home ────────────────────────────────────────────────────────────────
function AdminHome() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    contacts: '—', expired_licenses: '—'
  })

  useEffect(() => {
    // Reuse the superadmin stats endpoint — admin can also read it
    apiGet('/api/users/stats.php')
      .then(data => {
        if (data.success) setStats({
          contacts:         data.contacts,
          expired_licenses: data.expired_licenses,
        })
      })
      .catch(() => {})
  }, [])

  const cards = [
    { icon: Users,         label: 'Total Contacts',  value: String(stats.contacts),         sub: 'Clients, Orgs & Workers', accent: 'blue'    },
    { icon: ClipboardList, label: 'Active Jobs',      value: '—',                            sub: 'Coming soon',             accent: 'amber'   },
    { icon: Calendar,      label: 'Scheduled Today',  value: '—',                            sub: 'Coming soon',             accent: 'emerald' },
    { icon: AlertTriangle, label: 'Expired Licenses', value: String(stats.expired_licenses), sub: 'Needs attention',         accent: 'red'     },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display font-bold text-3xl text-slate-100 tracking-wide">Admin Panel</h2>
        <p className="font-body text-slate-400 text-sm mt-1">Manage contacts, job orders, scheduling & configurations</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(s => <StatsCard key={s.label} {...s} />)}
      </div>
      {stats.expired_licenses > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30">
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-display font-bold text-sm text-red-400 tracking-wide">
              {stats.expired_licenses} Expired License{stats.expired_licenses !== 1 ? 's' : ''} Detected
            </div>
            <p className="font-body text-xs text-slate-400 mt-0.5">Review contacts with expired licenses.</p>
            <button onClick={() => navigate('/admin/contacts')}
              className="mt-2 text-xs font-display font-semibold tracking-wider uppercase text-amber-400 hover:text-amber-300 transition-colors">
              View Contacts →
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,         label: 'Contacts',      path: '/admin/contacts',   border: 'hover:border-blue-400/60',    icolor: 'text-blue-400'    },
          { icon: ClipboardList, label: 'Job Orders',    path: '/admin/job-orders', border: 'hover:border-amber-500/60',   icolor: 'text-amber-400'   },
          { icon: Calendar,      label: 'Scheduling',    path: '/admin/scheduling', border: 'hover:border-emerald-400/60', icolor: 'text-emerald-400' },
          { icon: Settings,      label: 'Configuration', path: '/admin/config',     border: 'hover:border-slate-400/60',   icolor: 'text-slate-400'   },
        ].map(({ icon: Icon, label, path, border, icolor }) => (
          <button key={path} onClick={() => navigate(path)}
            className={`card-steel border p-5 text-left transition-all duration-200 ${border}`}>
            <Icon size={20} className={`${icolor} mb-3`} />
            <div className="font-display font-bold text-slate-100 tracking-wide">{label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Contact Modal ─────────────────────────────────────────────────────────────
function ContactModal({ contact, onClose, onSave }) {
  const isEdit = !!contact

  // Resolve org type id and spec id from current contact data
  const resolveOrgTypeId = () => {
    if (!contact?.organisation_type) return ''
    const found = ORG_TYPES.find(o => o.name === contact.organisation_type)
    return found ? String(found.id) : ''
  }
  const resolveSpecId = () => {
    if (!contact?.specialization) return ''
    const found = SPECIALIZATIONS.find(s => s.name === contact.specialization)
    return found ? String(found.id) : ''
  }

  const [form, setForm] = useState({
    first_name:           contact?.first_name || '',
    last_name:            contact?.last_name  || '',
    address:              contact?.address    || '',
    phone:                contact?.phone      || '',
    mobile:               contact?.mobile     || '+63',
    email:                contact?.email      || '',
    type:                 contact?.type       || 'client',
    is_admin:             contact?.is_admin   ?? 0,
    organisation_type_id: resolveOrgTypeId(),
    specialization_id:    resolveSpecId(),
    status_id:            contact?.status === 'Inactive' ? 2 : contact?.status === 'Blacklisted' ? 3 : 1,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const validateForm = () => {
    const e = {}
    const fn = validate.name(form.first_name); if (fn !== true) e.first_name = fn
    const ln = validate.name(form.last_name);  if (ln !== true) e.last_name  = ln
    if (form.phone)                          { const pv = validate.phone(form.phone);   if (pv !== true) e.phone  = pv }
    if (form.mobile && form.mobile !== '+63'){ const mv = validate.mobile(form.mobile); if (mv !== true) e.mobile = mv }
    if (form.email)                          { const ev = validate.email(form.email);   if (ev !== true) e.email  = ev }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      if (isEdit) {
        const data = await apiPut('/api/contacts/update.php', { id: contact.id, ...form })
        onSave(data.contact)
      } else {
        const data = await apiPost('/api/contacts/create.php', form)
        onSave(data.contact)
      }
      onClose()
    } catch (err) {
      setErrors({ api: err?.response?.data?.error || 'Failed to save contact' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-steel-900 border border-steel-700 my-8 z-10">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400" />
        <div className="p-6 border-b border-steel-800 flex items-center justify-between">
          <h3 className="font-display font-bold text-xl text-slate-100 tracking-wide">
            {isEdit ? 'Edit Contact' : 'New Contact'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {errors.api && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle size={14} />{errors.api}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">First Name *</label>
              <input className="input-field" value={form.first_name}
                onChange={e => f('first_name', e.target.value)} placeholder="Juan" />
              {errors.first_name && <p className="text-red-400 text-xs mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="label-field">Last Name *</label>
              <input className="input-field" value={form.last_name}
                onChange={e => f('last_name', e.target.value)} placeholder="dela Cruz" />
              {errors.last_name && <p className="text-red-400 text-xs mt-1">{errors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="label-field">Address</label>
            <textarea className="input-field resize-none" rows={2} value={form.address}
              onChange={e => f('address', e.target.value)} placeholder="Street, City, Province" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Phone (Landline)</label>
              <input className="input-field" value={form.phone}
                onChange={e => f('phone', e.target.value)} placeholder="(02) 8123 4567" />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="label-field">Mobile</label>
              <input className="input-field" value={form.mobile}
                onChange={e => f('mobile', e.target.value)} placeholder="+639171234567" />
              {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile}</p>}
            </div>
          </div>
          <div>
            <label className="label-field">Email</label>
            <input type="email" className="input-field" value={form.email}
              onChange={e => f('email', e.target.value)} placeholder="email@example.com" />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="label-field">Type *</label>
            <select className="input-field" value={form.type} onChange={e => f('type', e.target.value)}>
              <option value="client">Client (Customer)</option>
              <option value="organisation">Organisation (Subcon)</option>
              <option value="worker">Worker</option>
            </select>
          </div>
          {form.type === 'organisation' && (
            <div>
              <label className="label-field">Organisation Type</label>
              <select className="input-field" value={form.organisation_type_id}
                onChange={e => f('organisation_type_id', e.target.value)}>
                <option value="">Select type...</option>
                {ORG_TYPES.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          {form.type === 'worker' && (
            <div>
              <label className="label-field">Specialization</label>
              <select className="input-field" value={form.specialization_id}
                onChange={e => f('specialization_id', e.target.value)}>
                <option value="">Select specialization...</option>
                {SPECIALIZATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label-field">Admin Access</label>
            <select className="input-field" value={form.is_admin}
              onChange={e => f('is_admin', parseInt(e.target.value))}>
              <option value={0}>No</option>
              <option value={1}>Yes</option>
            </select>
          </div>
          <div>
            <label className="label-field">Status</label>
            <select className="input-field" value={form.status_id}
              onChange={e => f('status_id', e.target.value)}>
              <option value="1">Active</option>
              <option value="2">Inactive</option>
              <option value="3">Blacklisted</option>
            </select>
          </div>

          {/* Licenses panel — only shown when editing an existing contact */}
          {isEdit && contact?.id && (
            <div>
              <label className="label-field">Licenses / Documents</label>
              <ContactLicensesPanel
                contactId={contact.id}
                contactName={`${form.first_name} ${form.last_name}`}
              />
            </div>
          )}
          {!isEdit && (
            <div className="border border-dashed border-steel-600 p-4 text-center">
              <p className="font-body text-xs text-slate-500">Save the contact first, then attach licenses via Edit.</p>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-steel-800 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contacts Page ─────────────────────────────────────────────────────────────
function ContactsPage() {
  const [contacts, setContacts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('all')
  const [showModal, setShowModal]     = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [toast, setToast]             = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadContacts = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/contacts/list.php')
      setContacts(data.contacts || [])
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, [])

  const filtered = contacts.filter(c => {
    const matchSearch =
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_code?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || c.type === filterType
    return matchSearch && matchType
  })

  const licenseColor = (ls) => {
    if (ls === 'License Expired') return 'bg-red-500/10 text-red-400'
    if (ls === 'License Valid')   return 'bg-emerald-500/10 text-emerald-400'
    return 'bg-slate-500/10 text-slate-400'
  }

  const typeIcon = (type) => {
    if (type === 'organisation') return <Building2 size={14} className="text-blue-400" />
    if (type === 'worker')       return <HardHat   size={14} className="text-emerald-400" />
    return <UserCheck size={14} className="text-amber-400" />
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-body text-sm">
          <CheckCircle size={14} />{toast}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Contacts</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Clients, organisations & workers directory</p>
        </div>
        <button onClick={() => { setEditContact(null); setShowModal(true) }}
          className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />New Contact
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-9 text-sm" placeholder="Search by name, code or email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto text-sm" value={filterType}
          onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="client">Client</option>
          <option value="organisation">Organisation</option>
          <option value="worker">Worker</option>
        </select>
      </div>

      <div className="card-steel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-steel-700 bg-steel-900/60">
                {['Contact ID', 'Name', 'Type', 'Mobile', 'License', 'Admin', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />Loading contacts...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-slate-600">No contacts found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{c.contact_code}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{c.full_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {typeIcon(c.type)}
                      <span className="text-slate-400 capitalize">{c.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{c.mobile || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${licenseColor(c.license_status)}`}>
                      {c.license_status === 'License Expired' && <AlertTriangle size={10} />}
                      {c.license_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${c.is_admin ? 'bg-amber-500/10 text-amber-400' : 'bg-steel-700 text-slate-500'}`}>
                      {c.is_admin ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : c.status === 'Blacklisted' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditContact(c); setShowModal(true) }}
                      className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-steel-800">
            <span className="font-body text-xs text-slate-500">
              Showing {filtered.length} of {contacts.length} contacts
            </span>
          </div>
        )}
      </div>

      {showModal && (
        <ContactModal contact={editContact} onClose={() => setShowModal(false)}
          onSave={(saved) => {
            if (editContact) {
              setContacts(p => p.map(c => c.id === saved.id ? saved : c))
              showToast('Contact updated successfully')
            } else {
              setContacts(p => [...p, saved])
              showToast('Contact created successfully')
            }
          }} />
      )}
    </div>
  )
}

// ─── Job Orders Page ───────────────────────────────────────────────────────────
function JobOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Job Orders</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Create and manage construction job orders</p>
        </div>
        <button className="btn-primary text-sm flex items-center gap-2"><Plus size={16} />New Job Order</button>
      </div>
      <div className="card-steel p-12 flex flex-col items-center gap-4 text-center">
        <ClipboardList size={40} className="text-steel-600" />
        <div className="font-display font-bold text-xl text-slate-400 tracking-wide">Job Orders Module</div>
        <p className="font-body text-sm text-slate-500 max-w-sm">Coming in the next sprint.</p>
        <div className="flex items-center gap-2 text-xs font-display font-semibold tracking-widest uppercase text-amber-400 border border-amber-500/30 px-4 py-2">
          <RefreshCw size={12} />Coming Soon
        </div>
      </div>
    </div>
  )
}

// ─── Scheduling Page ───────────────────────────────────────────────────────────
function SchedulingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Scheduling</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Workforce and job order scheduling calendar</p>
      </div>
      <div className="card-steel p-12 flex flex-col items-center gap-4 text-center">
        <Calendar size={40} className="text-steel-600" />
        <div className="font-display font-bold text-xl text-slate-400 tracking-wide">Scheduling Module</div>
        <p className="font-body text-sm text-slate-500 max-w-sm">Coming in the next sprint.</p>
        <div className="flex items-center gap-2 text-xs font-display font-semibold tracking-widest uppercase text-emerald-400 border border-emerald-400/30 px-4 py-2">
          <RefreshCw size={12} />Coming Soon
        </div>
      </div>
    </div>
  )
}

// ─── Config Page ───────────────────────────────────────────────────────────────
function ConfigPage() {
  const [activeTab, setActiveTab] = useState('org_types')
  const [orgTypes, setOrgTypes]           = useState(ORG_TYPES)
  const [specializations, setSpecializations] = useState(SPECIALIZATIONS)
  const [statuses] = useState([
    { id: 1, entity: 'contact', label: 'Active' }, { id: 2, entity: 'contact', label: 'Inactive' }, { id: 3, entity: 'contact', label: 'Blacklisted' },
    { id: 4, entity: 'worker',  label: 'Active' }, { id: 5, entity: 'worker',  label: 'Inactive' }, { id: 6, entity: 'worker',  label: 'On Leave'    },
    { id: 7, entity: 'user',    label: 'Active' }, { id: 8, entity: 'user',    label: 'Inactive' }, { id: 9, entity: 'user',    label: 'Suspended'   },
  ])
  const [newName, setNewName] = useState('')

  const tabs = [
    { key: 'org_types',       label: 'Organisation Types' },
    { key: 'specializations', label: 'Specializations'    },
    { key: 'statuses',        label: 'Statuses'           },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Configuration</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Manage lookup tables and system settings</p>
      </div>
      <div className="flex border-b border-steel-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setNewName('') }}
            className={`px-5 py-3 font-display font-semibold text-sm tracking-wider uppercase transition-colors border-b-2 -mb-px
              ${activeTab === t.key ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'org_types' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input className="input-field flex-1 text-sm" placeholder="New organisation type..."
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { setOrgTypes(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName('') }}} />
            <button onClick={() => { if (newName.trim()) { setOrgTypes(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName('') }}}
              className="btn-primary text-sm flex items-center gap-2"><Plus size={15} />Add</button>
          </div>
          <div className="card-steel overflow-hidden">
            {orgTypes.map((ot, i) => (
              <div key={ot.id} className={`flex items-center justify-between px-5 py-3.5 ${i < orgTypes.length - 1 ? 'border-b border-steel-800' : ''} hover:bg-steel-800/40`}>
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="font-body text-slate-200">{ot.name}</span></div>
                <button className="p-1.5 text-slate-600 hover:text-amber-400 transition-colors"><Edit2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'specializations' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input className="input-field flex-1 text-sm" placeholder="New specialization..."
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { setSpecializations(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName('') }}} />
            <button onClick={() => { if (newName.trim()) { setSpecializations(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName('') }}}
              className="btn-primary text-sm flex items-center gap-2"><Plus size={15} />Add</button>
          </div>
          <div className="card-steel overflow-hidden">
            {specializations.map((s, i) => (
              <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 ${i < specializations.length - 1 ? 'border-b border-steel-800' : ''} hover:bg-steel-800/40`}>
                <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span className="font-body text-slate-200">{s.name}</span></div>
                <button className="p-1.5 text-slate-600 hover:text-amber-400 transition-colors"><Edit2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'statuses' && (
        <div className="space-y-6">
          {['contact', 'worker', 'user'].map(entity => (
            <div key={entity}>
              <h4 className="font-display font-bold text-sm tracking-widest uppercase text-slate-500 mb-3">{entity} Statuses</h4>
              <div className="card-steel overflow-hidden">
                {statuses.filter(s => s.entity === entity).map((s, i, arr) => (
                  <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 ${i < arr.length - 1 ? 'border-b border-steel-800' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.label === 'Active' ? 'bg-emerald-400' : s.label === 'Blacklisted' || s.label === 'Suspended' ? 'bg-red-400' : 'bg-slate-500'}`} />
                      <span className="font-body text-slate-200">{s.label}</span>
                    </div>
                    <span className="font-body text-xs text-slate-600 capitalize">{s.entity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Admin Panel">
      <Routes>
        <Route path="dashboard"  element={<AdminHome />}     />
        <Route path="contacts"   element={<ContactsPage />}  />
        <Route path="workers"    element={<WorkersPage />}   />
        <Route path="licenses"   element={<LicensesPage />}  />
        <Route path="job-orders" element={<JobOrdersPage />} />
        <Route path="scheduling" element={<SchedulingPage />}/>
        <Route path="config"     element={<ConfigPage />}    />
        <Route path="*"          element={<AdminHome />}     />
      </Routes>
    </DashboardLayout>
  )
}