# DocMind-Agent 技术实现方案

**项目代号**: DocMind-Agent
**版本**: v1.0
**日期**: 2026-05-13
**基于**: prd.md v1.0

---

## 1. 总体架构设计

### 1.1 分层架构

系统采用五层架构（前端 + 后端），层间通过接口解耦，支持单元测试和模块替换。

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端交互层 (Vue 3 SPA)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 知识问答  │ │ 文档维护  │ │ 新人引导  │ │ FAQ 管理  │          │
│  │ ChatView │ │MaintainVw│ │OnboardVw │ │ FaqView  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       └─────────────┴─────────────┴─────────────┘               │
│              HTTP REST API + WebSocket + SSE                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   后端服务层 (Spring Boot)                        │
│  REST Controllers + WebSocket Handler + 异步任务管理              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ QaController │ │MaintainCtrl  │ │OnboardCtrl   │             │
│  │ FaqController│ │IndexCtrl     │ │ChatWsHandler │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      Agent 调度层                                │
│  DocMindAgent (门面) → 模式路由 → Agent 执行引擎                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ ReActAgent   │ │ PlanExecute  │ │ FaqDetector  │             │
│  │ (文档维护)    │ │ Agent(引导)   │ │ (FAQ检测)    │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      基础能力层                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ RAG引擎  │ │ 记忆系统  │ │ 规划引擎  │ │ 工具注册中心  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘       │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      数据存储层                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ VectorDB │ │ MemoryDB │ │ FaqDB    │ │ GitProcess   │       │
│  │ (SQLite) │ │ (JSON)   │ │ (SQLite) │ │ (本地Git)     │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 模块依赖关系

```
前端 (Vue 3 SPA)
  └→ HTTP REST API + WebSocket
       │
后端 (Spring Boot)
  └→ Controller 层
       └→ DocMindAgent (门面)
            ├→ RAG Engine
            │    ├→ EmbeddingClient (外部: Ollama/OpenAI)
            │    ├→ VectorStore (SQLite)
            │    └→ CodeChunker
            ├→ Memory System
            │    ├→ ConversationMemory (内存)
            │    └→ LongTermMemory (JSON文件)
            ├→ Plan Engine
            │    ├→ Planner (LLM)
            │    └→ ExecutionPlan (DAG)
            ├→ ReAct Agent
            │    ├→ ToolRegistry
            │    └→ LlmClient (外部: OpenAI兼容)
            ├→ Git Analyzer
            │    └→ GitProcessExecutor (本地git CLI)
            └→ FAQ System
                 ├→ FaqDetector
                 └→ FaqStore (SQLite)
```

---

## 2. 核心数据结构

### 2.1 文档块 (DocChunk)

```java
public record DocChunk(
    String id,              // UUID，唯一标识
    String filePath,        // 文件相对路径
    String chunkType,       // "file" | "class" | "method" | "section"
    String name,            // 块名称（类名/方法名/标题）
    String content,         // 块内容
    int startLine,          // 起始行号
    int endLine,            // 结束行号
    float[] embedding,      // 向量表示（维度由模型决定，如 768）
    String sourceType,      // "local" | "confluence" | "ticket"
    Map<String, String> metadata  // 扩展元数据
) {}
```

**存储**: SQLite `doc_chunks` 表，embedding 以 BLOB 存储。

### 2.2 检索结果 (SearchResult)

```java
public record SearchResult(
    DocChunk chunk,
    float vectorScore,      // 向量相似度分数
    float keywordScore,     // 关键词匹配分数
    float finalScore,       // 融合后的最终分数
    String matchReason      // 匹配原因说明
) {}
```

### 2.3 FAQ 条目 (FaqEntry)

```java
public record FaqEntry(
    String id,              // UUID
    String question,        // 标准化问题
    String answer,          // 标准化回答
    List<SourceReference> sources,  // 来源引用
    int frequency,          // 出现频率
    String clusterId,       // 聚类ID
    Instant lastVerified,   // 最后验证时间
    Instant createdAt       // 创建时间
) {
    public record SourceReference(String filePath, int line, String chunkType) {}
}
```

### 2.4 新人进度 (NewcomerProgress)

```java
public record NewcomerProgress(
    String id,              // UUID
    String userId,          // 用户标识
    String taskDescription, // 任务描述
    String status,          // "pending" | "in_progress" | "completed" | "blocked"
    ProgressDetail detail,  // 进度详情
    Instant lastActive      // 最后活跃时间
) {
    public record ProgressDetail(
        List<String> completedTasks,   // 已完成任务ID列表
        String currentTask,            // 当前任务ID
        List<TaskError> errors         // 错误记录
    ) {}

    public record TaskError(String taskId, String message, Instant timestamp) {}
}
```

### 2.5 Git 变更摘要 (ChangeSummary)

```java
public record ChangeSummary(
    String commitHash,
    String commitMessage,
    List<RenamedSymbol> renames,
    List<AddedRemovedConfig> configChanges,
    List<ModifiedApi> apiChanges,
    Instant timestamp
) {
    public record RenamedSymbol(String oldName, String newName, String filePath, String symbolType) {}
    public record AddedRemovedConfig(String key, String action, String filePath) {}
    public record ModifiedApi(String signature, String action, String filePath) {}
}
```

### 2.6 执行计划 (ExecutionPlan / Task)

```java
public record ExecutionPlan(
    String id,              // 计划ID
    String goal,            // 目标描述
    List<Task> tasks,       // 任务列表
    List<List<Task>> executionBatches,  // 拓扑排序后的并行批次
    PlanStatus status,      // 计划状态
    Instant createdAt
) {}

public record Task(
    String id,              // 任务ID
    String description,     // 任务描述
    TaskType type,          // "read_doc" | "run_command" | "search" | "write"
    List<String> dependencies,  // 依赖的任务ID列表
    TaskStatus status,      // "pending" | "running" | "completed" | "failed"
    String result,          // 执行结果
    String error            // 错误信息
) {}

public enum PlanStatus { DRAFT, APPROVED, EXECUTING, COMPLETED, FAILED }
public enum TaskType { READ_DOC, RUN_COMMAND, SEARCH, WRITE, CUSTOM }
public enum TaskStatus { PENDING, RUNNING, COMPLETED, FAILED, SKIPPED }
```

### 2.7 记忆条目 (MemoryEntry)

```java
public record MemoryEntry(
    String id,              // UUID
    String content,         // 记忆内容
    MemoryType type,        // "FACT" | "QA_PAIR" | "PROGRESS" | "REJECTION"
    Map<String, String> metadata,  // 元数据（category, keywords等）
    float importance,       // 重要性分数 0-1
    Instant createdAt,
    Instant lastAccessedAt,
    int accessCount         // 访问次数
) {}

public enum MemoryType { FACT, QA_PAIR, PROGRESS, REJECTION }
```

---

## 3. 核心算法设计

### 3.1 文档分块算法 (CodeChunker)

**策略**: 按文档类型采用不同分块策略。

