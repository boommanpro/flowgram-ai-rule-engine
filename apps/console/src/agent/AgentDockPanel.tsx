/**
 * AgentDockPanel - Agent 对话面板主体（flex 子元素）
 * 由 AgentDock 渲染，作为 flex 布局子元素，宽度从 0 动画到 420px
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconClose, IconList } from '@douyinfe/semi-icons';

import { useAgent } from './AgentContext';
import { useLanguage, t } from '../i18n';
import { createToolExecutor } from './tools';
import MessageList from './MessageList';
import SessionList from './SessionList';
import { DebugPanel } from './DebugPanel';
import { PlanCard } from './PlanCard';
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
          <span style={{ color: '#999', fontSize: '12px' }}>{t('agent.actions')}</span>
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

export const AgentDockPanel: React.FC = () => {
  const {
    dockOpen,
    setDockOpen,
    sessions,
    currentSessionKey,
    pendingConfirm,
    streaming,
    queueLength,
    tokenUsage,
    compactContext,
    setToolExecutor,
    resolveConfirm,
    createSession,
    renameSession,
    sendMessage,
    stopStreaming,
    debugPanelOpen,
    setDebugPanelOpen,
    focusDebugEntryId,
    activePlan,
  } = useAgent();
  const navigate = useNavigate();
  useLanguage();

  const [input, setInput] = useState('');
  const [showSessionList, setShowSessionList] = useState(false);
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [textareaHeight, setTextareaHeight] = useState(56);
  const [isResizing, setIsResizing] = useState(false);

  // 顶栏标题内联编辑（双击标题触发）
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const editTitleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingTitle && editTitleRef.current) {
      editTitleRef.current.focus();
      editTitleRef.current.select();
    }
  }, [editingTitle]);

  // Task 1c: multimodal image input
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // IME 输入法合成状态：中文输入候选词期间按回车不应发送消息
  const isComposingRef = useRef(false);

  // 注册工具执行器
  useEffect(() => {
    setToolExecutor(createToolExecutor(navigate));
  }, [navigate, setToolExecutor]);

  // 首次打开 Dock 且无会话时，自动新建对话（无需用户手动点击）
  const autoCreateInitRef = useRef(false);
  useEffect(() => {
    if (dockOpen && !autoCreateInitRef.current && sessions.length === 0 && !currentSessionKey) {
      autoCreateInitRef.current = true;
      void createSession();
    }
  }, [dockOpen, sessions.length, currentSessionKey, createSession]);

  // 切换会话时重置 plan 折叠状态（新会话 PlanCard 默认展开）
  useEffect(() => {
    setPlanCollapsed(false);
  }, [currentSessionKey]);

  /** 读取单个 File 为 base64 data URL */
  const readFileAsDataURL = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  /** 处理文件选择：最多 4 张 */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const remaining = 4 - selectedImages.length;
      const toRead = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, remaining);
      const dataUrls = await Promise.all(toRead.map(readFileAsDataURL));
      if (dataUrls.length > 0) {
        setSelectedImages((prev) => [...prev, ...dataUrls]);
      }
      // 清空 input value 以便重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [selectedImages.length, readFileAsDataURL]
  );

  /** 粘贴事件：检测剪贴板中的图片 */
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      const remaining = 4 - selectedImages.length;
      const toRead = imageFiles.slice(0, remaining);
      const dataUrls = await Promise.all(toRead.map(readFileAsDataURL));
      if (dataUrls.length > 0) {
        setSelectedImages((prev) => [...prev, ...dataUrls]);
      }
    },
    [selectedImages.length, readFileAsDataURL]
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && selectedImages.length === 0) return;
    const imagesToSend = selectedImages.length > 0 ? selectedImages : undefined;
    setInput('');
    setSelectedImages([]);
    void sendMessage(text, imagesToSend);
  }, [input, selectedImages, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 中文输入法合成期间（候选词未确认）按回车不应发送消息
      if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /** 面板宽度拖拽：拖动左侧边缘调整宽度（320-600px） */
  const onPanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = panelWidth;
      setIsResizing(true);
      const onMove = (ev: MouseEvent) => {
        const delta = startX - ev.clientX;
        const newWidth = Math.max(320, Math.min(600, startWidth + delta));
        setPanelWidth(newWidth);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setIsResizing(false);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [panelWidth]
  );

  /** 输入框高度拖拽：拖动手柄调整高度（40-300px） */
  const onTextareaResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = textareaHeight;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        const newHeight = Math.max(40, Math.min(300, startHeight + delta));
        setTextareaHeight(newHeight);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [textareaHeight]
  );

  const currentSession = sessions.find((s) => s.sessionKey === currentSessionKey);
  const headerTitle = currentSession ? currentSession.title : t('agent.title');

  const handleStartEditTitle = useCallback(() => {
    if (!currentSessionKey || !headerTitle) return;
    setEditingTitle(true);
    setEditingTitleValue(headerTitle);
  }, [currentSessionKey, headerTitle]);

  const handleCommitTitleEdit = useCallback(async () => {
    if (!currentSessionKey || !editingTitle) return;
    const trimmed = editingTitleValue.trim();
    if (trimmed && trimmed !== headerTitle) {
      try {
        await renameSession(currentSessionKey, trimmed);
      } catch (e) {
        // ignore UI already reflects optimistic rename via AgentContext
      }
    }
    setEditingTitle(false);
  }, [currentSessionKey, editingTitle, editingTitleValue, headerTitle, renameSession]);

  return (
    <>
      {/* 会话列表侧栏（浮于面板左侧） */}
      {dockOpen && showSessionList && (
        <div
          style={{
            position: 'fixed',
            right: panelWidth,
            top: 0,
            width: '180px',
            height: '100vh',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderRight: '1px solid #e8e8ea',
            flexShrink: 0,
            zIndex: 9999,
          }}
        >
          <SessionList onClose={() => setShowSessionList(false)} />
        </div>
      )}

      {/* 动画外层容器：宽度 0 → 420px */}
      <div
        style={{
          width: dockOpen ? panelWidth : 0,
          transition: isResizing ? 'none' : 'width 0.3s ease',
          overflow: 'hidden',
          height: '100vh',
          flexShrink: 0,
          display: 'flex',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* 主面板（固定宽度，防止动画过程中内容回流） */}
        <div
          style={{
            width: panelWidth,
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
            {/* 拖拽条：调整面板宽度 */}
            <div
              onMouseDown={onPanelResizeStart}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                cursor: 'col-resize',
                background: 'transparent',
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            />
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
            {editingTitle ? (
              <input
                ref={editTitleRef}
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onBlur={() => void handleCommitTitleEdit()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCommitTitleEdit();
                  else if (e.key === 'Escape') setEditingTitle(false);
                }}
                style={{
                  flex: 1,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  border: `1px solid ${ACCENT}`,
                  borderRadius: '4px',
                  padding: '3px 8px',
                  outline: 'none',
                  background: '#fff',
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <div
                onDoubleClick={handleStartEditTitle}
                title={currentSession ? t('agent.doubleClickToRename') : ''}
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  cursor: currentSession ? 'text' : 'default',
                }}
              >
                {headerTitle}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DockIconButton title={t('agent.sessionList')} onClick={() => setShowSessionList((v) => !v)}>
                <IconList />
              </DockIconButton>
              <DockIconButton
                title={t('agent.newSession')}
                onClick={() => {
                  void createSession();
                }}
              >
                <IconPlus />
              </DockIconButton>
              <DockIconButton title="调试信息" onClick={() => setDebugPanelOpen(!debugPanelOpen)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v3M16 2v3M3 8h18M5 8v8a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V8M9 12h6M9 16h6" />
                </svg>
              </DockIconButton>
              <DockIconButton title={t('agent.close')} onClick={() => setDockOpen(false)}>
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
                {t('agent.emptySession')}
              </div>
            ) : (
              <MessageList />
            )}
          </div>

          {/* Task 2b: Token 使用量进度条 + 压缩上下文按钮 */}
          {tokenUsage.estimated > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                fontSize: '11px',
                color: '#999',
                flexShrink: 0,
                borderTop: '1px solid #eee',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  background: '#e8e8ea',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (tokenUsage.estimated / tokenUsage.limit) * 100)}%`,
                    height: '100%',
                    background:
                      tokenUsage.estimated / tokenUsage.limit > 0.85
                        ? '#ff4d4f'
                        : tokenUsage.estimated / tokenUsage.limit > 0.6
                        ? '#faad14'
                        : '#52c41a',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span>
                {tokenUsage.estimated} / {tokenUsage.limit} tokens
              </span>
              <button
                onClick={() => void compactContext()}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  border: '1px solid #e0e0e6',
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer',
                  color: '#555',
                }}
              >
                压缩上下文
              </button>
            </div>
          )}

          {/* 执行计划（输入框上方，可折叠，coding agent 风格） */}
          {activePlan && activePlan.steps.length > 0 && (
            <div
              style={{
                flexShrink: 0,
                borderTop: '1px solid #eee',
                borderBottom: planCollapsed ? '1px solid #eee' : 'none',
                background: '#fafafa',
              }}
            >
              <div
                onClick={() => setPlanCollapsed((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '11px',
                  color: ACCENT,
                  fontWeight: 600,
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  style={{
                    transform: planCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <path d="M2 3 L5 7 L8 3" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>执行计划</span>
                <span style={{ color: '#bbb', fontWeight: 400 }}>
                  {activePlan.steps.filter((s) => s.status === 'done').length}/{activePlan.steps.length} 完成
                </span>
              </div>
              <div
                style={{
                  padding: planCollapsed ? '0 12px' : '0 12px 8px',
                  maxHeight: planCollapsed ? '0' : '200px',
                  overflowY: 'auto',
                  transition: 'max-height 0.2s ease-out, opacity 0.2s ease-out, padding 0.2s ease-out',
                  opacity: planCollapsed ? 0 : 1,
                }}
              >
                <PlanCard steps={activePlan.steps} />
              </div>
            </div>
          )}

          {/* 输入区 */}
          <div
            style={{
              borderTop: '1px solid #eee',
              padding: '10px 12px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {/* Task 1c: 已选图片缩略图 */}
            {selectedImages.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {selectedImages.map((img, idx) => (
                  <div
                    key={idx}
                    style={{ position: 'relative', width: '48px', height: '48px' }}
                  >
                    <img
                      src={img}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '4px',
                      }}
                    />
                    <button
                      onClick={() =>
                        setSelectedImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#ff4d4f',
                        color: '#fff',
                        border: 'none',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void handleFileSelect(e)}
              style={{ display: 'none' }}
            />

            {/* 拖拽手柄：调整输入框高度 */}
            <div
              onMouseDown={onTextareaResizeStart}
              style={{
                height: '4px',
                cursor: 'row-resize',
                background: 'transparent',
                borderRadius: '2px',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            />
            {/* 输入行：图片按钮 + textarea + 发送/停止 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <button
                title="选择图片"
                onClick={() => fileInputRef.current?.click()}
                disabled={!currentSessionKey || selectedImages.length >= 4}
                style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  border: '1px solid #e0e0e6',
                  borderRadius: '8px',
                  background: '#fff',
                  cursor:
                    !currentSessionKey || selectedImages.length >= 4
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#555',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                onPaste={handlePaste}
                placeholder={
                  streaming
                    ? queueLength > 0
                      ? `排队中 (${queueLength})，可继续输入…`
                      : t('agent.inputPlaceholderStreaming')
                    : t('agent.inputPlaceholder')
                }
                disabled={!currentSessionKey}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: '1px solid #e0e0e6',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  minHeight: '40px',
                  maxHeight: '300px',
                  height: textareaHeight,
                  outline: 'none',
                  background: '#fff',
                  color: '#1a1a1a',
                  fontFamily: 'inherit',
                }}
              />
              {streaming ? (
                <button
                  onClick={stopStreaming}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#e5404e',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  停止
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={
                    (!input.trim() && selectedImages.length === 0) || !currentSessionKey
                  }
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background:
                      (!input.trim() && selectedImages.length === 0) || !currentSessionKey
                        ? '#c9c9e0'
                        : ACCENT,
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor:
                      (!input.trim() && selectedImages.length === 0) || !currentSessionKey
                        ? 'not-allowed'
                        : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {t('agent.send')}
                </button>
              )}
            </div>
          </div>

          {/* 确认弹窗 */}
          {pendingConfirm && <ConfirmModal event={pendingConfirm} onResolve={resolveConfirm} />}
        </div>
      </div>

      {/* 调试面板：渲染在主面板外部，避免被 backdropFilter 创建包含块导致 fixed 定位失效 */}
      {dockOpen && debugPanelOpen && <DebugPanel onClose={() => setDebugPanelOpen(false)} focusEntryId={focusDebugEntryId} />}
    </>
  );
};
