# DocMind-Agent 产品需求文档 (PRD)

**项目代号**: DocMind-Agent  
**版本**: v1.0  
**日期**: 2026-05-13  
**状态**: 草稿，待团队评审

---

## 1. 项目概述

### 1.1 背景

企业技术团队普遍面临三大知识管理痛点：

- **新人上手成本高**：新人入职后需要花费 2-4 周才能独立开发，期间大量重复性问题消耗老员工时间
- **知识散落与腐烂**：团队知识散落在 Confluence、Markdown 文档、代码注释、历史工单中，代码变更后文档未同步，导致文档与实际脱节
- **重复问答消耗人力**：相似问题（如"如何配置数据库连接池"）被不同新人反复提问，老员工被迫重复解答

DocMind-Agent 旨在构建一个智能知识传承 Agent，通过 RAG 检索增强生成、ReAct 推理、Plan-and-Execute 任务规划、Memory 记忆系统四大核心能力，实现团队知识的自动沉淀、智能问答、主动维护和新人引导。

### 1.2 目标

| 目标 | 量化指标 |
|------|----------|
| 降低新人上手成本 | 首次独立开发时间从 2-4 周缩短至 1 周内 |
| 减少重复问答 | 高频问题自动沉淀为 FAQ，老员工介入减少 60%+ |
| 知识保鲜 | 代码变更后 24h 内自动检测文档同步状态 |
| 知识可检索 | 支持自然语言查询，回答附带来源引用 |

### 1.3 核心价值

- **RAG 知识问答**：从索引的文档和代码库中给出带来源引用的准确回答
- **ReAct 文档维护**：代码变更后自动推理哪些文档需要更新，生成更新建议
- **Plan-and-Execute 新人引导**：将复合任务拆解为可执行步骤，记录进度，跨会话恢复
- **Memory+FAQ 正循环**：高频问题自动沉淀为 FAQ，形成"提问→检索→补充文档"闭环

---

## 2. 核心业务逻辑分析

### 2.1 功能1：团队知识问答（RAG 模式）

#### 业务流程

```
用户自然语言提问
  ↓
Query 分词（中文分词 + 英文标识符提取）
  ↓
混合检索（向量语义检索 + 关键词匹配 + 类型加权）
  ↓
TopK 结果 + 来源引用（文件路径 + 行号 + chunk 类型）
  ↓
LLM 基于检索结果生成回答，附带来源引用
  ↓
Memory 记录问答对（用于后续 FAQ 统计）
```

#### 详细步骤

1. **用户输入**：新成员在 Web 页面输入自然语言问题，如"怎么本地启动后端服务？"
2. **查询预处理**：
   - 中文分词：使用 jieba 对问题分词，提取关键词
   - 英文标识符提取：正则 `[A-Za-z][A-Za-z0-9_.$-]{1,}` 提取代码标识符
   - 停用词过滤：去除"怎么"、"如何"、"什么"等无意义词
3. **混合检索**：
   - **语义检索**：Embedding 模型将查询向量化，与文档向量计算余弦相似度，取 Top 2K 候选
   - **关键词检索**：分词后的关键词在文档 name/file/content 字段中匹配
   - **评分融合**：
     - 双重命中（语义+关键词均命中）奖励 +0.1 分
     - 关键词在 name 中出现 +0.3 分，在 file 中出现 +0.1 分，在 content 中出现 +0.1 分
     - method 类型 chunk +0.15 分，class 类型 +0.10 分
     - 同一文件最多保留 2 个结果（防止单文件霸屏）
4. **回答生成**：
   - 将 TopK 检索结果注入 LLM 的 system prompt
   - LLM 基于检索到的代码片段和文档生成回答
   - 回答必须附带来源引用格式：`[来源: path/to/file.java:42 (method)]`
5. **记忆存储**：
   - 问答对以 `FACT` 类型存入长期记忆，metadata 标记 `category=qa_pair`
   - 用于后续 FAQ 高频问题检测

#### 输入输出规范

| 项目 | 规范 |
|------|------|
| 输入 | 自然语言字符串，长度 1-500 字符（Web 页面输入框） |
| 输出 | Markdown 格式回答，包含来源引用列表（前端渲染） |
| 来源引用格式 | `[来源: {filePath}:{startLine} ({chunkType})]` |
| 检索结果上限 | 默认 Top 5，可配置 |
| 相似度阈值 | 最低 0.3，低于此值提示"未找到高度相关文档" |