```
输入: 文件路径 + 文件内容
输出: List<DocChunk>

处理流程:
1. 根据文件扩展名判断类型
2. Markdown 文件:
   - 按标题层级 (# ## ###) 分割为 section
   - 每个 section 独立为一个 chunk
   - 超过 maxChunkSize (2000字符) 的 section 按段落二次分割
3. 代码文件 (.java, .py, .js):
   - 使用正则提取类定义、方法定义
   - 每个类/方法独立为一个 chunk
   - 类 chunk 包含类声明 + 字段定义
   - 方法 chunk 包含方法签名 + 方法体
4. 配置文件 (.yml, .properties, .json):
   - 整个文件作为一个 chunk
   - 超过 maxChunkSize 时按顶层 key 分割
5. 其他文件:
   - 按空行分割段落，每段作为一个 chunk
```

**关键实现**:
- Java 代码解析使用正则而非完整 AST 解析器，降低依赖复杂度
- 正则模式: `(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*\w+[\w<>\[\],\s]*\s+\w+\s*\(`
- 每个 chunk 记录 startLine/endLine，用于来源引用

### 3.2 混合检索算法 (CodeRetriever)

**策略**: 向量语义检索 + 关键词匹配 + 多维加权融合。

```
输入: 查询字符串 query, topK
输出: List<SearchResult>

处理流程:
1. 查询预处理:
   - 中文分词: jieba 分词
   - 英文标识符提取: 正则 [A-Za-z][A-Za-z0-9_.$-]{1,}
   - 停用词过滤

2. 向量检索:
   - EmbeddingClient.embed(query) → queryVector
   - VectorStore.cosineSearch(queryVector, topK=2*requestedK)
   - 返回候选集 + 相似度分数

3. 关键词检索:
   - 在 doc_chunks 表的 name, file, content 字段做 LIKE 检索
   - 计算关键词命中数

4. 评分融合:
   finalScore = baseVectorScore + bonusScore
   
   bonusScore 计算规则:
   - 双重命中（向量 + 关键词均命中）: +0.1
   - 关键词在 name 字段命中: +0.3
   - 关键词在 filePath 字段命中: +0.1
   - 关键词在 content 字段命中: +0.1 * hitCount / totalKeywords
   - chunkType == "method": +0.15
   - chunkType == "class": +0.10
   
5. 后处理:
   - 同一文件最多保留 2 个结果（防止单文件霸屏）
   - 过滤 finalScore < minSimilarity (0.3) 的结果
   - 按 finalScore 降序排列，取 topK
```

**向量相似度计算** (余弦相似度):

```java
public static float cosineSimilarity(float[] a, float[] b) {
    if (a.length != b.length) throw new IllegalArgumentException("Vector dimension mismatch");
    float dotProduct = 0, normA = 0, normB = 0;
    for (int i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / ((float) Math.sqrt(normA) * (float) Math.sqrt(normB));
}
```

### 3.3 ReAct 推理循环

**策略**: Thought-Action-Observation 循环，带工具调用和预算控制。

```
输入: 用户问题 + 检索上下文
输出: 最终回答

执行流程:
1. 构造初始 Prompt:
   system: "你是一个知识库助手。使用提供的文档片段回答问题。
            回答必须附带来源引用 [来源: path:line (type)]。
            如果信息不足，说明哪些方面无法确认。"
   user: "{query}"
   context: "{topK search results}"

2. ReAct 循环 (最多 maxIterations=5):
   while iteration < maxIterations:
     response = LlmClient.chat(messages)
     
     if response contains tool_call:
       result = ToolRegistry.execute(tool_call)
       messages.append(tool_result)
       iteration++
     else:
       // 纯文本回答，循环结束
       break

3. 后处理:
   - 提取回答中的来源引用
   - 验证引用的文件路径存在
   - 存储问答对到 Memory
```

### 3.4 Plan-and-Execute 规划算法

**策略**: LLM 生成 DAG 计划，拓扑排序确定执行顺序。

```
输入: 复合任务目标
输出: ExecutionPlan

规划流程:
1. Planner Prompt:
   "给定目标: {goal}
    请生成执行计划，每个任务包含:
    - id: 唯一标识
    - description: 任务描述
    - type: 任务类型 (read_doc/run_command/search/write)
    - dependencies: 依赖的其他任务 id 列表
    返回 JSON 格式。"

2. LLM 返回 JSON → 解析为 List<Task>

3. 拓扑排序 (计算并行批次):
   batches = []
   remaining = allTasks
   completed = empty set
   
   while remaining not empty:
     // 找出所有依赖已完成的任务
     ready = tasks where all dependencies in completed
     if ready is empty:
       throw CycleDetectedError("任务依赖存在循环")
     batches.add(ready)
     completed.addAll(ready)
     remaining.removeAll(ready)
   
   return new ExecutionPlan(batches)

4. 用户审阅计划，确认/修改/取消
```

**并行执行**:

```
executor = Executors.newFixedThreadPool(4)
for batch in plan.executionBatches:
    futures = batch.map(task -> executor.submit(() -> executeTask(task)))
    // 等待当前批次所有任务完成
    for future in futures:
        result = future.get()
        if result.failed:
            markDependentTasksAsSkipped(task)
            if completionRate < 0.5:
                triggerReplanning()
```

### 3.5 FAQ 聚类算法

**策略**: 两阶段聚类 — 关键词重叠度初筛 + LLM 精炼。

```
输入: 所有 qa_pair 类型的 MemoryEntry
输出: List<FaqEntry>

第一阶段: 关键词聚类
1. 对每个 qa_pair 提取关键词:
   - jieba 分词
   - 去停用词
   - TF-IDF 加权取 Top 10 关键词

2. 计算关键词重叠度:
   overlap(A, B) = |A.keywords ∩ B.keywords| / min(|A.keywords|, |B.keywords|)

3. 贪心聚类:
   clusters = []
   for each qa_pair:
     placed = false
     for each cluster:
       if overlap(qa_pair, cluster.centroid) >= 0.6:
         cluster.add(qa_pair)
         placed = true
         break
     if not placed:
       clusters.add(new Cluster(qa_pair))

4. 过滤: 保留 frequency >= 3 的聚类

第二阶段: LLM 精炼
5. 对每个聚类，构造 Prompt:
   "以下是用户多次提出的相关问题:
    {聚类中的问题列表}
    请判断这些问题是否属于同一主题。如果是，生成一个标准化的 FAQ 条目。
    返回 JSON: {question, answer}"

6. LLM 返回标准化 FAQ
7. 持久化到 FaqStore
```

### 3.6 Git 变更分析算法

**策略**: 通过本地 git CLI 获取 diff，正则提取符号变更。

```
输入: commitCount (最近N次commit)
输出: List<ChangeSummary>

执行流程:
1. 获取最近N次commit的hash列表:
   git log --format="%H" -n {commitCount}

2. 对每个commit获取diff:
   git diff {hash}^..{hash} --unified=0

3. 解析diff输出:
   3.1 提取重命名符号:
       正则匹配删除行和新增行中的符号定义
       - 删除: ^-\s*(?:public|private|protected)?\s*\w+\s+(\w+)\s*\( → oldName
       - 新增: ^+\s*(?:public|private|protected)?\s*\w+\s+(\w+)\s*\( → newName
       如果 oldName 和 newName 在同一文件/相邻位置出现，判定为重命名
   
   3.2 提取配置变更:
       匹配 .yml, .properties, .json 文件的变更
       - 删除行: ^-\s*(\w[\w.]*)\s*[:=] → removed config
       - 新增行: ^+\s*(\w[\w.]*)\s*[:=] → added config
   
   3.3 提取API签名变更:
       匹配方法签名变更（参数列表、返回类型变化）

4. 返回 ChangeSummary 列表
```

