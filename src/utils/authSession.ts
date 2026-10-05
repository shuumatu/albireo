import { computed, reactive, ref } from 'vue'
import type { LoginResponse } from '../api/auth'

const keys = ['token', 'userId', 'username', 'role']
let currentToken = localStorage.getItem('token') || ''
export const authSession = reactive({
  isLoggedIn: Boolean(currentToken),
  userId: localStorage.getItem('userId') || '',
  username: localStorage.getItem('username') || '',
  role: currentToken ? localStorage.getItem('role') || '' : ''
})
// Discard cached pages and signed media links when the viewer changes.
export const gallerySessionRevision = ref(0)
export const isAdminPreview = computed(
  () => authSession.isLoggedIn && authSession.role === 'ADMIN'
)

export function syncAuthSession() {
  const token = localStorage.getItem('token') || ''
  const userId = token ? localStorage.getItem('userId') || '' : ''
  const role = token ? localStorage.getItem('role') || '' : ''
  if (currentToken !== token || authSession.userId !== userId || authSession.role !== role) {
    gallerySessionRevision.value++
  }
  currentToken = token
  Object.assign(authSession, {
    isLoggedIn: Boolean(token), userId, role,
    username: token ? localStorage.getItem('username') || '' : ''
  })
}

export function saveAuthSession(data: LoginResponse) {
  localStorage.setItem('userId', String(data.userId))
  localStorage.setItem('username', data.username)
  localStorage.setItem('role', data.role)
  localStorage.setItem('token', data.token)
  syncAuthSession()
}

export function clearAuthSession() {
  keys.forEach(key => localStorage.removeItem(key))
  syncAuthSession()
}

window.addEventListener('storage', event => {
  if (event.key === null || keys.includes(event.key)) syncAuthSession()
})
