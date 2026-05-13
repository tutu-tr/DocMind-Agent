<template>
  <div class="task-card" :class="[`task-card--${task.status.toLowerCase()}`]">
    <div class="task-card__header">
      <div class="task-card__icon">
        <el-icon v-if="task.status === 'COMPLETED'" color="#67c23a"><CircleCheck /></el-icon>
        <el-icon v-else-if="task.status === 'RUNNING'" color="#409eff" class="spin"><Loading /></el-icon>
        <el-icon v-else-if="task.status === 'FAILED'" color="#f56c6c"><CircleClose /></el-icon>
        <el-icon v-else-if="task.status === 'SKIPPED'" color="#909399"><Remove /></el-icon>
        <el-icon v-else color="#c0c4cc"><Clock /></el-icon>
      </div>
      <div class="task-card__info">
        <div class="task-card__title">{{ task.description }}</div>
        <div class="task-card__meta">
          <el-tag size="small" :type="tagType">{{ task.type }}</el-tag>
          <span v-if="task.dependencies.length" class="task-card__deps">
            依赖: {{ task.dependencies.join(', ') }}
          </span>
        </div>
      </div>
    </div>
    <div v-if="task.result" class="task-card__result">
      <MarkdownRenderer :content="task.result" />
    </div>
    <div v-if="task.error" class="task-card__error">
      <el-icon><Warning /></el-icon>
      {{ task.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleClose, Loading, Remove, Clock, Warning } from '@element-plus/icons-vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import type { Task } from '@/types'

const props = defineProps<{ task: Task }>()

const tagType = computed(() => {
  const map: Record<string, string> = {
    READ_DOC: '',
    RUN_COMMAND: 'warning',
    SEARCH: 'info',
    WRITE: 'success',
    CUSTOM: 'danger',
  }
  return (map[props.task.type] || '') as any
})
</script>

<style scoped>
.task-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px 16px;
  background: white;
  transition: border-color 0.3s;
}
.task-card--completed {
  border-left: 4px solid #67c23a;
}
.task-card--running {
  border-left: 4px solid #409eff;
}
.task-card--failed {
  border-left: 4px solid #f56c6c;
}
.task-card--skipped {
  border-left: 4px solid #909399;
  opacity: 0.7;
}
.task-card__header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.task-card__icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}
.task-card__info {
  flex: 1;
  min-width: 0;
}
.task-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
}
.task-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-card__deps {
  font-size: 12px;
  color: #909399;
}
.task-card__result {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f0f9eb;
  border-radius: 6px;
  font-size: 13px;
}
.task-card__error {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fef0f0;
  border-radius: 6px;
  font-size: 13px;
  color: #f56c6c;
  display: flex;
  align-items: center;
  gap: 6px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>
