import { Routes, Route } from 'react-router-dom'

import TopNav                from './CustomerNavbar'
import CustomerHome          from './CustomerHome'
import CustomerJobOrdersPage from './CustomerJobOrders'
import CustomerInquiriesPage from './CustomerInquiries'
import CustomerProfilePage   from './CustomerProfile'

// ── Main Layout ────────────────────────────────────────────────
export default function CustomerDashboard() {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <TopNav />
      <Routes>
        <Route path="dashboard"  element={<CustomerHome />}          />
        <Route path="job-orders" element={<CustomerJobOrdersPage />} />
        <Route path="inquiries"  element={<CustomerInquiriesPage />} />
        <Route path="profile"    element={<CustomerProfilePage />}   />
        <Route path="*"          element={<CustomerHome />}          />
      </Routes>
    </div>
  )
}