---

### 2.2 功能2：主动维护文档（ReAct 模式）

#### 业务流程

```
代码变更事件（Git commit / 手动触发）
  ↓
Git Diff 分析：提取重命名符号、配置变更、API 签名变更
  ↓
ReAct 推理循环：
  思考 → 哪些文档可能提到旧变量名？
  行动 → search_docs("旧变量名")
  观察 → 发现 docs/deployment.md 第 42 行提到旧变量名
  思考 → 需要更新文档中的变量名描述
  行动 → 生成文档更新建议
  ↓
HITL 审批：用户确认/拒绝更新建议
  ↓
Memory 记录：storeFact("变量X已重命名为Y，相关文档已更新")
```

#### 详细步骤

1. **变更检测**：
   - 通过 Git API 读取最近 N 次 commit 的 diff
   - 提取关键变更：
     - 重命名的变量/方法/类
     - 新增/删除的配置项（环境变量、properties、yaml）
     - 修改的 API 签名（方法名、参数列表、返回类型）
2. **ReAct 推理**：
   - 构造 Prompt："观察到以下代码变更: {diff_summary}。请检查团队文档库中是否有需要同步更新的内容。"
   - Agent 执行 ReAct 循环：
     - **Thought**：分析变更影响范围
     - **Action**：调用 `search_docs` 工具搜索文档库中相关描述
     - **Observation**：获取检索结果
     - 循环直到找到所有需要更新的文档
3. **更新建议生成**：
   - 对每个需要更新的文档，生成结构化建议：
     ```json
     {
       "file": "docs/deployment.md",
       "line": 42,
       "oldText": "DB_POOL_SIZE",
       "newText": "DB_MAX_POOL_SIZE",
       "reason": "代码中变量已重命名"
     }
     ```
   - 建议以 diff 预览形式展示给用户
4. **HITL 审批**：
   - 用户可逐条确认/拒绝/修改更新建议
   - 拒绝的建议记录拒绝原因到 Memory，避免重复建议
5. **记忆存储**：
   - 变更事实存入长期记忆：`storeFact("DB_POOL_SIZE 已重命名为 DB_MAX_POOL_SIZE，docs/deployment.md 已更新")`

#### 边界条件

| 场景 | 处理策略 |
|------|----------|
| 无最近 commit（空仓库） | 提示"暂无代码变更" |
| 变更不涉及文档相关符号 | 静默跳过，不生成更新建议 |
| 文档更新建议被拒绝 | 记录拒绝原因，后续不再建议相同变更 |
| Git 仓库损坏 | catch 异常，提示"Git 仓库状态异常" |
| 并发文档修改冲突 | 检测冲突，提示用户手动解决 |

---

### 2.3 功能3：Plan-and-Execute 引导新人上手

#### 业务流程

```
新人输入复合任务（如"完成第一个功能模块开发"）
  ↓
Planner 生成执行计划：
  task_1: 阅读项目架构图（检索相关文档）
  task_2: 搭建开发环境（执行检查脚本）
  task_3: 理解代码规范（检索已有样例）
  task_4: 运行测试用例（观察输出）
  task_5: 创建功能分支并提交
  ↓
用户审阅计划，确认执行
  ↓
按 DAG 依赖顺序执行各 task
  ↓
Memory 记录每个 task 的结果和遇到的错误
  ↓
会话结束：storeFact("新人已完成环境搭建，卡在了依赖安装")
  ↓
下次会话："上次你卡在了依赖安装，是否要继续？"
```

#### 详细步骤

1. **任务规划**：
   - 新人输入复合任务目标
   - Planner 分析目标，生成 JSON 格式执行计划
   - 每个 Task 包含：id、description、type、dependencies
   - 计算拓扑排序，确定并行执行批次
2. **计划审阅**：
   - 展示可视化计划（任务列表 + 依赖关系图）
   - 用户可确认执行 / 修改计划 / 取消
3. **任务执行**：
   - 按 DAG 依赖顺序执行，无依赖的任务可并行（最大 4 并发）
   - 每个 task 内部走 ReAct 子循环（最多 5 轮工具调用）
   - task 执行完毕后记录结果到 Memory
4. **失败处理**：
   - 单个 task 失败：记录错误，跳过后续依赖 task，提示"建议先解决此问题"
   - 整体进度 < 50% 且有失败：触发重新规划
