/**
 * AgentDock - 全局悬浮 Agent 对话面板
 * 右下角悬浮按钮 + 右侧抽屉式对话面板
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconSetting, IconClose, IconList } from '@douyinfe/semi-icons';

import { useAgent } from './AgentContext';
import { createToolExecutor } from './tools';
import MessageList from './MessageList';
import SessionList from './SessionList';
import PermissionSettings from './PermissionSettings';
import type { ToolCallEvent } from './types';

const ACCENT = '#4d53e8';

/** 工具调用 args 摘要 */
function summarizeArgs(args: Record<string, any>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return '(无参数)';
  const parts: string[] = [];
  for (const k of keys.slice(0, 4)) {
    let v = args[k];
    if (typeof v === 'string') {
      v = v.length > 30 ? v.slice(0, 30) + '…' : v;
    } else if (typeof v === 'object') {
      v = JSON.stringify(v);
      if (v.length > 30) v = v.slice(0, 30) + '…';
    }
    parts.push(`${k}: ${v}`);
  }
  if (keys.length > 4) parts.push(`…+${keys.length - 4}`);
  return parts.join(', ');
}

/** 确认弹窗 */
const ConfirmModal: React.FC<{ event: ToolCallEvent; onResolve: (v: boolean) => void }> = ({
  event,
  onResolve,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: '320px',
          background: '#fff',
          borderRadius: '10px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          padding: '18px 18px 16px',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>
          确认执行工具
        </div>
        <div style={{ marginBottom: '6px' }}>
          <span style={{ color: '#999', fontSize: '12px' }}>操作</span>
          <span
            style={{
              marginLeft: '8px',
              color: ACCENT,
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {event.action}
          </span>
        </div>
        <div
          style={{
            background: '#f7f7fa',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '12px',
            color: '#555',
            marginBottom: '16px',
            wordBreak: 'break-all',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        >
          {summarizeArgs(event.args)}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onResolve(false)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid #e0e0e6',
              background: '#fff',
              color: '#555',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            拒绝
          </button>
          <button
            onClick={() => onResolve(true)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: ACCENT,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
};

export const AgentDock: React.FC = () => {
  const {
    dockOpen,
    setDockOpen,
    sessions,
    currentSessionKey,
    pendingConfirm,
    streaming,
    setToolExecutor,
    resolveConfirm,
    createSession,
    sendMessage,
  } = useAgent();
  const navigate = useNavigate();

  const [input, setInput] = useState('');
  const [showSessionList, setShowSessionList] = useState(false);
  const [showPermission, setShowPermission] = useState(false);

  // 注册工具执行器
  useEffect(() => {
    setToolExecutor(createToolExecutor(navigate));
  }, [navigate, setToolExecutor]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    void sendMessage(text);
  }, [input, streaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const currentSession = sessions.find((s) => s.sessionKey === currentSessionKey);
  const headerTitle = currentSession ? currentSession.title : 'Agent 对话';

  // 悬浮按钮
  if (!dockOpen) {
    return (
      <button
        onClick={() => setDockOpen(true)}
        title="打开 Agent"
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
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '1px',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        AI
      </button>
    );
  }

  // 抽屉面板
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100vh',
        display: 'flex',
        zIndex: 9999,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* 会话列表侧栏 */}
      {showSessionList && (
        <div
          style={{
            width: '180px',
            height: '100vh',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderRight: '1px solid #e8e8ea',
            flexShrink: 0,
          }}
        >
          <SessionList onClose={() => setShowSessionList(false)} />
        </div>
      )}

      {/* 主面板 */}
      <div
        style={{
          width: '420px',
          height: '100vh',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderLeft: '1px solid #e8e8ea',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.05)',
        }}
      >
        {/* 顶部栏 */}
        <div
          style={{
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            borderBottom: '1px solid #eee',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1a1a1a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {headerTitle}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <DockIconButton title="会话列表" onClick={() => setShowSessionList((v) => !v)}>
              <IconList />
            </DockIconButton>
            <DockIconButton
              title="新建对话"
              onClick={() => {
                void createSession();
              }}
            >
              <IconPlus />
            </DockIconButton>
            <DockIconButton title="权限设置" onClick={() => setShowPermission(true)}>
              <IconSetting />
            </DockIconButton>
            <DockIconButton title="关闭" onClick={() => setDockOpen(false)}>
              <IconClose />
            </DockIconButton>
          </div>
        </div>

        {/* 消息区 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {sessions.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '13px',
              }}
            >
              点击 + 新建对话
            </div>
          ) : (
            <MessageList />
          )}
        </div>

        {/* 输入区 */}
        <div
          style={{
            borderTop: '1px solid #eee',
            padding: '10px 12px',
            flexShrink: 0,
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? '正在回复…' : '输入消息，Enter 发送，Shift+Enter 换行'}
            disabled={streaming || !currentSessionKey}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #e0e0e6',
              borderRadius: '8px',
              padding: '8px 10px',
              fontSize: '13px',
              lineHeight: '1.5',
              minHeight: '40px',
              maxHeight: '120px',
              outline: 'none',
              background: '#fff',
              color: '#1a1a1a',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim() || !currentSessionKey}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: streaming || !input.trim() || !currentSessionKey ? '#c9c9e0' : ACCENT,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor:
                streaming || !input.trim() || !currentSessionKey ? 'not-allowed' : 'pointer',
            }}
          >
            发送
          </button>
        </div>

        {/* 确认弹窗 */}
        {pendingConfirm && <ConfirmModal event={pendingConfirm} onResolve={resolveConfirm} />}

        {/* 权限设置弹窗 */}
        {showPermission && (
          <PermissionSettings onClose={() => setShowPermission(false)} />
        )}
      </div>
    </div>
  );
};

/** 顶栏小图标按钮 */
const DockIconButton: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => {
  return (
    <button
      title={title}
      onClick={onClick}
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
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f0f0f5';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
};
