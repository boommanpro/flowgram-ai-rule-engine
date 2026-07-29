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
};
