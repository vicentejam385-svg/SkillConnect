// src/pages/dashboards/superadmin/AuditLogsPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Download, RefreshCw, X, Eye, ChevronLeft, ChevronRight,
  Activity, LogIn, ShieldAlert, UserCog, Lock
} from 'lucide-react'
import api, { apiGet } from '../../../utils/api'
import { GREEN, GREEN_LIGHT, Avatar, TableShell, TR, TD, IconBtn, inputStyle } from './SuperAdminDashboard'

const ENDPOINT = '/api/audit-logs/index.php'

const TABS = [
  { key: 'all',    label: 'All Activity' },
  { key: 'admin',  label: 'Admin Users'  },
  { key: 'worker', label: 'Workers'      },
  { key: 'client', label: 'Clients'      },
]

const ACTIONS = [
  'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
  'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ROLE_CHANGE', 'ACCESS_DENIED', 'EXPORT',
]
const MODULES = [
  'Auth', 'Admin Users', 'Workers Access', 'Client Access',
  'Inquiries', 'Job Orders', 'Schedules', 'Licenses', 'System',
]

const GRAY   = { bg: '#f1f5f9', color: '#475569' }
const RED    = { bg: '#fee2e2', color: '#991b1b' }
const GREENC = { bg: '#d1fae5', color: '#065f46' }
const BLUE   = { bg: '#dbeafe', color: '#1e40af' }
const AMBER  = { bg: '#fef9c3', color: '#854d0e' }
const PURPLE = { bg: '#ede9fe', color: '#5b21b6' }
const TEAL   = { bg: '#ccfbf1', color: '#115e59' }

const ACTION_STYLE = {
  LOGIN: GRAY, LOGOUT: GRAY,
  LOGIN_FAILED: RED, ACCESS_DENIED: RED, DELETE: RED,
  CREATE: GREENC,
  UPDATE: BLUE, STATUS_CHANGE: BLUE,
  ROLE_CHANGE: PURPLE,
  PASSWORD_CHANGE: AMBER, PASSWORD_RESET: AMBER,
  EXPORT: TEAL,
}

const ROLE_LABEL = { superadmin: 'Super Admin', admin: 'Admin', worker: 'Worker', client: 'Client', guest: 'Guest' }

