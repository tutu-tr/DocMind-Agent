import request from './request'
import type { IndexRequest, IndexStatus } from '@/types'

export function startIndex(data: IndexRequest): Promise<void> {
  return request.post('/index', data)
}

export function getIndexStatus(): Promise<IndexStatus> {
  return request.get('/index/status')
}
