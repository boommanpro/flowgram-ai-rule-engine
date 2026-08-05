/**
 * 节点模板
 * 每种节点类型提供最小合法 JSON，LLM 只需填关键字段，系统自动补默认值
 */
import { merge } from 'lodash-es';
import { nanoid } from 'nanoid';
import { normalizeNodeData } from './normalize';

export interface NodeTemplate {
  id: string;
  type: string;
  data: Record<string, any>;
}

/** 各节点类型的默认模板 */
const templates: Record<string, Record<string, any>> = {
  start: {
    title: 'Start',
    outputs: { type: 'object', properties: {} },
  },
  end: {
    title: 'End',
    inputsValues: {},
    inputs: { type: 'object', properties: {} },
  },
  llm: {
    title: 'LLM',
    inputsValues: {
      modelName: { type: 'constant', content: '', schema: { type: 'string' } },
      apiKey: { type: 'constant', content: '' },
      apiHost: { type: 'constant', content: '', schema: { type: 'string' } },
      temperature: { type: 'constant', content: 0.5 },
      systemPrompt: { type: 'template', content: '# Role\nYou are an AI assistant.\n' },
      prompt: { type: 'template', content: '' },
    },
    inputs: {
      type: 'object',
      required: ['modelName', 'apiKey', 'apiHost', 'temperature', 'prompt'],
      properties: {
        modelName: { type: 'string' },
        apiKey: { type: 'string' },
        apiHost: { type: 'string' },
        temperature: { type: 'number' },
        systemPrompt: { type: 'string', extra: { formComponent: 'prompt-editor' } },
        prompt: { type: 'string', extra: { formComponent: 'prompt-editor' } },
      },
    },
    outputs: { type: 'object', properties: { result: { type: 'string' } } },
  },
  code: {
    title: 'Code',
    inputsValues: {},
    script: { language: 'java', content: '' },
    outputs: { type: 'object', properties: {}, required: [] },
    inputs: { type: 'object', properties: {} },
  },
  http: {
    title: 'HTTP',
    inputsValues: {
      method: { type: 'constant', content: 'GET', schema: { type: 'string' } },
      url: { type: 'constant', content: '', schema: { type: 'string' } },
      headers: { type: 'constant', content: {}, schema: { type: 'object' } },
      body: { type: 'constant', content: '', schema: { type: 'string' } },
    },
    inputs: {
      type: 'object',
      required: ['method', 'url'],
      properties: {
        method: { type: 'string' },
        url: { type: 'string' },
        headers: { type: 'object' },
        body: { type: 'string' },
      },
    },
    outputs: { type: 'object', properties: { result: { type: 'string' } } },
  },
  condition: {
    title: 'Condition',
    conditions: [],
  },
  branches: {
    title: 'Branches',
    branches: [],
  },
  loop: {
    title: 'Loop',
    loopFor: { type: 'ref', content: [] },
    loopOutputs: {},
    outputs: { type: 'object', required: [], properties: {} },
  },
  variable: {
    title: 'Variable',
    inputsValues: {},
    outputs: { type: 'object', properties: {} },
  },
  'string-format': {
    title: 'StringFormat',
    inputsValues: {},
    script: { language: 'spel-vue', content: '' },
    outputs: { type: 'object', properties: { formatStringResult: { type: 'string' } } },
    inputs: { type: 'object', properties: {} },
  },
  assignee: {
    title: 'Assignee',
    assignees: [],
    data: { assignees: [] },
  },
  comment: {
    title: 'Comment',
  },
};

/**
 * 根据类型创建节点（合并模板 + 用户 data）
 * @param type 节点类型
 * @param data 用户提供的 data（深度合并到模板）
 * @param title 节点标题（可选）
 * @returns 完整节点 JSON
 */
export function createNodeByType(
  type: string,
  data?: Record<string, any>,
  title?: string
): NodeTemplate {
  const template = templates[type] || templates['variable'];
  const normalizedData = normalizeNodeData(type, data || {});
  const mergedData = merge({}, template, normalizedData);
  if (title) {
    mergedData.title = title;
  }
  return {
    id: `${type}_${nanoid(6)}`,
    type,
    data: mergedData,
  };
}

/** 获取所有支持的节点类型 */
export function getSupportedNodeTypes(): string[] {
  return Object.keys(templates);
}