5. **进度持久化**：
   - 每个 task 完成后，调用 `MemoryManager.storeFact()` 保存进度
   - 进度数据结构：
     ```json
     {
       "userId": "newcomer_01",
       "task": "完成第一个功能模块开发",
       "completedTasks": ["task_1", "task_2"],
       "currentTask": "task_3",
       "errors": ["task_2: npm install 失败，缺少 node_modules"],
       "lastActive": "2026-05-13T10:30:00Z"
     }
     ```
6. **会话恢复**：
   - Agent 启动时检索 Memory 中的进度记录
   - 如果发现未完成的引导任务，主动提醒："上次你卡在了依赖安装，是否要继续？"
   - 用户确认后，从上次中断的 task 继续执行

#### 输入输出规范

| 项目 | 规范 |
|------|------|
| 输入 | 复合任务目标描述，长度 10-200 字符 |
| 输出 | 执行计划（JSON）+ 每步执行结果 + 最终总结 |
| 计划格式 | `{tasks: [{id, description, type, dependencies}], executionOrder: [...]}` |
| 并发上限 | 最大 4 个 task 并行执行 |
| 单 task 工具调用上限 | 最多 5 轮 |
| 进度持久化 | 每个 task 完成后立即写入 Memory |

---

### 2.4 功能4：减少重复问答（Memory + FAQ）

#### 业务流程

```
多人提问相似问题（如"如何切换环境配置"）
  ↓
Memory 记录每次问答对（category=qa_pair）
  ↓
FAQ 检测器定期扫描 Memory
  ↓
基于关键词重叠度聚类，识别频率 >= 3 的高频主题
  ↓
LLM 生成标准化 FAQ 条目
  ↓
FAQ 持久化存储 + 注入 system prompt
  ↓
后续有人问类似问题 → 优先从 FAQ 检索 → 快速回答
  ↓
建议将高频 FAQ 更新到团队 Wiki
```

#### 详细步骤

1. **问答记录**：
   - 每次知识问答结束后，问答对存入长期记忆
   - metadata 标记：`category=qa_pair`, `question_keywords=...`
2. **高频检测**：
   - 定期扫描所有 `qa_pair` 类型的记忆
   - 基于 jieba 分词后的关键词重叠度进行聚类
   - 重叠度阈值：>= 0.6 归为同一主题
   - 频率阈值：>= 3 次触发 FAQ 生成
3. **FAQ 生成**：
   - 对高频主题，调用 LLM 生成标准化 FAQ 条目
   - FAQ 结构：
     ```json
     {
       "id": "faq_001",
       "question": "如何切换环境配置？",
       "answer": "修改 application-{env}.yml 中的 spring.profiles.active 配置...",
       "sources": [
         {"filePath": "src/main/resources/application-dev.yml", "line": 1},
         {"filePath": "README.md", "line": 42}
       ],
       "frequency": 5,
       "lastVerified": "2026-05-13T10:00:00Z"
     }
     ```
4. **FAQ 检索**：
   - 用户提问时，优先从 FAQ 检索（关键词匹配）
   - 命中 FAQ 且 `lastVerified` 在 30 天内：直接回答，附带 FAQ 标记
   - 未命中：走正常 RAG 流程
5. **Wiki 建议**：
   - 当 FAQ 频率 >= 10 时，建议更新到团队 Wiki
   - 生成 Wiki 格式的文档内容，用户确认后推送

#### 边界条件

| 场景 | 处理策略 |
|------|----------|
| 问答对太少（< 3 条） | 不触发 FAQ 检测，提示"积累更多问答后再生成" |
| 聚类质量差 | LLM 二次确认，合并误分的类别 |
| FAQ 条目过多 | 按频率排序，只保留 Top 50 注入 prompt |
| FAQ 内容过时 | 标记 `lastVerified`，超过 30 天标记为"待验证" |

---

## 3. 关键功能模块设计

