<template>
  <div class="faq-card" :class="{ 'faq-card--expanded': expanded }">
    <div class="faq-card__header" @click="expanded = !expanded">
      <div class="faq-card__question">
        <el-icon class="faq-card__icon"><QuestionFilled /></el-icon>
        <span>{{ faq.question }}</span>
      </div>
      <div class="faq-card__meta">
        <el-tag size="small" type="warning">频率: {{ faq.frequency }}</el-tag>
        <el-icon class="faq-card__arrow" :class="{ 'is-expanded': expanded }"><ArrowDown /></el-icon>
      </div>
    </div>
    <el-collapse-transition>
      <div v-show="expanded" class="faq-card__body">
        <div class="faq-card__answer">
          <MarkdownRenderer :content="faq.answer" />
        </div>
        <div v-if="faq.sources?.length" class="faq-card__sources">
          <div class="faq-card__sources-label">来源：</div>
          <div class="faq-card__sources-list">
            <SourceReference v-for="(src, i) in faq.sources" :key="i" :source="src" />
          </div>
        </div>
        <div class="faq-card__footer">
          <span class="faq-card__date">
            最后验证: {{ faq.lastVerified ? formatTime(faq.lastVerified) : '未验证' }}
          </span>
        </div>
      </div>
    </el-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { QuestionFilled, ArrowDown } from '@element-plus/icons-vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import SourceReference from './SourceReference.vue'
import type { FaqEntry } from '@/types'
import { formatTime } from '@/utils/format'

defineProps<{ faq: FaqEntry }>()
const expanded = ref(false)
</script>

<style scoped>
.faq-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: white;
  transition: box-shadow 0.3s;
}
.faq-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.faq-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  cursor: pointer;
  gap: 12px;
}
.faq-card__question {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  flex: 1;
  min-width: 0;
}
.faq-card__icon {
  color: #e6a23c;
  font-size: 18px;
  flex-shrink: 0;
}
.faq-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.faq-card__arrow {
  transition: transform 0.3s;
  color: #c0c4cc;
}
.faq-card__arrow.is-expanded {
  transform: rotate(180deg);
}
.faq-card__body {
  padding: 0 16px 16px;
  border-top: 1px solid #f0f0f0;
}
.faq-card__answer {
  margin-top: 12px;
}
.faq-card__sources {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
}
.faq-card__sources-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.faq-card__sources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.faq-card__footer {
  margin-top: 10px;
  font-size: 12px;
  color: #c0c4cc;
}
</style>
