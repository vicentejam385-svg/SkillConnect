import { useState, useEffect } from 'react'
import {
  Plus, Search, Edit2, RefreshCw, AlertCircle,
  CheckCircle, Eye, EyeOff, HardHat, X
} from 'lucide-react'
import { validate } from '../../utils/validators'
import { apiGet, apiPost, apiPut } from '../../utils/api'

const SPECIALIZATIONS = [
  { id: 1, name: 'Architect' }, { id: 2, name: 'Civil Engineer' },
  { id: 3, name: 'Structural Engineer' }, { id: 4, name: 'Electrical Engineer' },
  { id: 5, name: 'Mechanical Engineer' }, { id: 6, name: 'Plumbing' },
  { id: 7, name: 'Foreman' }, { id: 8, name: 'Carpenter' },
  { id: 9, name: 'Mason' }, { id: 10, name: 'Welder' },
]

// ─── Create Worker Modal ───────────────────────────────────────────────────────
function WorkerModal({ worker, onClose, onSave }) {
  const isEdit = !!worker

  const resolveSpecId = () => {
    if (!worker?.specialization) return ''
    const found = SPECIALIZATIONS.find(s => s.name === worker.specialization)
    return found ? String(found.id) : ''
  }

  const [form, setForm] = useState({
    first_name:        worker?.full_name?.split(' ')[0] || '',
    last_name:         worker?.full_name?.split(' ').slice(1).join(' ') || '',
    email:             worker?.email    || '',
    mobile:            worker?.mobile   || '+63',
    username:          worker?.username || '',
    password:          '',
    specialization_id: resolveSpecId(),
    status_id:         worker?.status === 'Inactive' ? 5 : worker?.status === 'On Leave' ? 6 : 4,
  })
  const [errors, setErrors]     = useState({})
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving]     = useState(false)

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const validateForm = () => {
    const e = {}
    const fn = validate.name(form.first_name); if (fn !== true) e.first_name = fn
    const ln = validate.name(form.last_name);  if (ln !== true) e.last_name  = ln
    const uv = validate.username(form.username); if (uv !== true) e.username = uv
    if (!form.specialization_id) e.specialization_id = 'Specialization is required.'
    if (!isEdit) {
      const pv = validate.password(form.password); if (pv !== true) e.password = pv
    }
    if (form.mobile && form.mobile !== '+63') {
      const mv = validate.mobile(form.mobile); if (mv !== true) e.mobile = mv
    }
    if (form.email) {
      const ev = validate.email(form.email); if (ev !== true) e.email = ev
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      if (isEdit) {
        const data = await apiPut('/api/workers/update.php', { id: worker.id, ...form })
        onSave(data.worker)
      } else {
        const data = await apiPost('/api/workers/create.php', form)
        onSave(data.worker)
      }
      onClose()
    } catch (err) {
      setErrors({ api: err?.response?.data?.error || 'Failed to save worker' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-steel-900 border border-steel-700 my-8 z-10">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400" />
        <div className="p-6 border-b border-steel-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardHat size={18} className="text-emerald-400" />
            <h3 className="font-display font-bold text-xl text-slate-100 tracking-wide">
              {isEdit ? 'Edit Worker' : 'New Worker'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {errors.api && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle size={14} />{errors.api}
            </div>
          )}

          {/* Name */}
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

          {/* Specialization */}
          <div>
            <label className="label-field">Specialization *</label>
            <select className="input-field" value={form.specialization_id}
              onChange={e => f('specialization_id', e.target.value)}>
              <option value="">Select specialization...</option>
              {SPECIALIZATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.specialization_id && <p className="text-red-400 text-xs mt-1">{errors.specialization_id}</p>}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Mobile</label>
              <input className="input-field" value={form.mobile}
                onChange={e => f('mobile', e.target.value)} placeholder="+639171234567" />
              {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile}</p>}
            </div>
            <div>
              <label className="label-field">Email</label>
              <input type="email" className="input-field" value={form.email}
                onChange={e => f('email', e.target.value)} placeholder="email@example.com" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Credentials */}
          <div>
            <label className="label-field">Username *</label>
            <input className="input-field" value={form.username}
              onChange={e => f('username', e.target.value)}
              placeholder="Min 5 chars, no special chars" />
            {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
          </div>

          {!isEdit && (
            <div>
              <label className="label-field">Password *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input-field pr-10"
                  value={form.password} onChange={e => f('password', e.target.value)}
                  placeholder="Min 8 chars, upper, lower, number, special" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>
          )}

          {/* Status */}
          <div>
            <label className="label-field">Status</label>
            <select className="input-field" value={form.status_id}
              onChange={e => f('status_id', Number(e.target.value))}>
              <option value={4}>Active</option>
              <option value={5}>Inactive</option>
              <option value={6}>On Leave</option>
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-steel-800 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Worker'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Workers Page ──────────────────────────────────────────────────────────────
export default function WorkersPage() {
  const [workers, setWorkers]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterSpec, setFilterSpec] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editWorker, setEditWorker] = useState(null)
  const [toast, setToast]           = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadWorkers = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)       params.search         = search
      if (filterSpec)   params.specialization = filterSpec
      if (filterStatus) params.status         = filterStatus
      const data = await apiGet('/api/workers/list.php', params)
      setWorkers(data.workers || [])
    } catch {
      setWorkers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWorkers() }, [search, filterSpec, filterStatus])

  const statusColor = (s) => {
    if (s === 'Active')   return 'bg-emerald-500/10 text-emerald-400'
    if (s === 'On Leave') return 'bg-amber-500/10 text-amber-400'
    return 'bg-slate-500/10 text-slate-400'
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
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Workers</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Manage worker accounts and details</p>
        </div>
        <button onClick={() => { setEditWorker(null); setShowModal(true) }}
          className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />New Worker
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-9 text-sm" placeholder="Search by name, username, code..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input-field w-auto text-sm" value={filterSpec}
          onChange={e => setFilterSpec(e.target.value)}>
          <option value="">All Specializations</option>
          {SPECIALIZATIONS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select className="input-field w-auto text-sm" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="On Leave">On Leave</option>
        </select>
      </div>

      {/* Table */}
      <div className="card-steel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-steel-700 bg-steel-900/60">
                {['Worker ID', 'Name', 'Username', 'Specialization', 'Mobile', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-500">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />Loading workers...
                </td></tr>
              ) : workers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-600">No workers found</td></tr>
              ) : workers.map(w => (
                <tr key={w.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{w.worker_code}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{w.full_name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{w.username}</td>
                  <td className="px-4 py-3 text-slate-400">{w.specialization || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{w.mobile || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${statusColor(w.status)}`}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditWorker(w); setShowModal(true) }}
                      className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <Edit2 size={14} />
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
              {workers.length} worker{workers.length !== 1 ? 's' : ''} found
            </span>
          </div>
        )}
      </div>

      {showModal && (
        <WorkerModal worker={editWorker} onClose={() => setShowModal(false)}
          onSave={(saved) => {
            if (editWorker) {
              setWorkers(p => p.map(w => w.id === saved.id ? saved : w))
              showToast('Worker updated successfully')
            } else {
              setWorkers(p => [saved, ...p])
              showToast('Worker created successfully')
            }
          }} />
      )}
    </div>
  )
}