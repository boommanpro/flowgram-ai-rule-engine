/**
 * AgentDock - 全局 Agent 入口
 * 由悬浮按钮 (FAB) + 抽屉面板 (Panel) 组成
 */
import React from 'react';
import { AgentDockFAB } from './AgentDockFAB';
import { AgentDockPanel } from './AgentDockPanel';

export const AgentDock: React.FC = () => (
  <>
    <AgentDockFAB />
    <AgentDockPanel />
  </>
);
