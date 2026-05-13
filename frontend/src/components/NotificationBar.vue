<template>
  <div v-if="notifications.length" class="notif-bar">
    <transition-group name="notif-fade" tag="div">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="notif-bar__item"
        :class="[`notif-bar__item--${notif.type}`]"
      >
        <el-icon v-if="notif.type === 'warning'" class="notif-bar__icon"><Warning /></el-icon>
        <el-icon v-else-if="notif.type === 'error'" class="notif-bar__icon"><CircleClose /></el-icon>
        <el-icon v-else class="notif-bar__icon"><InfoFilled /></el-icon>
        <span class="notif-bar__text">{{ notif.message }}</span>
        <el-icon class="notif-bar__close" @click="removeNotification(notif.id)"><Close /></el-icon>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Warning, CircleClose, InfoFilled, Close } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { notifications } = storeToRefs(appStore)
const { removeNotification } = appStore
</script>

<style scoped>
.notif-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}
.notif-bar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 13px;
}
.notif-bar__item--info {
  background: #ecf5ff;
  color: #409eff;
}
.notif-bar__item--warning {
  background: #fdf6ec;
  color: #e6a23c;
}
.notif-bar__item--error {
  background: #fef0f0;
  color: #f56c6c;
}
.notif-bar__icon {
  font-size: 16px;
  flex-shrink: 0;
}
.notif-bar__text {
  flex: 1;
}
.notif-bar__close {
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
}
.notif-bar__close:hover {
  opacity: 1;
}
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: all 0.3s ease;
}
.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
