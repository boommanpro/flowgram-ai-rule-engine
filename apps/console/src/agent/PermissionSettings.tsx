/**
 * PermissionSettings - 权限设置弹窗组件
 * 按 4 类分组列出所有 action 的权限策略（always / confirm / forbid）
 */
import React, { useCallback } from 'react';
import { IconClose } from '@douyinfe/semi-icons';
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

import { useAgent } from './AgentContext';
import type { PermissionPolicy } from './types';

const ACCENT = '#4d53e8';

/** action 分组定义 */
const ACTION_GROUPS: { title: string; actions: { name: string; desc: string }[] }[] = [
  {
    title: '导航类',
    actions: [
      { name: 'goHome', desc: '前往首页' },
      { name: 'goAdmin', desc: '前往管理后台' },
      { name: 'goReleases', desc: '前往发布列表' },
      { name: 'goEditor', desc: '前往工作流编辑器' },
      { name: 'goTemplateEditor', desc: '前往模板编辑器' },
    ],
  },
  {
    title: '查询类',
    actions: [
      { name: 'listWorkflows', desc: '查询工作流列表' },
      { name: 'listTemplates', desc: '查询模板列表' },
      { name: 'listLogs', desc: '查询执行日志' },
      { name: 'getWorkflowDetail', desc: '查询工作流详情' },
      { name: 'getNodeDetail', desc: '查询节点详情' },
    ],
  },
  {
    title: '写操作类',
    actions: [
      { name: 'createWorkflow', desc: '创建工作流' },
      { name: 'createTemplate', desc: '创建模板' },
      { name: 'saveWorkflow', desc: '保存工作流' },
      { name: 'deleteWorkflow', desc: '删除工作流' },
    ],
  },
  {
    title: '画布类',
    actions: [
      { name: 'addNode', desc: '新增节点' },
      { name: 'updateNode', desc: '更新节点' },
      { name: 'deleteNode', desc: '删除节点' },
      { name: 'connect', desc: '连接节点' },
      { name: 'disconnect', desc: '断开连接' },
      { name: 'autoLayout', desc: '自动布局' },
    ],
  },
];

const POLICY_OPTIONS: { value: PermissionPolicy; label: string; color: string }[] = [
  { value: 'always', label: '总是允许', color: '#1f9d55' },
  { value: 'confirm', label: '每次确认', color: '#b7791f' },
  { value: 'forbid', label: '禁止', color: '#e5404e' },
];

interface PermissionSettingsProps {
  onClose?: () => void;
}

export const PermissionSettings: React.FC<PermissionSettingsProps> = ({ onClose }) => {
  const { permissions, updatePermission } = useAgent();

  const handleChange = useCallback(
    (action: string, policy: PermissionPolicy) => {
      void updatePermission(action, policy);
    },
    [updatePermission]
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        zIndex: 110,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '360px',
          height: '100%',
          background: '#fff',
          borderLeft: '1px solid #e8e8ea',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
        }}
      >
        {/* 顶栏 */}
        <div
          style={{
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px 0 16px',
            borderBottom: '1px solid #eee',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>权限设置</span>
          <button
            onClick={handleClose}
            title="关闭"
            style={{
              width: '30px',
              height: '30px',
              border: 'none',
              background: 'transparent',
              color: '#555',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f0f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <IconClose />
          </button>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div
            style={{
              fontSize: '12px',
              color: '#999',
              marginBottom: '14px',
              lineHeight: '1.5',
            }}
          >
            为每类工具操作设置权限策略，控制 Agent 执行时是否需要确认。
          </div>

          {ACTION_GROUPS.map((group) => (
            <div key={group.title} style={{ marginBottom: '18px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: ACCENT,
                  marginBottom: '8px',
                  letterSpacing: '0.3px',
                }}
              >
                {group.title}
              </div>
              <div
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {group.actions.map((action, idx) => {
                  const current = permissions[action.name] || 'confirm';
                  return (
                    <div
                      key={action.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderTop: idx === 0 ? 'none' : '1px solid #f5f5f5',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#333',
                            fontWeight: 500,
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          }}
                        >
                          {action.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#aaa' }}>{action.desc}</span>
                      </div>
                      <RadioGroup
                        type="button"
                        buttonSize="small"
                        value={current}
                        onChange={(e) => handleChange(action.name, e.target.value as PermissionPolicy)}
                      >
                        {POLICY_OPTIONS.map((opt) => (
                          <Radio key={opt.value} value={opt.value}>
                            {opt.label}
                          </Radio>
                        ))}
                      </RadioGroup>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PermissionSettings;