**关键实现 — GitProcessExecutor**:

```java
public class GitProcessExecutor {
    
    public List<String> execute(String... args) throws GitException {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(Arrays.asList(args));
        
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(repoRoot);
        pb.redirectErrorStream(false);
        
        Process process = pb.start();
        String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
        int exitCode = process.waitFor();
        
        if (exitCode != 0) {
            throw new GitException("git command failed: " + stderr);
        }
        return Arrays.asList(stdout.split("\n"));
    }
    
    public List<String> getRecentCommits(int count) {
        return execute("log", "--format=%H", "-n", String.valueOf(count));
    }
    
    public String getDiff(String commitHash) {
        List<String> lines = execute("diff", commitHash + "^.." + commitHash, "--unified=0");
        return String.join("\n", lines);
    }
    
    public boolean isGitRepo() {
        try {
            execute("rev-parse", "--is-inside-work-tree");
            return true;
        } catch (GitException e) {
            return false;
        }
    }
}
```

---

## 4. 各模块详细设计

### 4.1 RAG Engine 模块

#### 4.1.1 VectorStore

**职责**: 向量存储与检索，基于 SQLite。

**表结构**:
```sql
CREATE TABLE doc_chunks (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    chunk_type TEXT NOT NULL,
    name TEXT,
    content TEXT NOT NULL,
    start_line INTEGER,
    end_line INTEGER,
    embedding BLOB,
    source_type TEXT DEFAULT 'local',
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_path ON doc_chunks(file_path);
CREATE INDEX idx_chunk_type ON doc_chunks(chunk_type);
CREATE INDEX idx_name ON doc_chunks(name);
```

**核心方法**:
```java
public interface VectorStore {
    void insert(DocChunk chunk);
    void insertBatch(List<DocChunk> chunks);
    List<SearchResult> cosineSearch(float[] queryVector, int topK);
    List<SearchResult> keywordSearch(List<String> keywords);
    void deleteByFile(String filePath);
    void clear();
    int count();
}
```

**向量检索实现要点**:
- 加载所有 embedding 到内存进行余弦相似度计算（适合几千条规模）
- 超过 10000 条时考虑分批加载或引入近似最近邻索引
- embedding 存储格式: 每个 float 4 字节，BLOB 序列化

#### 4.1.2 EmbeddingClient

**职责**: 调用外部 Embedding 模型，将文本转为向量。

```java
public interface EmbeddingClient {
    float[] embed(String text);
    List<float[]> embedBatch(List<String> texts);
}
```

**实现**:
- Ollama 实现: POST http://localhost:11434/api/embeddings
- OpenAI 实现: POST https://api.openai.com/v1/embeddings
- 通过配置文件切换 provider

#### 4.1.3 CodeChunker

**职责**: 将文件按类型分块为 DocChunk 列表。

```java
public class CodeChunker {
    private final int maxChunkSize;
    
    public List<DocChunk> chunk(String filePath, String content) {
        String ext = getExtension(filePath);
        return switch (ext) {
            case ".md", ".txt" -> chunkMarkdown(filePath, content);
            case ".java", ".py", ".js", ".ts" -> chunkCode(filePath, content);
            case ".yml", ".yaml", ".properties", ".json" -> chunkConfig(filePath, content);
            default -> chunkGeneric(filePath, content);
        };
    }
}
```

#### 4.1.4 CodeRetriever

**职责**: 混合检索，融合向量分数和关键词分数。

```java
public class CodeRetriever {
    private final VectorStore vectorStore;
    private final EmbeddingClient embeddingClient;
    
    public List<SearchResult> hybridSearch(String query, int topK) {
        // 1. 查询预处理
        List<String> keywords = QueryPreprocessor.extract(query);
        float[] queryVector = embeddingClient.embed(query);
        
        // 2. 向量检索
        List<SearchResult> vectorResults = vectorStore.cosineSearch(queryVector, topK * 2);
        
        // 3. 关键词检索
        List<SearchResult> keywordResults = vectorStore.keywordSearch(keywords);
        
        // 4. 评分融合
        Map<String, SearchResult> merged = mergeResults(vectorResults, keywordResults, keywords);
        
        // 5. 后处理
        return merged.values().stream()
            .sorted(Comparator.comparingDouble(r -> -r.finalScore()))
            .filter(r -> r.finalScore() >= minSimilarity)
            .limit(topK)
            .collect(Collectors.toList());
    }
}
```

### 4.2 Memory System 模块

#### 4.2.1 存储格式

**文件结构**:
```
~/.docmind/memory/
├── conversations/        # 短期记忆（会话级）
│   └── {sessionId}.json
├── longterm/            # 长期记忆（持久化）
│   └── memories.json
└── faq/
    └── faq.json
```

**memories.json 格式**:
```json
{
  "version": 1,
  "entries": [
    {
      "id": "uuid-1",
      "content": "DB_POOL_SIZE 已重命名为 DB_MAX_POOL_SIZE",
      "type": "FACT",
      "metadata": {"category": "rename", "oldName": "DB_POOL_SIZE", "newName": "DB_MAX_POOL_SIZE"},
      "importance": 0.8,
      "createdAt": "2026-05-13T10:00:00Z",
      "lastAccessedAt": "2026-05-13T10:00:00Z",
      "accessCount": 1
    }
  ]
}
```

#### 4.2.2 MemoryManager

**职责**: 记忆的 CRUD、压缩、检索。

```java
public class MemoryManager {
    private final ConversationMemory shortTerm;  // 内存，会话级
    private final LongTermMemory longTerm;        // JSON 持久化
    
    // 存储
    public String storeFact(String content, Map<String, String> metadata);
    public String storeQaPair(String question, String answer, List<SourceReference> sources);
    public String storeProgress(NewcomerProgress progress);
    
    // 检索
    public List<MemoryEntry> retrieveRelevant(String query, int topK);
    public List<MemoryEntry> retrieveByCategory(String category);
    
    // 压缩
    public void compressIfNeeded();  // 当短期记忆超过阈值时触发
}
```

**压缩策略**:
- 短期记忆超过 20 条时触发压缩
- 使用 LLM 提取关键事实，合并到长期记忆
- 压缩后清空短期记忆

### 4.3 Git Analyzer 模块

#### 4.3.1 GitProcessExecutor

**职责**: 封装本地 git 命令调用。

**关键方法**:
```java
public class GitProcessExecutor {
    // 基础执行
    List<String> execute(String... args);
    
    // 常用操作
    List<String> getRecentCommits(int count);
    String getDiff(String commitHash);
    String getFileContent(String filePath, String ref);
    boolean isGitRepo();
    String getCurrentBranch();
    List<String> getChangedFiles(String commitHash);
}
```

