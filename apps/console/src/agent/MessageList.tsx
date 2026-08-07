/**
 * MessageList - 消息流渲染组件
 * 渲染 user / assistant / tool 三类消息，支持流式追加与工具调用卡片
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { useAgent } from './AgentContext';
import { useLanguage, t } from '../i18n';
import SubagentCard from './SubagentCard';
import Markdown from './Markdown';
import { PlanCard } from './PlanCard';
import type { DisplayMessage, ToolCallEvent } from './types';

const ACCENT = '#4d53e8';

/** Markdown 全局样式（仅注入一次） */
export const MarkdownStyle: React.FC = () => (
  <style>{`
    .md-body { font-size: 13px; line-height: 1.6; word-break: break-word; }
    .md-body .md-p { margin: 0 0 6px; }
    .md-body .md-p:last-child { margin-bottom: 0; }
    .md-body .md-h { margin: 8px 0 4px; font-weight: 600; line-height: 1.3; }
    .md-body .md-h1 { font-size: 16px; }
    .md-body .md-h2 { font-size: 15px; }
    .md-body .md-h3 { font-size: 14px; }
    .md-body .md-h4, .md-body .md-h5, .md-body .md-h6 { font-size: 13px; }
    .md-body .md-ul, .md-body .md-ol { margin: 4px 0; padding-left: 20px; }
    .md-body .md-ul { list-style: disc; }
    .md-body .md-ol { list-style: decimal; }
    .md-body .md-ul li, .md-body .md-ol li { margin: 2px 0; }
    .md-body .md-inline-code {
      background: #f0f0f5; padding: 1px 5px; border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px; color: #c0405a;
    }
    .md-body .md-code-block {
      background: #1e1e2e; color: #e0e0e8; border-radius: 6px;
      padding: 10px 12px; margin: 6px 0; overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px; line-height: 1.5;
    }
    .md-body .md-code-block code { background: transparent; padding: 0; color: inherit; }
    .md-body .md-quote {
      border-left: 3px solid #d0d0e0; padding: 2px 10px; margin: 6px 0;
      color: #666; background: #f7f7fa; border-radius: 0 4px 4px 0;
    }
    .md-body .md-hr { border: none; border-top: 1px solid #e8e8ea; margin: 8px 0; }
    .md-body .md-table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12.5px; }
    .md-body .md-table th { background: #f0f0f5; font-weight: 600; text-align: left; }
    .md-body .md-table th, .md-body .md-table td { border: 1px solid #e0e0e8; padding: 4px 8px; }
    .md-body .md-table tbody tr:nth-child(even) { background: #fafafa; }
    .md-body .md-link { color: #4d53e8; text-decoration: none; }
    .md-body .md-link:hover { text-decoration: underline; }
    .md-body strong { font-weight: 600; }
    .md-body em { font-style: italic; }
    @keyframes tool-spin { to { transform: rotate(360deg); } }
  `}</style>
);

/** 工具调用 args 摘要 */
function summarizeArgs(args: Record<string, any>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return '(无参数)';
  return keys
    .map((k) => {
      let v = args[k];
      if (typeof v === 'object') v = JSON.stringify(v);
      else v = String(v);
      if (v.length > 60) v = v.slice(0, 60) + '…';
      return `${k}: ${v}`;
    })
    .join(', ');
}

/** policy 文案 + 颜色 */
function policyLabel(policy: string): { text: string; color: string; bg: string } {
  switch (policy) {
    case 'always':
      return { text: t('agent.policyAlways'), color: '#1f9d55', bg: '#e6f6ee' };
    case 'confirm':
      return { text: t('agent.policyConfirm'), color: '#b7791f', bg: '#fdf3e0' };
    case 'forbid':
      return { text: t('agent.policyForbid'), color: '#e5404e', bg: '#fdecee' };
    default:
      return { text: policy, color: '#666', bg: '#f0f0f0' };
  }
}

/** 工具调用卡片 */
export const ToolCallCard: React.FC<{ toolCall: ToolCallEvent }> = ({ toolCall }) => {
  const pl = policyLabel(toolCall.policy);
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e8e8ea',
        borderLeft: `3px solid ${ACCENT}`,
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        maxWidth: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ color: '#999', fontSize: '11px' }}>{t('agent.toolCall')}</span>
        <span style={{ color: ACCENT, fontWeight: 600 }}>{toolCall.action}</span>
        <span
          style={{
            fontSize: '10px',
            color: pl.color,
            background: pl.bg,
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 500,
          }}
        >
          {pl.text}
        </span>
      </div>
      <div
        style={{
          color: '#666',
          fontSize: '11px',
          wordBreak: 'break-all',
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
        }}
      >
        {summarizeArgs(toolCall.args)}
      </div>
    </div>
  );
};

