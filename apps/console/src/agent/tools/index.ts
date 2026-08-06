/**
 * 工具执行器
 * 导航类、查询类、写操作类工具实现
 * 画布类工具在 canvas.ts 中实现，通过 canvasContext 注入
 */
import type { ToolExecutor } from '../AgentContext';
import { workflowApi } from '../../services/workflow-api';
import { createNodeByType } from '../node-templates';

/** 画布上下文（由 editor 页面注入） */
export interface CanvasContext {
  /** 获取画布 JSON */
  toJSON: () => any;
  /** 通过类型创建节点 */
  createNodeByType: (type: string, position: { x: number; y: number } | undefined, data: any, parentId?: string) => any;
  /** 按 ID 获取节点 */
  getNodeById: (id: string) => any;
  /** 删除节点 */
  deleteNode: (id: string) => void;
  /** 添加连线 */
  addLine: (line: { sourceNodeID: string; targetNodeID: string; sourcePortID?: string }) => void;
  /** 删除连线 */
  removeLine: (from: string, to: string) => void;
  /** 自动布局 */
  autoLayout: () => void;
  /** Deep merge node data (arrays replaced wholesale) */
  updateNodeData: (nodeId: string, data: Record<string, any>) => boolean;
  /** Get available variables grouped by source node */
  getAvailableVariables: () => Array<{
    nodeId: string;
    nodeTitle: string;
    nodeType: string;
    outputs: Array<{ name: string; type: string }>;
  }>;
  /** Run the entire workflow (opens test run panel) */
  runWorkflow: (inputs?: Record<string, any>) => Promise<{ success: boolean; result?: any; error?: string }>;
  /** Run a single node (opens single node test panel) */
  runNode: (nodeId: string, inputs?: Record<string, any>) => Promise<{ success: boolean; result?: any; error?: string }>;
  /** 选中的节点 ID */
  selectedNodeId?: string;
}

let canvasCtx: CanvasContext | null = null;

export function setCanvasContext(ctx: CanvasContext | null): void {
  canvasCtx = ctx;
}

export function getCanvasContext(): CanvasContext | null {
  return canvasCtx;
}

interface NavigateFn {
  (path: string): void;
}

