import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const wsConnected = ref(false)
  const notifications = ref<Array<{ id: string; message: string; type: 'info' | 'warning' | 'error'; timestamp: string }>>([])
  const sidebarCollapsed = ref(false)

  function addNotification(message: string, type: 'info' | 'warning' | 'error' = 'info') {
    notifications.value.unshift({
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date().toISOString(),
    })
    if (notifications.value.length > 50) {
      notifications.value = notifications.value.slice(0, 50)
    }
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function clearNotifications() {
    notifications.value = []
  }

  return {
    wsConnected,
    notifications,
    sidebarCollapsed,
    addNotification,
    removeNotification,
    clearNotifications,
  }
})
