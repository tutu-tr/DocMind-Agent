import { defineStore } from 'pinia'
import { ref } from 'vue'
import { analyzeChanges, approveChanges } from '@/api/maintain'
import type { UpdateSuggestion, ChangeSummary } from '@/types'

export const useMaintainStore = defineStore('maintain', () => {
  const suggestions = ref<UpdateSuggestion[]>([])
  const changeSummaries = ref<ChangeSummary[]>([])
  const loading = ref(false)
  const approving = ref(false)

  async function analyze() {
    loading.value = true
    try {
      const res = await analyzeChanges()
      suggestions.value = res.suggestions
      changeSummaries.value = res.changeSummaries
    } finally {
      loading.value = false
    }
  }

  async function approve(ids: string[]) {
    if (!ids.length) return
    approving.value = true
    try {
      await approveChanges({ suggestionIds: ids, action: 'approve' })
      suggestions.value = suggestions.value.filter((s) => !ids.includes(s.id))
    } finally {
      approving.value = false
    }
  }

  async function reject(ids: string[], reasons: Record<string, string> = {}) {
    if (!ids.length) return
    approving.value = true
    try {
      await approveChanges({ suggestionIds: ids, action: 'reject', rejectReasons: reasons })
      suggestions.value = suggestions.value.filter((s) => !ids.includes(s.id))
    } finally {
      approving.value = false
    }
  }

  function approveLocal(id: string) {
    const s = suggestions.value.find((s) => s.id === id)
    if (s) s.status = 'approved'
  }

  function rejectLocal(id: string) {
    const s = suggestions.value.find((s) => s.id === id)
    if (s) s.status = 'rejected'
  }

  return {
    suggestions,
    changeSummaries,
    loading,
    approving,
    analyze,
    approve,
    reject,
    approveLocal,
    rejectLocal,
  }
})
