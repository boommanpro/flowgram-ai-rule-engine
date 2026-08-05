/**
 * DebugPanel - 调试信息面板
 * 显示 SSE 上报的 context_loaded / debug_request / debug_response 事件
 * 按会话绑定，支持持久化到 localStorage
 */
import React, { useState, useEffect } from 'react';
import { IconClose } from '@douyinfe/semi-icons';
import { useAgent } from './AgentContext';
import { useLanguage, t } from '../i18n';

interface DebugEntry {
  id: string;
  timestamp: number;
  request?: any;
  response?: any;
  context?: any;
}

const ACCENT = '#4d53e8';

export const DebugPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { debugEntries, clearDebugEntries, currentSessionKey } = useAgent();
  useLanguage();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedIds(new Set());
  }, [currentSessionKey]);

  // Persist to localStorage
  useEffect(() => {
    if (!currentSessionKey) return;
    const key = `agent-debug-${currentSessionKey}`;
    if (debugEntries.length > 0) {
      try {
        localStorage.setItem(key, JSON.stringify(debugEntries.slice(-50)));
      } catch {
        // ignore quota errors
      }
    }
  }, [debugEntries, currentSessionKey]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyEntry = (entry: DebugEntry) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    if (currentSessionKey) {
      try {
        localStorage.removeItem(`agent-debug-${currentSessionKey}`);
      } catch {
        // ignore
      }
    }
    clearDebugEntries();
  };

  const reversed = [...debugEntries].reverse();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: '420px',
        width: '520px',
        height: '100vh',
        background: '#fff',
        borderRight: '1px solid #e8e8ea',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
            {t('agent.debugTitle')} ({debugEntries.length})
          </span>
          {currentSessionKey && (
            <span style={{ fontSize: '10px', color: '#aaa', fontFamily: 'ui-monospace, monospace' }}>
              {t('agent.debugSession')}: {currentSessionKey.slice(0, 16)}…
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleClear}
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
            {t('agent.debugClear')}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title={t('agent.close')}
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
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <IconClose />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {reversed.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', fontSize: '12px', marginTop: '40px' }}>
            {t('agent.debugEmpty')}
          </div>
        ) : (
          reversed.map((entry) => {
            const expanded = expandedIds.has(entry.id);
            const ctx = entry.context;
            return (
              <div
                key={entry.id}
                style={{
                  border: '1px solid #e8e8ea',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  overflow: 'hidden',
                }}
              >
                {/* Header row */}
                <div
                  onClick={() => toggleExpand(entry.id)}
                  style={{
                    padding: '8px 10px',
                    background: '#f7f7fa',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: '#555' }}>
                    {new Date(entry.timestamp).toLocaleString()}
                    {entry.response ? ` · ${entry.response.durationMs}ms` : ' · pending'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyEntry(entry); }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: ACCENT }}
                  >
                    {t('agent.debugCopy')}
                  </button>
                </div>

                {/* Context loaded summary (always visible) */}
                {ctx && (
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '11px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      <ContextBadge label={t('agent.debugModel')} value={ctx.model} color={ACCENT} />
                      <ContextBadge label={t('agent.debugTools')} value={`${ctx.toolsCount} (${ctx.toolsMs}ms)`} color="#389e0d" />
                      <ContextBadge label={t('agent.debugRag')} value={`${ctx.ragChunks} (${ctx.ragMs}ms)`} color="#d46b08" />
                      <ContextBadge label={t('agent.debugGraph')} value={`${ctx.graphNodes} (${ctx.graphMs}ms)`} color="#cf1322" />
                      <ContextBadge label={t('agent.debugHistory')} value={`${ctx.historyMessages} 条`} color="#555" />
                      <ContextBadge label={t('agent.debugSystemPrompt')} value={`${ctx.systemPromptChars} 字`} color="#555" />
                      <ContextBadge label={t('agent.debugTotalMessages')} value={`${ctx.totalMessages}`} color="#555" />
                    </div>
                  </div>
                )}

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ padding: '8px 10px', fontSize: '11px' }}>
                    {/* Context detail */}
                    {ctx && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1a1a1a' }}>
                          {t('agent.debugContext')}
                        </div>
                        <pre
                          style={{
                            background: '#f0f5ff',
                            padding: '6px',
                            borderRadius: '4px',
                            overflowX: 'auto',
                            maxHeight: '150px',
                            fontSize: '10px',
                            margin: 0,
                            color: '#333',
                          }}
                        >
{JSON.stringify(ctx, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Request */}
                    {entry.request && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1a1a1a' }}>
                          {t('agent.debugRequest')} ({entry.request.model}, temp={entry.request.temperature}, maxTokens={entry.request.maxTokens || 'N/A'}, {t('agent.debugTools')}: {entry.request.toolsCount ?? 'N/A'})
                        </div>
                        <pre
                          style={{
                            background: '#f7f7fa',
                            padding: '6px',
                            borderRadius: '4px',
                            overflowX: 'auto',
                            maxHeight: '200px',
                            fontSize: '10px',
                            margin: 0,
                          }}
                        >
                          {JSON.stringify(
                            entry.request.messages?.map((m: any) => ({
                              role: m.role,
                              content:
                                typeof m.content === 'string'
                                  ? m.content?.substring(0, 200)
                                  : '[array]',
                              tool_calls: m.tool_calls
                                ? `[${m.tool_calls.length} calls]`
                                : undefined,
                            })),
                            null,
                            2
                          )}
                        </pre>
                        {/* 工具列表 */}
                        {entry.request.tools && entry.request.tools.length > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '2px', color: '#389e0d' }}>
                              {t('agent.debugTools')} ({entry.request.tools.length}):
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {entry.request.tools.map((tool: any, idx: number) => (
                                <span
                                  key={idx}
                                  style={{
                                    display: 'inline-block',
                                    padding: '1px 6px',
                                    background: '#f6ffed',
                                    border: '1px solid #b7eb8f',
                                    borderRadius: '3px',
                                    fontSize: '10px',
                                    color: '#389e0d',
                                  }}
                                >
                                  {tool.function?.name || 'unknown'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Response */}
                    {entry.response && (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1a1a1a' }}>
                          {t('agent.debugResponse')} ({entry.response.durationMs}ms, {entry.response.toolCalls} tool calls)
                        </div>
                        <pre
                          style={{
                            background: '#f7f7fa',
                            padding: '6px',
                            borderRadius: '4px',
                            overflowX: 'auto',
                            maxHeight: '200px',
                            fontSize: '10px',
                            margin: 0,
                          }}
                        >
                          {entry.response.content?.substring(0, 500)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/** 上下文加载标签 */
const ContextBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
    <span style={{ color: '#999' }}>{label}:</span>
    <span style={{ color, fontWeight: 500 }}>{value}</span>
  </span>
);

export default DebugPanel;
