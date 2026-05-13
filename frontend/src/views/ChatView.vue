<template>
  <div class="chat-view">
    <div class="chat-view__messages" ref="messagesRef">
      <div v-if="!messages.length" class="chat-view__empty">
        <el-icon :size="48" color="#c0c4cc"><ChatDotRound /></el-icon>
        <p>开始提问吧，我会从团队知识库中检索答案</p>
        <div class="chat-view__examples">
          <el-button
            v-for="example in examples"
            :key="example"
            text
            bg
            size="small"
            @click="inputText = example; sendMessage()"
          >
            {{ example }}
          </el-button>
        </div>
      </div>
      <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />
      <div v-if="streamingContent" class="chat-msg chat-msg--assistant">
        <div class="chat-msg__avatar">
          <el-icon :size="20"><Monitor /></el-icon>
        </div>
        <div class="chat-msg__body">
          <div class="chat-msg__content">
            <MarkdownRenderer :content="streamingContent" />
            <span class="typing-cursor" />
          </div>
        </div>
      </div>
      <div v-if="loading && !streamingContent" class="chat-view__loading">
        <el-icon class="spin" :size="20"><Loading /></el-icon>
        <span>正在检索知识库并生成回答...</span>
      </div>
    </div>
    <div class="chat-view__input">
      <el-input
        v-model="inputText"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 4 }"
        placeholder="输入你的问题，按 Enter 发送..."
        @keydown="handleKeydown"
        :disabled="loading"
        resize="none"
      />
      <el-button
        type="primary"
        :icon="Promotion"
        :loading="loading"
        :disabled="!inputText.trim()"
        @click="sendMessage"
        circle
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { ChatDotRound, Promotion, Monitor, Loading } from '@element-plus/icons-vue'
import ChatMessage from '@/components/ChatMessage.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { useChatStore } from '@/stores/chat'
import { useChat } from '@/composables/useChat'

const chatStore = useChatStore()
const { messages, loading, streamingContent } = storeToRefs(chatStore)
const { inputText, sendMessage, handleKeydown } = useChat()

const messagesRef = ref<HTMLElement>()
const examples = [
  '怎么本地启动后端服务？',
  '如何配置数据库连接池？',
  '项目的代码规范是什么？',
]

watch(messages, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}, { deep: true })

watch(streamingContent, () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
})
</script>

<style scoped>
.chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 900px;
  margin: 0 auto;
}
.chat-view__messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}
.chat-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #c0c4cc;
  gap: 12px;
}
.chat-view__empty p {
  font-size: 15px;
}
.chat-view__examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  justify-content: center;
}
.chat-view__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: #909399;
  font-size: 13px;
}
.chat-view__input {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 16px 0;
  border-top: 1px solid #ebeef5;
}
.chat-view__input .el-textarea {
  flex: 1;
}
/* Streaming cursor */
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: #409eff;
  margin-left: 2px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}

/* Chat message styles (duplicated for streaming) */
.chat-msg {
  display: flex;
  gap: 12px;
  padding: 16px 0;
}
.chat-msg--assistant .chat-msg__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #67c23a;
  color: white;
}
.chat-msg__body {
  max-width: 75%;
}
.chat-msg__content {
  padding: 12px 16px;
  border-radius: 12px;
  border-top-left-radius: 4px;
  background: #f4f4f5;
  color: #303133;
}
</style>
