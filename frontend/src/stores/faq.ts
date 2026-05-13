import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getFaqList, detectFaq } from '@/api/faq'
import type { FaqEntry } from '@/types'

export const useFaqStore = defineStore('faq', () => {
  const faqs = ref<FaqEntry[]>([])
  const total = ref(0)
  const loading = ref(false)
  const detecting = ref(false)
  const searchQuery = ref('')

  async function fetchList() {
    loading.value = true
    try {
      const res = await getFaqList()
      faqs.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function detect() {
    detecting.value = true
    try {
      await detectFaq()
      await fetchList()
    } finally {
      detecting.value = false
    }
  }

  const filteredFaqs = ref<FaqEntry[]>([])
  function filterByQuery(query: string) {
    searchQuery.value = query
    if (!query.trim()) {
      filteredFaqs.value = faqs.value
    } else {
      const q = query.toLowerCase()
      filteredFaqs.value = faqs.value.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      )
    }
  }

  return {
    faqs,
    total,
    loading,
    detecting,
    searchQuery,
    filteredFaqs,
    fetchList,
    detect,
    filterByQuery,
  }
})
