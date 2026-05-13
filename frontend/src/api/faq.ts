import request from './request'
import type { FaqEntry, FaqDetectResponse, PageResult } from '@/types'

export function getFaqList(): Promise<PageResult<FaqEntry>> {
  return request.get('/faq')
}

export function getFaqDetail(id: string): Promise<FaqEntry> {
  return request.get(`/faq/${id}`)
}

export function detectFaq(): Promise<FaqDetectResponse> {
  return request.post('/faq/detect')
}
