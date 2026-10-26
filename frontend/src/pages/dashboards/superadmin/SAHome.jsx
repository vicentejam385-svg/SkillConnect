import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../../../utils/api'
import { GREEN, Avatar, StatusBadge } from './SuperAdminDashboard'

export default function SAHome() {
  const navigate = useNavigate()
  const [stats, setStats]                 = useState({ admin_users: '—', workers: '—', contacts: '—' })
  const [recentAdmins, setRecentAdmins]   = useState([])
  const [recentWorkers, setRecentWorkers] = useState([])

  useEffect(() => {
    apiGet('/api/users/stats.php').then(data => {
      if (data.success) setStats({
        admin_users: data.admin_users,
        workers:     data.workers,
        contacts:    data.contacts,
      })
    }).catch(() => {})

    apiGet('/api/users/list.php').then(d => {
      setRecentAdmins((d.users || []).slice(0, 6))
    }).catch(() => {})

    apiGet('/api/workers/list.php').then(d => {
      setRecentWorkers((d.workers || []).slice(0, 6))
    }).catch(() => {})
  }, [])

  const statCards = [
    { label: 'Admin Users',    value: stats.admin_users, color: '#3b82f6', bg: '#eff6ff', emoji: '👥' },
    { label: 'Total Workers',  value: stats.workers,     color: '#22c55e', bg: '#f0fdf4', emoji: '🔧' },
    { label: 'Total Contacts', value: stats.contacts,    color: '#f59e0b', bg: '#fffbeb', emoji: '👤' },
  ]

  return (
    <div>
      {/* Green Banner */}
      <div style={{
        background: GREEN, borderRadius: 12, padding: '24px 28px',
        marginBottom: 24, color: '#fff'
      }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Welcome to SkillConnect Super Admin</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: .85 }}>
          Emerald Builders &amp; Construction. Here's your overview today.
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '16px 20px', flex: '1 1 140px', minWidth: 140
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[
          { title: 'Recent Admin Users',  data: recentAdmins,  nameKey: 'name',      subKey: 'username', nav: '/superadmin/admin-users' },
          { title: 'Recent Worker Users', data: recentWorkers, nameKey: 'full_name', subKey: 'username', nav: '/superadmin/workers'     },
        ].map(({ title, data, nameKey, subKey, nav }) => (
          <div key={title} style={{
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 10, overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 18px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{title}</span>
              <button onClick={() => navigate(nav)} style={{
                fontSize: 11, color: GREEN, background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600
              }}>View all →</button>
            </div>
            {data.length === 0
              ? <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
              : data.map((u, i) => (
                <div key={u.id ?? i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 18px',
                  borderBottom: i < data.length - 1 ? '1px solid #f8fafc' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u[nameKey] || '?'} size={34} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{u[nameKey]}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{u[subKey]}</div>
                    </div>
                  </div>
                  <StatusBadge status={u.status ?? 'Active'} />
                </div>
              ))
            }
          </div>
        ))}
      </div>
    </div>
  )
}