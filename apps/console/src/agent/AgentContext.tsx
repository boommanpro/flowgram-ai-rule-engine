/**
 * Agent 全局状态 Context
 * 管理：会话列表、当前会话、消息流、权限配置、对话编排
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useLocation } from 'react-router-dom';
import { nanoid } from 'nanoid';

import { agentApi } from './api';
import { streamChat, streamToolResult, type ToolResultItem } from './sse-client';
import type {
  AgentSession,
  AgentMessage,
  DisplayMessage,
  PermissionPolicy,
  ToolCallEvent,
  PageContext,
  PlanStep,
} from './types';

/** 工具执行器接口（由 AgentDock 注入） */
export interface ToolExecutor {
  execute(action: string, args: Record<string, any>): Promise<{ result: string; rejected: boolean }>;
}

interface AgentContextValue {
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;

  sessions: AgentSession[];
  currentSessionKey: string | null;
  messages: DisplayMessage[];
  permissions: Record<string, PermissionPolicy>;
  streaming: boolean;
  pendingConfirm: ToolCallEvent | null;

  setToolExecutor: (executor: ToolExecutor) => void;
  resolveConfirm: (approved: boolean) => void;

  createSession: (title?: string) => Promise<void>;
  switchSession: (sessionKey: string) => Promise<void>;
  renameSession: (sessionKey: string, title: string) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  updatePermission: (action: string, policy: PermissionPolicy) => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}

