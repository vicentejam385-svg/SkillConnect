import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/DashboardLayout'
import { AdminRoutes, ADMIN_NAV_FOR_WORKER } from '../admin/AdminDashboard'
import { useAuth } from '../../../context/AuthContext'
import { ClipboardList, Calendar, User, ShieldCheck, LayoutDashboard } from 'lucide-react'
import { apiGet } from '../../../utils/api'

import WorkerHome from './WorkerHome'
import MyJobOrders from './MyJobOrders'
import MySchedules from './MySchedules'
import MyProfile from './MyProfile'

const NAV_ITEMS = [
  { type: 'section', label: 'My Work' },
  { path: '/worker/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/worker/job-orders', label: 'Job Orders',   icon: ClipboardList   },
  { path: '/worker/schedules',  label: 'Schedule',     icon: Calendar        },
]

// ── Onboarding Notification ────────────────────────────────────
function OnboardingNotification({ onDismiss, onGoToProfile }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-[#0f1923] border border-amber-500/40 rounded-sm">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500 rounded-t-sm" />
        {/* X button removed — user must go to profile */}
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 rounded-sm">
            <ShieldCheck size={22} className="text-amber-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-slate-100 tracking-wide mb-2">Welcome! Action Required</h3>
          <p className="font-body text-sm text-slate-400 mb-6 leading-relaxed">
            Your account is using a <span className="text-amber-400 font-semibold">default password</span>.
            Please update your credentials and upload your license to get started.
          </p>
          <div className="flex gap-3">
            <button onClick={onGoToProfile} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
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

        const workerContactId = worker?.contact_id
          || (worker?.contact_code ? parseInt(worker.contact_code.replace('C', ''), 10) : null)

        const lData = await apiGet('/api/licenses/list.php', { per_page: 50 }).catch(() => ({ licenses: [] }))
        const hasLicense = (lData.licenses || []).some(l =>
          workerContactId && String(l.contact_id) === String(workerContactId)
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
    <DashboardLayout navItems={NAV_ITEMS} adminNavItems={user?.has_admin_access ? ADMIN_NAV_FOR_WORKER : []} title="Worker">
      {showOnboarding && (
        <OnboardingNotification onDismiss={handleDismiss} onGoToProfile={handleGoToProfile} />
      )}
      <Routes>
        {user?.has_admin_access && <Route path="admin/*" element={<AdminRoutes />} />}
        <Route path="dashboard"  element={<WorkerHome />}    />
        <Route path="job-orders" element={<MyJobOrders />}   />
        <Route path="schedules"  element={<MySchedules />}   />
        <Route path="profile"    element={<MyProfile />}     />
        <Route path="*"          element={<WorkerHome />}    />
      </Routes>
    </DashboardLayout>
  )
}