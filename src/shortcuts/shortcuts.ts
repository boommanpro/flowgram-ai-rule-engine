import {
  FlowNodeBaseType,
  FlowNodeEntity,
  FreeLayoutPluginContext,
  ShortcutsRegistry,
  WorkflowDocument,
  WorkflowDragService,
  WorkflowNodeEntity,
  WorkflowNodeJSON,
  WorkflowSelectService,
} from '@flowgram.ai/free-layout-editor';
import { Toast } from '@douyinfe/semi-ui';

import { FlowCommandId } from './constants';

export function shortcuts(shortcutsRegistry: ShortcutsRegistry, ctx: FreeLayoutPluginContext) {
  shortcutsRegistry.addHandlers({
    commandId: FlowCommandId.SELECT_ALL,
    shortcuts: ['meta a', 'ctrl a'],
    execute() {
      const allNodes = ctx.document.getAllNodes();
      ctx.playground.selectionService.selection = allNodes;
    },
  });
  shortcutsRegistry.addHandlers({
    commandId: FlowCommandId.COPY,
    shortcuts: ['meta c', 'ctrl c'],
    execute: async (e) => {
      const document = ctx.get<WorkflowDocument>(WorkflowDocument);
      const selectService = ctx.get<WorkflowSelectService>(WorkflowSelectService);

      if (window.getSelection()?.toString()) {
        navigator.clipboard.writeText(window.getSelection()?.toString() ?? '').then(() => {
          Toast.success({
            content: 'Text copied',
          });
        });

        return e;
      }

      const { selectedNodes } = selectService;

      if (selectedNodes.length === 0) {
        return;
      }
      const nodeEntities = selectedNodes.filter(
        (n) => n.flowNodeType !== 'start' && n.flowNodeType !== 'end'
      );
      const nodes = await Promise.all(
        nodeEntities.map(async (nodeEntity) => {
          const nodeJSON = await document.toNodeJSON(nodeEntity);
          return {
            nodeJSON,
            nodeType: nodeEntity.flowNodeType,
          };
        })
      );
      navigator.clipboard
        .writeText(
          JSON.stringify({
            nodes,
            fromHost: window.location.host,
          })
        )
        .then(() => {
          Toast.success({
            content: 'Nodes copied',
          });
        })
        .catch((err) => {
          Toast.error({
            content: 'Failed to copy nodes',
          });
          console.error('Failed to write text: ', err);
        });
    },
  });
  shortcutsRegistry.addHandlers({
    commandId: FlowCommandId.PASTE,
    shortcuts: ['meta v', 'ctrl v'],
    execute: async (selectedNodes?: WorkflowNodeEntity[]) => {
      const document = ctx.get<WorkflowDocument>(WorkflowDocument);
      const selectService = ctx.get<WorkflowSelectService>(WorkflowSelectService);
      const dragService = ctx.get<WorkflowDragService>(WorkflowDragService);

      if (selectedNodes && Array.isArray(selectedNodes)) {
        const newNodes = await Promise.all(
          selectedNodes.map(async (node) => {
            const nodeJSON = await document.toNodeJSON(node);
            return document.copyNodeFromJSON(
              nodeJSON.type as string,
              nodeJSON,
              '',
              nodeJSON.meta?.position,
              node.parent?.id
            );
          })
        );
        return newNodes;
      }

      const text: string = (await navigator.clipboard.readText()) || '';
      let clipboardData: {
        nodes: {
          nodeJSON: WorkflowNodeJSON;
          nodeType: string;
        }[];
        fromHost: string;
      };
      try {
        clipboardData = JSON.parse(text);
      } catch (e) {
        return;
      }
      if (!clipboardData.nodes || !clipboardData.fromHost) {
        return null;
      }

      if (clipboardData.fromHost !== window.location.host) {
        Toast.error({
          content: 'Cannot paste nodes from different pages',
        });
        return null;
      }

      const { activatedNode } = selectService;
      const containerNode =
        activatedNode?.flowNodeType === FlowNodeBaseType.SUB_CANVAS ? activatedNode : undefined;

      const nodes = await Promise.all(
        clipboardData.nodes.map(({ nodeJSON }) => {
          delete nodeJSON.blocks;
          delete nodeJSON.edges;
          delete nodeJSON.meta?.canvasPosition;
          const position = containerNode
            ? dragService.adjustSubNodePosition(
                nodeJSON.type as string,
                containerNode,
                nodeJSON.meta?.position
              )
            : nodeJSON.meta?.position;
          return document.copyNodeFromJSON(
            nodeJSON.type as string,
            nodeJSON,
            '',
            position,
            containerNode?.id
          );
        })
      );

      if (nodes.length > 0) {
        selectService.selection = nodes;
      }

      Toast.success({
        content: 'Nodes pasted',
      });
    },
  });

  shortcutsRegistry.addHandlers({
    commandId: FlowCommandId.COLLAPSE,
    commandDetail: {
      label: 'Collapse',
    },
    shortcuts: ['meta alt openbracket', 'ctrl alt openbracket'],
    isEnabled: () => !ctx.playground.config.readonlyOrDisabled,
    execute: () => {
      const selection = ctx.selection;

      const selectNodes = selection.selection.filter(
        (_entity) => _entity instanceof FlowNodeEntity
      ) as FlowNodeEntity[];

      selectNodes.forEach((node) => {
        node.renderData.expanded = false;
      });
    },
  });

  shortcutsRegistry.addHandlers({
    commandId: FlowCommandId.EXPAND,
    commandDetail: {
      label: 'Expand',
    },
    shortcuts: ['meta alt closebracket', 'ctrol alt openbracket'],
    isEnabled: () => !ctx.playground.config.readonlyOrDisabled,
    execute: () => {
      const selection = ctx.selection;

      const selectNodes = selection.selection.filter(
        (_entity) => _entity instanceof FlowNodeEntity
      ) as FlowNodeEntity[];

      selectNodes.forEach((node) => {
        node.renderData.expanded = true;
      });
    },
  });
}
