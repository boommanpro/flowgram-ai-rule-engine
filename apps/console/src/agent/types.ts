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
}

/** Plan 步骤 */
export interface PlanStep {
  id: string;
  intent: string;
  action: string;
  args?: Record<string, any>;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: string;
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
}

/** SSE 事件处理器 */
export interface SseHandlers {
  onToken?: (content: string) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}
