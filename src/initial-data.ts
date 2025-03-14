import { FlowDocumentJSON } from './typings';

export const initialData: FlowDocumentJSON = {
  nodes: [
    {
      id: 'start_0',
      type: 'start',
      meta: {
        position: {
          x: 181,
          y: 249.5,
        },
      },
      data: {
        title: 'Start',
        description: 'Start node',
        outputs: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              default: 'Hello Flow.',
            },
          },
        },
      },
    },
    {
      id: 'condition_0',
      type: 'condition',
      meta: {
        position: {
          x: 643,
          y: 213,
        },
      },
      data: {
        title: 'Condition',
        description: 'condition',
        inputsValues: {
          conditions: [
            {
              key: 'if_0',
              value: { type: 'expression', content: '' },
            },
            {
              key: 'if_1',
              value: { type: 'expression', content: '' },
            },
          ],
        },
        inputs: {
          type: 'object',
          properties: {
            conditions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      id: 'llm_0',
      type: 'llm',
      blocks: [],
      meta: {
        description: 'llm',
        position: {
          x: 1105,
          y: 0,
        },
      },
      data: {
        title: 'LLM_0',
        description: 'condition',
        inputsValues: {
          modelType: 'gpt-3.5-turbo',
          temperature: 0.5,
          systemPrompt: 'You are an AI assistant.',
          prompt: '',
        },
        inputs: {
          type: 'object',
          required: ['modelType', 'temperature', 'prompt'],
          properties: {
            modelType: {
              type: 'string',
            },
            temperature: {
              type: 'number',
            },
            systemPrompt: {
              type: 'string',
            },
            prompt: {
              type: 'string',
            },
          },
        },
        outputs: {
          type: 'object',
          properties: {
            result: { type: 'string' },
          },
        },
      },
    },
    {
      id: 'llm_1',
      type: 'llm',
      blocks: [],
      meta: {
        description: 'llm',
        position: {
          x: 1105,
          y: 405,
        },
      },
      data: {
        title: 'LLM_1',
        description: 'condition',
        inputsValues: {
          modelType: 'gpt-3.5-turbo',
          temperature: 0.5,
          systemPrompt: 'You are an AI assistant.',
          prompt: 'Hello.',
        },
        inputs: {
          type: 'object',
          required: ['modelType', 'temperature', 'prompt'],
          properties: {
            modelType: {
              type: 'string',
            },
            temperature: {
              type: 'number',
            },
            systemPrompt: {
              type: 'string',
            },
            prompt: {
              type: 'string',
            },
          },
        },
        outputs: {
          type: 'object',
          properties: {
            result: { type: 'string' },
          },
        },
      },
    },
    {
      id: 'end_0',
      type: 'end',
      meta: {
        position: {
          x: 1567,
          y: 249.5,
        },
      },
      data: {
        title: 'End',
        description: 'end',
        outputs: {
          type: 'object',
          properties: {
            result: {
              type: 'string',
            },
          },
        },
      },
    },
    {
      id: 'code_mWO_8',
      type: 'code',
      meta: {
        position: {
          x: 379.6275862068965,
          y: 177.33620689655174,
        },
      },
      data: {
        title: 'Code_1',
        description: '代码组件',
        inputsValues: {},
        language: 'java',
        code: '',
        inputs: {
          type: 'object',
          required: [],
          properties: {},
        },
        outputs: {
          type: 'object',
          properties: {
            result: {
              type: 'string',
            },
          },
        },
      },
    },
  ],
  edges: [
    { sourceNodeID: 'start_0', targetNodeID: 'condition_0' },
    { sourceNodeID: 'condition_0', sourcePortID: 'if_0', targetNodeID: 'llm_0' },
    { sourceNodeID: 'condition_0', sourcePortID: 'if_1', targetNodeID: 'llm_1' },
    { sourceNodeID: 'llm_0', targetNodeID: 'end_0' },
    { sourceNodeID: 'llm_1', targetNodeID: 'end_0' },
  ],
};
