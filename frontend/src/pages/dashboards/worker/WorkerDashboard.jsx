import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../../components/DashboardLayout'
import { AdminRoutes } from '../admin/AdminDashboard'
import { Sidebar, TopBar } from '../admin/AdminNavbar'
import { useAuth } from '../../../context/AuthContext'
import {
  ClipboardList, Calendar, User, ShieldCheck, LayoutDashboard, Inbox,
  Briefcase, CalendarClock, Contact, HardHat, BadgeCheck, Settings, Mail,
} from 'lucide-react'
import { apiGet } from '../../../utils/api'

// Admin pages that become a second tab of a worker page
import AdminHome     from '../admin/AdminHome'
import JobOrdersPage from '../admin/JobOrdersPage'
import SchedulesPage from '../admin/SchedulesPage'

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

// Worker with admin access: one menu. Pages that exist on both sides
// (Dashboard, Job Orders, Schedule) are one page with two tabs.
const MERGED_NAV_ITEMS = [
  { type: 'section', label: 'Workspace' },
  { path: '/worker/dashboard',       label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/worker/admin/inquiries', label: 'Inquiries',     icon: Inbox           },
  { path: '/worker/job-orders',      label: 'Job Orders',    icon: Briefcase       },
  { path: '/worker/schedules',       label: 'Schedule',      icon: CalendarClock   },
  { path: '/worker/inbox',           label: 'Inbox',         icon: Mail            },
  { type: 'section', label: 'People' },
  { path: '/worker/admin/contacts',  label: 'Contacts',      icon: Contact         },
  { path: '/worker/admin/workers',   label: 'Workers',       icon: HardHat         },
  { path: '/worker/admin/licenses',  label: 'Licenses',      icon: BadgeCheck      },
  { type: 'section', label: 'System' },
  { path: '/worker/admin/config',    label: 'Configuration', icon: Settings        },
  { path: '/worker/profile',         label: 'My profile',    icon: User, hidden: true },
]

const INBOX_POLL_MS = 60000

const scrollbarStyle = `
  .custom-scroll::-webkit-scrollbar { width: 6px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #d1fae5; border-radius: 999px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #6ee7b7; }
`

// ── Sidebar layout (worker with admin access) ──────────────────
function WorkerAdminLayout({ items, children }) {
  const [collapsed,  setCollapsed]  = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{scrollbarStyle}</style>
      <Sidebar items={items} collapsed={collapsed} onToggle={() => setCollapsed(p => !p)}
        mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar items={items} rootLabel="SkillConnect" onMenuToggle={() => setMobileOpen(p => !p)}
          userMenu={{ roleLabel: 'Worker · Admin', profilePath: '/worker/profile', hideSwitch: true }} />
        <main className="flex-1 overflow-y-auto custom-scroll p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

// ── One page, two tabs (My … / All …). The tab is kept in the link (?view=all) ──
function TabbedPage({ tabs }) {
  const [params, setParams] = useSearchParams()
  const current = tabs.find(t => t.key === params.get('view')) || tabs[0]
  const pick = key => setParams(key === tabs[0].key ? {} : { view: key }, { replace: true })

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="View" className="inline-flex p-1 rounded-lg bg-slate-100">
        {tabs.map(t => {
          const on = t.key === current.key
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => pick(t.key)}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <t.icon size={15} strokeWidth={1.75} className={on ? 'text-emerald-600' : 'text-slate-400'} />
              {t.label}
            </button>
          )
        })}
      </div>
      <div key={current.key}>{current.element}</div>
    </div>
  )
}

// Old admin links (e.g. "Open in Job orders") land on the right tab and keep their highlight info
function ToTab({ to }) {
  const location = useLocation()
  return <Navigate to={to} replace state={location.state} />
}

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

  const onboarding = showOnboarding && (
    <OnboardingNotification onDismiss={handleDismiss} onGoToProfile={handleGoToProfile} />
  )

  // ── Worker only: same top menu as before ──
  if (!user?.has_admin_access) {
    return (
      <DashboardLayout navItems={navItems} title="Worker">
        {onboarding}
        <Routes>
          <Route path="dashboard"  element={<WorkerHome />}  />
          <Route path="job-orders" element={<MyJobOrders />} />
          <Route path="schedules"  element={<MySchedules />} />
          <Route path="inbox"      element={<WorkerInbox />} />
          <Route path="profile"    element={<MyProfile />}   />
          <Route path="*"          element={<WorkerHome />}  />
        </Routes>
      </DashboardLayout>
    )
  }

  // ── Worker with admin access: one sidebar, merged pages ──
  const mergedItems = MERGED_NAV_ITEMS.map(i => (i.path === '/worker/inbox' ? { ...i, badge: inboxCount } : i))

  return (
    <WorkerAdminLayout items={mergedItems}>
      {onboarding}
      <Routes>
        <Route path="dashboard" element={
          <TabbedPage tabs={[
            { key: 'mine', label: 'My work',  icon: HardHat,         element: <WorkerHome /> },
            { key: 'all',  label: 'Overview', icon: LayoutDashboard, element: <AdminHome /> },
          ]} />
        } />
        <Route path="job-orders" element={
          <TabbedPage tabs={[
            { key: 'mine', label: 'My jobs',        icon: HardHat,   element: <MyJobOrders /> },
            { key: 'all',  label: 'All job orders', icon: Briefcase, element: <JobOrdersPage /> },
          ]} />
        } />
        <Route path="schedules" element={
          <TabbedPage tabs={[
            { key: 'mine', label: 'My schedule',   icon: Calendar,      element: <MySchedules /> },
            { key: 'all',  label: 'All schedules', icon: CalendarClock, element: <SchedulesPage /> },
          ]} />
        } />
        <Route path="inbox"   element={<WorkerInbox />} />
        <Route path="profile" element={<MyProfile />}   />

        {/* Admin pages that now live in a tab */}
        <Route path="admin/dashboard"  element={<ToTab to="/worker/dashboard?view=all" />} />
        <Route path="admin/job-orders" element={<ToTab to="/worker/job-orders?view=all" />} />
        <Route path="admin/scheduling" element={<ToTab to="/worker/schedules?view=all" />} />
        {/* The other admin pages (Inquiries, Contacts, Workers, Licenses, Configuration) */}
        <Route path="admin/*" element={<AdminRoutes />} />

        <Route path="*" element={<Navigate to="/worker/dashboard" replace />} />
      </Routes>
    </WorkerAdminLayout>
  )
}