**错误处理**:
- git 命令不存在: 抛出 GitNotFoundException，提示安装 git
- 非 git 仓库: 抛出 NotGitRepoException
- 命令执行失败: 抛出 GitException，包含 stderr 信息

#### 4.3.2 GitDiffAnalyzer

**职责**: 分析 git diff，提取结构化变更信息。

```java
public class GitDiffAnalyzer {
    private final GitProcessExecutor git;
    
    public List<ChangeSummary> analyzeRecentChanges(int commitCount) {
        List<String> commits = git.getRecentCommits(commitCount);
        return commits.stream()
            .map(this::analyzeCommit)
            .collect(Collectors.toList());
    }
    
    private ChangeSummary analyzeCommit(String commitHash) {
        String diff = git.getDiff(commitHash);
        List<RenamedSymbol> renames = extractRenames(diff);
        List<AddedRemovedConfig> configChanges = extractConfigChanges(diff);
        List<ModifiedApi> apiChanges = extractApiChanges(diff);
        return new ChangeSummary(commitHash, ..., renames, configChanges, apiChanges, ...);
    }
}
```

### 4.4 Plan Engine 模块

#### 4.4.1 Planner

**职责**: 调用 LLM 生成执行计划。

```java
public class Planner {
    private final LlmClient llmClient;
    
    public ExecutionPlan createPlan(String goal) {
        // 1. 构造 Prompt
        String prompt = buildPlannerPrompt(goal);
        
        // 2. 调用 LLM
        String response = llmClient.chat(prompt);
        
        // 3. 解析 JSON
        List<Task> tasks = parseTasks(response);
        
        // 4. 验证依赖合法性（无循环）
        validateDependencies(tasks);
        
        // 5. 拓扑排序
        List<List<Task>> batches = topologicalSort(tasks);
        
        return new ExecutionPlan(UUID.randomUUID().toString(), goal, tasks, batches, ...);
    }
}
```

#### 4.4.2 PlanExecuteAgent

**职责**: 执行计划，管理任务状态。

```java
public class PlanExecuteAgent {
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final ToolRegistry toolRegistry;
    private final MemoryManager memory;
    
    public ExecutionResult execute(ExecutionPlan plan) {
        for (List<Task> batch : plan.executionBatches()) {
            List<Future<TaskResult>> futures = batch.stream()
                .map(task -> executor.submit(() -> executeSingleTask(task)))
                .collect(Collectors.toList());
            
            for (int i = 0; i < futures.size(); i++) {
                TaskResult result = futures.get(i).get();
                Task task = batch.get(i);
                
                if (result.failed()) {
                    task.status(TaskStatus.FAILED);
                    markDependentAsSkipped(task, plan);
                    memory.storeFact("任务失败: " + task.description() + ", 错误: " + result.error());
                } else {
                    task.status(TaskStatus.COMPLETED);
                    memory.storeFact("任务完成: " + task.description() + ", 结果: " + result.summary());
                }
            }
            
            // 检查是否需要重新规划
            if (completionRate(plan) < 0.5 && hasFailures(plan)) {
                return replan(plan);
            }
        }
        return new ExecutionResult(plan, ...);
    }
    
    private TaskResult executeSingleTask(Task task) {
        // 每个 task 内部走 ReAct 子循环，最多 5 轮工具调用
        // ...
    }
}
```

### 4.5 FAQ System 模块

#### 4.5.1 FaqDetector

**职责**: 从 Memory 中检测高频问题并生成 FAQ。

```java
public class FaqDetector {
    private final MemoryManager memory;
    private final LlmClient llmClient;
    private final FaqStore faqStore;
    
    public List<FaqEntry> detectAndGenerate() {
        // 1. 获取所有 qa_pair
        List<MemoryEntry> qaPairs = memory.retrieveByCategory("qa_pair");
        if (qaPairs.size() < 3) return Collections.emptyList();
        
        // 2. 关键词聚类
        List<Cluster> clusters = clusterByKeywords(qaPairs);
        
        // 3. 过滤低频聚类
        List<Cluster> highFreq = clusters.stream()
            .filter(c -> c.size() >= minFrequency)
            .collect(Collectors.toList());
        
        // 4. LLM 生成 FAQ
        List<FaqEntry> faqs = highFreq.stream()
            .map(this::generateFaq)
            .collect(Collectors.toList());
        
        // 5. 持久化
        faqs.forEach(faqStore::insert);
        
        return faqs;
    }
}
```

#### 4.5.2 FaqStore

**表结构**:
```sql
CREATE TABLE faq_entries (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources TEXT,           -- JSON 序列化的 SourceReference 列表
    frequency INTEGER DEFAULT 1,
    cluster_id TEXT,
    last_verified TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_question ON faq_entries(question);
```

### 4.6 Tool Registry 模块

#### 4.6.1 工具定义

```java
public record ToolDefinition(
    String name,
    String description,
    JsonSchema parameters,
    ToolHandler handler
) {}

@FunctionalInterface
public interface ToolHandler {
    ToolResult execute(JsonObject params) throws ToolException;
}
```

#### 4.6.2 内置工具注册

```java
public class ToolRegistry {
    private final Map<String, ToolDefinition> tools = new LinkedHashMap<>();
    
    public void registerDefaults(DocMindConfig config, CodeRetriever retriever,
                                  MemoryManager memory, GitDiffAnalyzer gitAnalyzer) {
        register("search_code", "搜索代码库", params -> {
            String query = params.get("query").getAsString();
            int topK = params.has("topK") ? params.get("topK").getAsInt() : 5;
            return retriever.hybridSearch(query, topK);
        });
        
        register("search_docs", "搜索文档索引", params -> {
            // 类似 search_code，但限定 sourceType
        });
        
        register("analyze_git_diff", "分析 Git 变更", params -> {
            int count = params.has("commitCount") ? params.get("commitCount").getAsInt() : 5;
            return gitAnalyzer.analyzeRecentChanges(count);
        });
        
        register("read_file", "读取文件内容", params -> {
            String path = params.get("path").getAsString();
            PathGuard.validate(path);  // 安全校验
            return Files.readString(Path.of(path));
        });
        
        register("write_file", "写入文件", params -> {
            String path = params.get("path").getAsString();
            String content = params.get("content").getAsString();
            PathGuard.validate(path);
            // 需要 HITL 审批，返回 pending 状态
            return ToolResult.pending("需要用户确认写入");
        });
    }
}
```

#### 4.6.3 安全守卫

```java
public class PathGuard {
    private static final Set<String> BLOCKED_PATHS = Set.of(
        "/etc", "/sys", "/proc", "~/.ssh", "~/.gnupg"
    );
    
    public static void validate(String path) throws SecurityException {
        Path normalized = Path.of(path).normalize();
        for (String blocked : BLOCKED_PATHS) {
            if (normalized.startsWith(blocked)) {
                throw new SecurityException("访问被拒绝: " + path);
            }
        }
    }
}

public class CommandGuard {
    private static final Set<String> BLOCKED_COMMANDS = Set.of(
        "rm -rf", "mkfs", "dd", "chmod 777", ":(){ :|:& };:"
    );
    
    public static void validate(String command) throws SecurityException {
        for (String blocked : BLOCKED_COMMANDS) {
            if (command.contains(blocked)) {
                throw new SecurityException("危险命令被拦截: " + command);
            }
        }
    }
}
```

