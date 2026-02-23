import { useState, useEffect, useRef } from 'react'
import {
  Plus, Search, Edit2, Trash2, RefreshCw, AlertCircle,
  CheckCircle, AlertTriangle, FileText, X, Upload, Calendar
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/api'
import api from '../../utils/api'

// ─── Helpers ───────────────────────────────────────────────────────────────────
const licenseStatusColor = (expiry) => {
  if (!expiry) return 'bg-slate-500/10 text-slate-400'
  const today = new Date()
  const exp   = new Date(expiry)
  if (exp <= today) return 'bg-red-500/10 text-red-400'
  const diff = (exp - today) / (1000 * 60 * 60 * 24)
  if (diff <= 30) return 'bg-amber-500/10 text-amber-400'
  return 'bg-emerald-500/10 text-emerald-400'
}

const licenseStatusLabel = (expiry) => {
  if (!expiry) return 'No Expiry'
  const today = new Date()
  const exp   = new Date(expiry)
  if (exp <= today) return 'Expired'
  const diff = Math.ceil((exp - today) / (1000 * 60 * 60 * 24))
  if (diff <= 30) return `Expires in ${diff}d`
  return 'Valid'
}

// ─── License Form Modal ────────────────────────────────────────────────────────
export function LicenseModal({ license, contactId, contactName, onClose, onSave }) {
  const isEdit  = !!license
  const fileRef = useRef()

  const [form, setForm] = useState({
    document_name: license?.document_name || '',
    expiry_date:   license?.expiry_date   || '',
  })
  const [file, setFile]       = useState(null)
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const validate = () => {
    const e = {}
    if (!form.document_name.trim()) e.document_name = 'Document name is required.'
    if (!form.expiry_date)          e.expiry_date   = 'Expiry date is required.'
    if (!isEdit && !file)           e.file          = 'Please select a file to upload.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      let saved
      if (isEdit) {
        // Edit: JSON update (no file re-upload for simplicity)
        const data = await apiPut('/api/licenses/update.php', {
          id:            license.id,
          document_name: form.document_name,
          expiry_date:   form.expiry_date,
        })
        saved = data.license
      } else {
        // Create: multipart with file upload
        const fd = new FormData()
        fd.append('contact_id',    contactId)
        fd.append('document_name', form.document_name)
        fd.append('expiry_date',   form.expiry_date)
        fd.append('document',      file)
        const res  = await api.post('/api/licenses/create.php', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        saved = res.data.license
      }
      onSave(saved)
      onClose()
    } catch (err) {
      setErrors({ api: err?.response?.data?.error || 'Failed to save license' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-steel-900 border border-steel-700 z-10">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
        <div className="p-6 border-b border-steel-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-amber-400" />
            <div>
              <h3 className="font-display font-bold text-lg text-slate-100 tracking-wide">
                {isEdit ? 'Edit License' : 'Add License'}
              </h3>
              {contactName && (
                <p className="font-body text-xs text-slate-500 mt-0.5">for {contactName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {errors.api && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle size={14} />{errors.api}
            </div>
          )}

          <div>
            <label className="label-field">Document Name *</label>
            <input className="input-field" value={form.document_name}
              onChange={e => f('document_name', e.target.value)}
              placeholder="e.g. Business Permit 2025" />
            {errors.document_name && <p className="text-red-400 text-xs mt-1">{errors.document_name}</p>}
          </div>

          <div>
            <label className="label-field">Expiry Date *</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="date" className="input-field pl-9" value={form.expiry_date}
                onChange={e => f('expiry_date', e.target.value)} />
            </div>
            {errors.expiry_date && <p className="text-red-400 text-xs mt-1">{errors.expiry_date}</p>}
          </div>

          {!isEdit && (
            <div>
              <label className="label-field">Document File * (PDF, JPG, PNG)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border border-dashed p-5 text-center cursor-pointer transition-colors
                  ${file ? 'border-amber-500/50 bg-amber-500/5' : 'border-steel-600 hover:border-steel-500'}`}>
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={16} className="text-amber-400" />
                    <span className="font-body text-sm text-amber-400">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload size={20} className="text-slate-600 mx-auto mb-2" />
                    <p className="font-body text-sm text-slate-500">Click to upload document</p>
                    <p className="font-body text-xs text-slate-600 mt-1">PDF, JPG or PNG</p>
                  </>
                )}
              </div>
              {errors.file && <p className="text-red-400 text-xs mt-1">{errors.file}</p>}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-steel-800 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Upload License'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Contact Licenses Panel (used inside Contact modal) ────────────────────────
export function ContactLicensesPanel({ contactId, contactName }) {
  const [licenses, setLicenses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editLicense, setEditLicense] = useState(null)
  const [deleteId, setDeleteId]     = useState(null)
  const [toast, setToast]           = useState(null)
  const [deleting, setDeleting]     = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadLicenses = async () => {
    setLoading(true)
    try {
      const data = await apiGet('/api/licenses/list.php', { contact_id: contactId })
      setLicenses(data.licenses || [])
    } catch {
      setLicenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (contactId) loadLicenses() }, [contactId])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiDelete(`/api/licenses/delete.php?id=${deleteId}`)
      setLicenses(p => p.filter(l => l.id !== deleteId))
      setDeleteId(null)
      showToast('License deleted')
    } catch {
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
          <CheckCircle size={12} />{toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="font-body text-xs text-slate-500">{licenses.length} license{licenses.length !== 1 ? 's' : ''}</span>
        <button onClick={() => { setEditLicense(null); setShowModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold tracking-wider uppercase text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors">
          <Plus size={12} />Add License
        </button>
      </div>

      {loading ? (
        <div className="py-4 text-center text-slate-500 text-sm">
          <RefreshCw size={14} className="animate-spin inline mr-1" />Loading...
        </div>
      ) : licenses.length === 0 ? (
        <div className="py-4 text-center text-slate-600 text-sm border border-dashed border-steel-700">
          No licenses attached
        </div>
      ) : (
        <div className="space-y-2">
          {licenses.map(l => (
            <div key={l.id} className="flex items-center justify-between p-3 bg-steel-800/40 border border-steel-700">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={14} className="text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-body text-sm text-slate-200 truncate">{l.document_name}</p>
                  <p className="font-body text-xs text-slate-500">Expires: {l.expiry_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span className={`status-badge text-xs ${licenseStatusColor(l.expiry_date)}`}>
                  {licenseStatusLabel(l.expiry_date)}
                </span>
                <button onClick={() => { setEditLicense(l); setShowModal(true) }}
                  className="p-1 text-slate-500 hover:text-amber-400 transition-colors">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => setDeleteId(l.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-xs bg-steel-900 border border-steel-700 p-6 z-10">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
            <div className="flex items-center gap-3 mb-3">
              <Trash2 size={16} className="text-red-400" />
              <h4 className="font-display font-bold text-slate-100">Delete License?</h4>
            </div>
            <p className="font-body text-sm text-slate-400 mb-5">This will permanently delete the license and its file.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 text-sm px-4 py-2 font-display font-bold tracking-wider uppercase bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                {deleting && <RefreshCw size={13} className="animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <LicenseModal
          license={editLicense}
          contactId={contactId}
          contactName={contactName}
          onClose={() => setShowModal(false)}
          onSave={(saved) => {
            if (editLicense) {
              setLicenses(p => p.map(l => l.id === saved.id ? saved : l))
              showToast('License updated')
            } else {
              setLicenses(p => [...p, saved])
              showToast('License added')
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Standalone Licenses Page ──────────────────────────────────────────────────
export default function LicensesPage() {
  const [licenses, setLicenses]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [expiredOnly, setExpiredOnly] = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const [editLicense, setEditLicense] = useState(null)
  const [deleteId, setDeleteId]       = useState(null)
  const [deleting, setDeleting]       = useState(false)
  const [toast, setToast]             = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadLicenses = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)      params.search       = search
      if (expiredOnly) params.expired_only = 1
      const data = await apiGet('/api/licenses/list.php', params)
      setLicenses(data.licenses || [])
    } catch {
      setLicenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLicenses() }, [search, expiredOnly])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await apiDelete(`/api/licenses/delete.php?id=${deleteId}`)
      setLicenses(p => p.filter(l => l.id !== deleteId))
      setDeleteId(null)
      showToast('License deleted successfully')
    } catch {
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const expiredCount = licenses.filter(l => new Date(l.expiry_date) <= new Date()).length

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-body text-sm">
          <CheckCircle size={14} />{toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Licenses</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">
            Documents & license tracking
            {expiredCount > 0 && !loading && (
              <span className="ml-2 text-red-400 font-semibold">{expiredCount} expired</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-9 text-sm" placeholder="Search by contact or document..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setExpiredOnly(p => !p)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-display font-semibold tracking-wider uppercase border transition-colors
            ${expiredOnly
              ? 'bg-red-500/10 border-red-500/40 text-red-400'
              : 'border-steel-600 text-slate-500 hover:text-slate-300'}`}>
          <AlertTriangle size={14} />
          {expiredOnly ? 'Showing Expired' : 'Show Expired Only'}
        </button>
      </div>

      {/* Table */}
      <div className="card-steel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-steel-700 bg-steel-900/60">
                {['Contact', 'Document', 'Expiry Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-500">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />Loading licenses...
                </td></tr>
              ) : licenses.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-600">No licenses found</td></tr>
              ) : licenses.map(l => (
                <tr key={l.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium">{l.contact_name}</p>
                    <p className="text-amber-400 font-mono text-xs">{l.contact_code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-slate-500 flex-shrink-0" />
                      <span className="text-slate-300">{l.document_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{l.expiry_date}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${licenseStatusColor(l.expiry_date)}`}>
                      {new Date(l.expiry_date) <= new Date() && <AlertTriangle size={10} />}
                      {licenseStatusLabel(l.expiry_date)}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <button onClick={() => { setEditLicense(l); setShowModal(true) }}
                      className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteId(l.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-steel-800">
            <span className="font-body text-xs text-slate-500">{licenses.length} license{licenses.length !== 1 ? 's' : ''} found</span>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-xs bg-steel-900 border border-steel-700 p-6 z-10">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
            <div className="flex items-center gap-3 mb-3">
              <Trash2 size={16} className="text-red-400" />
              <h4 className="font-display font-bold text-slate-100">Delete License?</h4>
            </div>
            <p className="font-body text-sm text-slate-400 mb-5">
              This will permanently delete the license and its uploaded file.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 text-sm px-4 py-2 font-display font-bold tracking-wider uppercase bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                {deleting && <RefreshCw size={13} className="animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <LicenseModal
          license={editLicense}
          contactId={editLicense?.contact_id}
          contactName={editLicense?.contact_name}
          onClose={() => setShowModal(false)}
          onSave={(saved) => {
            if (editLicense) {
              setLicenses(p => p.map(l => l.id === saved.id ? saved : l))
              showToast('License updated successfully')
            } else {
              loadLicenses()
              showToast('License added successfully')
            }
          }}
        />
      )}
    </div>
  )
}