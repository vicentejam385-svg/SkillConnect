import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar, TopBar, NAV_ITEMS } from './AdminNavbar'

import AdminHome     from './AdminHome'
import ContactsPage  from './ContactsPage'
import WorkersPage   from './WorkersPage'
import LicensesPage  from './LicensesPage'
import InquiriesPage from './InquiriesPage'
import JobOrdersPage from './JobOrdersPage'
import SchedulesPage from './SchedulesPage'
import ConfigPage    from './ConfigPage'

// ── Global Scrollbar Style ─────────────────────────────────────
const scrollbarStyle = `
  .custom-scroll::-webkit-scrollbar { width: 6px; }
  .custom-scroll::-webkit-scrollbar-track { background: transparent; }
  .custom-scroll::-webkit-scrollbar-thumb { background: #d1fae5; border-radius: 999px; }
  .custom-scroll::-webkit-scrollbar-thumb:hover { background: #6ee7b7; }
`

// ── Layout Wrapper ─────────────────────────────────────────────
function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{scrollbarStyle}</style>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuToggle={() => setMobileOpen(p => !p)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Exports used by other files ────────────────────────────────
export const ADMIN_NAV_FOR_WORKER = NAV_ITEMS
  .filter(i => i.path)
  .map(i => ({ ...i, path: i.path.replace('/admin/', '/worker/admin/') }))

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="dashboard"  element={<AdminHome />}      />
      <Route path="contacts"   element={<ContactsPage />}   />
      <Route path="workers"    element={<WorkersPage />}    />
      <Route path="licenses"   element={<LicensesPage />}   />
      <Route path="inquiries"  element={<InquiriesPage />}  />
      <Route path="job-orders" element={<JobOrdersPage />}  />
      <Route path="scheduling" element={<SchedulesPage />}  />
      <Route path="config"     element={<ConfigPage />}     />
      <Route path="*"          element={<AdminHome />}      />
    </Routes>
  )
}

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <AdminRoutes />
    </AdminLayout>
  )
}