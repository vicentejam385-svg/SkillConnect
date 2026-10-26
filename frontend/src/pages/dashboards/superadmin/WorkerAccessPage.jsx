import { useState, useEffect } from 'react'
import { Search, Key } from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'
import {
  GREEN, Avatar, StatusBadge, Toast, inputStyle,
  TableShell, TR, TD, ResetPasswordModal
} from './SuperAdminDashboard'

export default function WorkerAccessPage() {
  const [workers, setWorkers]       = useState([])
  const [search, setSearch]         = useState('')
  const [resetModal, setResetModal] = useState(null)
  const [toast, setToast]           = useState(null)
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    try { const d = await apiGet('/api/workers/list.php'); setWorkers(d.workers || []) } catch {}
  }
  useEffect(() => { load() }, [])

  const filtered = workers.filter(w =>
    w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.username?.toLowerCase().includes(search.toLowerCase()) ||
    w.worker_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Toast msg={toast} />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Workers Access</h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Reset worker portal passwords</p>
      </div>
      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 18 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search workers…" style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>
      <TableShell headers={['Worker ID', 'Name', 'Username', 'Specialization', 'Status', 'Actions']}>
        {filtered.length === 0
          ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No workers found</td></tr>
          : filtered.map((w, i) => (
            <TR key={w.id} last={i === filtered.length - 1}>
              <TD mono small><span style={{ color: '#f59e0b', fontWeight: 700 }}>{w.worker_code}</span></TD>
              <TD>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={w.full_name || '?'} size={30} />
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{w.full_name}</span>
                </div>
              </TD>
              <TD mono small>{w.username}</TD>
              <TD>{w.specialization || '—'}</TD>
              <TD><StatusBadge status={w.status} /></TD>
              <TD>
                <button onClick={() => setResetModal(w)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  border: `1px solid ${GREEN}`, borderRadius: 6, background: 'none',
                  color: GREEN, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                }}>
                  <Key size={12} />Reset
                </button>
              </TD>
            </TR>
          ))
        }
      </TableShell>
      {resetModal && (
        <ResetPasswordModal
          label={resetModal.full_name}
          onClose={() => setResetModal(null)}
          onReset={async (pwd) => {
            await apiPost('/api/workers/reset-password.php', { worker_id: resetModal.id, password: pwd })
            showToast(`Password reset for ${resetModal.full_name}`)
          }}
        />
      )}
    </div>
  )
}