### 3.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      DocMind-Agent 系统架构                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 用户交互层 (Web 前端)                       │   │
│  │  Vue3 SPA + WebSocket + REST API                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │ 知识问答  │ │ 文档维护  │ │ 新人引导  │ │ FAQ 管理  │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ HTTP / WebSocket                    │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │                   后端服务层 (Spring Boot)                  │   │
│  │  REST Controllers + WebSocket Handler                    │   │
│                           │                                      │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │                  Agent 调度层                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ ReAct Agent  │  │ PlanExecute  │  │ FAQ Detector │    │   │
│  │  │  (文档维护)   │  │  (新人引导)   │  │  (高频检测)   │    │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │   │
│  └─────────┼─────────────────┼─────────────────┼────────────┘   │
│            │                 │                 │                  │
│  ┌─────────▼─────────────────▼─────────────────▼────────────┐   │
│  │                  基础能力层（共享）                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐    │   │
│  │  │   RAG   │ │ Memory  │ │  Plan   │ │ ToolRegistry│    │   │
│  │  │ Engine  │ │ System  │ │ Engine  │ │             │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  数据存储层                                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │ VectorDB │ │ Memory   │ │ FAQ Store│ │ Git Repo │    │   │
│  │  │(SQLite)  │ │(JSON)    │ │(SQLite)  │ │(LocalGit)│    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 模块职责

| 模块 | 职责 | 关键类 |
|------|------|--------|
| **RAG Engine** | 文档索引、向量检索、混合排序 | `VectorStore`, `EmbeddingClient`, `CodeRetriever`, `CodeChunker` |
| **Memory System** | 短期/长期记忆、上下文压缩、事实提取 | `ConversationMemory`, `LongTermMemory`, `ContextCompressor`, `MemoryManager` |
| **Plan Engine** | 任务规划、拓扑排序、并行执行 | `Planner`, `ExecutionPlan`, `Task`, `PlanExecuteAgent` |
| **ReAct Agent** | 推理-行动循环、工具调用 | `Agent`, `AgentBudget` |
| **Tool Registry** | 工具注册、并行执行、安全审计 | `ToolRegistry`, `PathGuard`, `CommandGuard` |
| **FAQ Detector** | 高频问题检测、聚类、FAQ 生成 | `FaqDetector`, `FaqStore` |
| **Git Analyzer** | 变更检测、diff 分析、符号提取 | `GitDiffAnalyzer` |
| **Doc Connector** | 外部文档源拉取、格式转换 | `DocSourceConnector` |

### 3.3 模块交互关系

```
用户提问 "怎么配置数据库连接池？"
  │
  ├─→ RAG Engine: hybridSearch("数据库连接池配置")
  │     ├─→ EmbeddingClient.embed(query)
  │     ├─→ VectorStore.search(embedding, topK=10)
  │     ├─→ VectorStore.searchByKeyword("数据库", "连接池", "配置")
  │     └─→ 返回 Top5 结果 + 评分
  │
  ├─→ Memory System: retrieveRelevant("数据库连接池")
  │     └─→ 返回相关历史问答
  │
  ├─→ FAQ Store: search("数据库连接池")
  │     └─→ 返回匹配的 FAQ（如有）
  │
  └─→ ReAct Agent: 组装 prompt + 检索结果 → LLM 生成回答
        └─→ Memory System: storeFact(问答对)
```

### 3.4 新增文件结构

