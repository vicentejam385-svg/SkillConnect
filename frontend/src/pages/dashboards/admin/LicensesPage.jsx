import { useState, useEffect } from 'react'
import {
  Search, RefreshCw, FileText, Eye, X, CheckCircle, AlertCircle, AlertTriangle
} from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

// ── Auth headers / fetch ───────────────────────────────────────
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${JSON.parse(localStorage.getItem('sc_user') || 'null')?.token}`,
})
const authFetch = (url, opts = {}) =>
  fetch(url, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } })

// ── Toast ──────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg border
      ${toast.type === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-red-50 border-red-200 text-red-700'}`}>
      {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {toast.msg}
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────
function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.ceil(total / perPage)
  if (totalPages <= 1) return null
  const pages = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return (
    <div className="flex items-center justify-between px-1 mt-4">
      <p className="text-xs text-gray-400">
        Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-gray-400 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 h-8 text-xs font-semibold rounded-lg transition-colors
                ${p === page
                  ? 'bg-emerald-500 text-white border border-emerald-500'
                  : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  )
}
// ── Licenses Page
export default function LicensesPage() {
  const [licenses,  setLicenses]  = useState([])
  const [contacts,  setContacts]  = useState([])
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [showForm,  setShowForm]  = useState(false)
const [viewFile,   setViewFile]   = useState(null)
const [scanningId, setScanningId] = useState(null)
const [scanResult, setScanResult] = useState(null)
const [page,       setPage]       = useState(1)
const [total,      setTotal]      = useState(0)
const PER_PAGE = 3
  const [form, setForm] = useState({ contact_id: '', document_name: '', file_path: '', expiry_date: '', ai_scan_result: '' })
  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

 const handleAiScan = async (license) => {
    setScanningId(license.id)
    setScanResult(null)
    try {
      const proxyResp = await authFetch(
        `http://localhost/skillconnect/backend/api/licenses/fetch-image.php?path=${encodeURIComponent(license.file_path)}`
      )
      const proxyData = await proxyResp.json()
      if (!proxyData.success) throw new Error(proxyData.error || 'Failed to fetch image')

      const token = JSON.parse(localStorage.getItem('sc_user'))?.token
      const scanResp = await fetch('http://localhost/skillconnect/backend/api/licenses/scan.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image:     proxyData.base64,
          mime_type: proxyData.media_type || 'image/jpeg',
        }),
      })
      const scanData = await scanResp.json()
      if (!scanData.success) throw new Error(scanData.error || 'Scan failed')

      const token2 = JSON.parse(localStorage.getItem('sc_user'))?.token
      await fetch('http://localhost/skillconnect/backend/api/licenses/update.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token2}`,
        },
        body: JSON.stringify({
          id:             license.id,
          ai_scan_result: JSON.stringify({ expiry_date: scanData.expiry_date }),
          expiry_date:    scanData.expiry_date || license.expiry_date,
        }),
      })

      setScanResult({
        licenseId: license.id,
        data: {
          expiry_date:       scanData.expiry_date || '—',
          document_type:     '—',
          license_number:    '—',
          holder_name:       '—',
          issuing_authority: '—',
          is_valid:          !!scanData.expiry_date,
          notes: scanData.expiry_date
            ? 'Expiry date auto-detected and updated.'
            : 'No expiry date found in document.',
        }
      })
      showToast('AI scan complete!')
      load()
    } catch (err) {
      showToast('AI scan failed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setScanningId(null)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [lData, cData] = await Promise.all([
        apiGet('/api/licenses/list.php', { search, per_page: PER_PAGE, page }),
        apiGet('/api/contacts/list.php', { per_page: 100 }),
      ])
      const allLicenses = lData.licenses || []
      const filteredLicenses = filterStatus === 'expired'
        ? allLicenses.filter(l => isExpired(l.expiry_date))
        : filterStatus === 'expiring'
        ? allLicenses.filter(l => isExpiringSoon(l.expiry_date))
        : filterStatus === 'valid'
        ? allLicenses.filter(l => l.expiry_date && !isExpired(l.expiry_date) && !isExpiringSoon(l.expiry_date))
        : allLicenses
      setLicenses(filteredLicenses)
      setTotal(filteredLicenses.length)
      setContacts(cData.contacts || [])
    } catch { showToast('Failed to load licenses.', 'error') }
    setLoading(false)
  }

  useEffect(() => { setPage(1) }, [search, filterStatus])
  useEffect(() => { load() }, [search, filterStatus, page])

  const handleCreate = async () => {
    if (!form.contact_id || !form.document_name || !form.expiry_date) {
      showToast('Contact, document name, and expiry date are required.', 'error'); return
    }
    try {
      const data = await apiPost('/api/licenses/create.php', form)
      if (!data.success) throw new Error(data.error)
      showToast('License added!')
      setShowForm(false)
      setForm({ contact_id: '', document_name: '', file_path: '', expiry_date: '', ai_scan_result: '' })
      load()
    } catch (err) { showToast(err.message || 'Failed.', 'error') }
  }

  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false
    const diff = new Date(dateStr) - new Date()
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
  }

  const isExpired = (dateStr) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const workers = contacts.filter(c => c.type === 'worker')
  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-gray-800 placeholder-gray-400"
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider"

  // Compute stats
  const expiredCount      = licenses.filter(l => isExpired(l.expiry_date)).length
  const expiringSoonCount = licenses.filter(l => isExpiringSoon(l.expiry_date)).length

  return (
    <div className="space-y-6 max-w-6xl">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Licenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Worker licenses and certifications</p>
        </div>
      </div>

      {/* Alert banners */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {expiredCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex-1">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 font-medium">{expiredCount} license{expiredCount > 1 ? 's' : ''} expired</span>
            </div>
          )}
          {expiringSoonCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex-1">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700 font-medium">{expiringSoonCount} license{expiringSoonCount > 1 ? 's' : ''} expiring within 30 days</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 placeholder-gray-400"
            placeholder="Search licenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-600"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
        >
          <option value="">All Statuses</option>
          <option value="valid">Valid</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-emerald-500" />
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['ID', 'Worker', 'Document', 'Expiry Date', 'Status'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {licenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <FileText size={22} className="text-gray-400" />
                        </div>
                        <p className="text-gray-400 text-sm">No licenses found</p>
                        <button onClick={() => setShowForm(true)} className="text-emerald-500 text-xs font-semibold hover:underline">Add the first license</button>
                      </div>
                    </td>
                  </tr>
                ) : licenses.map(l => {
                  const expired  = isExpired(l.expiry_date)
                  const expiring = isExpiringSoon(l.expiry_date)
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-emerald-600 font-semibold">#{l.id}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600 flex-shrink-0">
                            {(l.worker_name || l.contact_name || '?').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <span className="text-gray-700 font-medium">{l.worker_name || l.contact_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-700 font-medium">{l.document_name}</span>
                        </div>
                        {l.file_path && (
  <button
    onClick={() => setViewFile({ url: `http://localhost/skillconnect/${l.file_path}`, name: l.document_name, worker: l.worker_name || l.contact_name })}
    className="text-xs text-emerald-500 hover:underline mt-0.5 block"
  >
    View file
  </button>
)}
                      </td>
                      <td className="px-5 py-3">
                        <div className={`text-sm font-medium ${expired ? 'text-red-500' : expiring ? 'text-amber-500' : 'text-gray-700'}`}>
                          {l.expiry_date || '—'}
                        </div>
                        {expiring && !expired && <div className="text-xs text-amber-500 mt-0.5">Expiring soon</div>}
                        {expired && <div className="text-xs text-red-500 mt-0.5">Expired</div>}
                      </td>
                      <td className="px-5 py-3">
                        {expired ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Expired</span>
                        ) : expiring ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Expiring Soon</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Valid</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
    {scanResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setScanResult(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={16} className="text-purple-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">AI Scan Result</p>
                  <p className="text-xs text-gray-400">Extracted from license document</p>
                </div>
              </div>
              <button onClick={() => setScanResult(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-0">
              {[
                { label: 'Document Type',    value: scanResult.data.document_type    },
                { label: 'License Number',   value: scanResult.data.license_number   },
                { label: 'Holder Name',      value: scanResult.data.holder_name      },
                { label: 'Expiry Date',      value: scanResult.data.expiry_date      },
                { label: 'Issuing Authority',value: scanResult.data.issuing_authority},
                { label: 'Notes',            value: scanResult.data.notes            },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-700 break-all">{value || '—'}</span>
                </div>
              ))}
              <div className="flex gap-4 py-2.5">
                <span className="text-xs text-gray-400 w-36 flex-shrink-0">Valid</span>
                <span className={`text-sm font-semibold ${scanResult.data.is_valid ? 'text-emerald-600' : 'text-red-500'}`}>
                  {scanResult.data.is_valid ? '✓ Valid' : '✗ Invalid'}
                </span>
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => setScanResult(null)} className="w-full px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    {viewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewFile(null)} />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{viewFile.name}</p>
                  <p className="text-xs text-gray-400">{viewFile.worker}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewFile(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100 min-h-[400px]">
              {/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(viewFile.url) ? (
                <div className="flex items-center justify-center h-full p-6">
                  <img src={viewFile.url} alt={viewFile.name} className="max-w-full max-h-full object-contain rounded-lg shadow" />
                </div>
              ) : /\.pdf$/i.test(viewFile.url) ? (
                <iframe src={viewFile.url} title={viewFile.name} className="w-full h-full min-h-[500px] border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                    <FileText size={28} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Preview not available for this file type.</p>
                  <a href={viewFile.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors">
                    <Eye size={14} />Open file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}