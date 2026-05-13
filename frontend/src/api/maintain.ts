import request from './request'
import type { MaintainAnalyzeResponse, MaintainApproveRequest } from '@/types'

export function analyzeChanges(): Promise<MaintainAnalyzeResponse> {
  return request.post('/maintain/analyze')
}

export function approveChanges(data: MaintainApproveRequest): Promise<void> {
  return request.post('/maintain/approve', data)
}
