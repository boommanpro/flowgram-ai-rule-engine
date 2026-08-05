/**
 * Node data normalization layer.
 * Converts LLM-simplified flat fields into flowgram.ai's real nested form structure.
 */
import { merge } from 'lodash-es';

/**
 * Normalize node data from LLM simplified format to flowgram nested format.
 * Handles: ref shorthand, http flat fields, llm flat fields, start output fields.
 * @param type node type
 * @param data raw data from LLM (may contain flat/simplified fields)
 * @returns normalized data with proper nested structure
 */
export function normalizeNodeData(type: string, data: Record<string, any>): Record<string, any> {
  if (!data) return {};
  const result = merge({}, data);

  switch (type) {
    case 'http':
      normalizeHttpNode(result);
      break;
    case 'llm':
      normalizeLlmNode(result);
      break;
    case 'start':
      normalizeStartNode(result);
      break;
    case 'end':
      normalizeEndNode(result);
      break;
    case 'code':
    case 'string-format':
      normalizeRefShorthand(result);
      break;
    case 'variable':
    case 'condition':
    case 'branches':
    case 'loop':
    case 'assignee':
      normalizeRefShorthand(result);
      break;
  }

  return result;
}

/**
 * Normalize HTTP node: convert flat method/url/headers/body to nested inputsValues structure.
 * LLM may output: { method: "GET", url: "http://...", headers: {...}, body: "..." }
 * flowgram needs: { inputsValues: { method: {type:"constant",content:"GET",...}, url: {...}, ... } }
 */
function normalizeHttpNode(data: Record<string, any>): void {
  if (!data.inputsValues) data.inputsValues = {};

  // method
  if (data.method && typeof data.method === 'string') {
    data.inputsValues.method = data.inputsValues.method || {
      type: 'constant',
      content: data.method,
      schema: { type: 'string' },
    };
    delete data.method;
  }
  // url
  if (data.url && typeof data.url === 'string') {
    data.inputsValues.url = data.inputsValues.url || {
      type: 'constant',
      content: data.url,
      schema: { type: 'string' },
    };
    delete data.url;
  }
  // headers
  if (data.headers && typeof data.headers === 'object') {
    data.inputsValues.headers = data.inputsValues.headers || {
      type: 'constant',
      content: data.headers,
      schema: { type: 'object' },
    };
    delete data.headers;
  }
  // body
  if (data.body !== undefined) {
    data.inputsValues.body = data.inputsValues.body || {
      type: 'constant',
      content: typeof data.body === 'string' ? data.body : JSON.stringify(data.body),
      schema: { type: 'string' },
    };
    delete data.body;
  }
  // timeout
  if (data.timeout !== undefined) {
    data.inputsValues.timeout = data.inputsValues.timeout || {
      type: 'constant',
      content: data.timeout,
      schema: { type: 'number' },
    };
    delete data.timeout;
  }
}

/**
 * Normalize LLM node: convert flat prompt/temperature/modelName to nested inputsValues.
 * LLM may output: { prompt: "...", systemPrompt: "...", temperature: 0.7, modelName: "..." }
 * flowgram needs: { inputsValues: { prompt: {type:"template",content:"..."}, ... } }
 */
function normalizeLlmNode(data: Record<string, any>): void {
  if (!data.inputsValues) data.inputsValues = {};

  if (data.prompt && typeof data.prompt === 'string') {
    data.inputsValues.prompt = data.inputsValues.prompt || {
      type: 'template',
      content: data.prompt,
    };
    delete data.prompt;
  }
  if (data.systemPrompt && typeof data.systemPrompt === 'string') {
    data.inputsValues.systemPrompt = data.inputsValues.systemPrompt || {
      type: 'template',
      content: data.systemPrompt,
    };
    delete data.systemPrompt;
  }
  if (data.temperature !== undefined && typeof data.temperature === 'number') {
    data.inputsValues.temperature = data.inputsValues.temperature || {
      type: 'constant',
      content: data.temperature,
    };
    delete data.temperature;
  }
  if (data.modelName && typeof data.modelName === 'string') {
    data.inputsValues.modelName = data.inputsValues.modelName || {
      type: 'constant',
      content: data.modelName,
      schema: { type: 'string' },
    };
    delete data.modelName;
  }
  if (data.apiKey && typeof data.apiKey === 'string') {
    data.inputsValues.apiKey = data.inputsValues.apiKey || {
      type: 'constant',
      content: data.apiKey,
    };
    delete data.apiKey;
  }
  if (data.apiHost && typeof data.apiHost === 'string') {
    data.inputsValues.apiHost = data.inputsValues.apiHost || {
      type: 'constant',
      content: data.apiHost,
      schema: { type: 'string' },
    };
    delete data.apiHost;
  }
}

/**
 * Normalize Start node: auto-fill description and default values for output fields.
 */
function normalizeStartNode(data: Record<string, any>): void {
  if (!data.outputs) data.outputs = { type: 'object', properties: {} };
  if (!data.outputs.properties) data.outputs.properties = {};

  // Auto-fill description and default values for output properties
  if (data.outputs.properties) {
    for (const [key, prop] of Object.entries(data.outputs.properties)) {
      const p = prop as Record<string, any>;
      if (!p.description) {
        p.description = key;
      }
      if (p.default === undefined && p.type) {
        p.default = getDefaultValueForType(p.type);
      }
    }
  }
}

/**
 * Normalize End node: ensure inputsValues and inputs schema exist.
 */
function normalizeEndNode(data: Record<string, any>): void {
  if (!data.inputsValues) data.inputsValues = {};
  if (!data.inputs) data.inputs = { type: 'object', properties: {} };
}

/**
 * Convert ref shorthand {ref: "a.b"} to flowgram format {type: "ref", content: "a.b"}.
 * Also handles {ref: ["a.b", "c.d"]} → {type: "ref", content: ["a.b", "c.d"]}.
 * Recursively scans inputsValues and other fields.
 */
function normalizeRefShorthand(data: Record<string, any>): void {
  if (!data.inputsValues) return;
  for (const key of Object.keys(data.inputsValues)) {
    const val = data.inputsValues[key];
    if (val && typeof val === 'object' && val.ref !== undefined && !val.type) {
      val.type = 'ref';
      val.content = val.ref;
      delete val.ref;
    }
  }
  // Also handle conditions/branches arrays
  if (Array.isArray(data.conditions)) {
    for (const cond of data.conditions) {
      if (cond && typeof cond === 'object') {
        normalizeConditionRef(cond);
      }
    }
  }
  if (Array.isArray(data.branches)) {
    for (const branch of data.branches) {
      if (branch && typeof branch === 'object' && Array.isArray(branch.conditions)) {
        for (const cond of branch.conditions) {
          normalizeConditionRef(cond);
        }
      }
    }
  }
}

function normalizeConditionRef(cond: Record<string, any>): void {
  if (cond.left && typeof cond.left === 'object' && cond.left.ref !== undefined && !cond.left.type) {
    cond.left.type = 'ref';
    cond.left.content = cond.left.ref;
    delete cond.left.ref;
  }
  if (cond.right && typeof cond.right === 'object' && cond.right.ref !== undefined && !cond.right.type) {
    cond.right.type = 'ref';
    cond.right.content = cond.right.ref;
    delete cond.right.ref;
  }
}

function getDefaultValueForType(type: string): any {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'object': return {};
    case 'array': return [];
    default: return null;
  }
}
