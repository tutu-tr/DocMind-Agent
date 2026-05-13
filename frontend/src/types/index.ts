// ========== 文档块 ==========
export interface DocChunk {
  id: string
  filePath: string
  chunkType: 'file' | 'class' | 'method' | 'section'
  name: string
  content: string
  startLine: number
  endLine: number
  embedding: number[] | null
  sourceType: 'local' | 'confluence' | 'ticket'
  metadata: Record<string, string>
}

// ========== 检索结果 ==========
export interface SearchResult {
  chunk: DocChunk
  vectorScore: number
  keywordScore: number
  finalScore: number
  matchReason: string
}

// ========== 问答相关 ==========
export interface SourceReference {
  filePath: string
  line: number
  chunkType: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sources: SourceReference[]
  timestamp: string
  loading?: boolean
}

export interface QaRequest {
  query: string
  sessionId?: string
}

export interface QaResponse {
  answer: string
  sources: SourceReference[]
  sessionId: string
}

// ========== 文档维护 ==========
export interface RenamedSymbol {
  oldName: string
  newName: string
  filePath: string
  symbolType?: string
}

export interface AddedRemovedConfig {
  key: string
  action: 'added' | 'removed'
  filePath: string
}

export interface ModifiedApi {
  signature: string
  action: 'added' | 'removed' | 'modified'
  filePath: string
}

export interface ChangeSummary {
  commitHash: string
  commitMessage: string
  renames: RenamedSymbol[]
  configChanges: AddedRemovedConfig[]
  apiChanges: ModifiedApi[]
  timestamp: string
}

export interface UpdateSuggestion {
  id: string
  file: string
  line: number
  oldText: string
  newText: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  changeSummary: ChangeSummary
}

export interface MaintainAnalyzeResponse {
  suggestions: UpdateSuggestion[]
  changeSummaries: ChangeSummary[]
}

export interface MaintainApproveRequest {
  suggestionIds: string[]
  action: 'approve' | 'reject'
  rejectReasons?: Record<string, string>
}

// ========== 新人引导 ==========
export type TaskType = 'READ_DOC' | 'RUN_COMMAND' | 'SEARCH' | 'WRITE' | 'CUSTOM'
export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type PlanStatus = 'DRAFT' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED'

export interface Task {
  id: string
  description: string
  type: TaskType
  dependencies: string[]
  status: TaskStatus
  result: string
  error: string
}

export interface ExecutionPlan {
  id: string
  goal: string
  tasks: Task[]
  executionBatches: Task[][]
  status: PlanStatus
  createdAt: string
}

export interface OnboardProgress {
  id: string
  userId: string
  taskDescription: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  detail: {
    completedTasks: string[]
    currentTask: string
    errors: Array<{ taskId: string; message: string; timestamp: string }>
  }
  lastActive: string
}

export interface OnboardStartRequest {
  goal: string
  userId?: string
}

// ========== FAQ ==========
export interface FaqEntry {
  id: string
  question: string
  answer: string
  sources: SourceReference[]
  frequency: number
  clusterId: string
  lastVerified: string
  createdAt: string
}

export interface FaqDetectResponse {
  faqs: FaqEntry[]
  totalClusters: number
  totalQaPairs: number
}

// ========== 索引 ==========
export interface IndexRequest {
  path?: string
  type: 'local' | 'confluence'
}

export interface IndexStatus {
  status: 'idle' | 'indexing' | 'completed' | 'error'
  totalFiles: number
  indexedFiles: number
  message: string
}

// ========== WebSocket 消息 ==========
export interface WsMessage {
  type: 'task_status' | 'progress_update' | 'error' | 'complete' | 'notification'
  payload: any
}

// ========== 通用 ==========
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiError {
  code: string
  message: string
  details?: string
}
