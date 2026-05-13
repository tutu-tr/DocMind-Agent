<template>
  <div class="faq-view">
    <div class="faq-view__header">
      <div class="faq-view__title">
        <el-icon :size="20"><QuestionFilled /></el-icon>
        <h2>FAQ 管理</h2>
      </div>
      <p class="faq-view__desc">高频问题自动沉淀为 FAQ，减少重复问答</p>
    </div>

    <div class="faq-view__actions">
      <el-button type="primary" :loading="detecting" @click="detect">
        <el-icon><MagicStick /></el-icon>
        检测高频问题
      </el-button>
      <el-input
        v-model="searchText"
        placeholder="搜索 FAQ..."
        clearable
        style="width: 300px"
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <div class="faq-view__stats" v-if="faqs.length">
      <el-statistic title="FAQ 总数" :value="total" />
      <el-statistic title="高频问题" :value="highFreqCount" />
      <el-statistic title="最近 30 天验证" :value="recentVerifiedCount" />
    </div>

    <div v-if="displayFaqs.length" class="faq-view__list">
      <FaqCard v-for="faq in displayFaqs" :key="faq.id" :faq="faq" />
    </div>

    <el-empty v-else-if="!loading" description="暂无 FAQ，点击「检测高频问题」生成" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { QuestionFilled, MagicStick, Search } from '@element-plus/icons-vue'
import FaqCard from '@/components/FaqCard.vue'
import { useFaqStore } from '@/stores/faq'

const faqStore = useFaqStore()
const { faqs, total, loading, detecting } = storeToRefs(faqStore)
const { fetchList, detect, filterByQuery } = faqStore

const searchText = ref('')

const displayFaqs = computed(() => {
  if (searchText.value.trim()) {
    return faqStore.filteredFaqs
  }
  return faqs.value
})

const highFreqCount = computed(() =>
  faqs.value.filter((f) => f.frequency >= 5).length
)

const recentVerifiedCount = computed(() => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  return faqs.value.filter((f) => f.lastVerified && new Date(f.lastVerified).getTime() > thirtyDaysAgo).length
})

function handleSearch(val: string) {
  filterByQuery(val)
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.faq-view {
  max-width: 900px;
  margin: 0 auto;
}
.faq-view__header {
  margin-bottom: 20px;
}
.faq-view__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.faq-view__title h2 {
  font-size: 20px;
  font-weight: 600;
}
.faq-view__desc {
  color: #909399;
  font-size: 14px;
}
.faq-view__actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}
.faq-view__stats {
  display: flex;
  gap: 40px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
.faq-view__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
