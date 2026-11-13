// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { apiGet, apiPost, BASE_URL } from '../utils/api'

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

    /** Merge changes into the current user and keep localStorage in sync (e.g. a new profile photo). */
  const updateUser = (patch) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('sc_user', JSON.stringify(next))
      return next
    })
  }

  // Workers: load their profile photo once per session if the login response did not include it
  useEffect(() => {
    if (!user || user.loginRole !== 'worker' || user.profile_photo !== undefined) return
    apiGet('/api/workers/list.php', { search: user.username || '', per_page: 20 })
      .then(d => {
        const me = (d.workers || []).find(w => String(w.id) === String(user.id))
        updateUser({ profile_photo: me?.profile_photo ?? null })
      })
      .catch(() => {})
  }, [user?.id, user?.loginRole, user?.profile_photo])
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
    <AuthContext.Provider value={{ user, login, logout, adminAccess, backToWorker, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}