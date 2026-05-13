<template>
  <div class="onboard-view">
    <div class="onboard-view__header">
      <div class="onboard-view__title">
        <el-icon :size="20"><Guide /></el-icon>
        <h2>新人引导</h2>
      </div>
      <p class="onboard-view__desc">输入目标，AI 将生成可执行的上手计划</p>
    </div>

    <!-- 恢复提示 -->
    <el-card v-if="progress && progress.status === 'in_progress'" class="onboard-view__resume" shadow="hover">
      <div class="resume-card">
        <el-icon :size="24" color="#e6a23c"><Warning /></el-icon>
        <div class="resume-card__info">
          <div class="resume-card__title">发现未完成的引导任务</div>
          <div class="resume-card__desc">{{ progress.taskDescription }}</div>
          <div class="resume-card__meta">
            已完成 {{ progress.detail.completedTasks.length }} 个任务，
            当前: {{ progress.detail.currentTask }}
          </div>
        </div>
        <el-button type="primary" @click="handleResume">继续上次任务</el-button>
      </div>
    </el-card>

    <!-- 目标输入 -->
    <div v-if="!plan" class="onboard-view__input">
      <el-input
        v-model="goalInput"
        placeholder="输入你的目标，例如：完成第一个功能模块开发"
        size="large"
        clearable
        @keydown.enter="handleStart"
      >
        <template #append>
          <el-button type="primary" :loading="loading" @click="handleStart">
            开始规划
          </el-button>
        </template>
      </el-input>
      <div class="onboard-view__presets">
        <span class="onboard-view__presets-label">快速开始：</span>
        <el-button
          v-for="preset in presets"
          :key="preset"
          text
          bg
          size="small"
          @click="goalInput = preset; handleStart()"
        >
          {{ preset }}
        </el-button>
      </div>
    </div>

    <!-- 任务计划 -->
    <div v-if="plan" class="onboard-view__plan">
      <div class="plan-header">
        <h3>执行计划</h3>
        <div class="plan-header__actions">
          <el-button v-if="!executing" type="primary" @click="handleExecute">
            <el-icon><VideoPlay /></el-icon>
            开始执行
          </el-button>
          <el-button v-if="!executing" @click="plan = null">
            重新规划
          </el-button>
        </div>
      </div>

      <TaskProgress
        :title="plan.goal"
        :completed="completedCount"
        :total="totalCount"
        :active="executing"
        :steps="progressSteps"
      />

      <div class="plan-batches">
        <div v-for="(batch, batchIdx) in plan.executionBatches" :key="batchIdx" class="plan-batch">
          <div class="plan-batch__label">
            批次 {{ batchIdx + 1 }}
            <el-tag v-if="batch.length > 1" size="small" type="info">并行</el-tag>
          </div>
          <div class="plan-batch__tasks">
            <TaskPlanCard v-for="task in batch" :key="task.id" :task="task" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Guide, Warning, VideoPlay } from '@element-plus/icons-vue'
import TaskPlanCard from '@/components/TaskPlanCard.vue'
import TaskProgress from '@/components/TaskProgress.vue'
import { useOnboardStore } from '@/stores/onboard'
import { useWebSocket } from '@/composables/useWebSocket'
import type { WsMessage } from '@/types'

const onboardStore = useOnboardStore()
const { plan, progress, loading, executing, taskStatuses, completedCount, totalCount } = storeToRefs(onboardStore)
const { start, resume, checkProgress, updateTaskStatus, updateTaskResult } = onboardStore

const goalInput = ref('')
const { connect, onMessage } = useWebSocket('/ws/chat')

const presets = [
  '阅读项目架构文档',
  '搭建开发环境',
  '运行测试用例',
]

const progressSteps = computed(() => {
  if (!plan.value) return []
  return plan.value.tasks.map((t) => ({
    id: t.id,
    label: t.description,
    status: taskStatuses.value[t.id] || t.status,
  }))
})

onMounted(() => {
  checkProgress()
})

async function handleStart() {
  if (!goalInput.value.trim() || loading.value) return
  await start(goalInput.value.trim())
}

async function handleResume() {
  await resume()
}

function handleExecute() {
  executing.value = true
  connect()

  onMessage((msg: WsMessage) => {
    if (msg.type === 'task_status') {
      updateTaskStatus(msg.payload.taskId, msg.payload.status)
      if (msg.payload.result) {
        updateTaskResult(msg.payload.taskId, msg.payload.result)
      }
    } else if (msg.type === 'complete') {
      executing.value = false
    } else if (msg.type === 'error') {
      executing.value = false
    }
  })
}
</script>

<style scoped>
.onboard-view {
  max-width: 900px;
  margin: 0 auto;
}
.onboard-view__header {
  margin-bottom: 20px;
}
.onboard-view__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.onboard-view__title h2 {
  font-size: 20px;
  font-weight: 600;
}
.onboard-view__desc {
  color: #909399;
  font-size: 14px;
}
.onboard-view__resume {
  margin-bottom: 20px;
}
.resume-card {
  display: flex;
  align-items: center;
  gap: 16px;
}
.resume-card__info {
  flex: 1;
}
.resume-card__title {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
}
.resume-card__desc {
  color: #606266;
  font-size: 14px;
}
.resume-card__meta {
  color: #909399;
  font-size: 13px;
  margin-top: 4px;
}
.onboard-view__input {
  margin-bottom: 24px;
}
.onboard-view__presets {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.onboard-view__presets-label {
  font-size: 13px;
  color: #909399;
}
.onboard-view__plan {
  margin-top: 8px;
}
.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.plan-header h3 {
  font-size: 16px;
  font-weight: 600;
}
.plan-header__actions {
  display: flex;
  gap: 8px;
}
.plan-batches {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.plan-batch__label {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.plan-batch__tasks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
