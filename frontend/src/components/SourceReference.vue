<template>
  <div class="source-ref" @click="handleClick">
    <el-icon class="source-ref__icon"><Document /></el-icon>
    <span class="source-ref__path">{{ source.filePath }}</span>
    <span class="source-ref__line">:{{ source.line }}</span>
    <el-tag size="small" type="info" class="source-ref__type">{{ source.chunkType }}</el-tag>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import type { SourceReference } from '@/types'

defineProps<{ source: SourceReference }>()

function handleClick() {
  // Could open file in editor or show detail
}
</script>

<style scoped>
.source-ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #f0f7ff;
  border: 1px solid #d0e3ff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.source-ref:hover {
  background: #e0efff;
}
.source-ref__icon {
  color: #409eff;
  font-size: 14px;
}
.source-ref__path {
  color: #303133;
  font-family: monospace;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.source-ref__line {
  color: #909399;
  font-family: monospace;
}
.source-ref__type {
  margin-left: 2px;
}
</style>