```
# 后端 (Java)
src/main/java/com/docmind/
├── DocMindApplication.java            // Spring Boot 启动入口
├── controller/
│   ├── QaController.java              // 问答 REST API
│   ├── MaintainController.java        // 文档维护 REST API
│   ├── OnboardController.java         // 新人引导 REST API
│   ├── FaqController.java             // FAQ REST API
│   ├── IndexController.java           // 索引 REST API
│   └── ChatWebSocketHandler.java      // WebSocket 实时通信
├── agent/
│   └── DocMindAgent.java              // 门面类，路由到不同模式
├── rag/
│   ├── VectorStore.java               // 向量存储（SQLite）
│   ├── EmbeddingClient.java           // Embedding 客户端
│   ├── CodeRetriever.java             // 混合检索器
│   ├── CodeChunker.java               // 文档分块器
│   ├── CodeIndex.java                 // 索引管理
│   └── SearchResultFormatter.java     // 结果格式化（带来源引用）
├── memory/
│   ├── ConversationMemory.java        // 短期记忆
│   ├── LongTermMemory.java            // 长期记忆（JSON 持久化）
│   ├── ContextCompressor.java         // 上下文压缩 + 事实提取
│   ├── MemoryManager.java             // 记忆管理门面
│   └── MemoryRetriever.java           // 记忆检索
├── plan/
│   ├── Planner.java                   // 任务规划器
│   ├── ExecutionPlan.java             // 执行计划
│   ├── Task.java                      // 任务节点
│   └── PlanExecuteAgent.java          // Plan-and-Execute Agent
├── knowledge/
│   ├── GitDiffAnalyzer.java           // Git 变更检测
│   ├── DocSourceConnector.java        // 外部文档源连接器
│   ├── DocIndexer.java                // 文档索引器
│   ├── FaqDetector.java               // FAQ 高频检测
│   ├── FaqStore.java                  // FAQ 持久化
│   ├── FaqEntry.java                  // FAQ 数据结构
│   └── NewcomerProgress.java          // 新人进度追踪
├── tool/
│   └── ToolRegistry.java              // 工具注册中心
├── llm/
│   ├── LlmClient.java                 // LLM 客户端接口
│   └── LlmClientFactory.java          // LLM 客户端工厂
├── prompt/
│   ├── PromptAssembler.java           // Prompt 组装器
│   └── PromptMode.java                // Prompt 模式枚举
└── config/
    └── DocMindConfig.java             // 全局配置

# 前端 (Vue3)
frontend/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.ts                        // Vue 入口
│   ├── App.vue                        // 根组件
│   ├── router/
│   │   └── index.ts                   // 路由配置
│   ├── stores/
│   │   ├── chat.ts                    // 问答状态 (Pinia)
│   │   ├── maintain.ts                // 文档维护状态
│   │   ├── onboard.ts                 // 新人引导状态
│   │   └── faq.ts                     // FAQ 状态
│   ├── views/
│   │   ├── ChatView.vue               // 知识问答页面
│   │   ├── MaintainView.vue           // 文档维护页面
│   │   ├── OnboardView.vue            // 新人引导页面
│   │   └── FaqView.vue                // FAQ 管理页面
│   ├── components/
│   │   ├── ChatMessage.vue            // 聊天消息气泡
│   │   ├── SourceReference.vue        // 来源引用卡片
│   │   ├── DiffPreview.vue            // Diff 预览组件
│   │   ├── TaskPlanCard.vue           // 任务计划卡片
│   │   ├── TaskProgress.vue           // 任务进度条
│   │   └── FaqCard.vue                // FAQ 卡片
│   ├── composables/
│   │   ├── useWebSocket.ts            // WebSocket 连接
│   │   └── useSSE.ts                  // SSE 流式接收
│   ├── api/
│   │   ├── qa.ts                      // 问答 API
│   │   ├── maintain.ts                // 文档维护 API
│   │   ├── onboard.ts                 // 新人引导 API
│   │   ├── faq.ts                     // FAQ API
│   │   └── index.ts                   // 索引 API
│   └── types/
│       └── index.ts                   // TypeScript 类型定义
└── public/
    └── favicon.ico
```

---

## 4. 边界条件与异常处理

### 4.1 RAG 问答边界

| 边界场景 | 处理策略 |
|----------|----------|
| 索引为空（未执行索引） | 页面提示"请先索引代码库"，引导至索引页面 |
| 检索结果相似度全部 < 0.3 | 告知"未找到高度相关的文档"，建议换关键词 |
| 查询语言与文档语言不一致 | 中英文混合分词，无需额外处理 |
| 文档内容过时 | 回答中标注"最后更新时间"，提示用户验证 |
| Embedding 服务不可用 | fallback 到纯关键词检索 |
| 外部文档源连接失败 | 降级为仅搜索本地已索引文档 |

### 4.2 文档维护边界

| 边界场景 | 处理策略 |
|----------|----------|
| 无最近 commit | 提示"暂无代码变更" |
| 变更不涉及文档相关符号 | 静默跳过 |
| 更新建议被拒绝 | 记录拒绝原因，不再重复建议 |
| Git 仓库损坏 | catch 异常，提示"Git 仓库状态异常" |
| 并发修改冲突 | 检测冲突，提示用户手动解决 |

### 4.3 新人引导边界

| 边界场景 | 处理策略 |
|----------|----------|
| 新人中途退出 | 保存进度到 Memory，下次会话恢复 |
| task 执行失败 | 记录错误，跳过依赖 task |
| 环境依赖缺失 | 提供安装指引 |
| 重复提问已学内容 | 从 Memory 检索，提示"你之前学过这个" |

### 4.4 FAQ 边界

| 边界场景 | 处理策略 |
|----------|----------|
| 问答对 < 3 条 | 不触发检测 |
| 聚类质量差 | LLM 二次确认 |
| FAQ 条目过多 | 保留 Top 50 |
| FAQ 过时 | 标记"待验证" |

### 4.5 通用异常处理

