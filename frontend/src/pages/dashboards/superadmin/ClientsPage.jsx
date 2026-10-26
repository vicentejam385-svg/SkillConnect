import { useState, useEffect } from 'react'
import { Search, Key, RefreshCw } from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'
import {
  GREEN, Avatar, StatusBadge, Toast, inputStyle,
  TableShell, TR, TD, ResetPasswordModal
} from './SuperAdminDashboard'

export default function ClientsPage() {
  const [clients, setClients]       = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [resetModal, setResetModal] = useState(null)
  const [toast, setToast]           = useState(null)
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const d = await apiGet('/api/contacts/list.php?type=client')
      setClients(d.clients ?? d.contacts ?? [])
    } catch { setClients([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = clients.filter(c => {
    const t = search.toLowerCase()
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(t) ||
      c.contact_code?.toLowerCase().includes(t) ||
      c.email?.toLowerCase().includes(t) ||
      c.mobile?.toLowerCase().includes(t)
  })

  return (
    <div>
      <Toast msg={toast} />
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Client Access</h2>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Registered client contacts</p>
      </div>
      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 18 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, code, email…" style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>
      <TableShell headers={['Client ID', 'Name', 'Mobile', 'Email', 'Address', 'Status', 'Actions']}>
        {loading
          ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={14} style={{ display: 'inline', marginRight: 6, animation: 'spin 1s linear infinite' }} />
              Loading clients…
            </td></tr>
          : filtered.length === 0
            ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No clients found</td></tr>
            : filtered.map((c, i) => (
              <TR key={c.id} last={i === filtered.length - 1}>
                <TD mono small><span style={{ color: '#3b82f6', fontWeight: 700 }}>{c.contact_code}</span></TD>
                <TD>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={`${c.first_name} ${c.last_name}`} size={30} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      {c.first_name} {c.last_name}{c.suffix ? ` ${c.suffix}` : ''}
                    </span>
                  </div>
                </TD>
                <TD mono small>{c.mobile || '—'}</TD>
                <TD small>{c.email || '—'}</TD>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12,
                  maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={c.address}>{c.address || '—'}</td>
                <TD><StatusBadge status={c.status} /></TD>
                <TD>
                  <button onClick={() => setResetModal(c)} style={{
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
          label={`${resetModal.first_name} ${resetModal.last_name}`}
          onClose={() => setResetModal(null)}
          onReset={async (pwd) => {
            await apiPost('/api/contacts/reset-password.php', { contact_id: resetModal.id, password: pwd })
            showToast(`Password reset for ${resetModal.first_name} ${resetModal.last_name}`)
          }}
        />
      )}
    </div>
  )
}