### 4.7 LLM Client 模块

```java
public interface LlmClient {
    String chat(List<Message> messages);
    String chat(String systemPrompt, String userMessage);
    String chatWithTools(List<Message> messages, List<ToolDefinition> tools);
}

public record Message(String role, String content) {}

public class OpenAiCompatibleClient implements LlmClient {
    private final OkHttpClient httpClient;
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    
    // 实现: POST /v1/chat/completions
    // 支持 tool_choice, tools 参数
}
```

---

## 5. 执行流程

### 5.1 知识问答流程

```
前端: 用户在 ChatView 输入框输入 "怎么配置数据库连接池？"
    │
    ▼ 前端调用 POST /api/qa/stream (SSE)
    │
后端: QaController.handleQaStream()
    │
    ├─→ 1. FaqStore.search("数据库连接池")
    │     ├─ 命中 FAQ 且 lastVerified < 30天 → SSE 推送 FAQ 回答
    │     └─ 未命中 → 继续
    │
    ├─→ 2. MemoryManager.retrieveRelevant("数据库连接池", topK=3)
    │     └─ 返回相关历史问答作为上下文
    │
    ├─→ 3. CodeRetriever.hybridSearch("数据库连接池配置", topK=5)
    │     ├─ jieba 分词 → ["数据库", "连接池", "配置"]
    │     ├─ EmbeddingClient.embed(query) → queryVector
    │     ├─ VectorStore.cosineSearch(queryVector, 10) → 向量候选
    │     ├─ VectorStore.keywordSearch(["数据库", "连接池", "配置"]) → 关键词候选
    │     ├─ mergeResults() → 评分融合
    │     └─ 返回 Top5 SearchResult
    │
    └─→ 4. ReActAgent.execute(query, searchResults, historyContext)
          ├─ 组装 system prompt + context
          ├─ LLM 流式生成回答 → SSE 逐 token 推送到前端
          ├─ 前端 MarkdownRenderer 实时渲染
          └─ MemoryManager.storeQaPair(query, answer, sources)

前端: ChatMessage 组件渲染回答 + SourceReference 来源卡片
```

### 5.2 文档维护流程

```
前端: 用户点击 "文档维护" 页面的 "分析变更" 按钮
    │
    ▼ 前端调用 POST /api/maintain/analyze
    │
后端: MaintainController.analyze()
    │
    ├─→ 1. GitProcessExecutor.isGitRepo() 检查
    │     └─ 非 git 仓库 → 返回错误，前端提示
    │
    ├─→ 2. GitDiffAnalyzer.analyzeRecentChanges(5)
    │     ├─ git log → 最近5次commit
    │     ├─ 对每个 commit 获取 diff
    │     ├─ 提取 renames, configChanges, apiChanges
    │     └─ 返回 List<ChangeSummary>
    │
    ├─→ 3. 过滤: 无变更 → 返回空列表，前端提示"暂无代码变更"
    │
    ├─→ 4. ReActAgent 执行推理循环:
    │     for each ChangeSummary:
    │       Thought: "代码中 {oldName} 重命名为 {newName}，需要检查文档"
    │       Action: search_docs("{oldName}")
    │       Observation: "在 docs/deployment.md:42 找到 {oldName}"
    │       Thought: "需要建议更新该文档"
    │       Action: generate_update_suggestion(...)
    │
    └─→ 5. 返回更新建议列表

前端: DiffPreview 组件展示每条建议的 diff 预览
    │ 用户逐条点击 "确认" / "拒绝" / "修改"
    ▼ 前端调用 POST /api/maintain/approve (批量审批)
    │
后端: 执行已确认的更新，拒绝的记录到 Memory
```

### 5.3 新人引导流程

```
前端: 用户进入 "新人引导" 页面
    │
    ▼ 前端调用 GET /api/onboard/progress
    │
后端: 检查 Memory 中是否有未完成的进度
    ├─ 有 → 返回进度数据，前端展示恢复提示卡片
    └─ 无 → 返回空，前端展示目标输入框

前端: 用户输入目标 "完成第一个功能模块开发"
    │
    ▼ 前端调用 POST /api/onboard/start
    │
后端: Planner.createPlan(goal)
    ├─ LLM 生成任务列表
    ├─ 验证依赖合法性
    ├─ 拓扑排序
    └─ 返回 ExecutionPlan

前端: TaskPlanCard 组件展示计划（卡片 + vue-flow 依赖图）
    │ 用户点击 "开始执行"
    ▼ 建立 WebSocket 连接 /ws/chat
    │
后端: PlanExecuteAgent.execute(plan)
    for each batch:
      for each task (并行，最大4):
        ├─ 执行 task (ReAct 子循环)
        ├─ WebSocket 推送任务状态变更 → 前端 TaskProgress 实时更新
        ├─ 记录结果到 Memory
        └─ 失败时标记依赖 task 为 SKIPPED

前端: TaskProgress 组件实时更新进度条 + 状态图标
    └─ 完成后展示总结卡片
```

### 5.4 FAQ 检测流程

```
前端: 用户在 FAQ 页面点击 "检测高频问题" 按钮
    │
    ▼ 前端调用 POST /api/faq/detect
    │
后端: FaqDetector.detectAndGenerate()
    │
    ├─→ 1. MemoryManager.retrieveByCategory("qa_pair")
    │     └─ 获取所有问答对
    │
    ├─→ 2. 关键词聚类
    │     ├─ jieba 分词 + TF-IDF 提取关键词
    │     ├─ 计算重叠度矩阵
    │     ├─ 贪心聚类（阈值 0.6）
    │     └─ 过滤低频聚类（< 3次）
    │
    ├─→ 3. LLM 生成 FAQ
    │     for each cluster:
    │       ├─ Prompt: "以下是相关问题列表，请生成标准FAQ"
    │       ├─ LLM 返回 {question, answer}
    │       └─ 附加来源引用
    │
    └─→ 4. 持久化到 FaqStore，返回生成的 FAQ 列表

前端: FaqCard 组件展示新生成的 FAQ 卡片
```

---

## 6. 文件结构

### 6.1 后端 (Java / Spring Boot)

