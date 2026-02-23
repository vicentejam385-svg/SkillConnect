import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import StatsCard from '../../components/StatsCard'
import {
  Shield, Users, Key, Plus, Search, Eye, EyeOff,
  RefreshCw, Edit2, CheckCircle, AlertCircle, HardHat, UserCheck,
  UserX, UserCheck2
} from 'lucide-react'
import { validate } from '../../utils/validators'
import { apiGet, apiPost, apiPut } from '../../utils/api'

const NAV_ITEMS = [
  { type: 'section', label: 'Management' },
  { path: '/superadmin/dashboard',   label: 'Dashboard',     icon: Shield   },
  { path: '/superadmin/admin-users', label: 'Admin Users',   icon: Users    },
  { path: '/superadmin/workers',     label: 'Worker Access', icon: HardHat  },
]

// ─── Dashboard Home ────────────────────────────────────────────────────────────
function SAHome() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    admin_users: '—', workers: '—', contacts: '—', expired_licenses: '—'
  })

  useEffect(() => {
  apiGet('/api/users/stats.php')
    .then(data => {
      if (data.success) {
        setStats({
          admin_users:      data.admin_users,
          workers:          data.workers,
          contacts:         data.contacts,
          expired_licenses: data.expired_licenses,
        })
      }
    })
    .catch((err) => {
      console.error('Stats error:', err.response?.status, err.response?.data)
    })
}, [])

  const cards = [
    { icon: Users,     label: 'Admin Users',     value: String(stats.admin_users),     sub: 'Active admins',            accent: 'amber'   },
    { icon: HardHat,   label: 'Workers',          value: String(stats.workers),          sub: 'Registered workers',       accent: 'emerald' },
    { icon: UserCheck, label: 'Total Contacts',   value: String(stats.contacts),         sub: 'Clients + Orgs + Workers', accent: 'blue'    },
    { icon: Shield,    label: 'Expired Licenses', value: String(stats.expired_licenses), sub: 'Needs attention',          accent: 'red'     },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display font-bold text-3xl text-slate-100 tracking-wide">Welcome back</h2>
        <p className="font-body text-slate-400 text-sm mt-1">SkillConnect Super Admin Portal</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(s => <StatsCard key={s.label} {...s} />)}
      </div>
      <div>
        <h3 className="font-display font-bold text-lg text-slate-300 tracking-wide mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => navigate('/superadmin/admin-users')}
            className="card-steel p-5 text-left hover:border-amber-500/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-2">
              <Users size={20} className="text-amber-400" />
              <span className="font-display font-bold text-slate-100 tracking-wide">Manage Admin Users</span>
            </div>
            <p className="font-body text-sm text-slate-500">Create, edit, and deactivate admin accounts.</p>
          </button>
          <button onClick={() => navigate('/superadmin/workers')}
            className="card-steel p-5 text-left hover:border-emerald-400/40 transition-all duration-200">
            <div className="flex items-center gap-3 mb-2">
              <Key size={20} className="text-emerald-400" />
              <span className="font-display font-bold text-slate-100 tracking-wide">Reset Worker Password</span>
            </div>
            <p className="font-body text-sm text-slate-500">Reset passwords for worker accounts.</p>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge Helper ───────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Active:    'bg-emerald-500/10 text-emerald-400',
    Inactive:  'bg-slate-500/10 text-slate-400',
    Suspended: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`status-badge ${map[status] ?? 'bg-slate-500/10 text-slate-400'}`}>
      {status ?? 'Active'}
    </span>
  )
}