const prettyAction = (s = '') =>
  s.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(String(s).replace(' ', 'T'))
  if (isNaN(d)) return s
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function valueText(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ─── Small pieces ──────────────────────────────────────────────────────────────
function ActionBadge({ action }) {
  const s = ACTION_STYLE[action] ?? GRAY
  return (
    <span style={{
      background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {prettyAction(action)}
    </span>
  )
}

function ResultBadge({ status }) {
  const s = status === 'failed' ? RED : GREENC
  return (
    <span style={{
      background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}

function RoleTag({ type }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f1f5f9',
      padding: '1px 7px', borderRadius: 8, whiteSpace: 'nowrap',
    }}>
      {ROLE_LABEL[type] ?? type}
    </span>
  )
}

function SummaryCard({ icon: Icon, color, bg, value, label }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Detail side panel ─────────────────────────────────────────────────────────
function DetailPanel({ log, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const oldV = log.old_values && typeof log.old_values === 'object' ? log.old_values : null
  const newV = log.new_values && typeof log.new_values === 'object' ? log.new_values : null
  const fields = Array.from(new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]))

  const Row = ({ k, children }) => (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 110, flexShrink: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{k}</div>
      <div style={{ flex: 1, fontSize: 13, color: '#1e293b', wordBreak: 'break-word' }}>{children}</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)' }} />
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 440,
        background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column',
        borderTop: `4px solid ${GREEN}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Log Details</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{log.log_code}</div>
          </div>
          <IconBtn onClick={onClose}><X size={18} /></IconBtn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px' }}>
          <Row k="Timestamp">{fmtDate(log.created_at)}</Row>
          <Row k="User">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={log.actor_name} size={26} />
              <div>
                <div style={{ fontWeight: 600 }}>{log.actor_name}</div>
                <RoleTag type={log.actor_type} />
              </div>
            </div>
          </Row>
          <Row k="Action"><ActionBadge action={log.action} /></Row>
          <Row k="Module">{log.module}</Row>
          <Row k="Description">{log.description}</Row>
          <Row k="Target">{log.target_label ? `${log.target_label}${log.target_type ? ` (${log.target_type})` : ''}` : '—'}</Row>
          <Row k="Result"><ResultBadge status={log.status} /></Row>
          <Row k="IP Address"><span style={{ fontFamily: 'monospace' }}>{log.ip_address || '—'}</span></Row>
          <Row k="Device">{log.user_agent || '—'}</Row>

          {fields.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                Changes
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Field', 'Old value', 'New value'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(f => (
                      <tr key={f} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#334155' }}>{f}</td>
                        <td style={{ padding: '8px 10px', color: '#991b1b', background: '#fef2f2', wordBreak: 'break-word' }}>{valueText(oldV?.[f])}</td>
                        <td style={{ padding: '8px 10px', color: '#065f46', background: '#f0fdf4', wordBreak: 'break-word' }}>{valueText(newV?.[f])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
const EMPTY_FILTERS = { q: '', action: '', module: '', status: '', date_from: '', date_to: '' }

export default function AuditLogsPage() {
  const [group, setGroup]         = useState('all')
  const [search, setSearch]       = useState('')
  const [filters, setFilters]     = useState(EMPTY_FILTERS)
  const [page, setPage]           = useState(1)
  const [perPage, setPerPage]     = useState(20)
  const [rows, setRows]           = useState([])
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, pages: 1 })
  const [summary, setSummary]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selected, setSelected]   = useState(null)
  const [exporting, setExporting] = useState(false)
  const reqId = useRef(0)

  const fieldStyle = { ...inputStyle, width: 'auto', minWidth: 0 }

  // Debounce the search box so we don't hit the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => (f.q === search.trim() ? f : { ...f, q: search.trim() }))
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const buildParams = useCallback(() => {
    const p = { group, ...filters }
    Object.keys(p).forEach(k => { if (p[k] === '' || p[k] == null) delete p[k] })
    return p
  }, [group, filters])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    setError('')
    try {
      const res = await apiGet(ENDPOINT, { ...buildParams(), page, per_page: perPage })
      if (id !== reqId.current) return
      if (!res?.success) throw new Error(res?.error || 'Failed to load audit logs.')
      setRows(res.data.rows)
      setPagination(res.data.pagination)
      setSummary(res.data.summary)
    } catch (err) {
      if (id !== reqId.current) return
      setError(err?.response?.data?.error || err.message || 'Failed to load audit logs.')
      setRows([])
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [buildParams, page, perPage])

  useEffect(() => { load() }, [load])

  const updateFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }
  const changeGroup = (key) => { setGroup(key); setPage(1) }
  const clearFilters = () => { setSearch(''); setFilters(EMPTY_FILTERS); setPage(1) }
  const hasFilters = Object.values(filters).some(Boolean) || search !== ''

  const exportCsv = async () => {
    setExporting(true)
    setError('')
    try {
      const res = await api.get(ENDPOINT, {
        params: { ...buildParams(), export: 'csv' },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      a.href = url
      a.download = `audit_logs_${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      load() // the export itself is logged, so refresh to show it
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.per_page + 1
  const to   = Math.min(pagination.page * pagination.per_page, pagination.total)

  const pagerBtn = (disabled) => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
    fontSize: 12, fontWeight: 600, color: '#475569',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  })

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e293b' }}>Audit Logs</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={12} /> A permanent, read-only record of system activity. Entries cannot be edited or deleted.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6,
            fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer',
          }}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
            Refresh
          </button>
          <button onClick={exportCsv} disabled={exporting} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: GREEN, border: 'none', borderRadius: 6,
            fontSize: 13, fontWeight: 600, color: '#fff',
            cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1,
          }}>
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Summary cards (today) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 16, marginBottom: 20,
      }}>
        <SummaryCard icon={Activity}    color="#3b82f6" bg="#eff6ff" value={summary?.logs_today}            label="Total Logs Today" />
        <SummaryCard icon={LogIn}       color="#1a8a50" bg="#e8f5ee" value={summary?.logins_today}          label="Logins Today" />
        <SummaryCard icon={ShieldAlert} color="#ef4444" bg="#fef2f2" value={summary?.failed_logins_today}   label="Failed Logins Today" />
        <SummaryCard icon={UserCog}     color="#f59e0b" bg="#fffbeb" value={summary?.account_changes_today} label="Account Changes Today" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(t => {
          const on = group === t.key
          return (
            <button key={t.key} onClick={() => changeGroup(t.key)} style={{
              padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
              color: on ? GREEN : '#64748b',
              borderBottom: on ? `2px solid ${GREEN}` : '2px solid transparent',
              marginBottom: -1, transition: 'all .15s',
            }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: 12, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search user, description, target, IP, log ID…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>

        <select value={filters.action} onChange={e => updateFilter('action', e.target.value)} style={fieldStyle}>
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{prettyAction(a)}</option>)}
        </select>

        <select value={filters.module} onChange={e => updateFilter('module', e.target.value)} style={fieldStyle}>
          <option value="">All modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={filters.status} onChange={e => updateFilter('status', e.target.value)} style={fieldStyle}>
          <option value="">All results</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={filters.date_from} max={filters.date_to || undefined}
            onChange={e => updateFilter('date_from', e.target.value)} style={fieldStyle} title="From date" />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>to</span>
          <input type="date" value={filters.date_to} min={filters.date_from || undefined}
            onChange={e => updateFilter('date_to', e.target.value)} style={fieldStyle} title="To date" />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px',
            background: GREEN_LIGHT, color: GREEN, border: 'none', borderRadius: 6,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Table */}
      <TableShell headers={['Timestamp', 'User', 'Action', 'Module', 'Description', 'IP Address', 'Result', '']}>
        {loading && rows.length === 0 && (
          <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading audit logs…</td></tr>
        )}
        {!loading && rows.length === 0 && !error && (
          <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No audit logs match your filters.
          </td></tr>
        )}
        {rows.map((r, i) => (
          <TR key={r.id} last={i === rows.length - 1}>
            <TD small>
              <div style={{ whiteSpace: 'nowrap', color: '#334155' }}>{fmtDate(r.created_at)}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>{r.log_code}</div>
            </TD>
            <TD>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={r.actor_name} size={28} />
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{r.actor_name}</div>
                  <RoleTag type={r.actor_type} />
                </div>
              </div>
            </TD>
            <TD><ActionBadge action={r.action} /></TD>
            <TD small>{r.module}</TD>
            <TD small>
              <div style={{ maxWidth: 340, wordBreak: 'break-word' }}>{r.description}</div>
            </TD>
            <TD mono small>{r.ip_address || '—'}</TD>
            <TD><ResultBadge status={r.status} /></TD>
            <TD>
              <IconBtn onClick={() => setSelected(r)} hoverColor={GREEN}><Eye size={15} /></IconBtn>
            </TD>
          </TR>
        ))}
      </TableShell>

      {/* Pagination */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginTop: 14,
      }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Showing {from}–{to} of {pagination.total} entries
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} style={{ ...fieldStyle, padding: '6px 10px', fontSize: 12 }}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={pagerBtn(page <= 1)}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
            Page {pagination.page} of {Math.max(1, pagination.pages)}
          </span>
          <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={pagerBtn(page >= pagination.pages)}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {selected && <DetailPanel log={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}