import request from '../utils/request'

export interface LoginResponse {
  token: string
  userId: number
  username: string
  role: string
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request.post('/api/auth/login', { username, password })
}

export function register(username: string, password: string): Promise<void> {
  return request.post('/api/auth/register', { username, password })
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return request.post('/api/auth/change-password', { oldPassword, newPassword })
}

export async function logout(all = false): Promise<void> {
  try { await request.post(all ? "/api/auth/logout-all" : "/api/auth/logout") }
  catch (e: any) { if (e?.response?.status !== 401) throw e }
}
