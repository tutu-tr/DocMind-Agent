import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiError } from '@/types'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const apiError: ApiError = error.response?.data || {
      code: 'UNKNOWN',
      message: error.message || '网络请求失败',
    }
    ElMessage.error(apiError.message)
    return Promise.reject(apiError)
  }
)

export default request
