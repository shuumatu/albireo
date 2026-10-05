import axios from 'axios'
import { clearAuthSession } from './authSession'

const request = axios.create({
  withCredentials: true,
  baseURL: import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 10000
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 可加入 token
    const token = localStorage.getItem('token')
    if (token && !['/api/auth/login', '/api/auth/admin-login', '/api/auth/register'].includes(config.url || '')) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      const loginRequest = ['/api/auth/login', '/api/auth/admin-login'].includes(error.config?.url || '')
      const token = localStorage.getItem('token')
      const currentAuthorization = token ? `Bearer ${token}` : ''
      const requestAuthorization = error.config?.headers?.Authorization || ''
      if (!loginRequest && requestAuthorization === currentAuthorization) {
        clearAuthSession()
        const query = new URLSearchParams({ redirect: window.location.pathname + window.location.search })
        window.location.href = `/login?${query}`
      }
    }
    console.error('API error', error)
    return Promise.reject(error)
  }
)

export default request