/** 后端消息 → 前端展示消息 */
function convertMessages(msgs: AgentMessage[]): DisplayMessage[] {
  const result: DisplayMessage[] = [];
  for (const msg of msgs) {
    const ts = msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now();
    if (msg.role === 'user') {
      result.push({
        id: `msg-${msg.id}`,
        role: 'user',
        content: msg.content || '',
        timestamp: ts,
      });
    } else if (msg.role === 'assistant') {
      if (msg.content) {
        result.push({
          id: `msg-${msg.id}`,
          role: 'assistant',
          content: msg.content,
          timestamp: ts,
        });
      }
      if (msg.toolCalls) {
        try {
          const tcs = JSON.parse(msg.toolCalls);
          for (const tc of tcs) {
            let args = {};
            try {
              args = JSON.parse(tc.function?.arguments || '{}');
            } catch { /* ignore */ }
            result.push({
              id: `msg-${msg.id}-tool-${tc.id}`,
              role: 'tool',
              content: '',
              toolCall: {
                id: tc.id,
                action: tc.function?.name || 'unknown',
                args,
                policy: 'always',
              },
              timestamp: ts,
            });
          }
        } catch { /* ignore */ }
      }
    } else if (msg.role === 'tool') {
      result.push({
        id: `msg-${msg.id}`,
        role: 'tool',
        content: msg.content || '',
        timestamp: ts,
      });
    }
  }
  return result;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [dockOpen, setDockOpen] = useState(false);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [currentSessionKey, setCurrentSessionKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionPolicy>>({});
  const [streaming, setStreaming] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ToolCallEvent | null>(null);

  const location = useLocation();
  const toolExecutorRef = useRef<ToolExecutor | null>(null);
  const confirmResolverRef = useRef<((v: boolean) => void) | null>(null);
  const currentSessionKeyRef = useRef<string | null>(null);

  // 保持 ref 同步
  useEffect(() => {
    currentSessionKeyRef.current = currentSessionKey;
  }, [currentSessionKey]);

  // 初始化：加载会话列表 + 默认权限
  useEffect(() => {
    agentApi.listSessions().then((list) => {
      setSessions(list || []);
      // 自动选中第一个会话（或创建新会话）
      if (list && list.length > 0) {
        setCurrentSessionKey(list[0].sessionKey);
      }
    }).catch(() => {});
    agentApi.getPermissionDefaults().then(setPermissions).catch(() => {});
  }, []);

  // 切换会话时加载消息和权限
  useEffect(() => {
    if (!currentSessionKey) return;
    agentApi.getMessages(currentSessionKey).then((msgs) => {
      setMessages(convertMessages(msgs || []));
    }).catch(() => {});
    agentApi.getPermissions(currentSessionKey).then(setPermissions).catch(() => {});
  }, [currentSessionKey]);

  const setToolExecutor = useCallback((executor: ToolExecutor) => {
    toolExecutorRef.current = executor;
  }, []);

  const resolveConfirm = useCallback((approved: boolean) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(approved);
      confirmResolverRef.current = null;
    }
    setPendingConfirm(null);
  }, []);

  const getPageContextJson = useCallback((): string => {
    const ctx: PageContext = { route: location.pathname };
    return JSON.stringify(ctx);
  }, [location.pathname]);

  const createSession = useCallback(async (title?: string) => {
    const session = await agentApi.createSession(title);
    setSessions((prev) => [session, ...prev]);
    setCurrentSessionKey(session.sessionKey);
    setMessages([]);
    setDockOpen(true);
  }, []);

  const switchSession = useCallback(async (sessionKey: string) => {
    setCurrentSessionKey(sessionKey);
    setDockOpen(true);
  }, []);

  const renameSession = useCallback(async (sessionKey: string, title: string) => {
    await agentApi.renameSession(sessionKey, title);
    setSessions((prev) =>
      prev.map((s) => (s.sessionKey === sessionKey ? { ...s, title } : s))
    );
  }, []);

  const deleteSession = useCallback(async (sessionKey: string) => {
    await agentApi.deleteSession(sessionKey);
    setSessions((prev) => prev.filter((s) => s.sessionKey !== sessionKey));
    if (currentSessionKeyRef.current === sessionKey) {
      setCurrentSessionKey(null);
      setMessages([]);
    }
  }, []);

  const updatePermission = useCallback(async (action: string, policy: PermissionPolicy) => {
    setPermissions((prev) => ({ ...prev, [action]: policy }));
    if (currentSessionKey) {
      await agentApi.updatePermission(currentSessionKey, action, policy);
    }
  }, [currentSessionKey]);

  /** 显示确认弹窗 */
  const showConfirm = useCallback((event: ToolCallEvent): Promise<boolean> => {
    setPendingConfirm(event);
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
    });
  }, []);

  /** 执行 Plan：渲染步骤卡片 → 自动逐步执行 → 实时更新状态 */
  const executePlan = useCallback(
    async (event: ToolCallEvent): Promise<ToolResultItem> => {
      const rawSteps = Array.isArray(event.args.steps) ? event.args.steps : [];
      if (rawSteps.length === 0) {
        return {
          toolCallId: event.id,
          result: JSON.stringify({ success: true, stepsCount: 0 }),
          rejected: false,
        };
      }

      // 构建 PlanStep 列表
      const planSteps: PlanStep[] = rawSteps.map((s: any, idx: number) => ({
        id: `plan-step-${idx}-${nanoid(4)}`,
        intent: s.intent || s.description || `Step ${idx + 1}`,
        action: s.action || 'unknown',
        args: s.args || {},
        status: 'pending' as const,
      }));

      // 创建一条带 planSteps 的展示消息
      const planMsgId = nanoid();
      setMessages((prev) => [
        ...prev,
        {
          id: planMsgId,
          role: 'tool' as const,
          content: '',
          planSteps,
          timestamp: Date.now(),
        },
      ]);

      const executor = toolExecutorRef.current;
      const results: string[] = [];

      // 逐步执行
      for (let i = 0; i < planSteps.length; i++) {
        const step = planSteps[i];

        // 更新为 running
        setMessages((prev) =>
          prev.map((m) =>
            m.id === planMsgId
              ? {
                  ...m,
                  planSteps: m.planSteps!.map((ps, idx) =>
                    idx === i ? { ...ps, status: 'running' as const } : ps
                  ),
                }
              : m
          )
        );

        try {
          if (!executor) {
            throw new Error('tool executor not registered');
          }
          const { result, rejected } = await executor.execute(step.action, step.args || {});
          const parsed = (() => {
            try {
              return JSON.parse(result);
            } catch {
              return { raw: result };
            }
          })();
          results.push(JSON.stringify({ action: step.action, result: parsed, rejected }));

          // 更新为 done
          setMessages((prev) =>
            prev.map((m) =>
              m.id === planMsgId
                ? {
                    ...m,
                    planSteps: m.planSteps!.map((ps, idx) =>
                      idx === i
                        ? {
                            ...ps,
                            status: 'done' as const,
                            result:
                              typeof parsed === 'object' && parsed !== null
                                ? JSON.stringify(parsed).slice(0, 120)
                                : String(result).slice(0, 120),
                          }
                        : ps
                    ),
                  }
                : m
            )
          );
        } catch (e) {
          const errMsg = (e as Error).message;
          results.push(JSON.stringify({ action: step.action, error: errMsg }));

          // 更新为 error
          setMessages((prev) =>
            prev.map((m) =>
              m.id === planMsgId
                ? {
                    ...m,
                    planSteps: m.planSteps!.map((ps, idx) =>
                      idx === i
                        ? { ...ps, status: 'error' as const, result: errMsg.slice(0, 120) }
                        : ps
                    ),
                  }
                : m
            )
          );
          // 出错后停止后续步骤
          break;
        }
      }

      return {
        toolCallId: event.id,
        result: JSON.stringify({
          success: true,
          stepsCount: planSteps.length,
          executedCount: results.length,
          results,
        }),
        rejected: false,
      };
    },
    []
  );

  /** 执行单个 tool_call */
  const executeOneTool = useCallback(
    async (event: ToolCallEvent): Promise<ToolResultItem> => {
      // createPlan 特殊处理：渲染 PlanCard 并自动逐步执行
      if (event.action === 'createPlan') {
        return executePlan(event);
      }
      // forbid → 自动拒绝
      if (event.policy === 'forbid') {
        return { toolCallId: event.id, result: '', rejected: true };
      }
      // confirm → 弹确认
      if (event.policy === 'confirm') {
        const approved = await showConfirm(event);
        if (!approved) {
          return { toolCallId: event.id, result: '', rejected: true };
        }
      }
      // 执行
      if (!toolExecutorRef.current) {
        return {
          toolCallId: event.id,
          result: JSON.stringify({ error: 'tool executor not registered' }),
          rejected: false,
        };
      }
      try {
        const { result, rejected } = await toolExecutorRef.current.execute(event.action, event.args);
        return { toolCallId: event.id, result, rejected };
      } catch (e) {
        return {
          toolCallId: event.id,
          result: JSON.stringify({ error: (e as Error).message }),
          rejected: false,
        };
      }
    },
    [showConfirm, executePlan]
  );

  /** 发送消息 */
  const sendMessage = useCallback(
    async (text: string) => {
      const sessionKey = currentSessionKeyRef.current;
      if (!sessionKey || streaming) return;

      // 添加 user 消息
      const userMsg: DisplayMessage = {
        id: nanoid(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      // 创建 assistant 占位
      let currentAssistantId = nanoid();
      const assistantMsg: DisplayMessage = {
        id: currentAssistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      const pendingToolCalls: ToolCallEvent[] = [];
      let errorMsg: string | null = null;

      const handlers = {
        onToken: (content: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, content: m.content + content }
                : m
            )
          );
        },
        onToolCall: (event: ToolCallEvent) => {
          pendingToolCalls.push(event);
          // 添加 tool_call 展示消息
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(),
              role: 'tool' as const,
              content: '',
              toolCall: event,
              timestamp: Date.now(),
            },
          ]);
        },
        onDone: () => {},
        onError: (msg: string) => {
          errorMsg = msg;
        },
      };

      try {
        // 第一轮
        await streamChat(sessionKey, text, getPageContextJson(), handlers);

        // 后续轮（tool 结果回灌）
        let safetyCounter = 0;
        while (pendingToolCalls.length > 0 && !errorMsg && safetyCounter < 20) {
          safetyCounter++;
          const calls = pendingToolCalls.splice(0, pendingToolCalls.length);
          const results: ToolResultItem[] = [];
          for (const tc of calls) {
            results.push(await executeOneTool(tc));
          }
          // 创建新 assistant 占位
          currentAssistantId = nanoid();
          setMessages((prev) => [
            ...prev,
            {
              id: currentAssistantId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
            },
          ]);
          await streamToolResult(sessionKey, results, handlers);
        }

        if (errorMsg) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, content: m.content || `⚠️ ${errorMsg}` }
                : m
            )
          );
        }
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === currentAssistantId
              ? { ...m, content: m.content || `⚠️ ${(e as Error).message}` }
              : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [streaming, getPageContextJson, executeOneTool]
  );

  const value: AgentContextValue = {
    dockOpen,
    setDockOpen,
    sessions,
    currentSessionKey,
    messages,
    permissions,
    streaming,
    pendingConfirm,
    setToolExecutor,
    resolveConfirm,
    createSession,
    switchSession,
    renameSession,
    deleteSession,
    sendMessage,
    updatePermission,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
