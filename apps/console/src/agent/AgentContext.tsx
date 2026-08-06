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
import { streamChat, streamToolResult, streamCompact, streamSubagent, type ToolResultItem } from './sse-client';
import { getCanvasContext } from './tools';
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
  queueLength: number;
  pendingConfirm: ToolCallEvent | null;

  // Token usage tracking (Task 2)
  tokenUsage: { estimated: number; limit: number };
  compactContext: () => Promise<void>;

  // Debug entries (Task 3)
  debugEntries: Array<{
    id: string;
    timestamp: number;
    request?: any;
    response?: any;
    context?: any;
  }>;
  clearDebugEntries: () => void;

  setToolExecutor: (executor: ToolExecutor) => void;
  resolveConfirm: (approved: boolean) => void;

  createSession: (title?: string) => Promise<void>;
  switchSession: (sessionKey: string) => Promise<void>;
  renameSession: (sessionKey: string, title: string) => Promise<void>;
  deleteSession: (sessionKey: string) => Promise<void>;
  sendMessage: (text: string, images?: string[]) => Promise<void>;
  stopStreaming: () => void;
  updatePermission: (action: string, policy: PermissionPolicy) => Promise<void>;
  updateGlobalPermission: (action: string, policy: PermissionPolicy) => Promise<void>;

  // Subagent debug flow
  debugNode: (nodeId: string, instruction: string) => Promise<void>;
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
  const [queueLength, setQueueLength] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<ToolCallEvent | null>(null);

  // Token usage tracking — limit 从模型配置的 contextWindow 获取
  const [tokenUsage, setTokenUsage] = useState<{ estimated: number; limit: number }>({ estimated: 0, limit: 32768 });
  // 系统提示词 token 估算（从 context_loaded 事件获取）
  const systemPromptTokensRef = useRef<number>(0);

  // Debug entries (Task 3)
  const [debugEntries, setDebugEntries] = useState<Array<{
    id: string;
    timestamp: number;
    request?: any;
    response?: any;
    context?: any;
  }>>([]);

  const location = useLocation();
  const toolExecutorRef = useRef<ToolExecutor | null>(null);
  const confirmResolverRef = useRef<((v: boolean) => void) | null>(null);
  const currentSessionKeyRef = useRef<string | null>(null);
  const messageQueueRef = useRef<Array<{ text: string; images?: string[] }>>([]);
  const processingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 保持 ref 同步
  useEffect(() => {
    currentSessionKeyRef.current = currentSessionKey;
  }, [currentSessionKey]);

  // 初始化：加载会话列表 + 默认权限 + 模型配置
  useEffect(() => {
    agentApi.listSessions().then((list) => {
      setSessions(list || []);
      // 自动选中第一个会话（或创建新会话）
      if (list && list.length > 0) {
        setCurrentSessionKey(list[0].sessionKey);
      }
    }).catch(() => {});
    agentApi.getPermissionDefaults().then(setPermissions).catch(() => {});
    // 加载模型配置，用 contextWindow 更新 tokenUsage.limit
    agentApi.listConfigs('llm_config').then((configs) => {
      if (configs && configs.length > 0) {
        try {
          const cfg = JSON.parse(configs[0].configData || '{}');
          if (cfg.contextWindow && cfg.contextWindow > 0) {
            setTokenUsage((prev) => ({ estimated: prev.estimated, limit: cfg.contextWindow }));
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  // 切换会话时加载消息和权限
  useEffect(() => {
    if (!currentSessionKey) return;
    agentApi.getMessages(currentSessionKey).then((msgs) => {
      setMessages(convertMessages(msgs || []));
    }).catch(() => {});
    agentApi.getPermissions(currentSessionKey).then(setPermissions).catch(() => {});
  }, [currentSessionKey]);

  // 会话切换时从 localStorage 和后端 DB 加载调试历史
  useEffect(() => {
    if (!currentSessionKey) {
      setDebugEntries([]);
      backendTokenEstimatedRef.current = null;
      return;
    }
    // 重置后端 token 估算，等待新会话的 context_loaded 事件
    backendTokenEstimatedRef.current = null;
    // 先从 localStorage 快速加载（同步）
    try {
      const stored = localStorage.getItem(`agent-debug-${currentSessionKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDebugEntries(parsed);
        } else {
          setDebugEntries([]);
        }
      } else {
        setDebugEntries([]);
      }
    } catch {
      setDebugEntries([]);
    }
    // 再从后端 DB 加载（异步，DB 有数据时覆盖 localStorage）
    agentApi.getDebugData(currentSessionKey).then((data) => {
      if (data && data.trim()) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDebugEntries(parsed);
            // 同步到 localStorage
            localStorage.setItem(`agent-debug-${currentSessionKey}`, data);
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, [currentSessionKey]);

  // 调试信息变更时持久化到 localStorage + 后端 DB（debounced）
  const debugEntriesRef = useRef<typeof debugEntries>([]);
  debugEntriesRef.current = debugEntries;
  const debugSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!currentSessionKey || debugEntries.length === 0) return;
    const key = `agent-debug-${currentSessionKey}`;
    const json = JSON.stringify(debugEntries.slice(-50));
    // 同步保存到 localStorage
    try {
      localStorage.setItem(key, json);
    } catch {
      // ignore quota errors
    }
    // debounced 保存到后端 DB（避免频繁请求）
    if (debugSaveTimerRef.current) {
      clearTimeout(debugSaveTimerRef.current);
    }
    debugSaveTimerRef.current = setTimeout(() => {
      agentApi.saveDebugData(currentSessionKey, json).catch(() => {});
    }, 2000);
    return () => {
      if (debugSaveTimerRef.current) {
        clearTimeout(debugSaveTimerRef.current);
      }
    };
  }, [debugEntries]);

  // 估算 token 使用量（仅作 fallback，后端 context_loaded 事件的 estimatedTokens 优先）
  // 后端使用中英文区分的精确估算（中文1.5token/字，英文0.25token/字符），
  // 前端仅在未收到后端数据时用粗略估算
  const backendTokenEstimatedRef = useRef<number | null>(null);
  useEffect(() => {
    // 如果后端已提供 estimatedTokens，不覆盖
    if (backendTokenEstimatedRef.current != null) {
      const estimated = backendTokenEstimatedRef.current;
      setTokenUsage((prev) => ({ estimated, limit: prev.limit }));
      return;
    }
    // fallback: 粗略估算（中英混合，按 ~2.5 字符/token）
    const messageTokens = Math.ceil(JSON.stringify(messages).length / 2.5);
    const estimated = messageTokens + systemPromptTokensRef.current;
    setTokenUsage((prev) => ({ estimated, limit: prev.limit }));
  }, [messages]);

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

    // 提取工作流编码（编辑器路由 /editor/:code）
    const editorMatch = location.pathname.match(/^\/editor\/(.+)$/);
    if (editorMatch) {
      ctx.workflowCode = decodeURIComponent(editorMatch[1]);
    }

    // 注入画布摘要（未保存的画布数据也能获取，让 AI 感知当前画布状态）
    const canvas = getCanvasContext();
    if (canvas) {
      try {
        const json = canvas.toJSON();
        if (json && Array.isArray(json.nodes)) {
          ctx.canvasSummary = {
            nodes: json.nodes.map((n: any) => ({
              id: n.id || '',
              type: n.type || '',
              title: n.data?.title || n.data?.name || n.title || '',
            })),
            edges: (json.edges || []).map((e: any) => ({
              from: e.sourceNodeID || e.source || '',
              to: e.targetNodeID || e.target || '',
              fromPort: e.sourcePortID || e.sourcePort,
            })),
            selectedNodeId: canvas.selectedNodeId,
          };
        }
      } catch {
        // canvas not ready, skip
      }
    }

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

  const updateGlobalPermission = useCallback(async (action: string, policy: PermissionPolicy) => {
    await agentApi.updateGlobalPermission(action, policy);
  }, []);

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
      const createdNodeIds: string[] = []; // 跟踪 addNode 返回的 nodeId
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
          // 解析 connect 步骤中的占位 nodeId
          // $0, $1, $2... 引用第 N 个 addNode 返回的 nodeId
          // 非标准 nodeId（非 start_0/end_0/已知 nodeId）自动替换为最近创建的 nodeId
          let resolvedArgs = { ...step.args };
          if (step.action === 'canvas' && resolvedArgs?.action === 'connect') {
            const resolveNodeId = (id: string): string => {
              if (!id) return id;
              if (id === 'start_0' || id === 'end_0') return id;
              if (createdNodeIds.includes(id)) return id;
              // $N 索引引用
              const match = id.match(/^\$(\d+)$/);
              if (match) {
                const idx = parseInt(match[1]);
                return createdNodeIds[idx] || createdNodeIds[createdNodeIds.length - 1] || id;
              }
              // 其他非标准 ID，替换为最近创建的 nodeId
              return createdNodeIds[createdNodeIds.length - 1] || id;
            };
            resolvedArgs.from = resolveNodeId(resolvedArgs.from);
            resolvedArgs.to = resolveNodeId(resolvedArgs.to);
          }
          const { result, rejected } = await executor.execute(step.action, resolvedArgs || {});
          const parsed = (() => {
            try {
              return JSON.parse(result);
            } catch {
              return { raw: result };
            }
          })();

          // 如果是 addNode，提取返回的 nodeId 供后续 connect 使用
          if (step.action === 'canvas' && step.args?.action === 'addNode') {
            const nodeId = parsed?.nodeId || parsed?.id;
            if (nodeId && typeof nodeId === 'string') {
              createdNodeIds.push(nodeId);
            }
          }

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

  /** 将调试条目直接持久化到指定会话的 localStorage（不更新当前视图） */
  const persistDebugEntryToSession = useCallback((sessionKey: string, entry: any) => {
    try {
      const key = `agent-debug-${sessionKey}`;
      const stored = localStorage.getItem(key);
      const arr = stored ? JSON.parse(stored) : [];
      if (Array.isArray(arr)) {
        arr.push(entry);
        localStorage.setItem(key, JSON.stringify(arr.slice(-50)));
      }
    } catch { /* ignore */ }
  }, []);

  /** 更新指定会话 localStorage 中的某条调试记录（不更新当前视图） */
  const updateDebugEntryInSession = useCallback(
    (sessionKey: string, match: (e: any) => boolean, apply: (e: any) => any) => {
      try {
        const key = `agent-debug-${sessionKey}`;
        const stored = localStorage.getItem(key);
        if (!stored) return;
        const arr = JSON.parse(stored);
        if (!Array.isArray(arr)) return;
        for (let i = arr.length - 1; i >= 0; i--) {
          if (match(arr[i])) {
            arr[i] = apply(arr[i]);
            break;
          }
        }
        localStorage.setItem(key, JSON.stringify(arr));
      } catch { /* ignore */ }
    },
    []
  );

  /** 处理消息队列（串行） */
  const processQueue = useCallback(
    async () => {
      if (processingRef.current) return;
      const sessionKey = currentSessionKeyRef.current;
      if (!sessionKey) return;
      const nextItem = messageQueueRef.current.shift();
      if (!nextItem) return;
      const { text, images } = nextItem;
      setQueueLength(messageQueueRef.current.length);

      processingRef.current = true;
      setStreaming(true);
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // 添加 user 消息
      const userMsg: DisplayMessage = {
        id: nanoid(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      if (images && images.length > 0) {
        userMsg.images = images;
      }

      // 创建 assistant 占位
      let currentAssistantId = nanoid();
      const assistantMsg: DisplayMessage = {
        id: currentAssistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const pendingToolCalls: ToolCallEvent[] = [];
      let errorMsg: string | null = null;
      // 追踪当前轮 assistant 输出内容，用于检测 ::options 澄清选项
      let assistantContent = '';

      const handlers = {
        onToken: (content: string) => {
          assistantContent += content;
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
          // 使用 toolcall-${event.id} 作为消息 ID，支持原地更新
          setMessages((prev) => {
            const existingIdx = prev.findIndex(
              (m) => m.id === `toolcall-${event.id}`
            );
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], toolCall: event };
              return updated;
            }
            return [
              ...prev,
              {
                id: `toolcall-${event.id}`,
                role: 'tool' as const,
                content: '',
                toolCall: event,
                timestamp: Date.now(),
              },
            ];
          });
        },
        onDone: () => {},
        onError: (msg: string) => {
          errorMsg = msg;
        },
        // Task 3: debug handlers — 带会话守卫，防止跨会话串数据
        onDebugRequest: (data: any) => {
          const entryId = nanoid();
          const entry = { id: entryId, timestamp: Date.now(), request: data };
          if (sessionKey === currentSessionKeyRef.current) {
            // 仍在原会话，更新视图
            setDebugEntries((prev) => [...prev, entry]);
          } else {
            // 已切走，直接落原会话 localStorage，不污染当前视图
            persistDebugEntryToSession(sessionKey, entry);
          }
        },
        onDebugResponse: (data: any) => {
          if (sessionKey === currentSessionKeyRef.current) {
            setDebugEntries((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].request && !updated[i].response) {
                  updated[i] = { ...updated[i], response: data };
                  break;
                }
              }
              return updated;
            });
          } else {
            updateDebugEntryInSession(sessionKey, (e) => !e.response, (e) => ({ ...e, response: data }));
          }
        },
        onContextLoaded: (data: any) => {
          // 优先使用后端提供的 token 估算（更准确），fallback 到前端粗估
          if (data.estimatedTokens != null) {
            backendTokenEstimatedRef.current = data.estimatedTokens;
            setTokenUsage({
              estimated: data.estimatedTokens,
              limit: data.contextWindow || 32768,
            });
          } else if (data.contextWindow && data.systemPromptChars) {
            // 兼容旧版：前端粗估
            systemPromptTokensRef.current = Math.ceil(data.systemPromptChars / 4);
            setTokenUsage({
              estimated: Math.ceil(JSON.stringify(messages).length / 2.5) + systemPromptTokensRef.current,
              limit: data.contextWindow,
            });
          }
          if (sessionKey === currentSessionKeyRef.current) {
            setDebugEntries((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (!updated[i].context) {
                  updated[i] = { ...updated[i], context: data };
                  break;
                }
              }
              return updated;
            });
          } else {
            updateDebugEntryInSession(sessionKey, (e) => !e.context, (e) => ({ ...e, context: data }));
          }
        },
        onTokenWarning: (data: any) => {
          // 80% 警告：更新 tokenUsage 并在 UI 提示
          setTokenUsage({ estimated: data.estimated, limit: data.limit });
          if (sessionKey === currentSessionKeyRef.current) {
            // 可扩展：在聊天界面显示警告提示
            console.warn(`[Token Warning] ${data.percentage}% (${data.estimated}/${data.limit}): ${data.message}`);
          }
        },
      };

      try {
        // 第一轮
        await streamChat(sessionKey, text, getPageContextJson(), handlers, signal, images);

        // 后续轮（tool 结果回灌）
        // 如果回复包含 ::options（需要用户澄清/选择），不自动处理工具调用，等待用户选择
        let safetyCounter = 0;
        while (
          !assistantContent.includes('::options') &&
          pendingToolCalls.length > 0 && !errorMsg && safetyCounter < 20
        ) {
          safetyCounter++;
          const calls = pendingToolCalls.splice(0, pendingToolCalls.length);
          const results: ToolResultItem[] = [];
          for (const tc of calls) {
            const toolResult = await executeOneTool(tc);
            results.push(toolResult);
            // 执行完成后，原地更新该工具调用的展示消息
            setMessages((prev) =>
              prev.map((m) =>
                m.id === `toolcall-${tc.id}` && m.toolCall
                  ? {
                      ...m,
                      toolCall: {
                        ...m.toolCall,
                        result: toolResult.result.substring(0, 200),
                      },
                    }
                  : m
              )
            );
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
          // 重置内容追踪，用于下一轮检测
          assistantContent = '';
          await streamToolResult(sessionKey, results, handlers, signal);
        }

        if (errorMsg) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, content: m.content || `[错误] ${errorMsg}` }
                : m
            )
          );
        }
      } catch (e) {
        // AbortError 视为优雅停止，不显示错误
        if (signal.aborted || (e as Error).name === 'AbortError') {
          // 静默处理
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, content: m.content || `[错误] ${(e as Error).message}` }
                : m
            )
          );
        }
      } finally {
        processingRef.current = false;
        setStreaming(false);
        abortControllerRef.current = null;
        // 刷新会话列表（后端可能自动生成了标题）
        agentApi.listSessions().then((list) => {
          setSessions(list || []);
        }).catch(() => {});
        // 处理队列中的下一条消息
        if (messageQueueRef.current.length > 0) {
          void processQueue();
        }
      }
    },
    [getPageContextJson, executeOneTool]
  );

  /** 发送消息（入队，串行处理） */
  const sendMessage = useCallback(
    async (text: string, images?: string[]) => {
      const sessionKey = currentSessionKeyRef.current;
      if (!sessionKey) return;
      messageQueueRef.current.push({ text, images });
      setQueueLength(messageQueueRef.current.length);
      void processQueue();
    },
    [processQueue]
  );

  /** Task 2: 压缩上下文 */
  const compactContext = useCallback(async () => {
    const sessionKey = currentSessionKeyRef.current;
    if (!sessionKey) return;
    try {
      await streamCompact(sessionKey, {
        onDone: () => {
          // Reload messages after compaction
          if (sessionKey) {
            agentApi.getMessages(sessionKey).then((msgs) => {
              setMessages(convertMessages(msgs || []));
            }).catch(() => {});
          }
        },
        onError: (msg) => { console.error('Compact error:', msg); },
      });
    } catch (e) {
      console.error('Compact failed:', e);
    }
  }, []);

  /** Subagent debug flow: triggers a subagent SSE session for a node debug task */
  const debugNode = useCallback(
    async (nodeId: string, instruction: string) => {
      const sessionKey = currentSessionKeyRef.current || `debug-${Date.now()}`;
      const subagentSessionKey = `subagent-${sessionKey}-${nodeId}-${Date.now()}`;

      const msgId = nanoid();
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          role: 'tool',
          content: '',
          subagentSteps: [],
          timestamp: Date.now(),
        },
      ]);

      try {
        await streamSubagent(subagentSessionKey, instruction, getPageContextJson(), {
          onToken: () => {
            // ignore streaming text for subagent
          },
          onSubagentToolCall: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      subagentSteps: [
                        ...(m.subagentSteps || []),
                        {
                          action: data.action,
                          args: data.args,
                          status: 'running' as const,
                        },
                      ],
                    }
                  : m
              )
            );
          },
          onSubagentRoundDone: () => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== msgId || !m.subagentSteps) return m;
                const steps = [...m.subagentSteps];
                // Mark last step as done
                if (steps.length > 0) {
                  steps[steps.length - 1] = {
                    ...steps[steps.length - 1],
                    status: 'done' as const,
                  };
                }
                return { ...m, subagentSteps: steps };
              })
            );
          },
          onSubagentFinalResult: (data) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, subagentResult: { success: true, content: data.content } }
                  : m
              )
            );
          },
          onSubagentDone: () => {},
          onError: (msg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, subagentResult: { success: false, content: msg } }
                  : m
              )
            );
          },
        });
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, subagentResult: { success: false, content: (e as Error).message } }
              : m
          )
        );
      }
    },
    [getPageContextJson]
  );

  /** 停止流式输出并清空队列 */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    messageQueueRef.current = [];
    setQueueLength(0);
    processingRef.current = false;
    setStreaming(false);
  }, []);

  const value: AgentContextValue = {
    dockOpen,
    setDockOpen,
    sessions,
    currentSessionKey,
    messages,
    permissions,
    streaming,
    queueLength,
    pendingConfirm,
    tokenUsage,
    compactContext,
    debugEntries,
    clearDebugEntries: () => setDebugEntries([]),
    setToolExecutor,
    resolveConfirm,
    createSession,
    switchSession,
    renameSession,
    deleteSession,
    sendMessage,
    stopStreaming,
    updatePermission,
    updateGlobalPermission,
    debugNode,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
