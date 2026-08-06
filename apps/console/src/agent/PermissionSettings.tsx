/**
 * PermissionSettings - 权限设置弹窗组件
 * 按 4 类分组列出所有 action 的权限策略（always / confirm / forbid）
 * 置顶快捷操作：一键全部开启、应用到所有新会话
 */
import React, { useCallback, useState, useMemo } from 'react';
import { IconClose } from '@douyinfe/semi-icons';
import { Radio, RadioGroup } from '@douyinfe/semi-ui';

import { useAgent } from './AgentContext';
import { useLanguage, t } from '../i18n';
import type { PermissionPolicy } from './types';

const ACCENT = '#4d53e8';

/** action 分组定义（title/desc 存储 i18n key，渲染时用 t() 翻译） */
const ACTION_GROUPS: { titleKey: string; actions: { name: string; descKey: string }[] }[] = [
  {
    titleKey: 'agent.perm.groupNav',
    actions: [
      { name: 'navigate', descKey: 'agent.perm.action.navigate' },
    ],
  },
  {
    titleKey: 'agent.perm.groupQuery',
    actions: [
      { name: 'query', descKey: 'agent.perm.action.query' },
    ],
  },
  {
    titleKey: 'agent.perm.groupWrite',
    actions: [
      { name: 'manage', descKey: 'agent.perm.action.manage' },
    ],
  },
  {
    titleKey: 'agent.perm.groupCanvas',
    actions: [
      { name: 'canvas', descKey: 'agent.perm.action.canvas' },
    ],
  },
  {
    titleKey: 'agent.perm.groupPlan',
    actions: [
      { name: 'createPlan', descKey: 'agent.perm.action.createPlan' },
      { name: 'executeStep', descKey: 'agent.perm.action.executeStep' },
    ],
  },
];

const POLICY_OPTIONS: { value: PermissionPolicy; labelKey: string; color: string }[] = [
  { value: 'always', labelKey: 'agent.perm.policyAlways', color: '#1f9d55' },
  { value: 'confirm', labelKey: 'agent.perm.policyConfirm', color: '#b7791f' },
  { value: 'forbid', labelKey: 'agent.perm.policyForbid', color: '#e5404e' },
];

/** 所有 action 名称列表 */
const ALL_ACTION_NAMES = ACTION_GROUPS.flatMap((g) => g.actions.map((a) => a.name));

interface PermissionSettingsProps {
  onClose?: () => void;
}

export const PermissionSettings: React.FC<PermissionSettingsProps> = ({ onClose }) => {
  const { permissions, updatePermission, updateGlobalPermission } = useAgent();
  useLanguage();
  const [applyGlobal, setApplyGlobal] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const handleChange = useCallback(
    async (action: string, policy: PermissionPolicy) => {
      await updatePermission(action, policy);
      if (applyGlobal) {
        await updateGlobalPermission(action, policy);
      }
    },
    [updatePermission, updateGlobalPermission, applyGlobal]
  );

  /** 一键全部设置为指定策略 */
  const handleBatchSet = useCallback(
    async (policy: PermissionPolicy) => {
      setBatchLoading(true);
      try {
        for (const action of ALL_ACTION_NAMES) {
          await updatePermission(action, policy);
          if (applyGlobal) {
            await updateGlobalPermission(action, policy);
          }
        }
      } finally {
        setBatchLoading(false);
      }
    },
    [updatePermission, updateGlobalPermission, applyGlobal]
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  /** 当前策略统计 */
  const stats = useMemo(() => {
    let always = 0, confirm = 0, forbid = 0;
    for (const name of ALL_ACTION_NAMES) {
      const p = permissions[name] || 'always';
      if (p === 'always') always++;
      else if (p === 'confirm') confirm++;
      else if (p === 'forbid') forbid++;
    }
    return { always, confirm, forbid };
  }, [permissions]);

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
          width: '400px',
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
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{t('agent.perm.title')}</span>
          <button
            onClick={handleClose}
            title={t('agent.perm.close')}
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

        {/* 置顶快捷操作区 */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
            flexShrink: 0,
          }}
        >
          {/* 应用到所有新会话 */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#333',
              cursor: 'pointer',
              marginBottom: '10px',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={applyGlobal}
              onChange={(e) => setApplyGlobal(e.target.checked)}
              style={{ cursor: 'pointer', width: '14px', height: '14px' }}
            />
            <span>{t('agent.perm.applyGlobal')}</span>
          </label>

          {/* 一键批量操作 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#999', flexShrink: 0 }}>{t('agent.perm.quickAction')}：</span>
            <button
              onClick={() => handleBatchSet('always')}
              disabled={batchLoading}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                border: '1px solid #b7eb8f',
                borderRadius: '4px',
                background: '#f6ffed',
                color: '#389e0d',
                cursor: batchLoading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agent.perm.allAllow')}
            </button>
            <button
              onClick={() => handleBatchSet('confirm')}
              disabled={batchLoading}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                border: '1px solid #ffd591',
                borderRadius: '4px',
                background: '#fff7e6',
                color: '#d46b08',
                cursor: batchLoading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agent.perm.allConfirm')}
            </button>
            <button
              onClick={() => handleBatchSet('forbid')}
              disabled={batchLoading}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                background: '#fff2f0',
                color: '#cf1322',
                cursor: batchLoading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {t('agent.perm.allForbid')}
            </button>
          </div>

          {/* 统计 */}
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#aaa' }}>
            {t('agent.perm.statsCurrent')}：{stats.always} {t('agent.perm.allow')} / {stats.confirm} {t('agent.perm.confirmWord')} / {stats.forbid} {t('agent.perm.forbidWord')}
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {ACTION_GROUPS.map((group) => (
            <div key={group.titleKey} style={{ marginBottom: '18px' }}>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: ACCENT,
                  marginBottom: '8px',
                  letterSpacing: '0.3px',
                }}
              >
                {t(group.titleKey)}
              </div>
              <div
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {group.actions.map((action, idx) => {
                  const current = permissions[action.name] || 'always';
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
                        <span style={{ fontSize: '11px', color: '#aaa' }}>{t(action.descKey)}</span>
                      </div>
                      <RadioGroup
                        type="button"
                        buttonSize="small"
                        value={current}
                        onChange={(e) => handleChange(action.name, e.target.value as PermissionPolicy)}
                      >
                        {POLICY_OPTIONS.map((opt) => (
                          <Radio key={opt.value} value={opt.value}>
                            {t(opt.labelKey)}
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
