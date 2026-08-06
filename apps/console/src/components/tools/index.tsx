/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useEffect, useState } from 'react';

import { useClientContext, useRefresh } from '@flowgram.ai/free-layout-editor';
import { Divider, IconButton, Tooltip } from '@douyinfe/semi-ui';
import { IconRedo, IconUndo } from '@douyinfe/semi-icons';

import { TestRunButton } from '../testrun/testrun-button';
import { AddNode } from '../add-node';
import { ZoomSelect } from './zoom-select';
import { SwitchLine } from './switch-line';
import { ToolContainer, ToolSection } from './styles';
import { SchemaEditor } from './schema-editor';
import { Save } from './save';
import { ReportEditor } from './report-editor';
import { Readonly } from './readonly';
import { MinimapSwitch } from './minimap-switch';
import { Minimap } from './minimap';
import { Interactive } from './interactive';
import { FitView } from './fit-view';
import { Comment } from './comment';
import { AutoLayout } from './auto-layout';
import { RunHistoryButton } from '../run-history';
import { useLanguage, t } from '../../i18n';

export const DemoTools = ({
  hideSaveAndTestRun = false,
  hideSave = false,
  hideRunHistory = false,
  hideReportEditor = false,
}: {
  hideSaveAndTestRun?: boolean;
  hideSave?: boolean;
  hideRunHistory?: boolean;
  hideReportEditor?: boolean;
} = {}) => {
  const { history, playground } = useClientContext();
  useLanguage();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(true);
  useEffect(() => {
    const disposable = history.undoRedoService.onChange(() => {
      setCanUndo(history.canUndo());
      setCanRedo(history.canRedo());
    });
    return () => disposable.dispose();
  }, [history]);
  const refresh = useRefresh();

  useEffect(() => {
    const disposable = playground.config.onReadonlyOrDisabledChange(() => refresh());
    return () => disposable.dispose();
  }, [playground]);

  return (
    <ToolContainer className="demo-free-layout-tools">
      <ToolSection>
        <Interactive />
        <AutoLayout />
        <SwitchLine />
        <ZoomSelect />
        <FitView />
        <MinimapSwitch minimapVisible={minimapVisible} setMinimapVisible={setMinimapVisible} />
        <Minimap visible={minimapVisible} />
        <Readonly />
        <Comment />
        <Tooltip content={t('tool.undo')}>
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconUndo />}
            disabled={!canUndo || playground.config.readonly}
            onClick={() => history.undo()}
          />
        </Tooltip>
        <Tooltip content={t('tool.redo')}>
          <IconButton
            type="tertiary"
            theme="borderless"
            icon={<IconRedo />}
            disabled={!canRedo || playground.config.readonly}
            onClick={() => history.redo()}
          />
        </Tooltip>
        {!hideRunHistory && <RunHistoryButton />}
        {!hideRunHistory && <Divider layout="vertical" style={{ height: '16px' }} margin={3} />}
        <AddNode disabled={playground.config.readonly} />
        <Divider layout="vertical" style={{ height: '16px' }} margin={3} />
        {!hideSaveAndTestRun && !hideSave && <Save disabled={playground.config.readonly} />}
        {!hideReportEditor && <ReportEditor />}
        <SchemaEditor />
        {!hideSaveAndTestRun && <TestRunButton disabled={playground.config.readonly} />}
      </ToolSection>
    </ToolContainer>
  );
};
