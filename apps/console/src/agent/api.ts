/**
 * Agent 后端 API 封装
 */
import { getApiBaseUrl } from '../utils/apiConfig';
import type { AgentSession, AgentMessage, PermissionPolicy } from './types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const agentApi = {
  // 会话管理
  listSessions: () => request<AgentSession[]>('/agent/session/list'),
  createSession: (title?: string) =>
    request<AgentSession>('/agent/session/create', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  renameSession: (sessionKey: string, title: string) =>
    request<boolean>('/agent/session/rename', {
      method: 'PUT',
      body: JSON.stringify({ sessionKey, title }),
    }),
  deleteSession: (sessionKey: string) =>
    request<boolean>(`/agent/session/${sessionKey}`, { method: 'DELETE' }),
  getMessages: (sessionKey: string) =>
    request<AgentMessage[]>(`/agent/session/${sessionKey}/messages`),

  // 权限管理
  getPermissions: (sessionKey: string) =>
    request<Record<string, PermissionPolicy>>(`/agent/permission/${sessionKey}`),
  updatePermission: (sessionKey: string, action: string, policy: PermissionPolicy) =>
    request<boolean>('/agent/permission', {
      method: 'PUT',
      body: JSON.stringify({ sessionKey, action, policy }),
    }),
  getPermissionDefaults: () =>
    request<Record<string, PermissionPolicy>>('/agent/permission/defaults'),

  // 全局权限（默认策略）
  getGlobalPermissions: () =>
    request<Record<string, PermissionPolicy>>('/agent/permission/global'),
  updateGlobalPermission: (action: string, policy: PermissionPolicy) =>
    request<boolean>('/agent/permission/global', {
      method: 'PUT',
      body: JSON.stringify({ action, policy }),
    }),

  // Agent 配置
  listConfigs: (configType?: string) =>
    request<any[]>(`/agent/config/list${configType ? `?configType=${configType}` : ''}`),
  getConfig: (configKey: string) =>
    request<any>(`/agent/config/${configKey}`),
  saveConfig: (config: any) =>
    request<any>('/agent/config/save', { method: 'POST', body: JSON.stringify(config) }),
  deleteConfig: (configKey: string) =>
    request<boolean>(`/agent/config/${configKey}`, { method: 'DELETE' }),
  getConfigHistory: (configKey: string) =>
    request<any[]>(`/agent/config/${configKey}/history`),
  revertConfig: (configKey: string, version: number) =>
    request<any>(`/agent/config/${configKey}/revert/${version}`, { method: 'POST' }),

  // 知识库
  listKnowledge: (keyword?: string) =>
    request<any[]>(`/agent/knowledge/list${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  getKnowledge: (id: number) =>
    request<any>(`/agent/knowledge/${id}`),
  saveKnowledge: (chunk: any) =>
    request<any>('/agent/knowledge/save', { method: 'POST', body: JSON.stringify(chunk) }),
  deleteKnowledge: (id: number) =>
    request<boolean>(`/agent/knowledge/${id}`, { method: 'DELETE' }),
  searchKnowledge: (query: string, topK?: number) =>
    request<any[]>('/agent/knowledge/search', { method: 'POST', body: JSON.stringify({ query, topK: topK || 5 }) }),
  reembedAll: () =>
    request<any>('/agent/knowledge/reembed-all', { method: 'POST' }),

  // 知识图谱
  listGraphNodes: (nodeType?: string, keyword?: string) => {
    const params = new URLSearchParams();
    if (nodeType) params.set('nodeType', nodeType);
    if (keyword) params.set('keyword', keyword);
    const qs = params.toString();
    return request<any[]>(`/agent/graph/node/list${qs ? `?${qs}` : ''}`);
  },
  getGraphNode: (nodeKey: string) =>
    request<any>(`/agent/graph/node/${nodeKey}`),
  saveGraphNode: (node: any) =>
    request<any>('/agent/graph/node/save', { method: 'POST', body: JSON.stringify(node) }),
  deleteGraphNode: (nodeKey: string) =>
    request<boolean>(`/agent/graph/node/${nodeKey}`, { method: 'DELETE' }),
  listGraphEdges: (sourceKey?: string, targetKey?: string, edgeType?: string) => {
    const params = new URLSearchParams();
    if (sourceKey) params.set('sourceKey', sourceKey);
    if (targetKey) params.set('targetKey', targetKey);
    if (edgeType) params.set('edgeType', edgeType);
    const qs = params.toString();
    return request<any[]>(`/agent/graph/edge/list${qs ? `?${qs}` : ''}`);
  },
  saveGraphEdge: (edge: any) =>
    request<any>('/agent/graph/edge/save', { method: 'POST', body: JSON.stringify(edge) }),
  deleteGraphEdge: (id: number) =>
    request<boolean>(`/agent/graph/edge/${id}`, { method: 'DELETE' }),

  // 工具定义
  listToolDefinitions: (toolGroup?: string) =>
    request<any[]>(`/agent/tool-definition/list${toolGroup ? `?toolGroup=${toolGroup}` : ''}`),
  getToolDefinition: (toolName: string) =>
    request<any>(`/agent/tool-definition/${toolName}`),
  saveToolDefinition: (def: any) =>
    request<any>('/agent/tool-definition/save', { method: 'POST', body: JSON.stringify(def) }),
  deleteToolDefinition: (toolName: string) =>
    request<boolean>(`/agent/tool-definition/${toolName}`, { method: 'DELETE' }),
  refreshTools: () =>
    request<any>('/agent/tool-definition/refresh', { method: 'POST' }),

  // 配置导出/导入（用于线上升级迁移）
  exportConfig: async (): Promise<string> => {
    const url = `${getApiBaseUrl()}/agent/config/export`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    // 后端返回 attachment JSON，直接读取文本
    return response.text();
  },
  importConfig: (json: string) =>
    request<Record<string, number>>('/agent/config/import', {
      method: 'POST',
      body: json,
    }),
};
