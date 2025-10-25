import axios from 'axios'

const request = axios.create({
  baseURL: 'http://localhost:8080', // 后端服务器地址
  timeout: 10000
})

// 请求拦截器
request.interceptors.request.use(config => {
  // 可加入 token
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => Promise.reject(error))

// 响应拦截器
request.interceptors.response.use(response => {
  return response.data
}, error => {
  console.error('API error', error)
  return Promise.reject(error)
})

export default request
