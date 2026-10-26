import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost/skillconnect/backend'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('sc_user')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      const token = parsed.token  // ← use dot notation, not destructuring
      if (token) config.headers.Authorization = `Bearer ${token}`
    } catch {}
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      const url = err.config?.url || ''
      // Don't redirect if it's the login endpoint itself
      if (!url.includes('/auth/login.php') && !url.includes('/auth/logout.php') && !url.includes('/auth/change-password.php')) {
        localStorage.removeItem('sc_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)
export const apiGet = async (url, params = {}) => {
  const res = await api.get(url, { params })
  return res.data
}

export const apiPost = async (url, body = {}) => {
  const res = await api.post(url, body)
  return res.data
}

export const apiPut = async (url, body = {}) => {
  const res = await api.put(url, body)
  return res.data
}

export const apiDelete = async (url) => {
  const res = await api.delete(url)
  return res.data
}

export default api