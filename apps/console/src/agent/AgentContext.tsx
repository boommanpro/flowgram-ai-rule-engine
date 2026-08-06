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
import { getApiBaseUrl } from '../utils/apiConfig';
import type {
  AgentSession,
  AgentMessage,
  DisplayMessage,
  PermissionPolicy,
  ToolCallEvent,
  PageContext,
  PlanStep,
  ActivePlan,
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
    toolResults?: any;
  }>;
  clearDebugEntries: () => void;
  /** 调试面板是否打开 */
  debugPanelOpen: boolean;
  setDebugPanelOpen: (open: boolean) => void;
  /** 当前聚焦的调试条目 ID（点击消息跳转时设置） */
  focusDebugEntryId: string | null;
  /** 打开调试面板并聚焦到指定条目 */
  openDebugEntry: (entryId: string) => void;

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

  /** 当前活跃的执行计划（createPlan 生成，输入框上方展示） */
  activePlan: ActivePlan | null;

  /** 画布加载完成时注入画布摘要（进入编辑器时自动读取画布配置） */
  injectCanvasInfo: (summary: { nodes: Array<{ id: string; type: string; title: string }>; edges: Array<{ from: string; to: string }> }) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}

/** 后端消息 → 前端展示消息 */
function convertMessages(msgs: AgentMessage[]): DisplayMessage[] {
  // 先建立 tool_call_id → tool 结果 content 映射，用于回填 toolCall.result
  const toolResultMap = new Map<string, string>();
  for (const msg of msgs) {
    if (msg.role === 'tool' && msg.toolCallId) {
      toolResultMap.set(msg.toolCallId, msg.content || '');
    }
  }

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
            // 从映射中回填执行结果，使刷新后工具卡片显示正确状态（done/error）
            const toolResult = toolResultMap.get(tc.id);
            const actionName = tc.function?.name || 'unknown';

            // createPlan: 从 args.steps 重建 planSteps，使刷新后 PlanCard 仍能展示
            let planSteps: PlanStep[] | undefined;
            const argsMap = args as Record<string, any>;
            if (actionName === 'createPlan' && Array.isArray(argsMap.steps)) {
              planSteps = argsMap.steps.map((s: any, idx: number) => ({
                id: `plan-restored-${msg.id}-${idx}`,
                intent: s.intent || s.description || `Step ${idx + 1}`,
                action: s.action || 'unknown',
                args: s.args || {},
                status: 'done' as const,
              }));
            }

            result.push({
              id: `msg-${msg.id}-tool-${tc.id}`,
              role: 'tool',
              content: '',
              toolCall: {
                id: tc.id,
                action: actionName,
                args,
                policy: 'always',
                result: toolResult !== undefined ? toolResult.substring(0, 200) : undefined,
              },
              planSteps,
              timestamp: ts,
            });
          }
        } catch { /* ignore */ }
      }
    } else if (msg.role === 'tool') {
      // tool 结果已通过上面的映射回填到对应 toolCall.result，这里跳过单独渲染
      // 仅当该 tool 消息没有对应 toolCallId 时（孤儿结果）才单独展示
      if (!msg.toolCallId) {
        result.push({
          id: `msg-${msg.id}`,
          role: 'tool',
          content: msg.content || '',
          timestamp: ts,
        });
      }
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
    toolResults?: any;
  }>>([]);
  // 调试面板开关 + 聚焦条目（点击消息跳转用）
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [focusDebugEntryId, setFocusDebugEntryId] = useState<string | null>(null);
  const openDebugEntry = (entryId: string) => {
    setFocusDebugEntryId(entryId);
    setDebugPanelOpen(true);
  };

  // 活跃的执行计划（todo 机制：createPlan 生成，executeStep 逐个执行）
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  // activePlan 的同步 ref：executeStep 在同一轮 while 循环中紧跟 executePlan 调用，
  // 此时 setActivePlan 尚未 flush，闭包里的 activePlan 仍是旧值，必须用 ref 同步读取。
  const activePlanRef = useRef<ActivePlan | null>(null);
  // messages 的同步 ref：同上，fallback 路径从 messages 查找 planSteps 时也需要最新值
  const messagesRef = useRef<DisplayMessage[]>([]);
  messagesRef.current = messages;
  // plan 步骤对应的展示消息 ID（用于更新 PlanCard）
  const planMsgIdRef = useRef<string | null>(null);

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
      const converted = convertMessages(msgs || []);
      setMessages(converted);
      // 从历史消息中恢复 activePlan（最后一条含 planSteps 的消息）
      const lastPlanMsg = [...converted].reverse().find((m) => m.planSteps && m.planSteps.length > 0);
      if (lastPlanMsg && lastPlanMsg.planSteps) {
        const restored = {
          id: lastPlanMsg.id,
          steps: lastPlanMsg.planSteps,
          createdNodeIds: [],
        };
        activePlanRef.current = restored;
        setActivePlan(restored);
        planMsgIdRef.current = lastPlanMsg.id;
      } else {
        activePlanRef.current = null;
        setActivePlan(null);
        planMsgIdRef.current = null;
      }
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

  // debugEntries 加载后，为历史 assistant 消息按时序重建 debugEntryId 关联（刷新恢复跳转）
  useEffect(() => {
    if (debugEntries.length === 0) return;
    setMessages((prev) => {
      let entryIdx = 0;
      let changed = false;
      const updated = prev.map((m) => {
        // 只为有内容且未关联 debugEntryId 的 assistant 消息重建关联
        if (m.role === 'assistant' && m.content && !m.debugEntryId && entryIdx < debugEntries.length) {
          changed = true;
          return { ...m, debugEntryId: debugEntries[entryIdx++].id };
        }
        return m;
      });
      return changed ? updated : prev;
    });
  }, [debugEntries]);

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

  /** 更新 plan 步骤状态（同步 activePlan 和 message 中的 planSteps） */
  const updatePlanStepStatus = useCallback(
    (stepIndex: number, status: PlanStep['status'], result?: string) => {
      // 同步更新 ref（executeStep 在同一轮循环中后续调用可立即读到最新状态）
      const prev = activePlanRef.current;
      if (prev) {
        const updated = [...prev.steps];
        if (updated[stepIndex]) {
          updated[stepIndex] = { ...updated[stepIndex], status, result };
        }
        const next = { ...prev, steps: updated };
        activePlanRef.current = next;
        setActivePlan(next);
      }
      const msgId = planMsgIdRef.current;
      if (msgId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId && m.planSteps
              ? {
                  ...m,
                  planSteps: m.planSteps.map((ps, idx) =>
                    idx === stepIndex ? { ...ps, status, result } : ps
                  ),
                }
              : m
          )
        );
      }
    },
    []
  );

  /** 真实调用后端单节点测试 API（不打开面板，直接 HTTP 请求并等待结果） */
  const runNodeReal = useCallback(
    async (nodeId: string, inputs?: Record<string, any>): Promise<any> => {
      const ctx = getCanvasContext();
      if (!ctx) {
        return { error: 'not in editor page' };
      }
      try {
        const node = ctx.getNodeById(nodeId);
        if (!node) {
          return { error: `node ${nodeId} not found on canvas` };
        }
        const nodeJson = (node as any).toJSON ? (node as any).toJSON() : node;
        const response = await fetch(`${getApiBaseUrl()}/task/runNode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            node: JSON.stringify(nodeJson),
            inputs: inputs || {},
          }),
        });
        const data = await response.json();
        return data;
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
    []
  );

  /** createPlan：生成计划（todo list），不自动执行，提示 AI 调用 executeStep 逐个执行 */
  const executePlan = useCallback(
    async (event: ToolCallEvent): Promise<ToolResultItem> => {
      let rawSteps = Array.isArray(event.args.steps) ? event.args.steps : [];
      // 容错：后端可能因 JSON 解析失败把 arguments 原样存到 args.raw
      if (rawSteps.length === 0 && event.args?.raw) {
        try {
          const parsed = JSON.parse(event.args.raw as string);
          if (Array.isArray(parsed?.steps)) {
            rawSteps = parsed.steps;
          }
        } catch { /* ignore */ }
      }
      if (rawSteps.length === 0) {
        return {
          toolCallId: event.id,
          result: JSON.stringify({ success: false, error: 'steps is empty', receivedArgs: event.args }),
          rejected: false,
        };
      }

      const planId = nanoid(8);
      const planSteps: PlanStep[] = rawSteps.map((s: any, idx: number) => ({
        id: `plan-${planId}-step-${idx}`,
        intent: s.intent || s.description || `Step ${idx + 1}`,
        action: s.action || 'unknown',
        args: s.args || {},
        status: 'pending' as const,
      }));

      // 存入 activePlan 状态（todo 机制：AI 逐个 executeStep 执行）
      // 同步设置 ref：同一轮 while 循环中 executeStep 紧接着被调用，
      // 此时 setActivePlan 尚未 flush，必须用 ref 同步传递。
      const newPlan = { id: planId, steps: planSteps, createdNodeIds: [] };
      activePlanRef.current = newPlan;
      setActivePlan(newPlan);

      // 渲染 PlanCard 消息（todo list 风格）
      const planMsgId = nanoid();
      planMsgIdRef.current = planMsgId;
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

      // 返回给 LLM：计划已创建，提示调用 executeStep
      return {
        toolCallId: event.id,
        result: JSON.stringify({
          success: true,
          planId,
          stepsCount: planSteps.length,
          nextStepIndex: 0,
          message: `Plan created with ${planSteps.length} steps. Call executeStep(stepIndex=0) to execute the first step. After each step, check the result and continue with executeStep(stepIndex=N+1) or adjust and retry.`,
        }),
        rejected: false,
      };
    },
    []
  );

  /** executeStep：执行 plan 中的单个步骤，返回结果供 AI 决策下一步 */
  const executeStep = useCallback(
    async (event: ToolCallEvent): Promise<ToolResultItem> => {
      const stepIndex =
        typeof event.args.stepIndex === 'number'
          ? event.args.stepIndex
          : parseInt(event.args.stepIndex, 10);
      // 从 ref 读取最新 activePlan（避免闭包过期导致 "no active plan"）
      let currentPlan = activePlanRef.current;
      // activePlan 丢失时（会话切换/刷新），从 messages 中的 planSteps 恢复
      if (!currentPlan) {
        const planMsg = messagesRef.current.find((m) => m.planSteps && m.planSteps.length > 0);
        if (planMsg && planMsg.planSteps) {
          currentPlan = {
            id: planMsg.id,
            steps: planMsg.planSteps,
            createdNodeIds: [],
          };
          activePlanRef.current = currentPlan;
          setActivePlan(currentPlan);
          planMsgIdRef.current = planMsg.id;
        }
      }
      if (!currentPlan) {
        return { toolCallId: event.id, result: JSON.stringify({ error: 'no active plan, call createPlan first' }), rejected: false };
      }
      if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= currentPlan.steps.length) {
        return {
          toolCallId: event.id,
          result: JSON.stringify({ error: `invalid stepIndex ${event.args.stepIndex}` }),
          rejected: false,
        };
      }

      const step = currentPlan.steps[stepIndex];
      const executor = toolExecutorRef.current;
      if (!executor) {
        return { toolCallId: event.id, result: JSON.stringify({ error: 'tool executor not registered' }), rejected: false };
      }

      updatePlanStepStatus(stepIndex, 'running');

      try {
        // 解析 canvas 步骤中的占位 nodeId（$0/$1 引用 + 非标准 ID 替换）
        // 适用于 connect/runNode/updateNode/deleteNode/addNode(afterNodeId) 等所有引用节点的子动作
        // 同时递归解析 data 内的 ref 引用（如 end 节点的 inputsValues.result.content: ["$0", "result"]）
        const currentCreatedNodeIds = currentPlan.createdNodeIds;
        const resolveNodeId = (id: string): string => {
          if (!id || typeof id !== 'string') return id;
          if (id === 'start_0' || id === 'end_0' || id === 'start' || id === 'end') return id;
          if (currentCreatedNodeIds.includes(id)) return id;
          const match = id.match(/^\$(\d+)$/);
          if (match) {
            const idx = parseInt(match[1], 10);
            return currentCreatedNodeIds[idx] || currentCreatedNodeIds[currentCreatedNodeIds.length - 1] || id;
          }
          // 非标准 ID（非 hex/uuid 形式）替换为最近创建的 nodeId
          return currentCreatedNodeIds[currentCreatedNodeIds.length - 1] || id;
        };

        // 递归解析 data 中 ref content 数组里的占位 nodeId
        // 例：{type:"ref", content:["$0","result"]} → {type:"ref", content:["实际nodeId","result"]}
        const resolveRefValue = (val: any): any => {
          if (val == null) return val;
          if (typeof val === 'string') return resolveNodeId(val);
          if (Array.isArray(val)) {
            // ref content: [nodeId, fieldName] — 只解析第一个元素（nodeId）
            if (val.length === 2 && typeof val[0] === 'string' && typeof val[1] === 'string') {
              return [resolveNodeId(val[0]), val[1]];
            }
            return val.map(resolveRefValue);
          }
          if (typeof val === 'object') {
            const out: Record<string, any> = {};
            for (const k of Object.keys(val)) {
              out[k] = resolveRefValue(val[k]);
            }
            return out;
          }
          return val;
        };

        const resolvedArgs = { ...step.args };
        if (step.action === 'canvas') {
          // 顶层 nodeId/from/to/afterNodeId
          if (resolvedArgs.nodeId) resolvedArgs.nodeId = resolveNodeId(resolvedArgs.nodeId);
          if (resolvedArgs.from) resolvedArgs.from = resolveNodeId(resolvedArgs.from);
          if (resolvedArgs.to) resolvedArgs.to = resolveNodeId(resolvedArgs.to);
          if (resolvedArgs.afterNodeId) resolvedArgs.afterNodeId = resolveNodeId(resolvedArgs.afterNodeId);
          // data 内的 ref 引用（end/loop/condition/llm 节点的 inputsValues/prompt 等可能用 $0 引用）
          if (resolvedArgs.data) {
            resolvedArgs.data = resolveRefValue(resolvedArgs.data);
          }
        }

        // runNode 步骤：真实调用后端测试 API，等待结果回流
        if (step.action === 'canvas' && resolvedArgs.action === 'runNode') {
          updatePlanStepStatus(stepIndex, 'testing');
          const testResult = await runNodeReal(resolvedArgs.nodeId, resolvedArgs.inputs);
          const success = !testResult?.error;
          updatePlanStepStatus(
            stepIndex,
            success ? 'done' : 'testFailed',
            JSON.stringify(testResult).slice(0, 200)
          );
          const isLastStep = stepIndex >= currentPlan.steps.length - 1;
          return {
            toolCallId: event.id,
            result: JSON.stringify({
              success,
              stepIndex,
              testResult,
              nextStepIndex: success ? (isLastStep ? null : stepIndex + 1) : null,
              message: success
                ? `Step ${stepIndex} test passed.${isLastStep ? ' All steps completed.' : ` Call executeStep(stepIndex=${stepIndex + 1}) to continue.`}`
                : `Step ${stepIndex} test FAILED. Adjust node config with canvas(action=updateNode) then re-executeStep(stepIndex=${stepIndex}).`,
            }),
            rejected: false,
          };
        }

        // 普通步骤：执行工具
        const { result, rejected } = await executor.execute(step.action, resolvedArgs || {});
        const parsed = (() => {
          try {
            return JSON.parse(result);
          } catch {
            return { raw: result };
          }
        })();

        // addNode：提取返回的 nodeId 供后续 connect 使用
        let newNodeId: string | undefined;
        if (step.action === 'canvas' && step.args?.action === 'addNode') {
          newNodeId = parsed?.nodeId || parsed?.id;
          if (newNodeId && typeof newNodeId === 'string') {
            const idToAdd: string = newNodeId;
            // 同步更新 ref + state（后续 connect 步骤需读到最新 createdNodeIds）
            const prevPlan = activePlanRef.current;
            if (prevPlan) {
              const nextPlan = { ...prevPlan, createdNodeIds: [...prevPlan.createdNodeIds, idToAdd] };
              activePlanRef.current = nextPlan;
              setActivePlan(nextPlan);
            }
          }
        }

        updatePlanStepStatus(
          stepIndex,
          'done',
          typeof parsed === 'object' && parsed !== null
            ? JSON.stringify(parsed).slice(0, 200)
            : String(result).slice(0, 200)
        );

        const isLastStep = stepIndex >= currentPlan.steps.length - 1;
        return {
          toolCallId: event.id,
          result: JSON.stringify({
            success: true,
            stepIndex,
            result: parsed,
            nodeId: newNodeId,
            rejected,
            nextStepIndex: isLastStep ? null : stepIndex + 1,
            message: isLastStep
              ? 'All plan steps completed.'
              : `Step ${stepIndex} done. Call executeStep(stepIndex=${stepIndex + 1}) to continue.`,
          }),
          rejected: false,
        };
      } catch (e) {
        const errMsg = (e as Error).message;
        updatePlanStepStatus(stepIndex, 'error', errMsg.slice(0, 200));
        return {
          toolCallId: event.id,
          result: JSON.stringify({
            success: false,
            stepIndex,
            error: errMsg,
            message: `Step ${stepIndex} failed: ${errMsg}. Adjust and re-executeStep(stepIndex=${stepIndex}).`,
          }),
          rejected: false,
        };
      }
    },
    [runNodeReal, updatePlanStepStatus]
  );

  /** 执行单个 tool_call */
  const executeOneTool = useCallback(
    async (event: ToolCallEvent): Promise<ToolResultItem> => {
      // createPlan 特殊处理：生成计划（todo list），不自动执行
      if (event.action === 'createPlan') {
        return executePlan(event);
      }
      // executeStep 特殊处理：执行 plan 中的单个步骤（todo 机制）
      if (event.action === 'executeStep') {
        return executeStep(event);
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
    [showConfirm, executePlan, executeStep]
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
            // 关联 entryId 到当前 assistant 消息，支持点击消息跳转调试面板
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentAssistantId && !m.debugEntryId
                  ? { ...m, debugEntryId: entryId }
                  : m
              )
            );
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
        // 工具执行结果调试事件 — 把每个 tool_call 的实际结果存到最近一个有 response 的 entry
        onDebugToolResult: (data: any) => {
          if (sessionKey === currentSessionKeyRef.current) {
            setDebugEntries((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].response && !updated[i].toolResults) {
                  updated[i] = { ...updated[i], toolResults: data };
                  break;
                }
              }
              return updated;
            });
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

  /** 画布加载完成时注入画布摘要（进入编辑器时自动读取画布配置） */
  const injectCanvasInfo = useCallback(
    (summary: { nodes: Array<{ id: string; type: string; title: string }>; edges: Array<{ from: string; to: string }> }) => {
      // 画布摘要已通过 getPageContextJson() 随每次请求发送给后端，无需在聊天 UI 中显示。
      // 此处保留接口签名仅为兼容 EditorCanvasBridge 调用，不再注入聊天消息（避免消息流抖动）。
      void summary;
    },
    []
  );

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
    debugPanelOpen,
    setDebugPanelOpen,
    focusDebugEntryId,
    openDebugEntry,
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
    activePlan,
    injectCanvasInfo,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
