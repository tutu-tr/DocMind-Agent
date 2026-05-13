<template>
  <div class="maintain-view">
    <div class="maintain-view__header">
      <div class="maintain-view__title">
        <el-icon :size="20"><Refresh /></el-icon>
        <h2>文档维护</h2>
      </div>
      <p class="maintain-view__desc">检测代码变更对文档的影响，生成更新建议</p>
    </div>

    <div class="maintain-view__actions">
      <el-button type="primary" :loading="loading" @click="analyze">
        <el-icon><Search /></el-icon>
        分析变更
      </el-button>
      <el-button
        v-if="pendingSuggestions.length"
        type="success"
        :loading="approving"
        @click="approveAll"
      >
        <el-icon><Check /></el-icon>
        全部确认
      </el-button>
      <el-button
        v-if="pendingSuggestions.length"
        type="danger"
        :loading="approving"
        @click="rejectAll"
      >
        <el-icon><Close /></el-icon>
        全部拒绝
      </el-button>
    </div>

    <div v-if="changeSummaries.length" class="maintain-view__summaries">
      <h3>检测到的代码变更</h3>
      <el-timeline>
        <el-timeline-item
          v-for="summary in changeSummaries"
          :key="summary.commitHash"
          :timestamp="summary.commitMessage"
          placement="top"
        >
          <el-card shadow="never">
            <div class="summary-item">
              <code class="summary-hash">{{ summary.commitHash.slice(0, 8) }}</code>
              <div v-if="summary.renames.length" class="summary-section">
                <span class="summary-label">重命名:</span>
                <el-tag v-for="r in summary.renames" :key="r.oldName" size="small" type="warning">
                  {{ r.oldName }} → {{ r.newName }}
                </el-tag>
              </div>
              <div v-if="summary.configChanges.length" class="summary-section">
                <span class="summary-label">配置变更:</span>
                <el-tag v-for="c in summary.configChanges" :key="c.key" size="small" :type="c.action === 'added' ? 'success' : 'danger'">
                  {{ c.key }} ({{ c.action }})
                </el-tag>
              </div>
              <div v-if="summary.apiChanges.length" class="summary-section">
                <span class="summary-label">API 变更:</span>
                <el-tag v-for="a in summary.apiChanges" :key="a.signature" size="small" type="info">
                  {{ a.signature }}
                </el-tag>
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <div v-if="suggestions.length" class="maintain-view__suggestions">
      <h3>文档更新建议 ({{ pendingSuggestions.length }} 条待处理)</h3>
      <DiffPreview
        v-for="s in suggestions"
        :key="s.id"
        :suggestion="s"
        @approve="handleApprove"
        @reject="handleReject"
      />
    </div>

    <el-empty v-if="!loading && !suggestions.length && analyzed" description="未检测到需要更新的文档" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Refresh, Search, Check, Close } from '@element-plus/icons-vue'
import DiffPreview from '@/components/DiffPreview.vue'
import { useMaintainStore } from '@/stores/maintain'

const maintainStore = useMaintainStore()
const { suggestions, changeSummaries, loading, approving } = storeToRefs(maintainStore)
const { analyze, approve, reject, approveLocal, rejectLocal } = maintainStore

const analyzed = ref(false)

const pendingSuggestions = computed(() =>
  suggestions.value.filter((s) => s.status === 'pending')
)

async function handleApprove(id: string) {
  approveLocal(id)
  await approve([id])
}

async function handleReject(id: string) {
  rejectLocal(id)
  await reject([id])
}

async function approveAll() {
  const ids = pendingSuggestions.value.map((s) => s.id)
  ids.forEach(approveLocal)
  await approve(ids)
}

async function rejectAll() {
  const ids = pendingSuggestions.value.map((s) => s.id)
  ids.forEach(rejectLocal)
  await reject(ids)
}

// Auto-analyze on mount
analyze().then(() => { analyzed.value = true })
</script>

<style scoped>
.maintain-view {
  max-width: 900px;
  margin: 0 auto;
}
.maintain-view__header {
  margin-bottom: 20px;
}
.maintain-view__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.maintain-view__title h2 {
  font-size: 20px;
  font-weight: 600;
}
.maintain-view__desc {
  color: #909399;
  font-size: 14px;
}
.maintain-view__actions {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
}
.maintain-view__summaries {
  margin-bottom: 24px;
}
.maintain-view__summaries h3,
.maintain-view__suggestions h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #303133;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-hash {
  font-size: 12px;
  color: #909399;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}
.summary-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.summary-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}
</style>
