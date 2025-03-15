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
            user: {
              type: 'string',
              default: 'Hello Flow.',
            },
            mobile: {
              type: 'string',
              default: '123',
            },
            mis: {
              type: 'string',
              default: '123',
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
          x: 594.7362068965517,
          y: 586.6551724137931,
        },
      },
      data: {
        title: 'Condition',
        description: 'condition',
        inputsValues: {
          conditions: [
            {
              key: 'if_0',
              value: {
                type: 'expression',
                content: 'start_0.outputs.mobile',
              },
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
      id: 'end_0',
      type: 'end',
      meta: {
        position: {
          x: 1567,
          y: 335.12931034482756,
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
              default: 'code_r_Wx-.outputs.result',
            },
          },
        },
      },
    },
    {
      id: 'code_r_Wx-',
      type: 'code',
      meta: {
        position: {
          x: 1018.1913793103448,
          y: 249.5,
        },
      },
      data: {
        title: 'Code_1',
        description: '代码组件',
        inputsValues: {},
        config: {
          language: 'java',
          code: '',
        },
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
    {
      sourceNodeID: 'start_0',
      targetNodeID: 'condition_0',
    },
    {
      sourceNodeID: 'condition_0',
      targetNodeID: 'code_r_Wx-',
      sourcePortID: 'if_0',
    },
    {
      sourceNodeID: 'code_r_Wx-',
      targetNodeID: 'end_0',
    },
  ],
};