/** 工具结果（可折叠，JSON 美化） */
export const ToolResultCard: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  // 尝试解析 JSON 并美化
  const prettyContent = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }, [content]);

  const preview = prettyContent.length > 80 ? prettyContent.slice(0, 80).replace(/\n/g, ' ') + '…' : prettyContent;

  return (
    <div
      style={{
        background: '#f7f7fa',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '11px',
        color: '#888',
        maxWidth: '100%',
        border: '1px solid #eee',
      }}
    >
      <div
        onClick={toggle}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        <span style={{ color: '#aaa' }}>{expanded ? '▾' : '▸'} {t('agent.toolResult')}</span>
        {!expanded && (
          <span style={{ color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {preview}
          </span>
        )}
      </div>
      {expanded && (
        <pre
          style={{
            margin: '4px 0 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
            color: '#555',
            lineHeight: '1.4',
          }}
        >
          {prettyContent}
        </pre>
      )}
    </div>
  );
};

/** 工具状态图标：pending/running(旋转) / done(✓) / error(✕) */
export const ToolStatusIcon: React.FC<{ toolCall: ToolCallEvent }> = ({ toolCall }) => {
  if (toolCall.result === undefined) {
    // pending / running — spinner
    return (
      <span
        style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          border: '1.5px solid #d0d0e0',
          borderTopColor: ACCENT,
          borderRadius: '50%',
          animation: 'tool-spin 0.8s linear infinite',
          flexShrink: 0,
        }}
      />
    );
  }
  if (toolCall.result && toolCall.result.toLowerCase().includes('error')) {
    return (
      <span style={{ color: '#e5404e', fontSize: '13px', lineHeight: 1, flexShrink: 0 }}>✕</span>
    );
  }
  return (
    <span style={{ color: '#1f9d55', fontSize: '13px', lineHeight: 1, flexShrink: 0 }}>✓</span>
  );
};