```
src/main/java/com/docmind/
├── DocMindApplication.java                // Spring Boot 启动入口
├── controller/
│   ├── QaController.java                  // POST /api/qa, /api/qa/stream (SSE)
│   ├── MaintainController.java            // POST /api/maintain/analyze, /api/maintain/approve
│   ├── OnboardController.java             // POST /api/onboard/start, /api/onboard/resume, GET /api/onboard/progress
│   ├── FaqController.java                 // GET /api/faq, POST /api/faq/detect, GET /api/faq/{id}
│   ├── IndexController.java               // POST /api/index, GET /api/index/status
│   ├── ChatWebSocketHandler.java          // WebSocket /ws/chat 实时通信
│   └── dto/                               // 请求/响应 DTO
│       ├── QaRequest.java
│       ├── QaResponse.java
│       ├── MaintainRequest.java
│       ├── OnboardRequest.java
│       └── ...
├── agent/
│   ├── DocMindAgent.java                  // 门面类，路由到不同模式
│   ├── ReActAgent.java                    // ReAct 推理循环
│   └── AgentBudget.java                   // Token 预算控制
├── rag/
│   ├── VectorStore.java                   // 向量存储接口
│   ├── SqliteVectorStore.java             // SQLite 实现
│   ├── EmbeddingClient.java               // Embedding 接口
│   ├── OllamaEmbeddingClient.java         // Ollama 实现
│   ├── OpenAiEmbeddingClient.java         // OpenAI 实现
│   ├── CodeRetriever.java                 // 混合检索器
│   ├── CodeChunker.java                   // 文档分块器
│   ├── QueryPreprocessor.java             // 查询预处理（分词）
│   └── SearchResultFormatter.java         // 结果格式化
├── memory/
│   ├── ConversationMemory.java            // 短期记忆（内存）
│   ├── LongTermMemory.java                // 长期记忆（JSON）
│   ├── ContextCompressor.java             // 上下文压缩
│   ├── MemoryManager.java                 // 记忆管理门面
│   ├── MemoryEntry.java                   // 记忆条目 record
│   └── MemoryRetriever.java               // 记忆检索
├── plan/
│   ├── Planner.java                       // 任务规划器
│   ├── ExecutionPlan.java                 // 执行计划 record
│   ├── Task.java                          // 任务节点 record
│   ├── PlanExecuteAgent.java              // Plan-and-Execute Agent
│   └── TopologicalSorter.java             // 拓扑排序工具
├── knowledge/
│   ├── GitProcessExecutor.java            // 本地 git 命令封装
│   ├── GitDiffAnalyzer.java               // Git 变更分析
│   ├── ChangeSummary.java                 // 变更摘要 record
│   ├── DocSourceConnector.java            // 外部文档源连接器
│   ├── DocIndexer.java                    // 文档索引器
│   ├── FaqDetector.java                   // FAQ 高频检测
│   ├── FaqStore.java                      // FAQ 持久化
│   ├── FaqEntry.java                      // FAQ 数据结构
│   └── NewcomerProgress.java              // 新人进度 record
├── tool/
│   ├── ToolRegistry.java                  // 工具注册中心
│   ├── ToolDefinition.java                // 工具定义 record
│   ├── PathGuard.java                     // 路径安全守卫
│   └── CommandGuard.java                  // 命令安全守卫
├── llm/
│   ├── LlmClient.java                    // LLM 客户端接口
│   ├── OpenAiCompatibleClient.java        // OpenAI 兼容实现
│   ├── LlmClientFactory.java             // 工厂
│   └── Message.java                       // 消息 record
├── prompt/
│   ├── PromptAssembler.java               // Prompt 组装器
│   └── PromptMode.java                    // Prompt 模式枚举
├── config/
│   └── DocMindConfig.java                 // 全局配置
└── async/
    ├── TaskEventPublisher.java            // 事件发布（推送到 WebSocket）
    └── AsyncTaskManager.java              // 异步任务管理
```

### 6.2 前端 (Vue 3 + TypeScript)

```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.ts                            // Vue 入口
│   ├── App.vue                            // 根组件（导航栏 + 路由视图）
│   ├── router/
│   │   └── index.ts                       // 路由配置
│   ├── stores/                            // Pinia 状态管理
│   │   ├── chat.ts                        // 问答状态（消息列表、加载状态）
│   │   ├── maintain.ts                    // 文档维护状态（变更建议、审批状态）
│   │   ├── onboard.ts                     // 新人引导状态（计划、进度）
│   │   ├── faq.ts                         // FAQ 状态
│   │   └── app.ts                         // 全局状态（连接状态、通知）
│   ├── views/
│   │   ├── ChatView.vue                   // 知识问答页面（左历史 + 右输入）
│   │   ├── MaintainView.vue               // 文档维护页面（变更列表 + Diff 预览）
│   │   ├── OnboardView.vue                // 新人引导页面（计划卡片 + 进度条）
│   │   └── FaqView.vue                    // FAQ 管理页面（列表 + 搜索）
│   ├── components/
│   │   ├── ChatMessage.vue                // 聊天消息气泡（支持 Markdown 渲染）
│   │   ├── SourceReference.vue            // 来源引用卡片（文件路径 + 行号）
│   │   ├── DiffPreview.vue                // Diff 预览（并排/统一视图）
│   │   ├── TaskPlanCard.vue               // 任务计划卡片（状态 + 描述）
│   │   ├── TaskProgress.vue               // 任务进度条（步骤指示器）
│   │   ├── FaqCard.vue                    // FAQ 卡片（问题 + 频率 + 来源）
│   │   ├── MarkdownRenderer.vue           // Markdown 渲染（代码高亮）
│   │   └── NotificationBar.vue            // 顶部通知栏（文档更新提醒）
│   ├── composables/
│   │   ├── useWebSocket.ts                // WebSocket 连接管理
│   │   ├── useSSE.ts                      // SSE 流式接收
│   │   └── useChat.ts                     // 问答逻辑封装
│   ├── api/
│   │   ├── request.ts                     // Axios 实例 + 拦截器
│   │   ├── qa.ts                          // 问答 API
│   │   ├── maintain.ts                    // 文档维护 API
│   │   ├── onboard.ts                     // 新人引导 API
│   │   ├── faq.ts                         // FAQ API
│   │   └── index.ts                       // 索引 API
│   ├── types/
│   │   └── index.ts                       // TypeScript 类型定义
│   └── utils/
│       ├── markdown.ts                    // Markdown 工具函数
│       └── format.ts                      // 格式化工具
├── public/
│   └── favicon.ico
└── e2e/
    └── smoke.spec.ts                      // E2E 测试
```

### 6.3 资源文件

```
src/main/resources/
├── application.yml                        # Spring Boot 配置
├── db/
│   └── schema.sql                         # SQLite 建表语句
├── prompts/
│   ├── qa_system.txt                      # 问答系统 Prompt
│   ├── react_maintain.txt                 # 文档维护 ReAct Prompt
│   ├── planner.txt                        # 任务规划 Prompt
│   └── faq_generate.txt                   # FAQ 生成 Prompt
└── stopwords.txt                          # 停用词表
```

### 6.4 配置文件

```
~/.docmind/
├── config.json                            # 全局配置
├── db/
│   ├── vectors.db                         # 向量数据库
│   └── faq.db                             # FAQ 数据库
└── memory/
    ├── memories.json                      # 长期记忆
    └── conversations/                     # 会话记忆
```

---

## 7. 技术栈与依赖

### 7.1 后端

