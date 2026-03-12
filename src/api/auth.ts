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
