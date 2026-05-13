<template>
  <div class="task-progress">
    <div class="task-progress__header">
      <span class="task-progress__title">{{ title }}</span>
      <span class="task-progress__count">{{ completed }} / {{ total }}</span>
    </div>
    <el-progress
      :percentage="percent"
      :status="progressStatus"
      :stroke-width="10"
      striped
      :striped-flow="active"
    />
    <div class="task-progress__steps">
      <div
        v-for="step in steps"
        :key="step.id"
        class="task-progress__step"
        :class="[`task-progress__step--${step.status.toLowerCase()}`]"
      >
        <el-icon v-if="step.status === 'COMPLETED'" color="#67c23a" :size="16"><CircleCheck /></el-icon>
        <el-icon v-else-if="step.status === 'RUNNING'" color="#409eff" :size="16" class="spin"><Loading /></el-icon>
        <el-icon v-else-if="step.status === 'FAILED'" color="#f56c6c" :size="16"><CircleClose /></el-icon>
        <el-icon v-else :size="16" color="#c0c4cc"><Clock /></el-icon>
        <span class="task-progress__step-text">{{ step.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleClose, Loading, Clock } from '@element-plus/icons-vue'

const props = defineProps<{
  title: string
  completed: number
  total: number
  active?: boolean
  steps: Array<{ id: string; label: string; status: string }>
}>()

const percent = computed(() => {
  if (props.total === 0) return 0
  return Math.round((props.completed / props.total) * 100)
})

const progressStatus = computed(() => {
  if (props.steps.some((s) => s.status === 'FAILED')) return 'exception'
  if (props.completed === props.total && props.total > 0) return 'success'
  return undefined
})
</script>

<style scoped>
.task-progress {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: white;
}
.task-progress__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.task-progress__title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.task-progress__count {
  font-size: 13px;
  color: #909399;
}
.task-progress__steps {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-progress__step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.task-progress__step-text {
  color: #606266;
}
.task-progress__step--completed .task-progress__step-text {
  color: #67c23a;
}
.task-progress__step--running .task-progress__step-text {
  color: #409eff;
  font-weight: 500;
}
.task-progress__step--failed .task-progress__step-text {
  color: #f56c6c;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>
