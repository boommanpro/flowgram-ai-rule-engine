/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, startTransition } from 'react';

import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin';
import {
  PlaygroundEntityContext,
  useRefresh,
  useClientContext,
} from '@flowgram.ai/free-layout-editor';
import { Button } from '@douyinfe/semi-ui';
import { IconPlay } from '@douyinfe/semi-icons';

import { FlowNodeMeta } from '../../typings';
import { IsSidebarContext } from '../../context';
import { SidebarNodeRenderer } from './sidebar-node-renderer';
import { useLanguage, t } from '../../i18n';

export interface NodeFormPanelProps {
  nodeId: string;
}

export const NodeFormPanel: React.FC<NodeFormPanelProps> = ({ nodeId }) => {
  const panelManager = usePanelManager();
  const { selection, playground, document } = useClientContext();
  const refresh = useRefresh();
  useLanguage();
  const handleClose = useCallback(() => {
    // Sidebar delayed closing
    startTransition(() => {
      panelManager.close(nodeFormPanelFactory.key);
    });
  }, []);

  const handleTestNode = useCallback(() => {
    panelManager.open('single-node-test-panel', 'right', {
      props: { nodeId },
    });
  }, [panelManager, nodeId]);
  const node = document.getNode(nodeId);
  const sidebarDisabled = node?.getNodeMeta<FlowNodeMeta>()?.sidebarDisabled === true;
  /**
   * Listen readonly
   */
  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => {
      handleClose();
      refresh();
    });
    return () => disposable.dispose();
  }, [playground]);
  /**
   * Listen selection
   */
  useEffect(() => {
    const toDispose = selection.onSelectionChanged(() => {
      /**
       * 如果没有选中任何节点，则自动关闭侧边栏
       * If no node is selected, the sidebar is automatically closed
       */
      if (selection.selection.length === 0) {
        handleClose();
      } else if (selection.selection.length === 1 && selection.selection[0] !== node) {
        handleClose();
      }
    });
    return () => toDispose.dispose();
  }, [selection, node, handleClose]);
  /**
   * Close when node disposed
   */
  useEffect(() => {
    if (node) {
      const toDispose = node.onDispose(() => {
        panelManager.close(nodeFormPanelFactory.key);
      });
      return () => toDispose.dispose();
    }
    return () => {};
  }, [node, sidebarDisabled, handleClose]);
  /**
   * Cloze when sidebar disabled
   */
  useEffect(() => {
    if (!node || sidebarDisabled || playground.config.readonly) {
      handleClose();
    }
  }, [node, sidebarDisabled, playground.config.readonly]);

  if (!node || sidebarDisabled || playground.config.readonly) {
    return null;
  }

  return (
    <IsSidebarContext.Provider value={true}>
      <PlaygroundEntityContext.Provider key={node.id} value={node}>
        <SidebarNodeRenderer node={node} />
        {!playground.config.readonly && (
          <div style={{ padding: '8px 16px 16px', borderTop: '1px solid rgba(82,100,154,0.08)' }}>
            <Button
              block
              icon={<IconPlay size="small" />}
              onClick={handleTestNode}
              style={{ borderRadius: 6 }}
            >
              {t('singleNode.testThisNode')}
            </Button>
          </div>
        )}
      </PlaygroundEntityContext.Provider>
    </IsSidebarContext.Provider>
  );
};

export const nodeFormPanelFactory: PanelFactory<NodeFormPanelProps> = {
  key: 'node-form-panel',
  defaultSize: 500,
  render: (props: NodeFormPanelProps) => <NodeFormPanel {...props} />,
};
