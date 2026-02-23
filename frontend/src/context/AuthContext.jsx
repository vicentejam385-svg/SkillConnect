import { createContext, useContext, useState, useEffect } from 'react'
import { apiPost } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  const stored = localStorage.getItem('sc_user')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      console.log('Restored user:', parsed) // ← ADD THIS
      setUser(parsed)
    } catch {
      localStorage.removeItem('sc_user')
    }
  }
  setLoading(false)
}, [])

  const login = async (username, password, role) => {
  const endpoint = role === 'worker'
    ? '/api/auth/worker-login.php'
    : '/api/auth/login.php'
  const data = await apiPost(endpoint, { username, password, role })
  const userData = { ...data.user, token: data.token, loginRole: data.user.type }
  
  // Save to localStorage FIRST before anything else
  localStorage.setItem('sc_user', JSON.stringify(userData))
  setUser(userData)
  
  return userData
}
  const logout = () => {
    setUser(null)
    localStorage.removeItem('sc_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}