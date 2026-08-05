/**
 * SubagentCard - 子 Agent 调试任务结果展示卡片
 * 渲染 subagent 的步骤时间线（pending/running/done/error）+ 最终结论
 */
import React from 'react';
import type { DisplayMessage } from './types';

const ACTION_LABELS: Record<string, string> = {
  addNode: '添加节点',
  updateNode: '修改节点',
  deleteNode: '删除节点',
  connect: '连接节点',
  disconnect: '断开连接',
  autoLayout: '自动布局',
  runWorkflow: '运行工作流',
  runNode: '运行节点',
  getAvailableVariables: '查询可用变量',
  debugNode: '调试节点',
  listWorkflows: '查询工作流列表',
  getWorkflowDetail: '获取工作流详情',
  getNodeDetail: '获取节点详情',
  saveWorkflow: '保存工作流',
  createWorkflow: '创建工作流',
};

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export const SubagentCard: React.FC<{ message: DisplayMessage }> = ({ message }) => {
  const steps = message.subagentSteps || [];
  const result = message.subagentResult;

  return (
    <div
      style={{
        border: '1px solid #e8e8ea',
        borderRadius: '8px',
        overflow: 'hidden',
        margin: '8px 0',
        fontSize: '13px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          background: '#f0f5ff',
          borderBottom: '1px solid #e8e8ea',
          fontWeight: 600,
          color: '#1a1a1a',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        🔍 节点调试
      </div>

      {/* Step timeline */}
      {steps.length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          {steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: idx < steps.length - 1 ? '8px' : 0,
              }}
            >
              {/* Status icon */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  flexShrink: 0,
                  background:
                    step.status === 'done'
                      ? '#52c41a'
                      : step.status === 'error'
                      ? '#ff4d4f'
                      : step.status === 'running'
                      ? '#4d53e8'
                      : '#e8e8ea',
                  color: '#fff',
                }}
              >
                {step.status === 'done'
                  ? '✓'
                  : step.status === 'error'
                  ? '✕'
                  : step.status === 'running'
                  ? '⟳'
                  : '○'}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: '#333' }}>
                  {getActionLabel(step.action)}
                </div>
                {step.result && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#999',
                      marginTop: '2px',
                      wordBreak: 'break-all',
                      maxHeight: '40px',
                      overflow: 'hidden',
                    }}
                  >
                    {step.result}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Final result */}
      {result && (
        <div
          style={{
            padding: '8px 12px',
            background: result.success ? '#f6ffed' : '#fff2f0',
            borderTop: '1px solid ' + (result.success ? '#b7eb8f' : '#ffccc7'),
            color: result.success ? '#389e0d' : '#cf1322',
            fontSize: '12px',
          }}
        >
          <strong>{result.success ? '调试成功' : '调试失败'}</strong>
          {result.content && (
            <div style={{ marginTop: '4px', color: '#555', wordBreak: 'break-all' }}>
              {result.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubagentCard;