export function createToolExecutor(navigate: NavigateFn): ToolExecutor {
  return {
    async execute(action: string, args: Record<string, any>): Promise<{ result: string; rejected: boolean }> {
      try {
        switch (action) {
          // ===== 复合工具：导航 =====
          case 'navigate': {
            const target = args.target;
            switch (target) {
              case 'home':
                navigate('/');
                return { result: '{"success":true,"path":"/"}', rejected: false };
              case 'admin':
                navigate(args.tab === 'templates' ? '/admin/templates' : '/admin/workflows');
                return { result: '{"success":true,"path":"/admin"}', rejected: false };
              case 'releases':
                navigate('/releases');
                return { result: '{"success":true,"path":"/releases"}', rejected: false };
              case 'editor':
                navigate(args.workflowCode ? `/editor/${args.workflowCode}` : '/editor');
                return { result: '{"success":true,"path":"/editor"}', rejected: false };
              case 'templateEditor':
                navigate(`/template-editor/${args.templateCode}`);
                return { result: '{"success":true,"path":"/template-editor"}', rejected: false };
              default:
                return { result: `{"error":"unknown navigate target: ${target}"}`, rejected: false };
            }
          }

          // ===== 复合工具：查询 =====
          case 'query': {
            const resource = args.resource;
            switch (resource) {
              case 'workflows': {
                const list = await workflowApi.listWorkflows();
                return { result: JSON.stringify(list || []), rejected: false };
              }
              case 'templates': {
                const list = await workflowApi.listTemplates();
                return { result: JSON.stringify(list || []), rejected: false };
              }
              case 'logs': {
                const list = await workflowApi.listLogs(args.workflowCode);
                return { result: JSON.stringify(list || []), rejected: false };
              }
              case 'workflowDetail': {
                const wf = await workflowApi.getWorkflowByCode(args.workflowCode);
                return { result: JSON.stringify(wf), rejected: false };
              }
              case 'nodeDetail': {
                const ctx = getCanvasContext();
                if (!ctx) return { result: '{"error":"not in editor page"}', rejected: false };
                const doc = ctx.toJSON();
                const node = doc.nodes?.find((n: any) => n.id === args.nodeId);
                return { result: JSON.stringify(node || { error: 'node not found' }), rejected: false };
              }
              case 'availableVariables': {
                const ctx = getCanvasContext();
                if (!ctx) return { result: '{"error":"not in editor page"}', rejected: false };
                const vars = ctx.getAvailableVariables();
                return { result: JSON.stringify(vars), rejected: false };
              }
              default:
                return { result: `{"error":"unknown query resource: ${resource}"}`, rejected: false };
            }
          }

          // ===== 复合工具：管理 =====
          case 'manage': {
            const op = args.action;
            switch (op) {
              case 'createWorkflow': {
                const workflowCode = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await workflowApi.createWorkflow({
                  workflowCode,
                  workflowName: args.name,
                  workflowDesc: args.desc || '',
                });
                navigate(`/editor/${workflowCode}`);
                return {
                  result: JSON.stringify({ success: true, workflowCode, workflowName: args.name }),
                  rejected: false,
                };
              }
              case 'createTemplate': {
                const templateCode = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await workflowApi.createTemplate({
                  templateCode,
                  templateName: args.name,
                  templateDesc: args.desc || '',
                });
                navigate(`/template-editor/${templateCode}`);
                return {
                  result: JSON.stringify({ success: true, templateCode, templateName: args.name }),
                  rejected: false,
                };
              }
              case 'saveWorkflow': {
                const ctx = getCanvasContext();
                if (!ctx) return { result: '{"error":"not in editor page"}', rejected: false };
                const jsonData = ctx.toJSON();
                const dataStr = JSON.stringify(jsonData);
                const versions = await workflowApi.listVersions(args.workflowCode);
                if (versions && versions.length > 0) {
                  const current = versions.find((v: any) => v.isCurrent === 1) || versions[0];
                  await workflowApi.updateVersion({ ...current, workflowData: dataStr });
                } else {
                  await workflowApi.createVersion({
                    workflowCode: args.workflowCode,
                    versionNumber: 'v1.0',
                    versionDesc: 'Initial version',
                    workflowData: dataStr,
                    createdBy: 'agent',
                  });
                  const newVersions = await workflowApi.listVersions(args.workflowCode);
                  if (newVersions && newVersions.length > 0) {
                    await workflowApi.setCurrentVersion(newVersions[0].id!);
                  }
                }
                return { result: '{"success":true}', rejected: false };
              }
              case 'deleteWorkflow': {
                await workflowApi.deleteWorkflow(args.id);
                return { result: '{"success":true}', rejected: false };
              }
              default:
                return { result: `{"error":"unknown manage action: ${op}"}`, rejected: false };
            }
          }

          // ===== 复合工具：画布 =====
          case 'canvas': {
            const op = args.action;
            switch (op) {
              case 'addNode':
              case 'deleteNode':
              case 'connect':
              case 'disconnect':
              case 'autoLayout':
                return executeCanvasAction(op, args);
              case 'updateNode': {
                const ctx = getCanvasContext();
                if (!ctx) return { result: '{"error":"not in editor page"}', rejected: false };
                const success = ctx.updateNodeData(args.nodeId, args.data);
                return { result: JSON.stringify({ success }), rejected: false };
              }
              case 'runWorkflow': {
                const ctx = getCanvasContext();
                if (!ctx) return { result: '{"error":"not in editor page"}', rejected: false };
                const result = await ctx.runWorkflow(args.inputs);
                return { result: JSON.stringify(result), rejected: false };
              }
              case 'runNode': {
                const ctx = getCanvasContext();
                if (!ctx) return { result: '{"error":"not in editor page"}', rejected: false };
                const result = await ctx.runNode(args.nodeId, args.inputs);
                return { result: JSON.stringify(result), rejected: false };
              }
              default:
                return { result: `{"error":"unknown canvas action: ${op}"}`, rejected: false };
            }
          }

          // ===== 兼容旧工具名（过渡期保留） =====
          // ===== 导航类 =====
          case 'goHome':
            navigate('/');
            return { result: '{"success":true,"path":"/"}', rejected: false };
          case 'goAdmin':
            navigate(args.tab === 'templates' ? '/admin/templates' : '/admin/workflows');
            return { result: '{"success":true,"path":"/admin"}', rejected: false };
          case 'goReleases':
            navigate('/releases');
            return { result: '{"success":true,"path":"/releases"}', rejected: false };
          case 'goEditor':
            navigate(args.workflowCode ? `/editor/${args.workflowCode}` : '/editor');
            return { result: '{"success":true,"path":"/editor"}', rejected: false };
          case 'goTemplateEditor':
            navigate(`/template-editor/${args.templateCode}`);
            return { result: '{"success":true,"path":"/template-editor"}', rejected: false };

          // ===== 查询类 =====
          case 'listWorkflows': {
            const list = await workflowApi.listWorkflows();
            return { result: JSON.stringify(list || []), rejected: false };
          }
          case 'listTemplates': {
            const list = await workflowApi.listTemplates();
            return { result: JSON.stringify(list || []), rejected: false };
          }
          case 'listLogs': {
            const list = await workflowApi.listLogs(args.workflowCode);
            return { result: JSON.stringify(list || []), rejected: false };
          }
          case 'getWorkflowDetail': {
            const wf = await workflowApi.getWorkflowByCode(args.workflowCode);
            return { result: JSON.stringify(wf), rejected: false };
          }
          case 'getNodeDetail': {
            const ctx = getCanvasContext();
            if (!ctx) {
              return { result: '{"error":"not in editor page"}', rejected: false };
            }
            const doc = ctx.toJSON();
            const node = doc.nodes?.find((n: any) => n.id === args.nodeId);
            return { result: JSON.stringify(node || { error: 'node not found' }), rejected: false };
          }

          // ===== 写操作类 =====
          case 'createWorkflow': {
            const workflowCode = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await workflowApi.createWorkflow({
              workflowCode,
              workflowName: args.name,
              workflowDesc: args.desc || '',
            });
            // 跳转到编辑器
            navigate(`/editor/${workflowCode}`);
            return {
              result: JSON.stringify({ success: true, workflowCode, workflowName: args.name }),
              rejected: false,
            };
          }
          case 'createTemplate': {
            const templateCode = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await workflowApi.createTemplate({
              templateCode,
              templateName: args.name,
              templateDesc: args.desc || '',
            });
            navigate(`/template-editor/${templateCode}`);
            return {
              result: JSON.stringify({ success: true, templateCode, templateName: args.name }),
              rejected: false,
            };
          }
          case 'saveWorkflow': {
            const ctx = getCanvasContext();
            if (!ctx) {
              return { result: '{"error":"not in editor page"}', rejected: false };
            }
            const jsonData = ctx.toJSON();
            const dataStr = JSON.stringify(jsonData);
            const versions = await workflowApi.listVersions(args.workflowCode);
            if (versions && versions.length > 0) {
              const current = versions.find((v: any) => v.isCurrent === 1) || versions[0];
              await workflowApi.updateVersion({ ...current, workflowData: dataStr });
            } else {
              await workflowApi.createVersion({
                workflowCode: args.workflowCode,
                versionNumber: 'v1.0',
                versionDesc: 'Initial version',
                workflowData: dataStr,
                createdBy: 'agent',
              });
              const newVersions = await workflowApi.listVersions(args.workflowCode);
              if (newVersions && newVersions.length > 0) {
                await workflowApi.setCurrentVersion(newVersions[0].id!);
              }
            }
            return { result: '{"success":true}', rejected: false };
          }
          case 'deleteWorkflow': {
            await workflowApi.deleteWorkflow(args.id);
            return { result: '{"success":true}', rejected: false };
          }

          // ===== 画布类 =====
          case 'addNode':
            return executeCanvasAction(action, args);
          case 'updateNode': {
            const ctx = getCanvasContext();
            if (!ctx) {
              return { result: '{"error":"not in editor page"}', rejected: false };
            }
            const success = ctx.updateNodeData(args.nodeId, args.data);
            return { result: JSON.stringify({ success }), rejected: false };
          }
          case 'deleteNode':
            return executeCanvasAction(action, args);
          case 'connect':
            return executeCanvasAction(action, args);
          case 'disconnect':
            return executeCanvasAction(action, args);
          case 'autoLayout':
            return executeCanvasAction(action, args);
          case 'runWorkflow': {
            const ctx = getCanvasContext();
            if (!ctx) {
              return { result: '{"error":"not in editor page"}', rejected: false };
            }
            const result = await ctx.runWorkflow(args.inputs);
            return { result: JSON.stringify(result), rejected: false };
          }
          case 'runNode': {
            const ctx = getCanvasContext();
            if (!ctx) {
              return { result: '{"error":"not in editor page"}', rejected: false };
            }
            const result = await ctx.runNode(args.nodeId, args.inputs);
            return { result: JSON.stringify(result), rejected: false };
          }
          case 'getAvailableVariables': {
            const ctx = getCanvasContext();
            if (!ctx) {
              return { result: '{"error":"not in editor page"}', rejected: false };
            }
            const vars = ctx.getAvailableVariables();
            return { result: JSON.stringify(vars), rejected: false };
          }
          case 'debugNode': {
            // Silent execution via subagent SSE, no permission confirmation.
            // The subagent flow is handled by AgentContext; here we return a
            // placeholder and the actual subagent SSE is triggered by the caller.
            return {
              result: JSON.stringify({ success: true, message: 'debugNode triggered via subagent' }),
              rejected: false,
            };
          }

          // ===== Plan 类 =====
          case 'createPlan':
            // plan 的步骤由 AgentContext 自动执行，这里返回步骤列表
            return {
              result: JSON.stringify({ success: true, stepsCount: args.steps?.length || 0 }),
              rejected: false,
            };

          default:
            return {
              result: JSON.stringify({ error: `unknown action: ${action}` }),
              rejected: false,
            };
        }
      } catch (e) {
        return {
          result: JSON.stringify({ error: (e as Error).message }),
          rejected: false,
        };
      }
    },
  };
}