| 类别 | 选型 | Maven 坐标 | 版本 |
|------|------|-----------|------|
| 语言 | Java 17 | - | 17 |
| 框架 | Spring Boot | `org.springframework.boot:spring-boot-starter-web` | 3.2+ |
| WebSocket | Spring WebSocket | `org.springframework.boot:spring-boot-starter-websocket` | 3.2+ |
| 构建 | Maven | - | 3.9+ |
| SQLite | sqlite-jdbc | `org.xerial:sqlite-jdbc` | 3.45.0+ |
| HTTP 客户端 | OkHttp | `com.squareup.okhttp3:okhttp` | 4.12+ |
| JSON | Jackson | `com.fasterxml.jackson.core:jackson-databind` | 2.17+ |
| 中文分词 | jieba-analysis | `com.huaban:jieba-analysis` | 1.0.2 |
| 测试 | JUnit 5 | `org.junit.jupiter:junit-jupiter` | 5.10+ |
| Mock | Mockito | `org.mockito:mockito-core` | 5.11+ |
| 日志 | SLF4J + Logback | `ch.qos.logback:logback-classic` | 1.5+ |

### 7.2 前端

| 类别 | 选型 | npm 包 | 版本 |
|------|------|--------|------|
| 框架 | Vue 3 | `vue` | 3.4+ |
| 语言 | TypeScript | `typescript` | 5.3+ |
| 构建 | Vite | `vite` | 5.0+ |
| 路由 | Vue Router | `vue-router` | 4.3+ |
| 状态管理 | Pinia | `pinia` | 2.1+ |
| UI 组件库 | Element Plus | `element-plus` | 2.7+ |
| HTTP 客户端 | Axios | `axios` | 1.7+ |
| Markdown 渲染 | markdown-it | `markdown-it` | 14.0+ |
| 代码高亮 | highlight.js | `highlight.js` | 11.9+ |
| 图表 | vue-flow | `@vue-flow/core` | 1.33+（任务依赖图） |
| 测试 | Vitest | `vitest` | 1.6+ |
| E2E 测试 | Playwright | `@playwright/test` | 1.44+ |

### 7.3 不引入的依赖

- 不使用 JGit（改用本地 git CLI）
- 不使用 LangChain4j（自研核心逻辑，保持轻量）
- 不使用 Nginx 反向代理（Spring Boot 内嵌 Tomcat 直接服务前端静态资源）

---

## 8. 错误处理策略

### 8.1 异常体系

```java
// 基础异常
public class DocMindException extends RuntimeException { ... }

// 各模块异常
public class RAGException extends DocMindException { ... }
public class GitException extends DocMindException { ... }
public class GitNotFoundException extends GitException { ... }
public class NotGitRepoException extends GitException { ... }
public class LlmException extends DocMindException { ... }
public class EmbeddingException extends DocMindException { ... }
public class ToolException extends DocMindException { ... }
public class PlanException extends DocMindException { ... }
```

### 8.2 降级策略

| 故障场景 | 降级方案 |
|----------|----------|
| Embedding 服务不可用 | 降级为纯关键词检索 |
| LLM 调用超时 | 返回检索结果摘要，不生成回答 |
| Git 命令执行失败 | 提示错误信息，跳过变更分析 |
| SQLite 写入失败 | stderr 提示，不阻塞主流程 |
| 网络不可用 | 仅使用本地已索引数据 |
| 外部文档源不可达 | 降级为仅搜索本地文档 |

---

## 9. 性能优化

### 9.1 向量检索优化

- **内存缓存**: 启动时将所有 embedding 加载到内存
- **批量插入**: 索引时使用事务批量插入，减少 IO
- **惰性索引**: 增量索引，只处理变更文件

### 9.2 LLM 调用优化

- **Prompt 缓存**: 相同 system prompt 复用缓存
- **流式输出**: SSE 流式返回回答，前端逐 token 渲染
- **Token 预算**: 限制上下文长度，避免超出模型限制

### 9.3 并发优化

- **任务并行**: Plan-and-Execute 中无依赖任务并行执行（最大 4 线程）
- **异步索引**: 文档索引在后台线程执行，通过 WebSocket 推送进度
- **IO 隔离**: 数据库操作使用独立线程池

### 9.4 前端优化

- **虚拟滚动**: 聊天消息列表使用虚拟滚动，支持大量历史消息
- **代码分割**: Vue Router 路由级懒加载，首屏只加载问答页面
- **Markdown 缓存**: 已渲染的 Markdown 结果缓存，避免重复解析
- **WebSocket 重连**: 自动重连 + 指数退避，断线不丢失状态

---

## 10. 测试策略

### 10.1 后端单元测试

| 测试类 | 覆盖范围 | Mock 策略 |
|--------|----------|----------|
| `VectorStoreTest` | 向量插入、余弦相似度、TopK | 内存 SQLite |
| `CodeRetrieverTest` | 混合检索、评分融合 | Mock VectorStore + EmbeddingClient |
| `CodeChunkerTest` | 各类型文件分块 | 无 Mock |
| `MemoryManagerTest` | CRUD、压缩、检索 | Mock 文件系统 |
| `GitProcessExecutorTest` | 命令执行、错误处理 | Mock ProcessBuilder |
| `GitDiffAnalyzerTest` | diff 解析、符号提取 | Mock GitProcessExecutor |
| `FaqDetectorTest` | 聚类、频率统计 | Mock Memory + LlmClient |
| `PlannerTest` | 任务规划、拓扑排序 | Mock LlmClient |
| `TopologicalSorterTest` | 拓扑排序、循环检测 | 无 Mock |
| `PathGuardTest` | 路径安全校验 | 无 Mock |

### 10.2 后端 API 测试

| 测试类 | 覆盖范围 |
|--------|----------|
| `QaControllerTest` | POST /api/qa 请求/响应、SSE 流式输出 |
| `MaintainControllerTest` | 分析触发、审批处理 |
| `OnboardControllerTest` | 启动引导、恢复进度、WebSocket 推送 |
| `FaqControllerTest` | FAQ 列表、检测触发 |
| `IndexControllerTest` | 索引触发、状态查询 |

### 10.3 前端测试

| 测试文件 | 覆盖范围 |
|----------|----------|
| `ChatMessage.spec.ts` | 消息渲染、Markdown 解析、来源引用展示 |
| `DiffPreview.spec.ts` | Diff 渲染、确认/拒绝交互 |
| `TaskPlanCard.spec.ts` | 任务卡片展示、状态变更 |
| `useWebSocket.spec.ts` | WebSocket 连接、重连、消息处理 |
| `stores/chat.spec.ts` | 问答状态管理 |

### 10.4 E2E 测试 (Playwright)

```typescript
// e2e/smoke.spec.ts
test.describe('DocMind-Agent Smoke Test', () => {
  test('知识问答', async ({ page }) => {
    await page.goto('/');
    await page.fill('#chat-input', '怎么启动服务？');
    await page.click('#send-btn');
    await expect(page.locator('.chat-message.assistant')).toBeVisible();
    await expect(page.locator('.source-reference')).toBeVisible();
  });

  test('文档维护', async ({ page }) => {
    await page.goto('/maintain');
    await page.click('#analyze-btn');
    await expect(page.locator('.diff-preview')).toBeVisible();
    await page.click('.approve-btn');
  });

  test('新人引导', async ({ page }) => {
    await page.goto('/onboard');
    await page.fill('#goal-input', '完成第一个功能开发');
    await page.click('#start-btn');
    await expect(page.locator('.task-plan-card')).toHaveCount(5, { timeout: 10000 });
  });
});
```

