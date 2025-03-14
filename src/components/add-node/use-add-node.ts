import { useCallback } from 'react';

import { WorkflowNodePanelService } from '@flowgram.ai/free-node-panel-plugin';
import {
  useService,
  WorkflowDocument,
  usePlayground,
  getAntiOverlapPosition,
  PositionSchema,
  WorkflowNodeEntity,
  WorkflowSelectService,
} from '@flowgram.ai/free-layout-editor';

const useGetPanelPosition = () => {
  const playground = usePlayground();

  return useCallback(
    (targetBoundingRect: DOMRect): PositionSchema =>
      playground.config.getPosFromMouseEvent({
        clientX: targetBoundingRect.left + 64,
        clientY: targetBoundingRect.top - 7,
      }),
    [playground]
  );
};

const useSelectNode = () => {
  const selectService = useService(WorkflowSelectService);
  return useCallback(
    (node?: WorkflowNodeEntity) => {
      if (!node) {
        return;
      }
      selectService.selectNode(node);
    },
    [selectService]
  );
};

export const useAddNode = () => {
  const workflowDocument = useService(WorkflowDocument);
  const nodePanelService = useService<WorkflowNodePanelService>(WorkflowNodePanelService);
  const playground = usePlayground();
  const getPanelPosition = useGetPanelPosition();
  const select = useSelectNode();

  return useCallback(
    async (targetBoundingRect: DOMRect): Promise<void> => {
      const panelPosition = getPanelPosition(targetBoundingRect);
      await nodePanelService.call({
        panelPosition,
        customPosition: ({ selectPosition }) => {
          const nodeWidth = 360;
          const nodePanelOffset = 150 / playground.config.zoom;
          const customPositionX = panelPosition.x + nodeWidth / 2 + nodePanelOffset;
          const customNodePosition = getAntiOverlapPosition(workflowDocument, {
            x: customPositionX,
            y: selectPosition.y,
          });
          return {
            x: customNodePosition.x,
            y: customNodePosition.y,
          };
        },
        enableSelectPosition: true,
        enableMultiAdd: true,
        afterAddNode: select,
      });
    },
    [getPanelPosition, nodePanelService, playground.config.zoom, workflowDocument, select]
  );
};
