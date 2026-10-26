import { useState, useEffect } from 'react'
import { Plus, RefreshCw, Settings, X, CheckCircle, AlertCircle } from 'lucide-react'
import { apiGet, apiPost } from '../../../utils/api'

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
export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('org_types')
  const [orgTypes, setOrgTypes] = useState([])
  const [specializations, setSpecializations] = useState([])
  const [statuses] = useState([
    { id: 1,  entity: 'contact',   label: 'Active'       },
    { id: 2,  entity: 'contact',   label: 'Inactive'     },
    { id: 3,  entity: 'contact',   label: 'Blacklisted'  },
    { id: 10, entity: 'contact',   label: 'Pending'      },
    { id: 11, entity: 'contact',   label: 'Under Review' },
    { id: 4,  entity: 'worker',    label: 'Active'       },
    { id: 5,  entity: 'worker',    label: 'Inactive'     },
    { id: 6,  entity: 'worker',    label: 'On Leave'     },
    { id: 7,  entity: 'user',      label: 'Active'       },
    { id: 8,  entity: 'user',      label: 'Inactive'     },
    { id: 9,  entity: 'user',      label: 'Suspended'    },
    { id: 28, entity: 'job_order', label: 'Pending'      },
    { id: 29, entity: 'job_order', label: 'Active'       },
    { id: 30, entity: 'job_order', label: 'Complete'     },
    { id: 31, entity: 'job_order', label: 'On Hold'      },
    { id: 32, entity: 'job_order', label: 'Under Review' },
    { id: 33, entity: 'job_order', label: 'Scheduled'    },
    { id: 34, entity: 'job_order', label: 'In Progress'  },
    { id: 35, entity: 'job_order', label: 'Cancelled'    },
    { id: 36, entity: 'schedule',  label: 'Pending'      },
    { id: 37, entity: 'schedule',  label: 'Scheduled'    },
    { id: 38, entity: 'schedule',  label: 'In Progress'  },
    { id: 39, entity: 'schedule',  label: 'Complete'     },
    { id: 40, entity: 'schedule',  label: 'Cancelled'    },
    { id: 41, entity: 'inquiry',   label: 'New'          },
    { id: 42, entity: 'inquiry',   label: 'Won'          },
    { id: 43, entity: 'inquiry',   label: 'Lost'         },
  ])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const tabs = [{ key: 'org_types', label: 'Contract Types' }, { key: 'specializations', label: 'Specializations' }, { key: 'statuses', label: 'Statuses' }]

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    setLoading(true)
    try {
      const [sData, oData] = await Promise.all([
        apiGet('/api/config/specializations.php'),
        apiGet('/api/config/org-types.php'),
      ])
      setSpecializations(sData.data || sData.specializations || [])
      setOrgTypes(oData.data || oData.org_types || [])
    } catch { showToast('Failed to load config.', 'error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const endpoint = activeTab === 'org_types'
        ? '/api/config/org-types.php'
        : '/api/config/specializations.php'
      const data = await apiPost(endpoint, { name: newName.trim() })
      if (!data.success) throw new Error(data.error)
      showToast(`${activeTab === 'org_types' ? 'Contract Type' : 'Specialization'} added!`)
      setNewName('')
      setShowModal(false)
      load()
    } catch (err) {
      showToast(err.message || 'Failed to add.', 'error')
    }
    setSaving(false)
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-gray-800 placeholder-gray-400"
  const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider"

  return (
    <div className="space-y-6 max-w-4xl">
      <Toast toast={toast} />
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configuration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage lookup tables and system settings</p>
      </div>
      <div className="flex border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px
              ${activeTab === t.key ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {(activeTab === 'org_types' || activeTab === 'specializations') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {activeTab === 'org_types'
                ? `${orgTypes.length} contract type${orgTypes.length !== 1 ? 's' : ''}`
                : `${specializations.length} specialization${specializations.length !== 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => { setNewName(''); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={15} />Add {activeTab === 'org_types' ? 'Type' : 'Specialization'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <RefreshCw size={16} className="animate-spin text-emerald-500" />
                <span className="text-gray-400 text-sm">Loading...</span>
              </div>
            ) : (activeTab === 'org_types' ? orgTypes : specializations).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Settings size={18} className="text-gray-400" />
                </div>
                <p className="text-gray-400 text-sm">No items yet</p>
                <button onClick={() => { setNewName(''); setShowModal(true) }} className="text-emerald-500 text-xs font-semibold hover:underline">
                  Add the first one
                </button>
              </div>
            ) : (
              <div>
                {(activeTab === 'org_types' ? orgTypes : specializations).map((item, i, arr) => (
                  <div key={item.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeTab === 'org_types' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                      <span className="text-gray-700 text-sm">{item.name}</span>
                    </div>
                    <span className="text-xs text-gray-300 font-mono">#{item.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'statuses' && (
        <div className="space-y-6">
          {['contact', 'worker', 'user', 'job_order', 'inquiry'].map(entity => (
            <div key={entity}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                {entity === 'job_order' ? 'Job Order' : entity.charAt(0).toUpperCase() + entity.slice(1)} Statuses
              </h4>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {statuses.filter(s => s.entity === entity).map((s, i, arr) => {
                  const dotColor = (() => {
                    if (['Active', 'Complete', 'Won', 'Scheduled'].includes(s.label)) return 'bg-emerald-400'
                    if (['Blacklisted', 'Suspended', 'Cancelled', 'Lost', 'Expired'].includes(s.label)) return 'bg-red-400'
                    if (['Pending', 'New', 'Under Review'].includes(s.label)) return 'bg-yellow-400'
                    if (['In Progress', 'On Leave'].includes(s.label)) return 'bg-amber-400'
                    if (['On Hold'].includes(s.label)) return 'bg-orange-400'
                    if (['Inactive'].includes(s.label)) return 'bg-gray-300'
                    return 'bg-gray-300'
                  })()
                  const badgeColor = (() => {
                    if (['Active', 'Complete', 'Won', 'Scheduled'].includes(s.label)) return 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    if (['Blacklisted', 'Suspended', 'Cancelled', 'Lost'].includes(s.label)) return 'bg-red-50 text-red-600 border-red-100'
                    if (['Pending', 'New', 'Under Review'].includes(s.label)) return 'bg-yellow-50 text-yellow-600 border-yellow-100'
                    if (['In Progress', 'On Leave'].includes(s.label)) return 'bg-amber-50 text-amber-600 border-amber-100'
                    if (['On Hold'].includes(s.label)) return 'bg-orange-50 text-orange-600 border-orange-100'
                    return 'bg-gray-50 text-gray-500 border-gray-100'
                  })()
                  return (
                    <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                        <span className="text-gray-700 text-sm font-medium">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                          {entity === 'job_order' ? 'Job Order' : entity.charAt(0).toUpperCase() + entity.slice(1)}
                        </span>
                        <span className="text-xs text-gray-300 font-mono">#{s.id}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Plus size={16} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    Add {activeTab === 'org_types' ? 'Contract Type' : 'Specialization'}
                  </h3>
                  <p className="text-xs text-gray-400">Enter a name for the new entry</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>
                  {activeTab === 'org_types' ? 'Organisation Type Name' : 'Specialization Name'} *
                </label>
                <input
                  className={inputCls}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={activeTab === 'org_types' ? 'e.g. Heavy Equipment' : 'e.g. Electrician'}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100 bg-white">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || saving}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}