import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sendQuestion } from '@/api/qa'
import type { ChatMessage } from '@/types'
import { generateId } from '@/utils/format'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const sessionId = ref<string>('')
  const streamingContent = ref('')

  const lastAssistantMessage = computed(() => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i].role === 'assistant') return messages.value[i]
    }
    return null
  })

  function addUserMessage(content: string) {
    messages.value.push({
      id: generateId(),
      role: 'user',
      content,
      sources: [],
      timestamp: new Date().toISOString(),
    })
  }

  function addAssistantMessage(content: string, sources: ChatMessage['sources'] = []) {
    messages.value.push({
      id: generateId(),
      role: 'assistant',
      content,
      sources,
      timestamp: new Date().toISOString(),
    })
  }

  function updateStreamingMessage(content: string) {
    streamingContent.value = content
  }

  function finalizeStreamingMessage(sources: ChatMessage['sources'] = []) {
    if (streamingContent.value) {
      addAssistantMessage(streamingContent.value, sources)
      streamingContent.value = ''
    }
  }

  async function sendMessage(query: string) {
    if (!query.trim() || loading.value) return

    addUserMessage(query)
    loading.value = true

    try {
      const res = await sendQuestion({ query, sessionId: sessionId.value || undefined })
      sessionId.value = res.sessionId
      addAssistantMessage(res.answer, res.sources)
    } catch {
      addAssistantMessage('抱歉，处理您的问题时出现了错误，请稍后重试。', [])
    } finally {
      loading.value = false
    }
  }

  function clearMessages() {
    messages.value = []
    streamingContent.value = ''
  }

  return {
    messages,
    loading,
    sessionId,
    streamingContent,
    lastAssistantMessage,
    addUserMessage,
    addAssistantMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    sendMessage,
    clearMessages,
  }
})
