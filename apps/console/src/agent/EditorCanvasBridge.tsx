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

import { setCanvasContext, type CanvasContext } from './tools';

/**
 * 无需渲染任何 UI，仅作为画布上下文注入桥
 */
export const EditorCanvasBridge: React.FC = () => {
  const ctx = useClientContext();
  const tools = usePlaygroundTools();
  const linesManager = useService(WorkflowLinesManager);

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
        return ctx.document.createWorkflowNodeByType(type, pos, data, parentId);
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

    return () => {
      setCanvasContext(null);
    };
  }, [ctx, tools, linesManager]);

  return null;
};
