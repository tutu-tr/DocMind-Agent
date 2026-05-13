<template>
  <div class="diff-preview">
    <div class="diff-preview__header">
      <div class="diff-preview__file">
        <el-icon><Document /></el-icon>
        <span>{{ suggestion.file }}:{{ suggestion.line }}</span>
      </div>
      <div class="diff-preview__status">
        <el-tag v-if="suggestion.status === 'approved'" type="success" size="small">已确认</el-tag>
        <el-tag v-else-if="suggestion.status === 'rejected'" type="danger" size="small">已拒绝</el-tag>
        <el-tag v-else type="warning" size="small">待审批</el-tag>
      </div>
    </div>
    <div class="diff-preview__reason">{{ suggestion.reason }}</div>
    <div class="diff-preview__diff">
      <div class="diff-line diff-line--removed">
        <span class="diff-line__prefix">-</span>
        <code>{{ suggestion.oldText }}</code>
      </div>
      <div class="diff-line diff-line--added">
        <span class="diff-line__prefix">+</span>
        <code>{{ suggestion.newText }}</code>
      </div>
    </div>
    <div v-if="suggestion.status === 'pending'" class="diff-preview__actions">
      <el-button type="success" size="small" @click="$emit('approve', suggestion.id)">
        <el-icon><Check /></el-icon> 确认
      </el-button>
      <el-button type="danger" size="small" @click="$emit('reject', suggestion.id)">
        <el-icon><Close /></el-icon> 拒绝
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document, Check, Close } from '@element-plus/icons-vue'
import type { UpdateSuggestion } from '@/types'

defineProps<{ suggestion: UpdateSuggestion }>()
defineEmits<{
  approve: [id: string]
  reject: [id: string]
}>()
</script>

<style scoped>
.diff-preview {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background: white;
}
.diff-preview__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.diff-preview__file {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: monospace;
  font-size: 13px;
  color: #303133;
}
.diff-preview__reason {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}
.diff-preview__diff {
  background: #fafafa;
  border-radius: 6px;
  padding: 12px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.6;
}
.diff-line {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}
.diff-line--removed {
  background: #fef0f0;
  color: #f56c6c;
}
.diff-line--added {
  background: #f0f9eb;
  color: #67c23a;
}
.diff-line__prefix {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-weight: bold;
}
.diff-preview__actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>
