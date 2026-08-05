/**
 * AgentDockFAB - 悬浮动作按钮
 * 面板关闭时常驻右下角，点击打开面板
 */
import React from 'react';
import { useAgent } from './AgentContext';
import { useLanguage, t } from '../i18n';
import { publicPath } from '../utils/public-path';

const ACCENT = '#4d53e8';

export const AgentDockFAB: React.FC = () => {
  const { dockOpen, setDockOpen } = useAgent();
  useLanguage();
  if (dockOpen) return null;
  return (
    <button
      onClick={() => setDockOpen(true)}
      title={t('agent.open')}
      style={{
        position: 'fixed',
        right: '28px',
        bottom: '28px',
        width: '54px',
        height: '54px',
        borderRadius: '50%',
        background: ACCENT,
        color: '#fff',
        border: 'none',
        boxShadow: '0 6px 18px rgba(77,83,232,0.4)',
        cursor: 'pointer',
        padding: 0,
        overflow: 'hidden',
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={publicPath('agent-logo.jpg')}
        alt="Agent"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '50%',
        }}
      />
    </button>
  );
};