| 异常类型 | 处理策略 |
|----------|----------|
| LLM 调用超时 | stagnation 检测，超时返回错误 |
| Token 预算耗尽 | 自动压缩上下文 |
| SQLite 写入失败 | stderr 提示，不阻塞主流程 |
| 网络不可用 | 降级为本地模式 |

---

## 5. 技术难点与解决方案

### 5.1 多源文档统一索引

**难点**：Confluence、Markdown、代码注释格式差异大。

**解决方案**：
- `DocSourceConnector` 将不同格式转换为统一的 `Document` record
- `CodeChunker` 支持 Markdown AST 分块（按标题层级分割）
- 配置文件定义文档源列表，支持热更新
- 向量存储使用统一的 `doc_chunks` 表

### 5.2 FAQ 聚类准确性

**难点**：语义相似但措辞不同的问题可能被分开。

**解决方案**：
- 第一阶段：jieba 分词 + TF-IDF 关键词提取，重叠度 >= 0.6 归为一类
- 第二阶段：LLM 对聚类结果做二次确认，合并误分类别
- 阈值可配置

### 5.3 文档更新建议准确性

**难点**：Agent 可能误判哪些文档需要更新。

**解决方案**：
- 更新建议以"建议"形式呈现，不直接修改文件
- 必须经过 HITL 审批
- 建议包含 diff 预览
- 用户可拒绝并标记为"不需要更新"

### 5.4 新人进度跨会话持久化

**难点**：需要支持结构化的进度数据跨会话保存。

**解决方案**：
- 进度数据以 JSON 字符串存储在 Memory 中
- metadata 标记 `category=newcomer_progress`, `userId=<id>`
- `NewcomerProgress` 类提供结构化读写接口

### 5.5 实时文档同步

**难点**：代码变更后需实时检测文档状态，但不能阻塞用户工作流。

**解决方案**：
- 后台任务队列异步执行检测
- 检测结果通过 WebSocket 实时推送到前端
- 页面顶部通知栏展示待处理的更新提醒

---

## 6. 输入输出规范

### 6.1 数据模型

#### 文档块 (DocChunk)

```java
public record DocChunk(
    String filePath,        // 文件路径
    String chunkType,       // "file" / "class" / "method" / "section"
    String name,            // 块名称（类名/方法名/标题）
    String content,         // 块内容
    int startLine,          // 起始行号
    int endLine,            // 结束行号
    float[] embedding,      // 向量表示
    String sourceType       // "local" / "confluence" / "ticket"
) {}
```

#### FAQ 条目 (FaqEntry)

```java
public record FaqEntry(
    String id,
    String question,
    String answer,
    List<SourceReference> sources,
    int frequency,
    String clusterId,
    Instant lastVerified,
    Instant createdAt
) {
    public record SourceReference(String filePath, int line, String chunkType) {}
}
```

#### 新人进度 (NewcomerProgress)

```java
public record NewcomerProgress(
    String id,
    String userId,
    String taskDescription,
    String status,           // "pending" / "in_progress" / "completed" / "blocked"
    ProgressDetail detail,
    Instant lastActive
) {
    public record ProgressDetail(
        List<String> completedTasks,
        String currentTask,
        List<String> errors
    ) {}
}
```

#### Git 变更摘要 (ChangeSummary)

```java
public record ChangeSummary(
    String commitHash,
    String commitMessage,
    List<RenamedSymbol> renames,
    List<AddedRemovedConfig> configChanges,
    List<ModifiedApi> apiChanges,
    Instant timestamp
) {
    public record RenamedSymbol(String oldName, String newName, String filePath) {}
    public record AddedRemovedConfig(String key, String action, String filePath) {}
    public record ModifiedApi(String signature, String action, String filePath) {}
}
```

### 6.2 API 接口

#### REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/qa` | 知识问答，返回回答 + 来源引用 |
| `POST` | `/api/qa/stream` | 知识问答（SSE 流式返回） |
| `POST` | `/api/maintain/analyze` | 触发文档维护分析 |
| `POST` | `/api/maintain/approve` | 审批文档更新建议 |
| `POST` | `/api/onboard/start` | 启动新人引导 |
| `POST` | `/api/onboard/resume` | 恢复上次引导进度 |
| `GET`  | `/api/onboard/progress` | 查询引导进度 |
| `GET`  | `/api/faq` | 获取 FAQ 列表 |
| `POST` | `/api/faq/detect` | 手动触发 FAQ 检测 |
| `GET`  | `/api/faq/{id}` | 获取 FAQ 详情 |
| `POST` | `/api/index` | 索引代码库/文档 |
| `GET`  | `/api/index/status` | 查询索引状态 |
| `WS`   | `/ws/chat` | WebSocket 双向实时通信 |

