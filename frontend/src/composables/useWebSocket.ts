import { ref, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { WsMessage } from '@/types'

export function useWebSocket(url: string) {
  const appStore = useAppStore()
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 10

  const messageHandlers = ref<Array<(msg: WsMessage) => void>>([])

  function connect() {
    if (ws.value?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const fullUrl = `${protocol}//${window.location.host}${url}`
    ws.value = new WebSocket(fullUrl)

    ws.value.onopen = () => {
      connected.value = true
      appStore.wsConnected = true
      reconnectAttempts = 0
    }

    ws.value.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        messageHandlers.value.forEach((handler) => handler(msg))
      } catch {
        console.error('WebSocket message parse error:', event.data)
      }
    }

    ws.value.onclose = () => {
      connected.value = false
      appStore.wsConnected = false
      scheduleReconnect()
    }

    ws.value.onerror = () => {
      ws.value?.close()
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) return
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
    reconnectAttempts++
    reconnectTimer = setTimeout(connect, delay)
  }

  function send(data: unknown) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(data))
    }
  }

  function onMessage(handler: (msg: WsMessage) => void) {
    messageHandlers.value.push(handler)
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    ws.value?.close()
    ws.value = null
    connected.value = false
    appStore.wsConnected = false
  }

  onUnmounted(disconnect)

  return { ws, connected, connect, disconnect, send, onMessage }
}
