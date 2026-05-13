import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { startOnboarding, resumeOnboarding, getProgress } from '@/api/onboard'
import type { ExecutionPlan, OnboardProgress, TaskStatus } from '@/types'

export const useOnboardStore = defineStore('onboard', () => {
  const plan = ref<ExecutionPlan | null>(null)
  const progress = ref<OnboardProgress | null>(null)
  const loading = ref(false)
  const executing = ref(false)
  const taskStatuses = ref<Record<string, TaskStatus>>({})

  const completedCount = computed(() => {
    if (!plan.value) return 0
    return Object.values(taskStatuses.value).filter((s) => s === 'COMPLETED').length
  })

  const totalCount = computed(() => plan.value?.tasks.length ?? 0)

  const progressPercent = computed(() => {
    if (totalCount.value === 0) return 0
    return Math.round((completedCount.value / totalCount.value) * 100)
  })

  async function start(goal: string) {
    loading.value = true
    try {
      const res = await startOnboarding({ goal })
      plan.value = res
      taskStatuses.value = {}
      res.tasks.forEach((t) => {
        taskStatuses.value[t.id] = t.status
      })
    } finally {
      loading.value = false
    }
  }

  async function resume() {
    loading.value = true
    try {
      const res = await resumeOnboarding()
      plan.value = res
      res.tasks.forEach((t) => {
        taskStatuses.value[t.id] = t.status
      })
    } finally {
      loading.value = false
    }
  }

  async function checkProgress() {
    try {
      progress.value = await getProgress()
    } catch {
      progress.value = null
    }
  }

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    taskStatuses.value[taskId] = status
    if (plan.value) {
      const task = plan.value.tasks.find((t) => t.id === taskId)
      if (task) task.status = status
    }
  }

  function updateTaskResult(taskId: string, result: string) {
    if (plan.value) {
      const task = plan.value.tasks.find((t) => t.id === taskId)
      if (task) task.result = result
    }
  }

  return {
    plan,
    progress,
    loading,
    executing,
    taskStatuses,
    completedCount,
    totalCount,
    progressPercent,
    start,
    resume,
    checkProgress,
    updateTaskStatus,
    updateTaskResult,
  }
})