#### 内置工具（Agent 可调用）

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `search_code` | `{query, topK}` | 搜索代码库 |
| `search_docs` | `{query, topK}` | 搜索文档索引 |
| `generate_faq` | `{question, answer, sources}` | 生成 FAQ 条目 |
| `analyze_git_diff` | `{commitCount}` | 分析 Git 变更 |
| `check_doc_sync` | `{changeSummary}` | 检查文档同步状态 |
| `read_file` | `{path}` | 读取文件内容 |
| `write_file` | `{path, content}` | 写入文件（需 HITL 审批） |
| `execute_command` | `{command}` | 执行 shell 命令 |

### 6.3 配置文件

```json
// ~/.docmind/config.json
{
    "llm": {
        "provider": "openai",
        "model": "gpt-4",
        "apiKey": "${OPENAI_API_KEY}",
        "baseUrl": "https://api.openai.com/v1"
    },
    "embedding": {
        "provider": "ollama",
        "model": "nomic-embed-text:latest",
        "baseUrl": "http://localhost:11434"
    },
    "rag": {
        "topK": 5,
        "minSimilarity": 0.3,
        "maxChunkSize": 2000
    },
    "faq": {
        "minFrequency": 3,
        "similarityThreshold": 0.6,
        "maxInjected": 50
    },
    "docSources": [
        {
            "type": "local",
            "path": "/path/to/docs",
            "extensions": [".md", ".txt"]
        },
        {
            "type": "confluence",
            "baseUrl": "https://team.atlassian.net/wiki",
            "spaceKey": "DEV",
            "apiToken": "${CONFLUENCE_TOKEN}"
        }
    ],
    "onboarding": {
        "defaultTasks": [
            "阅读项目架构文档",
            "搭建开发环境",
            "理解代码规范",
            "运行测试用例",
            "创建第一个 PR"
        ]
    }
}
```

---

## 7. 实现路线图

### Phase 1: 基础框架 + 知识问答 MVP（3 周）

**目标**：搭建前后端骨架，实现带来源引用的知识问答。

**交付物**：
- Spring Boot 后端骨架 + REST API
- Vue 3 前端骨架 + 路由 + 页面布局
- RAG Engine：VectorStore + EmbeddingClient + CodeRetriever + CodeChunker
- Memory System：ConversationMemory + LongTermMemory + MemoryManager
- ReAct Agent：基础 ReAct 循环
- 问答页面：ChatView + ChatMessage + SourceReference 组件
- SSE 流式回答
- 索引页面 + 索引 API

**验证**：
- Web 页面输入"怎么本地启动后端服务？"从 README.md 检索到答案
- 回答以 Markdown 渲染，附带来源引用卡片

### Phase 2: 文档维护 MVP（2 周）

**目标**：实现 Git 变更检测和文档同步建议。

**交付物**：
- GitDiffAnalyzer：本地 Git diff 分析（ProcessBuilder 调用 git CLI）
- 内置工具：`analyze_git_diff`, `search_docs`, `check_doc_sync`
- ReAct 推理 Prompt 模板
- 文档维护页面：MaintainView + DiffPreview 组件
- HITL 审批交互（前端确认/拒绝按钮）

**验证**：
- 修改变量名后，页面展示检测到的文档更新建议
- 用户可在页面上逐条确认/拒绝建议

### Phase 3: 新人引导 MVP（2 周）

**目标**：实现 Plan-and-Execute 驱动的新人上手流程。

**交付物**：
- Plan Engine：Planner + ExecutionPlan + PlanExecuteAgent
- NewcomerProgress：进度追踪数据结构
- WebSocket 实时推送任务执行状态
- 新人引导页面：OnboardView + TaskPlanCard + TaskProgress 组件
- 会话恢复逻辑

**验证**：
- 页面输入目标，展示可视化任务计划（卡片 + 进度条）
- 中断后刷新页面，自动提示恢复

### Phase 4: FAQ 系统 MVP（2 周）

**目标**：实现高频问题检测和 FAQ 生成。

**交付物**：
- FaqDetector：问题聚类 + 频率统计
- FaqStore：SQLite 持久化
- FAQ 注入 system prompt 逻辑
- FAQ 页面：FaqView + FaqCard 组件
- FAQ 检测触发 + 结果展示

