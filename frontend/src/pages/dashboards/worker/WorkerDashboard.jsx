import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/DashboardLayout'
import { AdminRoutes, ADMIN_NAV_FOR_WORKER } from '../admin/AdminDashboard'
import { useAuth } from '../../../context/AuthContext'
import { ClipboardList, Calendar, User, ShieldCheck, LayoutDashboard, Inbox } from 'lucide-react'
import { apiGet } from '../../../utils/api'

import WorkerHome from './WorkerHome'
import MyJobOrders from './MyJobOrders'
import MySchedules from './MySchedules'
import MyProfile from './MyProfile'
import WorkerInbox from './WorkerInbox'

const NAV_ITEMS = [
  { type: 'section', label: 'My Work' },
  { path: '/worker/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/worker/job-orders', label: 'Job Orders',   icon: ClipboardList   },
  { path: '/worker/schedules',  label: 'Schedule',     icon: Calendar        },
  { path: '/worker/inbox',      label: 'Inbox',        icon: Inbox           },
]

const INBOX_POLL_MS = 60000

// ── Onboarding Notification ────────────────────────────────────
function OnboardingNotification({ onDismiss, onGoToProfile }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
        {/* X button removed — user must go to profile */}
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-emerald-50 flex items-center justify-center mx-auto mb-4 rounded-full">
            <ShieldCheck size={22} className="text-emerald-600" />
          </div>
          <h3 className="font-bold text-lg text-slate-800 mb-2">Welcome! Action Required</h3>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Your account is using a <span className="text-emerald-600 font-semibold">default password</span>.
            Please update your credentials and upload your license to get started.
          </p>
          <div className="flex gap-3">
            <button onClick={onGoToProfile} className="w-full px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              <User size={14} /> Go to Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ROOT ───────────────────────────────────────────────────────
export default function WorkerDashboard() {
  const { user }         = useAuth()
  const navigate         = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [inboxCount,     setInboxCount]     = useState(0)

  // Unread Inbox messages (job offers and assignments) for the menu badge
  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const res = await apiGet('/api/inbox/list.php', { summary: 1 })
        if (alive && res?.success !== false) setInboxCount(Number(res?.unread || 0))
      } catch { /* keep the last count */ }
    }
    check()
    const id = setInterval(check, INBOX_POLL_MS)
    const onChange = () => check()
    const onFocus  = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('sc-inbox-changed', onChange)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('sc-inbox-changed', onChange)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])

  const navItems = NAV_ITEMS.map(i => (i.path === '/worker/inbox' ? { ...i, badge: inboxCount } : i))

  useEffect(() => {
    const onboarded = localStorage.getItem(`onboarded_${user?.id}`)
    if (onboarded) return

    // Check if worker already has complete profile — if so, auto-dismiss
    const checkOnboarding = async () => {
      try {
        const wData = await apiGet('/api/workers/list.php')
        const worker = (wData.workers || []).find(w =>
          String(w.id) === String(user?.id) ||
          String(w.user_id) === String(user?.id)
        )
        if (!worker) return

        const hasAddress = !!(worker.address && worker.address.trim())

        // Licenses belong to the worker's user id
        const lData = await apiGet('/api/licenses/list.php', { per_page: 500 }).catch(() => ({ licenses: [] }))
        const hasLicense = (lData.licenses || []).some(l =>
          String(l.user_id ?? l.contact_id) === String(worker.id)
        )

        // If they already have address + license, consider them onboarded
        if (hasAddress && hasLicense) {
          localStorage.setItem(`onboarded_${user?.id}`, '1')
          return
        }

        setShowOnboarding(true)
      } catch {
        // silent — don't show onboarding on error
      }
    }
    checkOnboarding()
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(`onboarded_${user?.id}`, '1')
    setShowOnboarding(false)
  }

  const handleGoToProfile = () => {
    localStorage.setItem(`onboarded_${user?.id}`, '1')
    setShowOnboarding(false)
    navigate('/worker/profile', { state: { autoEdit: true } })
  }

  return (
    <DashboardLayout navItems={navItems} adminNavItems={user?.has_admin_access ? ADMIN_NAV_FOR_WORKER : []} title="Worker">
      {showOnboarding && (
        <OnboardingNotification onDismiss={handleDismiss} onGoToProfile={handleGoToProfile} />
      )}
      <Routes>
        {user?.has_admin_access && <Route path="admin/*" element={<AdminRoutes />} />}
        <Route path="dashboard"  element={<WorkerHome />}    />
        <Route path="job-orders" element={<MyJobOrders />}   />
        <Route path="schedules"  element={<MySchedules />}   />
        <Route path="inbox"      element={<WorkerInbox />}   />
        <Route path="profile"    element={<MyProfile />}     />
        <Route path="*"          element={<WorkerHome />}    />
      </Routes>
    </DashboardLayout>
  )
}