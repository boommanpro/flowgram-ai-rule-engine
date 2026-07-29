/**
 * MessageList - 消息流渲染组件
 * 渲染 user / assistant / tool 三类消息，支持流式追加与工具调用卡片
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';

import { useAgent } from './AgentContext';
import PlanCard from './PlanCard';
import type { DisplayMessage, ToolCallEvent } from './types';

const ACCENT = '#4d53e8';

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
      return { text: '总是允许', color: '#1f9d55', bg: '#e6f6ee' };
    case 'confirm':
      return { text: '需确认', color: '#b7791f', bg: '#fdf3e0' };
    case 'forbid':
      return { text: '禁止', color: '#e5404e', bg: '#fdecee' };
    default:
      return { text: policy, color: '#666', bg: '#f0f0f0' };
  }
}

/** 工具调用卡片 */
const ToolCallCard: React.FC<{ toolCall: ToolCallEvent }> = ({ toolCall }) => {
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
        <span style={{ color: '#999', fontSize: '11px' }}>工具调用</span>
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

/** 工具结果（可折叠） */
const ToolResultCard: React.FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;

  return (
    <div
      onClick={toggle}
      style={{
        background: '#f7f7fa',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '11px',
        color: '#888',
        cursor: 'pointer',
        maxWidth: '100%',
        wordBreak: 'break-all',
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
        border: '1px solid #eee',
      }}
    >
      <span style={{ color: '#aaa', marginRight: '4px' }}>{expanded ? '▾' : '▸'} 结果</span>
      {expanded ? content : preview}
    </div>
  );
};

/** 单条消息 */
const MessageItem: React.FC<{ message: DisplayMessage }> = ({ message }) => {
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
          padding: '8px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? ACCENT : '#f0f0f5',
          color: isUser ? '#fff' : '#1a1a1a',
          fontSize: '13px',
          lineHeight: '1.55',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {message.content || (isUser ? '' : '')}
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
  const { messages, streaming } = useAgent();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
            fontSize: '18px',
            fontWeight: 700,
          }}
        >
          AI
        </div>
        <div style={{ fontSize: '14px', color: '#666', fontWeight: 500 }}>
          开始与 Agent 对话
        </div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>
          你可以让我创建工作流、查询数据、或在画布上操作节点
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
      {messages.map((m) => (
        <React.Fragment key={m.id}>
          <MessageItem message={m} />
          {m.planSteps && m.planSteps.length > 0 && <PlanCard steps={m.planSteps} />}
        </React.Fragment>
      ))}
      {showTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
