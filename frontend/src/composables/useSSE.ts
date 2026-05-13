import { ref, onUnmounted } from 'vue'

export function useSSE() {
  const eventSource = ref<EventSource | null>(null)
  const connected = ref(false)
  const error = ref<string | null>(null)

  function connect(
    url: string,
    handlers: {
      onMessage?: (data: string) => void
      onError?: (err: Event) => void
      onOpen?: () => void
    }
  ) {
    disconnect()
    error.value = null

    eventSource.value = new EventSource(url)

    eventSource.value.onopen = () => {
      connected.value = true
      handlers.onOpen?.()
    }

    eventSource.value.onmessage = (event) => {
      handlers.onMessage?.(event.data)
    }

    eventSource.value.onerror = (event) => {
      connected.value = false
      error.value = 'SSE 连接错误'
      handlers.onError?.(event)
      disconnect()
    }
  }

  function disconnect() {
    eventSource.value?.close()
    eventSource.value = null
    connected.value = false
  }

  onUnmounted(disconnect)

  return { eventSource, connected, error, connect, disconnect }
}
