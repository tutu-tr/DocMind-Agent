import request from './request'
import type { OnboardStartRequest, ExecutionPlan, OnboardProgress } from '@/types'

export function startOnboarding(data: OnboardStartRequest): Promise<ExecutionPlan> {
  return request.post('/onboard/start', data)
}

export function resumeOnboarding(): Promise<ExecutionPlan> {
  return request.post('/onboard/resume')
}

export function getProgress(): Promise<OnboardProgress | null> {
  return request.get('/onboard/progress')
}
