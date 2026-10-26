import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SuperAdminDashboard from './pages/dashboards/superadmin/SuperAdminDashboard'
import AdminDashboard from './pages/dashboards/admin/AdminDashboard'
import WorkerDashboard from './pages/dashboards/worker/WorkerDashboard'
import CustomerDashboard from './pages/dashboards/customer/CustomerDashboard' 
import ForgotPasswordPage from './pages/ForgotPasswordPage'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-steel-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="font-display text-slate-400 tracking-widest text-sm uppercase">Loading...</span>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  // Authenticated but wrong role for this route — send them to their
  // own dashboard instead of logging them out (handles role-switch races too).
  if (allowedRoles && !allowedRoles.includes(user.loginRole)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function RoleRouter() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.loginRole === 'super_admin') return <Navigate to="/superadmin/dashboard" replace />
  if (user.loginRole === 'admin') return <Navigate to="/admin/dashboard" replace />
  if (user.loginRole === 'worker') return <Navigate to="/worker/dashboard" replace />
  if (user.loginRole === 'client') return <Navigate to="/customer/dashboard" replace /> // ← add this
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><RoleRouter /></ProtectedRoute>} />
          <Route path="/superadmin/*" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/worker/*" element={
            <ProtectedRoute allowedRoles={['worker']}>
              <WorkerDashboard />
            </ProtectedRoute>
          } />
          {/* ← add this */}
          <Route path="/customer/*" element={
            <ProtectedRoute allowedRoles={['client']}>
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}