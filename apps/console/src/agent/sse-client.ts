/**
 * SSE 流式客户端
 * 浏览器 EventSource 不支持 POST body，用 fetch + ReadableStream 手动解析 SSE
 */
import { getApiBaseUrl } from '../utils/apiConfig';
import { getCurrentLocale } from '../i18n';
import type { SseHandlers, ToolCallEvent } from './types';

export interface ToolResultItem {
  toolCallId: string;
  result: string;
  rejected: boolean;
}

/**
 * 发送对话消息（SSE 流式）
 */
export async function streamChat(
  sessionKey: string,
  message: string,
  pageContext: string,
  handlers: SseHandlers
): Promise<void> {
  const url = `${getApiBaseUrl()}/agent/chat`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionKey,
      message,
      pageContext,
      locale: getCurrentLocale(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API Error: ${response.status}`);
  }

  await readSseStream(response, handlers);
}

/**
 * 回灌工具执行结果后继续对话（SSE 流式）
 */
export async function streamToolResult(
  sessionKey: string,
  results: ToolResultItem[],
  handlers: SseHandlers
): Promise<void> {
  const url = `${getApiBaseUrl()}/agent/tool-result`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionKey,
      results,
      locale: getCurrentLocale(),
    }),
  });

  if (!response.ok) {
    throw new Error(`ToolResult API Error: ${response.status}`);
  }

  await readSseStream(response, handlers);
}

/**
 * 读取 SSE 流并分发事件
 */
async function readSseStream(
  response: Response,
  handlers: SseHandlers
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        const data = line.substring(5).trim();
        if (data) {
          try {
            const parsed = JSON.parse(data);
            handleEvent(eventName, parsed, handlers);
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    }
  }
}

function handleEvent(
  name: string,
  data: any,
  handlers: SseHandlers
): void {
  switch (name) {
    case 'token':
      handlers.onToken?.(data.content);
      break;
    case 'tool_call':
      handlers.onToolCall?.(data as ToolCallEvent);
      break;
    case 'done':
      handlers.onDone?.();
      break;
    case 'error':
      handlers.onError?.(data.message);
      break;
  }
}
