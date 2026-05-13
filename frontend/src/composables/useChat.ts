import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSSE } from './useSSE'
import type { SourceReference } from '@/types'

export function useChat() {
  const chatStore = useChatStore()
  const { connect: connectSSE, disconnect: disconnectSSE } = useSSE()
  const inputText = ref('')

  async function sendMessage() {
    const query = inputText.value.trim()
    if (!query || chatStore.loading) return
    inputText.value = ''

    // Use SSE for streaming
    chatStore.addUserMessage(query)
    chatStore.loading = true
    chatStore.streamingContent = ''

    const params = new URLSearchParams({ query })
    if (chatStore.sessionId) params.set('sessionId', chatStore.sessionId)

    connectSSE(`/api/qa/stream?${params.toString()}`, {
      onMessage(data: string) {
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'token') {
            chatStore.updateStreamingMessage(chatStore.streamingContent + parsed.content)
          } else if (parsed.type === 'sources') {
            chatStore.finalizeStreamingMessage(parsed.sources as SourceReference[])
            chatStore.sessionId = parsed.sessionId || chatStore.sessionId
          } else if (parsed.type === 'done') {
            chatStore.finalizeStreamingMessage([])
            chatStore.loading = false
            disconnectSSE()
          }
        } catch {
          // raw text token
          chatStore.updateStreamingMessage(chatStore.streamingContent + data)
        }
      },
      onError() {
        if (chatStore.streamingContent) {
          chatStore.finalizeStreamingMessage([])
        }
        chatStore.loading = false
      },
      onOpen() {
        // connection established
      },
    })
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return {
    inputText,
    sendMessage,
    handleKeydown,
  }
}