### 10.5 集成测试

```bash
# 后端集成测试
mvn test -Dtest=RagQaIntegrationTest
mvn test -Dtest=DocMaintainIntegrationTest
mvn test -Dtest=OnboardIntegrationTest
mvn test -Dtest=FaqSystemIntegrationTest

# 前端测试
cd frontend && npm run test          # Vitest 单元测试
cd frontend && npm run test:e2e      # Playwright E2E 测试
```

---

## 11. 实施路线

### Phase 1: 基础框架 + RAG 问答 (3周)

**Week 1 — 后端骨架**:
- Spring Boot 工程、目录结构、配置加载 (application.yml)
- SQLite 初始化 + 表结构
- GitProcessExecutor 基础实现
- CodeChunker 实现
- VectorStore 实现（SQLite 存储 + 余弦相似度）
- EmbeddingClient 接口 + Ollama 实现

**Week 2 — 后端核心**:
- CodeRetriever 混合检索
- QueryPreprocessor 中文分词
- LlmClient 接口 + OpenAI 兼容实现
- ReActAgent 基础循环
- MemoryManager 基础 CRUD
- QaController + IndexController (REST API)
- SSE 流式输出

**Week 3 — 前端骨架 + 问答页面**:
- Vue 3 + Vite + TypeScript 项目初始化
- Element Plus 集成 + 全局布局 (App.vue)
- Router + Pinia 状态管理
- ChatView 页面 + ChatMessage 组件
- MarkdownRenderer 组件 + 代码高亮
- SourceReference 来源引用卡片
- useSSE 组合式函数 (SSE 流式接收)
- 索引页面

**验证**: 浏览器打开页面，输入问题，流式返回带来源引用的回答

### Phase 2: 文档维护 (2周)

**Week 4 — 后端**:
- GitDiffAnalyzer 实现
- diff 解析: 重命名检测、配置变更、API 变更
- ChangeSummary 数据结构
- 内置工具注册: search_docs, analyze_git_diff, check_doc_sync
- ReAct 维护 Prompt 模板
- MaintainController (REST API)

**Week 5 — 前端**:
- MaintainView 页面
- DiffPreview 组件 (并排/统一视图切换)
- HITL 审批交互 (确认/拒绝按钮 + 批量操作)
- approve API 对接

**验证**: 修改变量名后，页面展示变更建议 + Diff 预览，可逐条审批

### Phase 3: 新人引导 (2周)

**Week 6 — 后端**:
- Planner 实现
- ExecutionPlan + Task 数据结构
- TopologicalSorter
- PlanExecuteAgent 实现
- NewcomerProgress 进度追踪
- OnboardController + ChatWebSocketHandler
- WebSocket 实时推送任务状态

**Week 7 — 前端**:
- OnboardView 页面
- TaskPlanCard 组件 (任务卡片 + 状态图标)
- vue-flow 依赖关系图
- TaskProgress 步骤进度条
- useWebSocket 组合式函数
- 会话恢复逻辑

**验证**: 页面输入目标，展示可视化计划，执行过程中实时更新进度

### Phase 4: FAQ 系统 (2周)

**Week 8 — 后端**:
- FaqStore 实现（SQLite）
- FaqDetector 关键词聚类
- TF-IDF 关键词提取
- LLM 生成 FAQ
- FAQ 注入 system prompt
- FaqController (REST API)

**Week 9 — 前端**:
- FaqView 页面
- FaqCard 组件 (问题 + 频率 + 来源)
- FAQ 搜索 + 筛选
- FAQ 检测触发 + 结果展示

**验证**: 3+ 相似问题被识别，FAQ 自动生成并在页面展示

### Phase 5: 外部文档源 + 收尾 (2周)

**Week 10 — 后端**:
- DocSourceConnector 接口
- Confluence REST API 集成
- DocIndexer 外部文档索引

**Week 11 — 全量打磨**:
- 配置管理页面 (前端)
- 通知栏组件 (文档更新提醒)
- 全量后端集成测试
- 前端 Vitest 单元测试
- Playwright E2E 测试
- 性能基准测试
- UI 打磨 + 响应式适配
- Bug 修复

---

## 12. 配置文件规范

```json
{
  "version": 1,
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "${OPENAI_API_KEY}",
    "baseUrl": "https://api.openai.com/v1",
    "maxTokens": 4096,
    "temperature": 0.1
  },
  "embedding": {
    "provider": "ollama",
    "model": "nomic-embed-text:latest",
    "baseUrl": "http://localhost:11434",
    "dimension": 768
  },
  "rag": {
    "topK": 5,
    "minSimilarity": 0.3,
    "maxChunkSize": 2000,
    "maxChunksPerFile": 5
  },
  "faq": {
    "minFrequency": 3,
    "similarityThreshold": 0.6,
    "maxInjected": 50,
    "staleDays": 30
  },
  "memory": {
    "maxShortTermEntries": 20,
    "compressionTriggerCount": 20,
    "maxLongTermEntries": 10000
  },
  "git": {
    "defaultCommitCount": 5,
    "repoPath": "."
  },
  "docSources": [
    {
      "type": "local",
      "path": "/path/to/docs",
      "extensions": [".md", ".txt", ".java", ".py", ".yml"]
    }
  ]
}
```

---

## 13. 关键设计决策总结

| 决策 | 选择 | 理由 |
|------|------|------|
| 交互方式 | Web 前端 (Vue 3 SPA) | 丰富的交互体验，支持实时更新、可视化、Diff 预览 |
| 后端框架 | Spring Boot 3.2 | 内嵌 Tomcat、WebSocket 支持、自动配置、生态成熟 |
| 前端框架 | Vue 3 + TypeScript | 响应式、组件化、类型安全、学习曲线平缓 |
| 实时通信 | SSE + WebSocket | SSE 单向流式回答，WebSocket 双向任务状态推送 |
| Git 集成 | 本地 git CLI (ProcessBuilder) | 无额外依赖，兼容性好，与用户环境一致 |
| 向量存储 | SQLite | 轻量级，单文件部署，适合几千 chunks 规模 |
| Embedding | Ollama 本地 + OpenAI 云端 | 灵活切换，本地部署隐私安全 |
| 代码分块 | 正则提取 | 零外部依赖，覆盖主要代码结构 |
| 中文分词 | jieba | 成熟稳定，Java 移植版可用 |
| FAQ 聚类 | 关键词重叠度 + LLM 精炼 | 两阶段兼顾效率和准确性 |
| 任务规划 | LLM 生成 + 拓扑排序 | 利用 LLM 理解能力 + 确定性排序 |
| 部署方式 | Spring Boot 单 JAR + 前端静态资源 | 后端直接服务前端，无需 Nginx，部署简单 |
| 错误处理 | 降级而非失败 | 核心功能不受单一组件故障影响 |
