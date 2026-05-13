import request from './request'
import type { QaRequest, QaResponse } from '@/types'

export function sendQuestion(data: QaRequest): Promise<QaResponse> {
  return request.post('/qa', data)
}

export function sendQuestionStream(data: QaRequest): EventSource {
  const params = new URLSearchParams({ query: data.query })
  if (data.sessionId) params.set('sessionId', data.sessionId)
  return new EventSource(`/api/qa/stream?${params.toString()}`)
}
