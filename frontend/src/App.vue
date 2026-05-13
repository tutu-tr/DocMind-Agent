<template>
  <el-config-provider :locale="zhCn">
    <div class="app-layout">
      <NotificationBar />
      <el-container class="app-container">
        <el-aside :width="sidebarCollapsed ? '64px' : '220px'" class="app-aside">
          <div class="app-aside__logo">
            <el-icon :size="24" color="#409eff"><DataBoard /></el-icon>
            <span v-show="!sidebarCollapsed" class="app-aside__title">DocMind</span>
          </div>
          <el-menu
            :default-active="currentRoute"
            :collapse="sidebarCollapsed"
            router
            class="app-aside__menu"
            background-color="#001529"
            text-color="#ffffffb3"
            active-text-color="#409eff"
          >
            <el-menu-item index="/">
              <el-icon><ChatDotRound /></el-icon>
              <template #title>知识问答</template>
            </el-menu-item>
            <el-menu-item index="/maintain">
              <el-icon><Refresh /></el-icon>
              <template #title>文档维护</template>
            </el-menu-item>
            <el-menu-item index="/onboard">
              <el-icon><Guide /></el-icon>
              <template #title>新人引导</template>
            </el-menu-item>
            <el-menu-item index="/faq">
              <el-icon><QuestionFilled /></el-icon>
              <template #title>FAQ 管理</template>
            </el-menu-item>
          </el-menu>
          <div class="app-aside__toggle" @click="toggleSidebar">
            <el-icon :size="18">
              <Expand v-if="sidebarCollapsed" />
              <Fold v-else />
            </el-icon>
          </div>
        </el-aside>
        <el-main class="app-main">
          <router-view v-slot="{ Component }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import {
  DataBoard, ChatDotRound, Refresh, Guide, QuestionFilled, Expand, Fold,
} from '@element-plus/icons-vue'
import NotificationBar from '@/components/NotificationBar.vue'

const route = useRoute()
const currentRoute = computed(() => route.path)
const sidebarCollapsed = ref(false)

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-container {
  flex: 1;
  overflow: hidden;
}
.app-aside {
  background: #001529;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
}
.app-aside__logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid #ffffff1a;
  flex-shrink: 0;
}
.app-aside__title {
  color: white;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}
.app-aside__menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}
.app-aside__menu:not(.el-menu--collapse) {
  width: 220px;
}
.app-aside__toggle {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffffb3;
  cursor: pointer;
  border-top: 1px solid #ffffff1a;
  flex-shrink: 0;
}
.app-aside__toggle:hover {
  color: white;
  background: #ffffff0a;
}
.app-main {
  background: #f5f7fa;
  overflow-y: auto;
  padding: 20px;
}
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
