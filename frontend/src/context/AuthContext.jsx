// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { apiPost, BASE_URL } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('sc_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setUser(parsed)
      } catch {
        localStorage.removeItem('sc_user')
      }
    }
    setLoading(false)
  }, [])

  /**
   * Unified login — one endpoint handles all roles.
   * Detection logic (done server-side):
   *   credential contains '@'  → client  (contacts table)
   *   credential is a username → super_admin / admin (users table)
   *   credential is a username → worker (workers table)  ← checked last
   */
  const login = async (credential, password) => {
    // Single unified endpoint — replaces both login.php and worker-login.php
    const data = await apiPost('/api/auth/login.php', {
      username: credential,
      password,
    })

    // Backend always returns { success, token, user: { ..., type: 'client'|'worker'|'admin'|'super_admin' } }
    if (!data?.success || !data?.token || !data?.user) {
      throw new Error(data?.error ?? 'Unexpected response from server.')
    }

    const loginRole = data.user.type  // 'client' | 'worker' | 'admin' | 'super_admin'

    const userData = {
      ...data.user,
      token:     data.token,
      loginRole,
    }

    localStorage.setItem('sc_user', JSON.stringify(userData))
    setUser(userData)

    return userData
  }
  /**
   * Swap the current worker session into their linked admin session.
   * Requires the worker's token to already be attached to outgoing requests
   * (handled by apiPost via Authorization header).
   */
    const adminAccess = async () => {
    const data = await apiPost('/api/auth/admin-access.php', {})

    if (!data?.success || !data?.token || !data?.user) {
      throw new Error(data?.error ?? 'Unable to switch to admin access.')
    }

    // Stash the current (worker) session so "Back to Worker" can restore it
    const currentWorkerSession = localStorage.getItem('sc_user')
    if (currentWorkerSession) {
      localStorage.setItem('sc_worker_session', currentWorkerSession)
    }

    const loginRole = data.user.type // 'admin' | 'super_admin'

    const userData = {
      ...data.user,
      token:     data.token,
      loginRole,
    }

    localStorage.setItem('sc_user', JSON.stringify(userData))
    setUser(userData)

    return userData
  }

  /**
   * Restore the worker session that was active before adminAccess() was called.
   * Returns the restored worker user object, or null if there's nothing to restore.
   */
  const backToWorker = () => {
    const stored = localStorage.getItem('sc_worker_session')
    if (!stored) return null

    let workerData
    try { workerData = JSON.parse(stored) } catch { return null }

    localStorage.setItem('sc_user', JSON.stringify(workerData))
    localStorage.removeItem('sc_worker_session')
    setUser(workerData)

    return workerData
  }

  const logout = () => {
    // Tell the server so the logout is recorded in the audit log
    let token = user?.token
    if (!token) {
      try { token = JSON.parse(localStorage.getItem('sc_user') || '{}').token } catch {}
    }
    if (token) {
      fetch(`${BASE_URL}/api/auth/logout.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
        keepalive: true,
      }).catch(() => {})
    }

    setUser(null)
    localStorage.removeItem('sc_user')
    localStorage.removeItem('sc_worker_session')
  }

     return (
    <AuthContext.Provider value={{ user, login, logout, adminAccess, backToWorker, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}