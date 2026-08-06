/**
 * DebugPanel - 调试信息面板
 * 显示 SSE 上报的 context_loaded / debug_request / debug_response 事件
 * 按会话绑定，支持持久化到 localStorage
 *
 * 视图分两层：
 *   1. 列表面板（右侧抽屉）：每条调试记录的概要 + 可展开的精简详情
 *   2. Raw 详细面板（全屏覆盖）：展示完整的、未做任何截断的原始 LLM 请求/响应
 */
import React, { useState, useEffect, useMemo } from 'react';
import { IconClose, IconCopy } from '@douyinfe/semi-icons';
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

/** 提取调试条目的内容前缀（最后一条用户消息摘要），方便快速定位 */
const getEntryPrefix = (entry: DebugEntry): string => {
  const messages = entry.request?.messages;
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') {
        const content = typeof m.content === 'string' ? m.content : '';
        if (content) {
          const trimmed = content.trim().replace(/\n/g, ' ');
          return trimmed.length > 40 ? trimmed.substring(0, 40) + '…' : trimmed;
        }
      }
    }
  }
  return entry.request?.model || entry.context?.model || '—';
};

export const DebugPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { debugEntries, clearDebugEntries, currentSessionKey } = useAgent();
  useLanguage();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // 当前查看原始数据的条目
  const [rawEntry, setRawEntry] = useState<DebugEntry | null>(null);

  useEffect(() => {
    setExpandedIds(new Set());
  }, [currentSessionKey]);

  // 调试信息持久化由 AgentContext 统一管理，避免会话切换时竞态覆盖

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
    <>
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
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, marginRight: '8px' }}>
                      <span style={{ color: '#1a1a1a', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getEntryPrefix(entry)}
                      </span>
                      <span style={{ color: '#999', fontSize: '11px' }}>
                        {new Date(entry.timestamp).toLocaleString()}
                        {entry.response ? ` · ${entry.response.durationMs}ms` : ' · pending'}
                        {entry.response?.toolCalls > 0 && ` · ${entry.response.toolCalls} tool calls`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRawEntry(entry);
                        }}
                        title={t('agent.debugRaw')}
                        style={{
                          border: '1px solid #4d53e8',
                          background: '#4d53e8',
                          color: '#fff',
                          padding: '1px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {t('agent.debugRaw')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyEntry(entry); }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: ACCENT }}
                      >
                        {t('agent.debugCopy')}
                      </button>
                    </div>
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

                  {/* Expanded detail (compact preview) */}
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

                      {/* Compact request preview */}
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

                      {/* Compact response preview */}
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

      {/* Raw 详细面板 - 全屏覆盖，展示完整未截断的原始数据 */}
      {rawEntry && (
        <RawDetailOverlay entry={rawEntry} onClose={() => setRawEntry(null)} />
      )}
    </>
  );
};

/**
 * 原始数据详细面板
 * 展示完整的、未做任何截断的 LLM 请求与响应
 */
