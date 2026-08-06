/**
 * EditorCanvasBridge - 编辑器画布上下文桥接组件
 * 在编辑器页面内部渲染，通过 useClientContext 获取画布 API，
 * 将其映射为 CanvasContext 注入到 agent 工具执行器
 */
import { useEffect } from 'react';
import {
  useClientContext,
  usePlaygroundTools,
  useService,
  WorkflowLinesManager,
  type WorkflowNodeEntity,
  type WorkflowPortEntity,
  type WorkflowLineEntity,
} from '@flowgram.ai/free-layout-editor';
import { FlowNodeFormData } from '@flowgram.ai/form-core';
import { usePanelManager } from '@flowgram.ai/panel-manager-plugin';

import { setCanvasContext, type CanvasContext } from './tools';
import { agentRunBridge } from './agent-run-bridge';
import { useAgent } from './AgentContext';

/**
 * 深度合并节点 data：数组整体替换，对象递归合并，其余直接覆盖
 */
function deepMergeNodeData(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (Array.isArray(source[key])) {
      result[key] = source[key]; // arrays replaced wholesale
    } else if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMergeNodeData(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * 无需渲染任何 UI，仅作为画布上下文注入桥
 */
export const EditorCanvasBridge: React.FC = () => {
  const ctx = useClientContext();
  const tools = usePlaygroundTools();
  const linesManager = useService(WorkflowLinesManager);
  const panelManager = usePanelManager();
  const { injectCanvasInfo } = useAgent();

  useEffect(() => {
    if (!ctx?.document) return;

    const canvasContext: CanvasContext = {
      toJSON: () => ctx.document.toJSON(),

      createNodeByType: (
        type: string,
        position: { x: number; y: number } | undefined,
        data: any,
        parentId?: string
      ) => {
        const pos = position || ctx.document.getNodeDefaultPosition(type);
        // createWorkflowNodeByType 的第三参数是 WorkflowNodeJSON（{id,type,meta,data,...}），
        // 而非裸 data。需要包装成 { data } 才能让框架读到表单数据并传给 form 引擎初始化。
        return ctx.document.createWorkflowNodeByType(type, pos, { data }, parentId);
      },

      getNodeById: (id: string) => ctx.document.getNode(id),

      deleteNode: (id: string) => {
        const node = ctx.document.getNode(id);
        if (!node) return;
        if (!ctx.document.canRemove(node)) return;
        node.dispose();
      },

      addLine: (line: { sourceNodeID: string; targetNodeID: string; sourcePortID?: string }) => {
        const fromNode = ctx.document.getNode(line.sourceNodeID);
        const toNode = ctx.document.getNode(line.targetNodeID);
        if (!fromNode || !toNode) return;

        // 获取源节点的输出端口
        const outputPorts = (fromNode as any).ports?.outputPorts as WorkflowPortEntity[] | undefined;
        if (!outputPorts || outputPorts.length === 0) return;

        // 如果指定了 sourcePortID，按 ID 查找；否则取第一个输出端口
        const fromPort =
          (line.sourcePortID
            ? outputPorts.find((p) => String(p.portID) === String(line.sourcePortID))
            : undefined) || outputPorts[0];

        // 插入中间节点场景：自动断开源端口已有的出边，避免旧直连边残留
        // 与 UI 交互路径（line-add-button）的 buildLine + line.dispose() 语义对齐
        const allLines = linesManager.getAllLines();
        for (const existing of allLines) {
          // 同源端口已有出边，且不是同一条（to 不同），则 dispose 旧边
          if (
            existing.from?.id === line.sourceNodeID &&
            existing.to?.id !== line.targetNodeID &&
            String(existing.fromPort?.portID) === String(fromPort?.portID) &&
            linesManager.canRemove(existing)
          ) {
            existing.dispose();
          }
        }

        // 使用 linesManager.createLine 创建连线
        linesManager.createLine({
          from: line.sourceNodeID,
          to: line.targetNodeID,
          fromPort: fromPort?.portID,
        });
      },

      removeLine: (from: string, to: string) => {
        const allLines = linesManager.getAllLines();
        const target = allLines.find(
          (line: WorkflowLineEntity) => line.from?.id === from && line.to?.id === to
        );
        if (target && linesManager.canRemove(target)) {
          target.dispose();
        }
      },

      autoLayout: () => {
        void tools.autoLayout({
          enableAnimation: true,
          animationDuration: 800,
          layoutConfig: {
            rankdir: 'LR',
            align: undefined,
            nodesep: 100,
            ranksep: 100,
          },
        });
      },

      updateNodeData: (nodeId: string, data: Record<string, any>) => {
        const node = ctx.document.getNode(nodeId) as any;
        if (!node) return false;
        // 节点表单数据由 form 引擎（FlowNodeFormData）管理，
        // node.updateData / node.data 都不存在；必须通过 formData.updateFormValues 写回。
        try {
          const formData = node.getData?.(FlowNodeFormData);
          if (formData?.formModel?.initialized) {
            const current = (typeof formData.toJSON === 'function' ? formData.toJSON() : {}) || {};
            const merged = deepMergeNodeData(current, data);
            formData.updateFormValues(merged);
            return true;
          }
        } catch {
          // form 引擎不可用时退回 extInfo 全量更新
        }
        const currentData = node.getJSONData?.() || {};
        const merged = deepMergeNodeData(currentData, data);
        if (node.updateExtInfo) {
          node.updateExtInfo(merged, true);
        }
        return true;
      },

      getAvailableVariables: () => {
        const doc = ctx.document.toJSON();
        const result: Array<{
          nodeId: string;
          nodeTitle: string;
          nodeType: string;
          outputs: Array<{ name: string; type: string }>;
        }> = [];
        for (const node of doc.nodes || []) {
          const outputs = node.data?.outputs?.properties;
          if (outputs && typeof outputs === 'object') {
            const vars = Object.entries(outputs).map(([name, schema]) => ({
              name,
              type: (schema as any)?.type || 'string',
            }));
            result.push({
              nodeId: node.id,
              nodeTitle: node.data?.title || node.id,
              nodeType: String(node.type),
              outputs: vars,
            });
          }
        }
        return result;
      },

      runWorkflow: async (inputs?: Record<string, any>) => {
        try {
          // Open test run panel
          panelManager.open('test-run-panel', 'right');
          // Fit view
          void tools.fitView();
          // The test run panel will handle actual execution
          return { success: true, result: { message: 'Test run panel opened' } };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      },

      runNode: async (nodeId: string, inputs?: Record<string, any>) => {
        try {
          panelManager.open('single-node-test-panel', 'right', {
            props: { nodeId },
          });
          return {
            success: true,
            result: { message: `Node test panel opened for ${nodeId}` },
          };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      },

      get selectedNodeId() {
        const selection = ctx.selection?.selection;
        if (!selection || selection.length === 0) return undefined;
        // selection 数组中可能包含节点和线条，取第一个节点的 id
        for (const entity of selection) {
          if (entity && typeof entity === 'object' && 'flowNodeType' in entity) {
            return (entity as WorkflowNodeEntity).id;
          }
        }
        return undefined;
      },
    };

    setCanvasContext(canvasContext);

    // 进入画布时主动读取画布当前配置，注入到 Agent 对话中
    try {
      const doc = ctx.document.toJSON();
      const nodes = (doc.nodes || []).map((n: any) => ({
        id: String(n.id),
        type: String(n.type),
        title: n.data?.title || '',
      }));
      const edges = ((doc as any).edges || []).map((e: any) => ({
        from: String(e.from?.id || e.from || ''),
        to: String(e.to?.id || e.to || ''),
      }));
      // 延迟注入，确保 AgentContext 已初始化
      setTimeout(() => injectCanvasInfo({ nodes, edges }), 500);
    } catch {
      // 读取画布失败时静默
    }

    return () => {
      setCanvasContext(null);
    };
  }, [ctx, tools, linesManager, panelManager, injectCanvasInfo]);

  // Register as the agentRunBridge listener (canvas side).
  // Handles run requests sent before this listener was mounted via pending replay.
  useEffect(() => {
    agentRunBridge.onRequest((request) => {
      if (request.type === 'runWorkflow') {
        panelManager.open('test-run-panel', 'right');
        void tools.fitView();
        agentRunBridge.respond({
          requestId: request.id,
          success: true,
          result: { message: 'Test run panel opened' },
        });
      } else if (request.type === 'runNode' && request.nodeId) {
        panelManager.open('single-node-test-panel', 'right', {
          props: { nodeId: request.nodeId },
        });
        agentRunBridge.respond({
          requestId: request.id,
          success: true,
          result: { message: `Node test panel opened for ${request.nodeId}` },
        });
      }
    });
    return () => {
      agentRunBridge.offRequest();
    };
  }, [ctx, panelManager, tools]);

  return null;
};
