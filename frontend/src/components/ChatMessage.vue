<template>
  <div class="chat-msg" :class="[`chat-msg--${message.role}`]">
    <div class="chat-msg__avatar">
      <el-icon v-if="message.role === 'user'" :size="20"><User /></el-icon>
      <el-icon v-else :size="20"><Monitor /></el-icon>
    </div>
    <div class="chat-msg__body">
      <div class="chat-msg__content">
        <MarkdownRenderer v-if="message.role === 'assistant'" :content="message.content" />
        <span v-else>{{ message.content }}</span>
      </div>
      <div v-if="message.sources?.length" class="chat-msg__sources">
        <div class="chat-msg__sources-label">来源引用：</div>
        <div class="chat-msg__sources-list">
          <SourceReference v-for="(src, i) in message.sources" :key="i" :source="src" />
        </div>
      </div>
      <div class="chat-msg__time">{{ formatTime(message.timestamp) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Monitor } from '@element-plus/icons-vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import SourceReference from './SourceReference.vue'
import type { ChatMessage } from '@/types'
import { formatTime } from '@/utils/format'

defineProps<{ message: ChatMessage }>()
</script>

<style scoped>
.chat-msg {
  display: flex;
  gap: 12px;
  padding: 16px 0;
}
.chat-msg--user {
  flex-direction: row-reverse;
}
.chat-msg__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.chat-msg--user .chat-msg__avatar {
  background: #409eff;
  color: white;
}
.chat-msg--assistant .chat-msg__avatar {
  background: #67c23a;
  color: white;
}
.chat-msg__body {
  max-width: 75%;
  min-width: 0;
}
.chat-msg--user .chat-msg__body {
  text-align: right;
}
.chat-msg__content {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  font-size: 14px;
}
.chat-msg--user .chat-msg__content {
  background: #409eff;
  color: white;
  border-top-right-radius: 4px;
}
.chat-msg--assistant .chat-msg__content {
  background: #f4f4f5;
  color: #303133;
  border-top-left-radius: 4px;
}
.chat-msg__sources {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
.chat-msg__sources-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.chat-msg__sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chat-msg__time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}
</style>