// ─── Deactivate Confirm Modal ──────────────────────────────────────────────────
function DeactivateModal({ user, onClose, onSave }) {
  const [statusId, setStatusId] = useState(8) // default Inactive
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleConfirm = async () => {
    setSaving(true)
    setError('')
    try {
      await apiPost('/api/users/deactivate.php', { id: user.id, status_id: statusId })
      onSave()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.error || 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-steel-900 border border-steel-700 p-6 z-10">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
        <div className="flex items-center gap-3 mb-2">
          <UserX size={18} className="text-red-400" />
          <h3 className="font-display font-bold text-lg text-slate-100 tracking-wide">Change User Status</h3>
        </div>
        <p className="font-body text-sm text-slate-400 mb-5">
          Update status for <span className="text-amber-400 font-semibold">{user.name}</span>
        </p>
        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={14} />{error}
          </div>
        )}
        <div className="mb-5">
          <label className="label-field">New Status</label>
          <select className="input-field" value={statusId} onChange={e => setStatusId(Number(e.target.value))}>
            <option value={7}>Active</option>
            <option value={8}>Inactive</option>
            <option value={9}>Suspended</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex-1 text-sm px-4 py-2 font-display font-bold tracking-wider uppercase bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Create / Edit Modal ───────────────────────────────────────────────────────
function AdminUserModal({ onClose, onSave, editUser = null }) {
  const [form, setForm] = useState({
    name:     editUser?.name     || '',
    username: editUser?.username || '',
    password: '',
    type:     editUser?.type     || 'admin',
  })
  const [errors, setErrors]   = useState({})
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving]   = useState(false)

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const validateForm = () => {
    const e = {}
    const nv = validate.name(form.name);         if (nv !== true) e.name = nv
    const uv = validate.username(form.username); if (uv !== true) e.username = uv
    if (!editUser) { const pv = validate.password(form.password); if (pv !== true) e.password = pv }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      if (editUser) {
        await apiPut('/api/users/update.php', { id: editUser.id, ...form })
      } else {
        await apiPost('/api/users/create.php', form)
      }
      onSave()
      onClose()
    } catch (err) {
      setErrors({ api: err?.response?.data?.error || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-steel-900 border border-steel-700 p-6 z-10">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
        <h3 className="font-display font-bold text-xl text-slate-100 tracking-wide mb-6">
          {editUser ? 'Edit Admin User' : 'Create Admin User'}
        </h3>
        {errors.api && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle size={14} />{errors.api}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="label-field">Full Name</label>
            <input className="input-field" value={form.name}
              onChange={e => f('name', e.target.value)} placeholder="e.g. Juan dela Cruz" />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="label-field">Username</label>
            <input className="input-field" value={form.username}
              onChange={e => f('username', e.target.value)} placeholder="Min 5 chars, no special chars" />
            {errors.username && <p className="text-red-400 text-xs mt-1">{errors.username}</p>}
          </div>
          {!editUser && (
            <div>
              <label className="label-field">Password</label>
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
          <div>
            <label className="label-field">Role Type</label>
            <select className="input-field" value={form.type} onChange={e => f('type', e.target.value)}>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {editUser ? 'Update' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Admin Users Page ──────────────────────────────────────────────────────────
function AdminUsersPage() {
  const [users, setUsers]           = useState([])
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [deactivateUser, setDeactivateUser] = useState(null)
  const [toast, setToast]           = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const loadUsers = async () => {
    try {
      const data = await apiGet('/api/users/list.php')
      setUsers(data.users || [])
    } catch {}
  }

  useEffect(() => { loadUsers() }, [])

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-body text-sm">
          <CheckCircle size={14} />{toast}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Admin Users</h2>
          <p className="font-body text-slate-400 text-sm mt-0.5">Manage admin accounts</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true) }}
          className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} />Create Admin
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-10 text-sm" placeholder="Search users..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card-steel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-steel-700 bg-steel-900/60">
                {['Name', 'Username', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-600">No admin users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${u.type === 'super_admin' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {u.type === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    {/* Edit */}
                    <button onClick={() => { setEditUser(u); setShowModal(true) }}
                      title="Edit"
                      className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    {/* Toggle status */}
                    <button onClick={() => setDeactivateUser(u)}
                      title="Change Status"
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      {u.status === 'Active' || !u.status
                        ? <UserX size={14} />
                        : <UserCheck2 size={14} className="text-emerald-400" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AdminUserModal editUser={editUser} onClose={() => setShowModal(false)}
          onSave={() => { loadUsers(); showToast('Admin user saved successfully') }} />
      )}
      {deactivateUser && (
        <DeactivateModal user={deactivateUser} onClose={() => setDeactivateUser(null)}
          onSave={() => { loadUsers(); showToast('User status updated') }} />
      )}
    </div>
  )
}

// ─── Worker Access Page ────────────────────────────────────────────────────────
function WorkerAccessPage() {
  const [workers, setWorkers]         = useState([])
  const [search, setSearch]           = useState('')
  const [resetModal, setResetModal]   = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [toast, setToast]             = useState(null)

  const loadWorkers = async () => {
    try {
      const data = await apiGet('/api/workers/list.php')
      setWorkers(data.workers || [])
    } catch {
      setWorkers([])
    }
  }

  useEffect(() => { loadWorkers() }, [])

  const filtered = workers.filter(w =>
    w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.username?.toLowerCase().includes(search.toLowerCase()) ||
    w.worker_code?.toLowerCase().includes(search.toLowerCase())
  )

  const handleReset = async () => {
    setError('')
    const v = validate.password(newPassword)
    if (v !== true) { setError(v); return }
    setSaving(true)
    try {
      await apiPost('/api/workers/reset-password.php', { worker_id: resetModal.id, password: newPassword })
      setToast(`Password reset for ${resetModal.full_name}`)
      setTimeout(() => setToast(null), 3000)
      setResetModal(null)
      setNewPassword('')
    } catch (err) {
      setError(err?.response?.data?.error || 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-body text-sm">
          <CheckCircle size={14} />{toast}
        </div>
      )}
      <div>
        <h2 className="font-display font-bold text-2xl text-slate-100 tracking-wide">Worker Access</h2>
        <p className="font-body text-slate-400 text-sm mt-0.5">Reset worker portal passwords</p>
      </div>
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input-field pl-10 text-sm" placeholder="Search workers..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card-steel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-steel-700 bg-steel-900/60">
                {['Worker ID', 'Name', 'Username', 'Specialization', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-display font-semibold text-xs tracking-widest uppercase text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-600">No workers found</td></tr>
              ) : filtered.map(w => (
                <tr key={w.id} className="border-b border-steel-800 hover:bg-steel-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-amber-400 font-semibold">{w.worker_code}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{w.full_name}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{w.username}</td>
                  <td className="px-4 py-3 text-slate-400">{w.specialization || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${w.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setResetModal(w); setNewPassword(''); setError('') }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold tracking-wider uppercase text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors">
                      <Key size={12} />Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setResetModal(null)} />
          <div className="relative w-full max-w-sm bg-steel-900 border border-steel-700 p-6 z-10">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
            <div className="flex items-center gap-3 mb-4">
              <Key size={18} className="text-amber-400" />
              <h3 className="font-display font-bold text-lg text-slate-100 tracking-wide">Reset Password</h3>
            </div>
            <p className="font-body text-sm text-slate-400 mb-5">
              Set new password for <span className="text-amber-400 font-semibold">{resetModal.full_name}</span>
            </p>
            {error && <p className="text-red-400 text-xs mb-3 font-body flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
            <div className="relative mb-2">
              <input type={showPass ? 'text' : 'password'} className="input-field pr-10"
                placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-xs text-slate-600 font-body mb-5">Min 8 chars, uppercase, lowercase, number & special character</p>
            <div className="flex gap-3">
              <button onClick={() => setResetModal(null)} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={handleReset} disabled={saving}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                {saving && <RefreshCw size={14} className="animate-spin" />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Super Admin">
      <Routes>
        <Route path="dashboard"   element={<SAHome />}          />
        <Route path="admin-users" element={<AdminUsersPage />}  />
        <Route path="workers"     element={<WorkerAccessPage />}/>
        <Route path="*"           element={<SAHome />}          />
      </Routes>
    </DashboardLayout>
  )
}