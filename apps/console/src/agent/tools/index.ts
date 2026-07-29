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
          case 'updateNode':
            return executeCanvasAction(action, args);
          case 'deleteNode':
            return executeCanvasAction(action, args);
          case 'connect':
            return executeCanvasAction(action, args);
          case 'disconnect':
            return executeCanvasAction(action, args);
          case 'autoLayout':
            return executeCanvasAction(action, args);

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
        const template = createNodeByType(args.type, args.data, args.title);
        const position = args.afterNodeId
          ? findPositionAfter(ctx, args.afterNodeId)
          : { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 };
        const node = ctx.createNodeByType(args.type, position, template.data, undefined);
        return {
          result: JSON.stringify({ success: true, nodeId: node?.id || template.id }),
          rejected: false,
        };
      }
      case 'updateNode': {
        const node = ctx.getNodeById(args.nodeId);
        if (!node) {
          return { result: '{"error":"node not found"}', rejected: false };
        }
        if (node.updateData) {
          node.updateData(args.data);
        }
        return { result: '{"success":true}', rejected: false };
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
