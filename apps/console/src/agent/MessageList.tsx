/**
 * MessageList - 消息流渲染组件
 * 渲染 user / assistant / tool 三类消息，支持流式追加与工具调用卡片
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { useAgent } from './AgentContext';
import PlanCard from './PlanCard';
import Markdown from './Markdown';
import type { DisplayMessage, ToolCallEvent } from './types';

const ACCENT = '#4d53e8';

/** Markdown 全局样式（仅注入一次） */
const MarkdownStyle: React.FC = () => (
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

/** 工具结果（可折叠，JSON 美化） */
const ToolResultCard: React.FC<{ content: string }> = ({ content }) => {
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
        <span style={{ color: '#aaa' }}>{expanded ? '▾' : '▸'} 结果</span>
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

/** 单条消息 */
const MessageItem: React.FC<{
  message: DisplayMessage;
  streaming: boolean;
  onOptionClick: (option: string) => void;
}> = ({ message, streaming, onOptionClick }) => {
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
  const { messages, streaming, sendMessage } = useAgent();
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
      <MarkdownStyle />
      {messages.map((m) => (
        <React.Fragment key={m.id}>
          <MessageItem
            message={m}
            streaming={streaming}
            onOptionClick={handleOptionClick}
          />
          {m.planSteps && m.planSteps.length > 0 && <PlanCard steps={m.planSteps} />}
        </React.Fragment>
      ))}
      {showTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
