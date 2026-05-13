# DocMind-Agent

智能知识传承 Agent，帮助企业技术团队解决新人上手成本高、知识散落与腐烂、重复问答消耗人力等痛点。

## 核心能力

- **RAG 知识问答** — 从索引的文档和代码库中给出带来源引用的准确回答
- **ReAct 文档维护** — 代码变更后自动检测文档同步状态，生成更新建议
- **Plan-and-Execute 新人引导** — 复合任务拆解为可执行步骤，支持跨会话恢复
- **Memory + FAQ 正循环** — 高频问题自动沉淀为 FAQ，形成知识闭环

## 技术栈

**前端**

- Vue 3 + TypeScript + Vite
- Element Plus
- Pinia + Vue Router
- Markdown-it + Highlight.js

## 快速开始

```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
DocMind-Agent/
├── frontend/          # 前端项目
│   ├── src/
│   │   ├── api/       # 接口层
│   │   ├── components/# 通用组件
│   │   ├── composables/# 组合式函数
│   │   ├── stores/    # Pinia 状态管理
│   │   ├── views/     # 页面视图
│   │   └── utils/     # 工具函数
│   └── ...
├── prd.md             # 产品需求文档
└── plan.md            # 技术方案文档
```
