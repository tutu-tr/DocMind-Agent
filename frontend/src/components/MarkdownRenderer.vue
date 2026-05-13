<template>
  <div class="markdown-body" v-html="renderedHtml" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{ content: string }>()

const renderedHtml = computed(() => renderMarkdown(props.content))
</script>

<style scoped>
.markdown-body {
  font-size: 14px;
  line-height: 1.8;
  word-break: break-word;
}
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}
.markdown-body :deep(p) {
  margin: 8px 0;
}
.markdown-body :deep(code) {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f5f5f5;
  font-size: 13px;
}
.markdown-body :deep(pre.hljs) {
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
}
.markdown-body :deep(pre.hljs code) {
  background: none;
  padding: 0;
  font-size: 13px;
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 12px;
  color: #666;
  margin: 8px 0;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
}
.markdown-body :deep(th) {
  background: #fafafa;
}
</style>
