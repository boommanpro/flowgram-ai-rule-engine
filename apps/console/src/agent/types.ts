/**
 * Agent 对话类型定义
 */

/** 会话 */
export interface AgentSession {
  id?: number;
  sessionKey: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 权限策略 */
export type PermissionPolicy = 'always' | 'confirm' | 'forbid';

/** 消息 */
export interface AgentMessage {
  id?: number;
  sessionKey: string;
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  toolCalls?: string;
  toolCallId?: string;
  pageContext?: string;
  createdAt?: string;
}

/** 工具调用事件（SSE tool_call） */
export interface ToolCallEvent {
  id: string;
  action: string;
  args: Record<string, any>;
  policy: PermissionPolicy;
  /** 执行结果（执行完成后原地更新） */
  result?: string;
}

/** Plan 步骤 */
export interface PlanStep {
  id: string;
  intent: string;
  action: string;
  args?: Record<string, any>;
  status: 'pending' | 'running' | 'done' | 'error' | 'testing' | 'testFailed';
  result?: string;
}

/** 活跃的执行计划（todo 机制） */
export interface ActivePlan {
  id: string;
  steps: PlanStep[];
  /** 跟踪 addNode 返回的 nodeId，供 connect 步骤 $0/$1 占位符解析 */
  createdNodeIds: string[];
}

/** 页面上下文 */
export interface PageContext {
  route: string;
  workflowCode?: string;
  canvasSummary?: {
    nodes: { id: string; type: string; title: string }[];
    edges: { from: string; to: string; fromPort?: string }[];
    selectedNodeId?: string;
  };
}

/** 前端展示的消息（含 plan 卡片等扩展） */
export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: ToolCallEvent;
  planSteps?: PlanStep[];
  timestamp: number;
  // New: for multimodal images
  images?: string[];
  // New: for debug panel
  debugInfo?: {
    request?: any;
    response?: any;
  };
  // 关联的调试条目 ID，用于点击消息跳转调试面板
  debugEntryId?: string;
  // New: for subagent
  subagentSteps?: Array<{
    action: string;
    args?: any;
    status: 'pending' | 'running' | 'done' | 'error';
    result?: string;
  }>;
  subagentResult?: {
    success: boolean;
    content: string;
  };
}

/** SSE 事件处理器 */
export interface SseHandlers {
  onToken?: (content: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  // New debug events
  onDebugRequest?: (data: { messages: any[]; model: string; temperature: number; timestamp: number }) => void;
  onDebugResponse?: (data: { content: string; toolCalls: any[]; toolCallsCount: number; durationMs: number }) => void;
  /** 工具执行结果调试事件 — 展示每个 tool_call 的实际执行结果 */
  onDebugToolResult?: (data: { results: Array<{ toolCallId: string; rejected: boolean; result: string }>; count: number }) => void;
  /** 上下文加载详情 — 展示本次请求加载了哪些工具/知识/图谱 */
  onContextLoaded?: (data: {
    model: string;
    apiHost: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
    historyMessages: number;
    systemPromptChars: number;
    ragChunks: number;
    ragMs: number;
    ragContext?: string;
    nodeKbCount?: number;
    nodeKbMs?: number;
    nodeKbContext?: string;
    graphNodes: number;
    graphMs: number;
    graphContext?: string;
    toolsCount: number;
    toolsMs: number;
    totalMessages: number;
    estimatedTokens: number;
    tokenPercentage: number;
  }) => void;
  /** Token 用量警告 — 上下文达到 80% 时触发 */
  onTokenWarning?: (data: { percentage: number; estimated: number; limit: number; message: string }) => void;
  // New subagent events
  onSubagentToolCall?: (data: { id: string; action: string; args: any }) => void;
  onSubagentRoundDone?: (data: { round: number; toolCalls: number }) => void;
  onSubagentFinalResult?: (data: { content: string }) => void;
  onSubagentDone?: () => void;
}
