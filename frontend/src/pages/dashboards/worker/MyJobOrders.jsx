import { useState, useEffect } from 'react'
import {
  RefreshCw, AlertCircle, ClipboardList, FileText, Upload, X,
  Eye, ChevronRight, MapPin, Clock
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { apiGet } from '../../../utils/api'

// ── Helpers ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = {
    'Pending':     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'Active':      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Complete':    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Completed':   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'On Hold':     'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Scheduled':   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'Cancelled':   'bg-red-500/10 text-red-400 border-red-500/20',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-sm
      ${colors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
      {status || '—'}
    </span>
  )
}

function progressPercent(status, start_date, end_date, uploadedPhotos = []) {
  if (status === 'Complete' || status === 'Completed') return 100
  if (status === 'Cancelled') return 0
  if (!start_date || !end_date) return 0
  const start = new Date(start_date)
  const end   = new Date(end_date)
  const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  if (uploadedPhotos.length === 0) return 0
  const uniqueDays = new Set(
    uploadedPhotos.map(p => (p.upload_date || '').slice(0, 10)).filter(Boolean)
  ).size
  return Math.min(99, Math.round((uniqueDays / totalDays) * 100))
}

// ── MY JOB ORDERS ──────────────────────────────────────────────
export default function MyJobOrders() {
  const { user }  = useAuth()
  const [jobs,         setJobs]         = useState([])
const [loading,      setLoading]      = useState(true)
const [viewJob,      setViewJob]      = useState(null)
const [photoError, setPhotoError] = useState(null)
const [progressJob,     setProgressJob]    = useState(null)
const [progressVal,     setProgressVal]    = useState(0)
const [mapCoords,       setMapCoords]      = useState(null)
const [mapLoading,      setMapLoading]     = useState(false)
const [progressPhotos,  setProgressPhotos] = useState([])
const [jobPhotos,       setJobPhotos]       = useState({}) // { [job_order_id]: [photos] }
const [jobPage,         setJobPage]         = useState(1)
const JOB_PER_PAGE = 3

  useEffect(() => {
    apiGet('/api/workers/list.php')
      .then(wData => {
        const workers = wData.workers || []
        const worker  = workers.find(w =>
          String(w.id)           === String(user?.id)   ||
          String(w.user_id)      === String(user?.id)   ||
          String(w.contact_code) === String(user?.contact_code)
        )
        if (!worker) return setJobs([])
        return apiGet('/api/job-orders/list.php', { per_page: 100 }).then(d => {
          const mine = (d.job_orders || []).filter(jo =>
            String(jo.worker_contact_id) === String(worker.contact_id) ||
            String(jo.worker_contact_id) === String(worker.id)         ||
            String(jo.worker_name)       === String(worker.full_name)
          )
          setJobs(mine)
        })
      })
      .catch(err => console.error('MyJobOrders error:', err))
      .finally(() => setLoading(false))
  }, [])

  // Load progress photos for all jobs
  useEffect(() => {
    if (jobs.length === 0) return
    const token = JSON.parse(localStorage.getItem('sc_user'))?.token
    Promise.all(
      jobs.map(jo =>
        fetch(`http://localhost/skillconnect/backend/api/job-orders/get-progress.php?job_order_id=${jo.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(d => ({ id: jo.id, photos: d.photos || [] }))
          .catch(() => ({ id: jo.id, photos: [] }))
      )
    ).then(results => {
      const map = {}
      results.forEach(r => { map[r.id] = r.photos })
      setJobPhotos(map)
    })
  }, [jobs])

  // Auto-complete jobs past their end date
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    jobs.forEach(async jo => {
      if (
        jo.end_date &&
        jo.end_date.slice(0, 10) < today &&
        jo.status !== 'Complete' &&
        jo.status !== 'Completed' &&
        jo.status !== 'Cancelled'
      ) {
        try {
          const token = JSON.parse(localStorage.getItem('sc_user'))?.token
          await fetch(`http://localhost/skillconnect/backend/api/job-orders/update.php?id=${jo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status_id: 'Complete' }),
          })
          setJobs(prev => prev.map(j => j.id === jo.id ? { ...j, status: 'Complete' } : j))
        } catch (err) {
          console.error('Auto-complete failed for job', jo.id, err)
        }
      }
    })
  }, [jobs])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-bold text-xl text-slate-800 tracking-tight">Job Orders</h2>
        <p className="text-slate-400 text-sm mt-0.5">Jobs assigned to you</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <RefreshCw size={18} className="animate-spin text-emerald-500" />
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400">No job orders assigned</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const totalJobPages = Math.ceil(jobs.length / JOB_PER_PAGE)
            const pagedJobs = jobs.slice((jobPage - 1) * JOB_PER_PAGE, jobPage * JOB_PER_PAGE)
            return (
              <>
              {pagedJobs.map(jo => {
            const pct = progressPercent(jo.status, jo.start_date, jo.end_date, jobPhotos[jo.id] || [])
            return (
              <div key={jo.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all">
                {/* Header */}
                <div className="flex flex-col gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <StatusBadge status={jo.status} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">{jo.contract_type || 'Construction Project'}</p>
                    <p className="text-xs font-mono text-slate-400">{jo.job_order_code}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
  onClick={e => {
    e.stopPropagation()
    setMapCoords(null)
    setMapLoading(false)
    setViewJob(jo)
    const addr = jo.client_address || jo.location
    console.log('Address to geocode:', addr)
    if (addr) {
      setMapLoading(true)
      const cleanAddr = addr.replace(/\s+/g, ' ').trim()
const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddr)}&limit=1&countrycodes=ph&accept-language=en`
      console.log('Fetching:', url)
      const geocode = (query) =>
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=ph&accept-language=en`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'SkillConnect/1.0' }
  }).then(r => r.json())

geocode(cleanAddr)
  .then(data => {
    if (data?.[0]) return data
    // fallback: try just the city portion (last 2 comma-parts)
    const parts = cleanAddr.split(',')
    const fallback = parts.slice(-2).join(',').trim()
    console.log('Trying fallback:', fallback)
    return geocode(fallback)
  })
  .then(data => {
    console.log('Final result:', data)
    if (data?.[0]) setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
  })
  .catch(err => console.error('Geocode error:', err))
  .finally(() => setMapLoading(false))
    } else {
      console.warn('No address found on job order:', jo)
    }
  }}
  className="px-3 py-1 text-xs bg-white border border-slate-200 text-slate-600 rounded font-medium hover:bg-slate-50 transition-colors">
  View
</button>
<button
  onClick={async e => {
  e.stopPropagation()
  setProgressVal(pct)
  setProgressJob(jo)
  setProgressPhotos([])
  try {
    const token = JSON.parse(localStorage.getItem('sc_user'))?.token
    const res = await fetch(`http://localhost/skillconnect/backend/api/job-orders/get-progress.php?job_order_id=${jo.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.success) setProgressPhotos(data.photos || [])
  } catch (err) { console.error('Failed to load photos:', err) }
}}
  className="px-3 py-1 text-xs bg-emerald-500 text-white rounded font-medium hover:bg-emerald-600 transition-colors">
  Update Progress
</button>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex items-start gap-1.5 min-w-0 flex-1">
                    <MapPin size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400">Location</p>
                      <p className="text-xs font-medium text-slate-700 break-words">{jo.client_address || jo.location || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 flex-shrink-0">
                    <Clock size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Start Time</p>
                      <p className="text-xs font-medium text-slate-700">{jo.start_date || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 flex-shrink-0">
                    <Clock size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400">Completion</p>
                      <p className="text-xs font-medium text-slate-700">{jo.end_date || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Progress removed */}
              </div>
            )
          })}

              {/* Pagination */}
              {totalJobPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-400">
                    Showing {(jobPage - 1) * JOB_PER_PAGE + 1}–{Math.min(jobPage * JOB_PER_PAGE, jobs.length)} of {jobs.length} jobs
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setJobPage(p => Math.max(1, p - 1))}
                      disabled={jobPage === 1}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={13} className="rotate-180" />
                    </button>
                    {Array.from({ length: totalJobPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setJobPage(p)}
                        className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-medium transition-colors
                          ${jobPage === p
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setJobPage(p => Math.min(totalJobPages, p + 1))}
                      disabled={jobPage === totalJobPages}
                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
              </>
            )
          })()}
        </div>
      )}

      {/* ── View Job Order Modal ── */}
      {viewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{viewJob.job_order_code}</h2>
                <p className="text-sm text-slate-400">{viewJob.contract_type || 'Construction Project'}</p>
              </div>
              <button onClick={() => setViewJob(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Left: details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <ClipboardList size={14} className="text-emerald-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Project Details</span>
                </div>

                {[
                  { label: 'Customer',   value: viewJob.client_name   },
                  { label: 'Location',   value: viewJob.client_address || viewJob.location },
                  { label: 'Start Date', value: viewJob.start_date    },
                  { label: 'Completion', value: viewJob.end_date      },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
                  </div>
                ))}

                {/* Progress removed */}
              </div>

              {/* Right: map via geocode */}
              <div className="rounded-lg overflow-hidden border border-slate-200 min-h-[200px] flex flex-col">
                {mapLoading ? (
                  <div className="bg-slate-100 flex flex-col items-center justify-center h-[220px] gap-2">
                    <RefreshCw size={18} className="animate-spin text-emerald-500" />
                    <p className="text-xs text-slate-400">Loading map...</p>
                  </div>
                ) : mapCoords ? (
                  <iframe
                    key={`map-${mapCoords.lat}-${mapCoords.lng}`}
                    title="job-location-map"
                    width="100%"
                    height="100%"
                    style={{ border: 'none', minHeight: '100%', flex: 1 }}
                    srcDoc={`<!DOCTYPE html><html><head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head><body><div id="map"></div><script>
  var map = L.map('map', {
    center: [${mapCoords.lat}, ${mapCoords.lng}],
    zoom: 15,
    minZoom: 12,
    maxZoom: 18,
    maxBounds: [[14.35, 120.85],[14.78, 121.20]],
    maxBoundsViscosity: 1.0
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  L.marker([${mapCoords.lat}, ${mapCoords.lng}]).addTo(map)
    .bindPopup('<b>${viewJob.client_name || 'Job Location'}</b><br>${viewJob.client_address || viewJob.location || ''}').openPopup();
</script></body></html>`}
                  />
                ) : (
                  <div className="bg-slate-100 flex flex-col items-center justify-center h-[220px]">
                    <MapPin size={28} className="mb-2 text-slate-300" />
                    <p className="text-xs text-slate-400">{viewJob.client_address || viewJob.location || 'No location set'}</p>
                    <p className="text-[10px] text-slate-300 mt-1">No address to map</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Update Progress Modal ── */}
      {progressJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{progressJob.job_order_code}</h2>
                <p className="text-sm text-slate-400">{progressJob.contract_type || 'Construction Project'}</p>
              </div>
              <button onClick={() => setProgressJob(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Info */}
              {[
                { label: 'Customer', value: progressJob.client_name },
                { label: 'Location', value: progressJob.client_address || progressJob.location },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
                </div>
              ))}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Start Date',  value: progressJob.start_date },
                  { label: 'Completion',  value: progressJob.end_date   },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
                  </div>
                ))}
              </div>

              
              {/* Photo Upload */}
<div>
  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Progress Photo</p>
  {(() => {
    const today = new Date().toISOString().slice(0, 10)
    const start = progressJob.start_date?.slice(0, 10)
    const end   = progressJob.end_date?.slice(0, 10)
    const withinRange = start && end && today >= start && today <= end
    const alreadyUploaded = progressJob._photoDate === today && progressJob._photo
    const blocked = !withinRange || alreadyUploaded
    return (
      <>
        {!withinRange && (
          <p className="text-[10px] text-red-400 mb-1">Uploads only allowed between {start} and {end}.</p>
        )}
        {/* {withinRange && alreadyUploaded && (
          <p className="text-[10px] text-amber-400 mb-1">You've already uploaded a photo today.</p>
        )} */}
  <div
    onDragOver={e => { if (!blocked) e.preventDefault() }}
    onDrop={e => {
      e.preventDefault()
      if (blocked) return
      const f = e.dataTransfer.files[0]
      if (f) {
        if (!f.type.startsWith('image/')) {
          setPhotoError('Only image files (JPG, PNG) are allowed.')
          return
        }
        if (f.size > 50 * 1024 * 1024) {
          setPhotoError(`Photo must be under 50MB. Your file is ${(f.size / 1024 / 1024).toFixed(2)}MB.`)
          return
        }
        setPhotoError(null)
        setProgressJob(prev => ({ ...prev, _photo: f, _photoDate: today, status: 'In Progress' }))
      }
    }}
    onClick={() => { if (!blocked) document.getElementById('progress-photo-input').click() }}
    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${blocked ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 cursor-pointer'}`}>
    <input
      id="progress-photo-input"
      type="file"
      className="hidden"
      accept=".jpg,.jpeg,.png"
      onChange={e => {
        const f = e.target.files[0] || null
        const today = new Date().toISOString().slice(0, 10)
        if (f) {
          if (!f.type.startsWith('image/')) {
            setPhotoError('Only image files (JPG, PNG) are allowed.')
            e.target.value = ''
            return
          }
          if (f.size > 50 * 1024 * 1024) {
            setPhotoError(`Photo must be under 50MB. Your file is ${(f.size / 1024 / 1024).toFixed(2)}MB.`)
            e.target.value = ''
            return
          }
          setPhotoError(null)
          setProgressJob(prev => ({ ...prev, _photo: f, _photoDate: today, status: 'In Progress' }))
        }
      }}
    />
    {progressJob._photo ? (
      <div className="flex items-center justify-center gap-2">
        <FileText size={14} className="text-emerald-500" />
        <span className="text-sm text-slate-600 truncate max-w-[200px]">{progressJob._photo.name}</span>
        <button
          onClick={e => { e.stopPropagation(); setProgressJob(prev => ({ ...prev, _photo: null })) }}
          className="text-slate-400 hover:text-red-500">
          <X size={13} />
        </button>
      </div>
    ) : (
      <>
        <Upload size={20} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">Drop file or <span className="text-emerald-600 font-medium">browse</span></p>
        <p className="text-xs text-slate-300 mt-1">JPG, PNG</p>
      </>
    )}
  </div>
      </>
    )
  })()}
</div>

{/* Uploaded Photos */}
{progressPhotos.length > 0 && (
  <div>
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Uploaded Progress Photos</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
      {progressPhotos.map(photo => (
        <div
          key={photo.id}
          className="relative group rounded-lg overflow-hidden border border-slate-200 cursor-pointer"
          onClick={() => window.open(`http://localhost/skillconnect/${photo.file_path}`, '_blank')}>
          <img
            src={`http://localhost/skillconnect/${photo.file_path}`}
            alt={`Progress ${photo.upload_date}`}
            className="w-full h-24 object-cover group-hover:opacity-80 transition-opacity"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <Eye size={20} className="text-white drop-shadow" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-0.5">
            <p className="text-[9px] text-white">{photo.upload_date}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{/* Photo Upload Input — add this wherever your file input lives */}
{photoError && (
  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
    <AlertCircle size={12} /> {photoError}
  </p>
)}

{/* Actions */}
<div className="flex gap-3 pt-2">
  <button onClick={() => { setProgressJob(null); setPhotoError(null) }}
    className="flex-1 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
    Close
  </button>
  <button
    onClick={async () => {
      try {
        const token = JSON.parse(localStorage.getItem('sc_user'))?.token


        // Upload photo if present
        if (progressJob._photo) {

          // ✅ 1MB size validation
          const MAX_SIZE_MB = 50
          const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
          if (progressJob._photo.size > MAX_SIZE_BYTES) {
            setPhotoError(`Photo must be under ${MAX_SIZE_MB}MB. Your file is ${(progressJob._photo.size / 1024 / 1024).toFixed(2)}MB.`)
            return
          }

          setPhotoError(null) // clear any previous error
          const formData = new FormData()
          formData.append('photo', progressJob._photo)
          formData.append('job_order_id', progressJob.id)
          formData.append('upload_date', new Date().toISOString().slice(0, 10))
          await fetch('http://localhost/skillconnect/backend/api/job-orders/upload-progress.php', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          })
        }

        // Refresh jobs list
        setJobs(prev => prev.map(j => j.id === progressJob.id ? { ...j, status: progressJob.status } : j))

        // Refresh photos for this job so progress bar updates immediately
        const photoRes = await fetch(`http://localhost/skillconnect/backend/api/job-orders/get-progress.php?job_order_id=${progressJob.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const photoData = await photoRes.json()
        if (photoData.success) {
          setJobPhotos(prev => ({ ...prev, [progressJob.id]: photoData.photos || [] }))
          setProgressPhotos(photoData.photos || [])
        }

        setProgressJob(null)
        alert('Progress saved!')
      } catch (err) {
        alert('Failed to save: ' + err.message)
      }
    }}
    className="flex-1 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">
    Save Progress
  </button>
</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}