/** 画布操作执行（需要 canvasContext） */
function executeCanvasAction(action: string, args: Record<string, any>): { result: string; rejected: boolean } {
  const ctx = getCanvasContext();
  if (!ctx) {
    return { result: '{"error":"not in editor page"}', rejected: false };
  }

  try {
    switch (action) {
      case 'addNode': {
        // Defense 1: Start/End uniqueness — only one start/end node allowed per workflow
        if (args.type === 'start' || args.type === 'end') {
          const doc = ctx.toJSON();
          const exists = doc.nodes?.some((n: any) => n.type === args.type);
          if (exists) {
            return {
              result: JSON.stringify({
                error: `${args.type} node already exists. Only one ${args.type} node is allowed per workflow.`,
              }),
              rejected: false,
            };
          }
        }
        const template = createNodeByType(args.type, args.data, args.title);
        const position = args.afterNodeId
          ? findPositionAfter(ctx, args.afterNodeId)
          : { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 };
        const node = ctx.createNodeByType(args.type, position, template.data, undefined);
        const nodeId = node?.id || template.id;
        // FlowGram createWorkflowNodeByType 使用注册表默认值创建节点，
        // 不会深度合并传入的 data。需要创建后立即 updateNodeData 注入 AI 提供的完整数据。
        if (args.data && Object.keys(args.data).length > 0) {
          ctx.updateNodeData(nodeId, template.data);
        }
        return {
          result: JSON.stringify({ success: true, nodeId }),
          rejected: false,
        };
      }
      case 'deleteNode': {
        ctx.deleteNode(args.nodeId);
        return { result: '{"success":true}', rejected: false };
      }
      case 'connect': {
        ctx.addLine({ sourceNodeID: args.from, targetNodeID: args.to, sourcePortID: args.fromPort });
        return { result: '{"success":true}', rejected: false };
      }
      case 'disconnect': {
        ctx.removeLine(args.from, args.to);
        return { result: '{"success":true}', rejected: false };
      }
      case 'autoLayout': {
        ctx.autoLayout();
        return { result: '{"success":true}', rejected: false };
      }
      default:
        return { result: '{"error":"unknown canvas action"}', rejected: false };
    }
  } catch (e) {
    return {
      result: JSON.stringify({ error: (e as Error).message }),
      rejected: false,
    };
  }
}

/** 在指定节点后方找位置 */
function findPositionAfter(ctx: CanvasContext, nodeId: string): { x: number; y: number } {
  const doc = ctx.toJSON();
  const node = doc.nodes?.find((n: any) => n.id === nodeId);
  if (node?.meta?.position) {
    return {
      x: node.meta.position.x + 300,
      y: node.meta.position.y,
    };
  }
  return { x: 300, y: 200 };
}