const RawDetailOverlay: React.FC<{ entry: DebugEntry; onClose: () => void }> = ({ entry, onClose }) => {
  useLanguage();
  const [activeTab, setActiveTab] = useState<'request' | 'response' | 'context'>('request');
  const [wrap, setWrap] = useState(true);

  // 构造完整的 LLM 请求体（与后端实际发给 LLM 的完全一致）
  const fullRequestJson = useMemo(() => {
    if (!entry.request) return '';
    // 后端 debug_request 事件直接包含了 messages / model / temperature / maxTokens / tools
    // 我们再额外组装一个标准 OpenAI chat/completions 请求体，方便对照
    const req = entry.request;
    const openaiPayload: any = {
      model: req.model,
      temperature: req.temperature,
      messages: req.messages,
    };
    if (req.maxTokens) openaiPayload.max_tokens = req.maxTokens;
    if (req.tools && req.tools.length > 0) {
      openaiPayload.tools = req.tools;
      openaiPayload.tool_choice = 'auto';
    }
    return JSON.stringify(openaiPayload, null, 2);
  }, [entry]);

  // 构造完整的 LLM 响应体
  const fullResponseJson = useMemo(() => {
    if (!entry.response) return '';
    // 后端 debug_response 事件包含 content / toolCalls / durationMs
    // 组装成标准 OpenAI 响应格式，便于对照
    const resp = entry.response;
    const message: any = { role: 'assistant', content: resp.content || '' };
    const openaiResp: any = {
      id: 'chatcmpl-debug',
      object: 'chat.completion',
      model: entry.request?.model || 'unknown',
      choices: [{ index: 0, message, finish_reason: resp.toolCalls > 0 ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
    return JSON.stringify(openaiResp, null, 2);
  }, [entry]);

  // 后端原始 debug_request 事件数据（原样）
  const rawRequestEventJson = useMemo(() => {
    if (!entry.request) return '';
    return JSON.stringify(entry.request, null, 2);
  }, [entry]);

  // 后端原始 debug_response 事件数据（原样）
  const rawResponseEventJson = useMemo(() => {
    if (!entry.response) return '';
    return JSON.stringify(entry.response, null, 2);
  }, [entry]);

  // 后端原始 context_loaded 事件数据（原样）
  const rawContextJson = useMemo(() => {
    if (!entry.context) return '';
    return JSON.stringify(entry.context, null, 2);
  }, [entry]);

  const copyText = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90vw',
          maxWidth: '1200px',
          height: '88vh',
          background: '#fff',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '52px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e8e8ea',
            flexShrink: 0,
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('agent.debugRawTitle')} — {getEntryPrefix(entry)}
            </span>
            <span style={{ fontSize: '11px', color: '#999' }}>
              {new Date(entry.timestamp).toLocaleString()}
              {entry.response ? ` · ${entry.response.durationMs}ms` : ' · pending'}
              {entry.response?.toolCalls > 0 && ` · ${entry.response.toolCalls} tool calls`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setWrap((v) => !v)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                border: '1px solid #e0e0e6',
                borderRadius: '4px',
                background: wrap ? '#f0f5ff' : '#fff',
                color: wrap ? ACCENT : '#555',
                cursor: 'pointer',
              }}
            >
              {wrap ? t('agent.debugRawNoWrap') : t('agent.debugRawWrap')}
            </button>
            <button
              onClick={onClose}
              title={t('agent.debugRawClose')}
              style={{
                width: '32px',
                height: '32px',
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
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e8e8ea',
            flexShrink: 0,
            background: '#fbfbfc',
          }}
        >
          <TabBtn active={activeTab === 'request'} onClick={() => setActiveTab('request')}>
            {t('agent.debugRawRequest')}
          </TabBtn>
          <TabBtn active={activeTab === 'response'} onClick={() => setActiveTab('response')} disabled={!entry.response}>
            {t('agent.debugRawResponse')}
          </TabBtn>
          <TabBtn active={activeTab === 'context'} onClick={() => setActiveTab('context')} disabled={!entry.context}>
            {t('agent.debugContext')}
          </TabBtn>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'request' && (
            <RawSection
              title={t('agent.debugRawRequest')}
              subtitle={t('agent.debugRawMessages')}
              openaiPayload={fullRequestJson}
              rawEvent={rawRequestEventJson}
              toolsCount={entry.request?.tools?.length || 0}
              messagesCount={entry.request?.messages?.length || 0}
              wrap={wrap}
              onCopy={copyText}
            />
          )}
          {activeTab === 'response' && entry.response && (
            <RawSection
              title={t('agent.debugRawResponse')}
              subtitle={entry.response.content || ''}
              openaiPayload={fullResponseJson}
              rawEvent={rawResponseEventJson}
              toolsCount={0}
              messagesCount={0}
              wrap={wrap}
              onCopy={copyText}
              responseContent={entry.response.content || ''}
            />
          )}
          {activeTab === 'context' && entry.context && (
            <RawSection
              title={t('agent.debugContext')}
              subtitle=""
              openaiPayload=""
              rawEvent={rawContextJson}
              toolsCount={0}
              messagesCount={0}
              wrap={wrap}
              onCopy={copyText}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/** Tab 按钮 */
const TabBtn: React.FC<{ active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({
  active,
  onClick,
  disabled,
  children,
}) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    style={{
      padding: '10px 16px',
      fontSize: '13px',
      fontWeight: active ? 600 : 400,
      color: active ? ACCENT : disabled ? '#bbb' : '#555',
      background: active ? '#fff' : 'transparent',
      border: 'none',
      borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
      cursor: disabled ? 'not-allowed' : 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </button>
);

/** 原始数据展示区 */
const RawSection: React.FC<{
  title: string;
  subtitle: string;
  openaiPayload: string;
  rawEvent: string;
  toolsCount: number;
  messagesCount: number;
  wrap: boolean;
  onCopy: (text: string) => void;
  responseContent?: string;
}> = ({ title, subtitle, openaiPayload, rawEvent, toolsCount, messagesCount, wrap, onCopy, responseContent }) => {
  const [view, setView] = useState<'payload' | 'raw'>('payload');
  // 如果没有 openaiPayload（如 context tab），默认显示 raw
  useEffect(() => {
    if (!openaiPayload) setView('raw');
  }, [openaiPayload]);

  const currentText = view === 'payload' ? openaiPayload : rawEvent;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Section header */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{title}</span>
          {(messagesCount > 0 || toolsCount > 0) && (
            <span style={{ fontSize: '11px', color: '#999' }}>
              {messagesCount > 0 && `${messagesCount} messages · `}
              {toolsCount > 0 && `${toolsCount} tools · `}
              {currentText.length.toLocaleString()} chars
            </span>
          )}
          {messagesCount === 0 && toolsCount === 0 && currentText && (
            <span style={{ fontSize: '11px', color: '#999' }}>{currentText.length.toLocaleString()} chars</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {openaiPayload && (
            <>
              <button
                onClick={() => setView('payload')}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  border: '1px solid #e0e0e6',
                  borderRadius: '4px',
                  background: view === 'payload' ? '#4d53e8' : '#fff',
                  color: view === 'payload' ? '#fff' : '#555',
                  cursor: 'pointer',
                }}
              >
                OpenAI Payload
              </button>
              <button
                onClick={() => setView('raw')}
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  border: '1px solid #e0e0e6',
                  borderRadius: '4px',
                  background: view === 'raw' ? '#4d53e8' : '#fff',
                  color: view === 'raw' ? '#fff' : '#555',
                  cursor: 'pointer',
                }}
              >
                SSE Event
              </button>
            </>
          )}
          <button
            onClick={() => onCopy(currentText)}
            title="Copy JSON"
            style={{
              padding: '3px 10px',
              fontSize: '11px',
              border: '1px solid #e0e0e6',
              borderRadius: '4px',
              background: '#fff',
              color: '#555',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <IconCopy /> {t('agent.debugRawCopy')}
          </button>
        </div>
      </div>

      {/* JSON viewer */}
      <div style={{ flex: 1, overflow: 'auto', background: '#1e1e2e' }}>
        <pre
          style={{
            margin: 0,
            padding: '16px',
            fontSize: '12px',
            lineHeight: 1.6,
            color: '#e0e0e0',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            whiteSpace: wrap ? 'pre-wrap' : 'pre',
            wordBreak: wrap ? 'break-all' : 'normal',
            minHeight: '100%',
          }}
        >
{currentText || '(empty)'}
        </pre>
      </div>

      {/* Response content raw view (plain text) */}
      {responseContent !== undefined && responseContent && (
        <div style={{ flexShrink: 0, maxHeight: '30%', overflow: 'auto', borderTop: '2px solid #333', background: '#252526' }}>
          <div style={{ padding: '6px 12px', fontSize: '11px', color: '#999', borderBottom: '1px solid #333', position: 'sticky', top: 0, background: '#252526' }}>
            Response Content (raw text, no truncation)
          </div>
          <pre
            style={{
              margin: 0,
              padding: '12px',
              fontSize: '12px',
              lineHeight: 1.6,
              color: '#e0e0e0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              whiteSpace: wrap ? 'pre-wrap' : 'pre',
              wordBreak: wrap ? 'break-all' : 'normal',
            }}
          >
{responseContent}
          </pre>
        </div>
      )}
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
