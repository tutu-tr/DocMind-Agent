import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
      meta: { title: '知识问答' },
    },
    {
      path: '/maintain',
      name: 'maintain',
      component: () => import('@/views/MaintainView.vue'),
      meta: { title: '文档维护' },
    },
    {
      path: '/onboard',
      name: 'onboard',
      component: () => import('@/views/OnboardView.vue'),
      meta: { title: '新人引导' },
    },
    {
      path: '/faq',
      name: 'faq',
      component: () => import('@/views/FaqView.vue'),
      meta: { title: 'FAQ 管理' },
    },
  ],
})

router.beforeEach((to) => {
  document.title = `${to.meta.title || 'DocMind'} - DocMind-Agent`
})

export default router
