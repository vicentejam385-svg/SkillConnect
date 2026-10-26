import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, AlertCircle, UserX, UserCheck2, RefreshCw } from 'lucide-react'
import { validate } from '../../../utils/validators'
import { apiGet, apiPost, apiPut } from '../../../utils/api'
import {
  GREEN, Avatar, StatusBadge, Toast, Modal,
  inputStyle, labelStyle, errText, greenBtn, ghostBtn, redBtn,
  TableShell, TR, TD, IconBtn
} from './SuperAdminDashboard'

// ─── Deactivate Modal ──────────────────────────────────────────────────────────
function DeactivateModal({ user, onClose, onSave }) {
  const [statusId, setStatusId] = useState(2)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleConfirm = async () => {
    setSaving(true); setError('')
    try {
      await apiPost('/api/users/deactivate.php', { id: user.id, status_id: statusId })
      onSave(); onClose()
    } catch (err) { setError(err?.response?.data?.error || 'Action failed') }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} accentColor="#ef4444">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <UserX size={18} color="#ef4444" />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Change User Status</h3>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Update status for <strong style={{ color: '#1e293b' }}>{user.name}</strong>
      </p>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
          padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 6, color: '#ef4444', fontSize: 12 }}>
          <AlertCircle size={13} />{error}
        </div>
      )}
      <label style={labelStyle}>New Status</label>
      <select value={statusId} onChange={e => setStatusId(Number(e.target.value))}
        style={{ ...inputStyle, marginBottom: 20 }}>
        <option value={1}>Active</option>
        <option value={2}>Inactive</option>
        <option value={3}>Suspended</option>
      </select>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={handleConfirm} disabled={saving}
          style={{ ...redBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          Confirm
        </button>
      </div>
    </Modal>
  )
}

// ─── Admin User Modal ──────────────────────────────────────────────────────────
function AdminUserModal({ onClose, onSave, editUser = null }) {
  const [form, setForm] = useState({
    name: editUser?.name || '', username: editUser?.username || '',
    type: editUser?.type || 'admin',
    worker_id: '',
  })
  const [workers, setWorkers] = useState([])
  const [errors, setErrors]   = useState({})
  const [saving, setSaving]   = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!editUser) {
      apiGet('/api/workers/list.php').then(d => setWorkers(d.workers || [])).catch(() => {})
    }
  }, [])

  const validateForm = () => {
    const e = {}
    const nv = validate.name(form.name);         if (nv !== true) e.name = nv
    const uv = validate.username(form.username); if (uv !== true) e.username = uv
    setErrors(e); return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      if (editUser) await apiPut('/api/users/update.php', { id: editUser.id, ...form })
      else          await apiPost('/api/users/create.php', form)
      onSave(); onClose()
    } catch (err) { setErrors({ api: err?.response?.data?.error || 'Save failed' }) }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
        {editUser ? 'Edit Admin User' : 'Create Admin User'}
      </h3>
      {errors.api && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
          padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 6, color: '#ef4444', fontSize: 12 }}>
          <AlertCircle size={13} />{errors.api}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {editUser ? (
          <>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={form.name} onChange={e => f('name', e.target.value)}
                placeholder="e.g. Juan dela Cruz" style={inputStyle} />
              {errors.name && <p style={errText}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <input value={form.username} onChange={e => f('username', e.target.value)}
                placeholder="Min 5 chars, no special chars" style={inputStyle} />
              {errors.username && <p style={errText}>{errors.username}</p>}
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Select Worker</label>
              <select
                value={form.worker_id}
                onChange={e => {
                  const w = workers.find(w => String(w.id) === String(e.target.value))
                  setForm(p => ({
                    ...p,
                    worker_id: e.target.value,
                    name:      w ? w.full_name : '',
                    username:  w ? (w.username || '') : '',
                  }))
                }}
                style={inputStyle}
              >
                <option value="">-- Select a worker --</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}{w.specialization ? ` — ${w.specialization}` : ''}
                  </option>
                ))}
              </select>
              {errors.name && <p style={errText}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                value={form.username}
                readOnly
                style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }}
              />
              {errors.username && <p style={errText}>{errors.username}</p>}
            </div>
          </>
        )}
        {!editUser && (
          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px' }}>
            🛡️ This worker will log in with their existing worker credentials, then switch to Admin Access from their dashboard.
          </p>
        )}
        <div>
          <label style={labelStyle}>Role Type</label>
          <select value={form.type} onChange={e => f('type', e.target.value)} style={inputStyle}>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={handleSave} disabled={saving}
          style={{ ...greenBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {saving && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          {editUser ? 'Update' : 'Create'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Admin Users Page ──────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers]         = useState([])
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser]   = useState(null)
  const [deactUser, setDeactUser] = useState(null)
  const [toast, setToast]         = useState(null)
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    try { const d = await apiGet('/api/users/list.php'); setUsers(d.users || []) } catch {}
  }
  useEffect(() => { load() }, [])

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Toast msg={toast} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Admin Users</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Manage admin accounts</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true) }}
          style={{ ...greenBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Create Admin
        </button>
      </div>

      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 18 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search users…" style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>

      <TableShell headers={['Admin ID', 'Name', 'Email', 'Status', 'Actions']}>
        {filtered.length === 0
          ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No admin users found</td></tr>
          : filtered.map((u, i) => (
            <TR key={u.id} last={i === filtered.length - 1}>
              <TD mono small>
                <span style={{ color: GREEN, fontWeight: 700 }}>
                  {u.admin_code ?? `ADM${String(u.id).padStart(3, '0')}`}
                </span>
              </TD>
              <TD>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={u.name || '?'} size={30} />
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{u.name}</span>
                </div>
              </TD>
              <TD small>{u.email || u.username}</TD>
              <TD><StatusBadge status={u.status ?? 'Active'} /></TD>
              <TD>
                <div style={{ display: 'flex', gap: 4 }}>
                  <IconBtn onClick={() => { setEditUser(u); setShowModal(true) }} hoverColor={GREEN}>
                    <Pencil size={14} />
                  </IconBtn>
                  <IconBtn onClick={() => setDeactUser(u)} hoverColor="#ef4444">
                    {(u.status === 'Active' || !u.status)
                      ? <UserX size={14} />
                      : <UserCheck2 size={14} color="#22c55e" />}
                  </IconBtn>
                </div>
              </TD>
            </TR>
          ))
        }
      </TableShell>

      {showModal && (
        <AdminUserModal editUser={editUser} onClose={() => setShowModal(false)}
          onSave={() => { load(); showToast('Admin user saved successfully') }} />
      )}
      {deactUser && (
        <DeactivateModal user={deactUser} onClose={() => setDeactUser(null)}
          onSave={() => { load(); showToast('User status updated') }} />
      )}
    </div>
  )
}