/** 分组工具调用卡片：将连续的 tool 消息合并为一张卡片 */
export const GroupedToolCard: React.FC<{ messages: DisplayMessage[] }> = ({ messages }) => {
  const toolCallMsgs = messages.filter((m) => m.toolCall);
  const resultMsgs = messages.filter((m) => !m.toolCall && m.content);

  if (toolCallMsgs.length === 0 && resultMsgs.length === 0) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
      <div style={{ maxWidth: '90%', width: '100%' }}>
        <div
          style={{
            background: '#f7f7fa',
            border: '1px solid #e8e8ea',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          {toolCallMsgs.length > 0 && (
            <>
              <div
                style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: '#999',
                  borderBottom: '1px solid #eee',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{t('agent.toolCall')}</span>
                <span
                  style={{
                    background: ACCENT,
                    color: '#fff',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    fontWeight: 500,
                  }}
                >
                  {toolCallMsgs.length}
                </span>
              </div>
              {toolCallMsgs.map((m, idx) => {
                const tc = m.toolCall!;
                const pl = policyLabel(tc.policy);
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '6px 10px',
                      borderTop: idx > 0 ? '1px solid #eee' : 'none',
                      fontSize: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px',
                      }}
                    >
                      <ToolStatusIcon toolCall={tc} />
                      <span style={{ color: ACCENT, fontWeight: 600 }}>{tc.action}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          color: pl.color,
                          background: pl.bg,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 500,
                        }}
                      >
                        {pl.text}
                      </span>
                    </div>
                    <div
                      style={{
                        color: '#666',
                        fontSize: '11px',
                        wordBreak: 'break-all',
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
                      }}
                    >
                      {summarizeArgs(tc.args)}
                    </div>
                    {tc.result && (
                      <div
                        style={{
                          color: '#888',
                          fontSize: '11px',
                          marginTop: '2px',
                          wordBreak: 'break-all',
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
                        }}
                      >
                        {tc.result}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {resultMsgs.map((m, idx) => (
            <div
              key={m.id}
              style={{
                padding: '6px 10px',
                borderTop: idx > 0 || toolCallMsgs.length > 0 ? '1px solid #eee' : 'none',
              }}
            >
              <ToolResultCard content={m.content} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** 单条消息 */
export const MessageItem: React.FC<{
  message: DisplayMessage;
  streaming: boolean;
  onOptionClick: (option: string) => void;
  /** 可选：覆盖调试跳转行为（当在 AgentContext 外复用时需要传入） */
  onDebugJump?: (debugEntryId: string) => void;
}> = ({ message, streaming, onOptionClick, onDebugJump }) => {
  const agent = useAgent() as { openDebugEntry?: (id: string) => void } | undefined;
  const openDebugEntry = (id: string) => {
    if (onDebugJump) {
      onDebugJump(id);
    } else if (agent?.openDebugEntry) {
      agent.openDebugEntry(id);
    }
  };
  // tool 类型
  if (message.role === 'tool') {
    if (message.toolCall) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
          <div style={{ maxWidth: '90%' }}>
            <ToolCallCard toolCall={message.toolCall} />
          </div>
        </div>
      );
    }
    // 工具结果
    if (message.content) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
          <div style={{ maxWidth: '90%' }}>
            <ToolResultCard content={message.content} />
          </div>
        </div>
      );
    }
    return null;
  }

  // user / assistant
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: '4px 0',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: isUser ? '8px 12px' : '8px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? ACCENT : '#f0f0f5',
          color: isUser ? '#fff' : '#1a1a1a',
          fontSize: '13px',
          lineHeight: '1.55',
          wordBreak: 'break-word',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <Markdown
            content={message.content}
            onOptionClick={onOptionClick}
            optionsDisabled={streaming}
          />
        )}
        {/* Task 1d: render user-attached images inline below text */}
        {isUser && message.images && message.images.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: message.content ? '6px' : 0 }}>
            {message.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                style={{
                  width: '80px',
                  height: '80px',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  display: 'block',
                }}
              />
            ))}
          </div>
        )}
        {/* assistant 消息调试跳转按钮 — 点击打开调试面板并定位到对应条目 */}
        {!isUser && message.debugEntryId && message.content && (
          <div style={{ marginTop: '4px', textAlign: 'right' }}>
            <button
              onClick={() => message.debugEntryId && openDebugEntry(message.debugEntryId)}
              title={t('agent.debugJumpTip') || '查看本条回复的调试详情'}
              style={{
                fontSize: '10px',
                color: '#888',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                textDecoration: 'underline',
              }}
            >
              {t('agent.debugJump') || '调试详情'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/** 打字指示器 */
const TypingIndicator: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 0' }}>
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '14px 14px 14px 4px',
        background: '#f0f0f5',
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#b0b0c0',
            animation: `agent-typing 1.2s ${i * 0.2}s infinite ease-in-out`,
            display: 'inline-block',
          }}
        />
      ))}
      <style>{`
        @keyframes agent-typing {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  </div>
);

export const MessageList: React.FC = () => {
  const { messages, streaming, sendMessage, queueLength } = useAgent();
  useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 选项点击 → 直接发送
  const handleOptionClick = useCallback(
    (option: string) => {
      if (!streaming) void sendMessage(option);
    },
    [streaming, sendMessage]
  );

  // 自动滚动到底部
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streaming]);

  // 空状态欢迎
  if (messages.length === 0 && !streaming) {
    return (
      <div
        ref={containerRef}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#bbb',
          gap: '12px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#f0f0ff',
            color: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div style={{ fontSize: '14px', color: '#666', fontWeight: 500 }}>
          {t('agent.welcomeTitle')}
        </div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>
          {t('agent.welcomeDesc')}
        </div>
      </div>
    );
  }

  // 判断是否需要显示打字指示器：流式 + 最后一条 assistant 内容为空
  const lastMsg = messages[messages.length - 1];
  const showTyping =
    streaming && lastMsg && lastMsg.role === 'assistant' && !lastMsg.content;

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MarkdownStyle />
      {(() => {
        const items: React.ReactNode[] = [];
        let i = 0;
        while (i < messages.length) {
          const m = messages[i];
          // 跳过内容为空的 assistant 占位消息（避免渲染空气泡）
          if (m.role === 'assistant' && !m.content) {
            i++;
            continue;
          }
          // Subagent debug card: render via SubagentCard instead of normal bubble
          if (m.subagentSteps || m.subagentResult) {
            items.push(
              <React.Fragment key={`subagent-${m.id}`}>
                <SubagentCard message={m} />
              </React.Fragment>
            );
            i++;
            continue;
          }
          if (m.role === 'tool') {
            // Plan steps 消息：渲染为 PlanCard（不归入工具调用分组）
            if (m.planSteps && m.planSteps.length > 0) {
              items.push(
                <React.Fragment key={m.id}>
                  <PlanCard steps={m.planSteps} />
                </React.Fragment>
              );
              i++;
              continue;
            }
            // 收集连续的 tool 消息，合并为一张分组卡片
            const group: DisplayMessage[] = [];
            while (i < messages.length && messages[i].role === 'tool') {
              const tm = messages[i];
              // planSteps 消息单独渲染为 PlanCard，跳出分组循环
              if (tm.planSteps && tm.planSteps.length > 0) break;
              // 跳过内容和 toolCall 均为空的 tool 消息
              if (!tm.content && !tm.toolCall && !tm.subagentSteps) {
                i++;
                continue;
              }
              group.push(tm);
              i++;
            }
            if (group.length > 0) {
              items.push(
                <React.Fragment key={`tool-group-${group[0].id}`}>
                  <GroupedToolCard messages={group} />
                </React.Fragment>
              );
            }
          } else {
            // user / assistant 消息正常渲染
            items.push(
              <React.Fragment key={m.id}>
                <MessageItem
                  message={m}
                  streaming={streaming}
                  onOptionClick={handleOptionClick}
                />
              </React.Fragment>
            );
            i++;
          }
        }
        return items;
      })()}
      {showTyping && <TypingIndicator />}
      {/* 排队消息指示器 */}
      {queueLength > 0 && streaming && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          padding: '4px 0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: '#f7f7fa',
            border: '1px solid #e8e8ea',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#888',
          }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              border: '1.5px solid #d0d0e0',
              borderTopColor: ACCENT,
              borderRadius: '50%',
              animation: 'tool-spin 0.8s linear infinite',
              flexShrink: 0,
            }} />
            <span>{queueLength} 条消息排队中…</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
