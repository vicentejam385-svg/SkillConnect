import { Routes, Route } from 'react-router-dom'

import TopNav                from './CustomerNavbar'
import CustomerHome          from './CustomerHome'
import CustomerJobOrdersPage from './CustomerJobOrders'
import CustomerInquiriesPage from './CustomerInquiries'
import CustomerProfilePage   from './CustomerProfile'
import { cxStyles }          from './CustomerUI'

// ── Main Layout ────────────────────────────────────────────────
export default function CustomerDashboard() {
  return (
    <div className="min-h-screen bg-slate-50">
      <style>{cxStyles}</style>
      <TopNav />
      <main className="cx-page max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-10">
        <Routes>
          <Route path="dashboard"  element={<CustomerHome />}          />
          <Route path="job-orders" element={<CustomerJobOrdersPage />} />
          <Route path="inquiries"  element={<CustomerInquiriesPage />} />
          <Route path="profile"    element={<CustomerProfilePage />}   />
          <Route path="*"          element={<CustomerHome />}          />
        </Routes>
      </main>
    </div>
  )
}