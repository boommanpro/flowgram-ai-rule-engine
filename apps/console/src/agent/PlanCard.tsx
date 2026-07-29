/**
 * PlanCard - Plan 步骤卡片组件
 * 渲染步骤列表，竖向连线连接各步骤，状态用简单 SVG 表示
 */
import React from 'react';

import type { PlanStep } from './types';

const ACCENT = '#4d53e8';

/** 状态元信息 */
function statusMeta(status: PlanStep['status']): {
  color: string;
  bg: string;
  label: string;
} {
  switch (status) {
    case 'pending':
      return { color: '#999', bg: '#f0f0f0', label: '等待' };
    case 'running':
      return { color: ACCENT, bg: '#f0f0ff', label: '进行中' };
    case 'done':
      return { color: '#1f9d55', bg: '#e6f6ee', label: '完成' };
    case 'error':
      return { color: '#e5404e', bg: '#fdecee', label: '出错' };
    default:
      return { color: '#999', bg: '#f0f0f0', label: status };
  }
}

/** 状态 SVG 图标 */
const StatusIcon: React.FC<{ status: PlanStep['status'] }> = ({ status }) => {
  const meta = statusMeta(status);
  const size = 18;

  if (status === 'pending') {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" fill="none" stroke={meta.color} strokeWidth="1.5" />
      </svg>
    );
  }

  if (status === 'running') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 18 18"
        style={{ animation: 'agent-plan-spin 0.9s linear infinite' }}
      >
        <circle
          cx="9"
          cy="9"
          r="7"
          fill="none"
          stroke="#e0e0e6"
          strokeWidth="1.5"
        />
        <path
          d="M9 2 a7 7 0 0 1 7 7"
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <style>{`@keyframes agent-plan-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </svg>
    );
  }

  if (status === 'done') {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="8" fill={meta.color} />
        <path
          d="M5 9 L8 12 L13 6"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // error
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="8" fill={meta.color} />
      <path
        d="M6 6 L12 12 M12 6 L6 12"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface PlanCardProps {
  steps: PlanStep[];
}

export const PlanCard: React.FC<PlanCardProps> = ({ steps }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        padding: '4px 0',
      }}
    >
      <div
        style={{
          maxWidth: '95%',
          width: '100%',
          background: '#fff',
          border: '1px solid #e8e8ea',
          borderRadius: '8px',
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: ACCENT,
              fontWeight: 600,
              letterSpacing: '0.3px',
            }}
          >
            执行计划
          </span>
          <span style={{ fontSize: '11px', color: '#bbb' }}>
            共 {steps.length} 步
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const meta = statusMeta(step.status);
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  gap: '10px',
                  paddingBottom: isLast ? 0 : '10px',
                  position: 'relative',
                }}
              >
                {/* 左侧序号 + 连线 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                    width: '20px',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: meta.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <StatusIcon status={step.status} />
                  </div>
                  {!isLast && (
                    <div
                      style={{
                        width: '1px',
                        flex: 1,
                        background: '#e0e0e6',
                        minHeight: '14px',
                        marginTop: '2px',
                      }}
                    />
                  )}
                </div>

                {/* 右侧内容 */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: '1px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#bbb',
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#1a1a1a',
                        fontWeight: 500,
                      }}
                    >
                      {step.intent}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: ACCENT,
                        background: '#f0f0ff',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {step.action}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: meta.color,
                        background: meta.bg,
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {step.result && (
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '11px',
                        color: '#888',
                        wordBreak: 'break-all',
                        maxHeight: '40px',
                        overflow: 'hidden',
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      {step.result}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlanCard;
