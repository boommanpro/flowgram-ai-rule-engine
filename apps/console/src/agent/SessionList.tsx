/**
 * SessionList - 会话列表侧栏组件
 * 列出所有会话，支持切换、新建、删除、重命名（双击编辑）
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';

import { useAgent } from './AgentContext';
import { useLanguage, t } from '../i18n';

const ACCENT = '#4d53e8';

interface SessionListProps {
  onClose?: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({ onClose }) => {
  const {
    sessions,
    currentSessionKey,
    switchSession,
    createSession,
    deleteSession,
    renameSession,
  } = useAgent();
  useLanguage();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 进入编辑态时聚焦
  useEffect(() => {
    if (editingKey && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingKey]);

  const startEdit = useCallback((key: string, title: string) => {
    setEditingKey(key);
    setEditingTitle(title);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingKey) {
      const trimmed = editingTitle.trim();
      if (trimmed) {
        void renameSession(editingKey, trimmed);
      }
      setEditingKey(null);
    }
  }, [editingKey, editingTitle, renameSession]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitEdit();
      } else if (e.key === 'Escape') {
        setEditingKey(null);
      }
    },
    [commitEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, key: string) => {
      e.stopPropagation();
      void deleteSession(key);
    },
    [deleteSession]
  );

  const handleSelect = useCallback(
    (key: string) => {
      if (key === currentSessionKey) {
        onClose?.();
        return;
      }
      void switchSession(key);
      onClose?.();
    },
    [currentSessionKey, switchSession, onClose]
  );

  const handleNew = useCallback(() => {
    void createSession();
    onClose?.();
  }, [createSession, onClose]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
      }}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '0 12px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '12px',
          color: '#999',
          fontWeight: 600,
          letterSpacing: '0.5px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        {t('agent.sessionList')}
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px' }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              color: '#bbb',
              fontSize: '12px',
            }}
          >
            {t('agent.noSession')}
          </div>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.sessionKey === currentSessionKey;
            const isEditing = editingKey === s.sessionKey;
            return (
              <div
                key={s.sessionKey}
                onClick={() => !isEditing && handleSelect(s.sessionKey)}
                onDoubleClick={() => startEdit(s.sessionKey, s.title)}
                title={s.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  marginBottom: '2px',
                  cursor: isEditing ? 'default' : 'pointer',
                  background: isCurrent ? '#f0f0ff' : 'transparent',
                  color: isCurrent ? ACCENT : '#333',
                  fontSize: '13px',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = '#f5f5f7';
                  const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement | null;
                  if (btn) btn.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = 'transparent';
                  const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement | null;
                  if (btn) btn.style.opacity = '0';
                }}
              >
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleEditKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      border: `1px solid ${ACCENT}`,
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '13px',
                      outline: 'none',
                      background: '#fff',
                      color: '#1a1a1a',
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {s.title || t('agent.unnamedSession')}
                  </span>
                )}
                {!isEditing && (
                  <button
                    className="del-btn"
                    onClick={(e) => handleDelete(e, s.sessionKey)}
                    title={t('agent.deleteSession')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#bbb',
                      cursor: 'pointer',
                      padding: '2px',
                      marginLeft: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0,
                      transition: 'opacity 0.12s, color 0.12s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#e5404e';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#bbb';
                    }}
                  >
                    <IconDelete size="small" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 新建按钮 */}
      <div
        style={{
          padding: '8px 8px',
          borderTop: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleNew}
          style={{
            width: '100%',
            padding: '7px 0',
            border: `1px dashed ${ACCENT}`,
            background: 'transparent',
            color: ACCENT,
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <IconPlus size="small" />
          {t('agent.newSession')}
        </button>
      </div>
    </div>
  );
};

export default SessionList;