**验证**：
- 3 个以上相似问题被识别为高频主题
- FAQ 自动生成并在页面展示

### Phase 5: 外部文档源集成 + 收尾（2 周）

**目标**：支持外部文档源，全量打磨。

**交付物**：
- DocSourceConnector：Confluence REST API 集成
- DocIndexer：外部文档索引逻辑
- 配置管理页面
- 全量集成测试 + E2E 测试
- 性能优化 + UI 打磨

**验证**：
- 配置 Confluence 后，能拉取并索引指定空间文档
- 全功能端到端验证通过

---

## 8. 验证方案

### 8.1 单元测试

| 测试类 | 覆盖范围 |
|--------|----------|
| `VectorStoreTest` | 向量插入、余弦相似度、TopK 检索 |
| `CodeRetrieverTest` | 混合检索、评分融合、结果排序 |
| `MemoryManagerTest` | 短期/长期记忆 CRUD、压缩触发 |
| `GitDiffAnalyzerTest` | diff 解析、符号重命名检测 |
| `FaqDetectorTest` | 问题聚类、频率统计、FAQ 生成 |
| `FaqStoreTest` | SQLite CRUD、关键词检索 |
| `PlannerTest` | 任务规划、拓扑排序、并行批次 |
| `NewcomerProgressTest` | 进度记录、恢复、状态转换 |

### 8.2 集成测试

```bash
mvn test -Dtest=RagQaIntegrationTest          # RAG 问答集成
mvn test -Dtest=DocMaintainIntegrationTest     # 文档维护集成
mvn test -Dtest=OnboardIntegrationTest         # 新人引导集成
mvn test -Dtest=FaqSystemIntegrationTest       # FAQ 系统集成
```

### 8.3 Smoke Test

**知识问答**：
1. 页面点击"索引"按钮，索引项目
2. 在问答输入框输入"怎么本地启动后端服务？"
3. 验证回答包含来源引用卡片

**文档维护**：
1. 修改代码中的变量名
2. 页面点击"文档维护"，触发分析
3. 验证页面展示变更建议 + Diff 预览

**新人引导**：
1. 页面进入"新人引导"
2. 输入目标，验证生成任务计划卡片
3. 执行 2 步后关闭页面，重新打开验证恢复提示

**FAQ**：
1. 提问相似问题 3+ 次
2. 页面点击"FAQ 检测"
3. 验证检测到高频问题并展示 FAQ 卡片

### 8.4 性能基准

| 指标 | 目标值 |
|------|--------|
| 知识问答响应时间（RAG 检索） | < 5 秒（不含 LLM 生成） |
| 文档索引速度 | > 100 文件/分钟 |
| FAQ 检测时间 | < 10 秒（1000 条 Memory） |
| Git Diff 分析时间 | < 2 秒（最近 10 次 commit） |
| Memory 占用 | < 50MB（1000 FAQ + 10000 Memory） |

---

## 9. 技术栈选型

| 类别 | 技术选型 | 理由 |
|------|----------|------|
| 后端语言 | Java 17 | 成熟生态，与现有工具链兼容 |
| 后端框架 | Spring Boot 3.2 | 内嵌 Tomcat、WebSocket 支持、自动配置 |
| 前端框架 | Vue 3 + TypeScript | 响应式、组件化、类型安全 |
| 前端构建 | Vite | 快速 HMR、原生 ESM |
| 前端状态管理 | Pinia | Vue 3 官方推荐，轻量 |
| 前端 UI 组件 | Element Plus | 成熟的 Vue 3 组件库 |
| 实时通信 | WebSocket + SSE | WebSocket 双向通信，SSE 流式回答 |
| 构建工具 | Maven | 标准化构建，依赖管理成熟 |
| 向量存储 | SQLite | 轻量级，适合中小规模（几千 chunks） |
| Embedding | Ollama (本地) / OpenAI API | 灵活切换，本地部署隐私安全 |
| LLM | OpenAI 兼容接口 | 支持多 Provider 切换 |
| 中文分词 | jieba | 成熟的中文分词库 |
| Git 集成 | 本地 Git (ProcessBuilder) | 调用系统 git 命令，兼容性好，无需额外依赖 |
| HTTP 客户端 | OkHttp | 高性能，SSE 流式支持 |
| JSON | Jackson | 高性能序列化 |
| 测试 | JUnit 5 + Mockito + Vitest | 后端 JUnit，前端 Vitest |
