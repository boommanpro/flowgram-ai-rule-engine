/**
 * 单节点测试面板
 * 支持在工作流编辑器中独立测试单个节点的执行效果
 *
 * 支持的节点类型：start, end, code, string-format, variable, http, llm, condition
 * 不支持：loop, block-start, block-end, continue, break, branches, workflow, group, note, comment, assignee
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin';
import { useClientContext } from '@flowgram.ai/free-layout-editor';
import { Button, Typography, Input, TextArea, InputNumber, Switch, Tag, Spin } from '@douyinfe/semi-ui';
import { IconClose, IconPlay } from '@douyinfe/semi-icons';

import { getApiBaseUrl } from '../../utils/apiConfig';
import { useLanguage, t } from '../../i18n';

/** 不支持单节点测试的节点类型 */
const UNSUPPORTED_NODE_TYPES = new Set([
  'loop',
  'block-start',
  'block-end',
  'continue',
  'break',
  'branches',
  'workflow',
  'group',
  'note',
  'comment',
  'assignee',
  'multi-condition',
]);

interface SingleNodeTestPanelProps {
  nodeId: string;
}

/** 从节点 JSON 中提取输入字段定义 */
interface InputField {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
}

/** 从节点 JSON 中提取输入字段（基于 data.inputs schema） */
function extractInputFields(nodeData: any): InputField[] {
  const inputsSchema = nodeData?.inputs;
  if (!inputsSchema || typeof inputsSchema !== 'object') {
    return [];
  }
  const properties = inputsSchema.properties;
  if (!properties || typeof properties !== 'object') {
    return [];
  }
  const required = new Set(inputsSchema.required || []);
  const fields: InputField[] = [];
  for (const [name, schema] of Object.entries(properties) as [string, any][]) {
    fields.push({
      name,
      type: schema.type || 'string',
      required: required.has(name),
      defaultValue: schema.default,
    });
  }
  return fields;
}

/** 构建模拟内存上下文 */
function buildMemoryContext(
  fieldValues: Record<string, any>,
  fields: InputField[],
  inputsValues: Record<string, any>
): Record<string, any> {
  const memory: Record<string, any> = {};
  // 顶层 key（用于模板解析 {{key}}）
  for (const field of fields) {
    if (fieldValues[field.name] !== undefined && fieldValues[field.name] !== '') {
      memory[field.name] = fieldValues[field.name];
    } else if (field.defaultValue !== undefined) {
      memory[field.name] = field.defaultValue;
    }
  }
  // 合并 inputsValues 中的常量值
  if (inputsValues) {
    for (const [key, val] of Object.entries(inputsValues)) {
      const v = val as any;
      if (v?.type === 'constant' && v.content !== undefined) {
        if (memory[key] === undefined) {
          memory[key] = v.content;
        }
      }
    }
  }
  return memory;
}

export const SingleNodeTestPanel: React.FC<SingleNodeTestPanelProps> = ({ nodeId }) => {
  const { document, playground } = useClientContext();
  const panelManager = usePanelManager();
  useLanguage();

  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [customMemoryText, setCustomMemoryText] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const node = document.getNode(nodeId);

  const nodeData = useMemo(() => {
    if (!node) return null;
    return node.toJSON()?.data || null;
  }, [node]);

  const nodeType = String(node?.flowNodeType || '');
  const isSupported = nodeType !== '' && !UNSUPPORTED_NODE_TYPES.has(nodeType);
  const isReadonly = playground.config.readonly;

  const fields = useMemo(() => extractInputFields(nodeData), [nodeData]);

  /** 同步 inputsValues 默认值到 fieldValues */
  useEffect(() => {
    if (!nodeData) return;
    const inputsValues = nodeData.inputsValues;
    const defaults: Record<string, any> = {};
    for (const [key, val] of Object.entries(inputsValues || {})) {
      const v = val as any;
      if (v?.type === 'constant' && v.content !== undefined) {
        defaults[key] = v.content;
      }
    }
    // 同时加入 schema 中的 default
    for (const field of fields) {
      if (field.defaultValue !== undefined && defaults[field.name] === undefined) {
        defaults[field.name] = field.defaultValue;
      }
    }
    setFieldValues(defaults);
  }, [nodeData, fields]);

  const handleClose = useCallback(() => {
    panelManager.close('single-node-test-panel');
  }, [panelManager]);

  const handleFieldChange = useCallback((name: string, value: any) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleRun = useCallback(async () => {
    if (!node) return;
    setLoading(true);
    setResult(null);
    try {
      const nodeJson = node.toJSON();
      const inputs = buildMemoryContext(fieldValues, fields, nodeData?.inputsValues);

      // 合并用户自定义的内存上下文
      try {
        const customMemory = JSON.parse(customMemoryText);
        if (typeof customMemory === 'object' && customMemory !== null) {
          Object.assign(inputs, customMemory);
        }
      } catch {
        // 自定义内存非合法 JSON 时忽略
      }

      const apiUrl = `${getApiBaseUrl()}/task/runNode`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: JSON.stringify(nodeJson),
          inputs,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('单节点测试失败:', error);
      setResult({
        success: false,
        error: t('singleNode.requestFailed') + (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [node, fieldValues, fields, nodeData, customMemoryText]);

  if (!node) {
    return null;
  }

  const renderFieldInput = (field: InputField) => {
    const value = fieldValues[field.name];
    switch (field.type) {
      case 'boolean':
        return <Switch checked={!!value} onChange={(v) => handleFieldChange(field.name, v)} />;
      case 'integer':
      case 'number':
        return (
          <InputNumber
            value={value}
            onChange={(v) => handleFieldChange(field.name, v)}
            placeholder={t('singleNode.placeholderValue')}
            style={{ width: '100%' }}
          />
        );
      case 'object':
      case 'array':
        return (
          <TextArea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(v: string) => handleFieldChange(field.name, v)}
            placeholder={t('singleNode.placeholderJson')}
            autosize={{ minRows: 2, maxRows: 6 }}
          />
        );
      default:
        return (
          <Input
            value={value !== undefined ? String(value) : ''}
            onChange={(v) => handleFieldChange(field.name, v)}
            placeholder={t('singleNode.placeholderValue')}
          />
        );
    }
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleStyle}>
          {t('singleNode.title')}
          <Tag size="small" color="blue" style={{ marginLeft: 8 }}>
            {nodeType}
          </Tag>
        </div>
        <Button
          type="tertiary"
          icon={<IconClose />}
          size="small"
          theme="borderless"
          onClick={handleClose}
        />
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {!isSupported ? (
          <div style={emptyStateStyle}>
            <Typography.Text type="danger">
              {t('singleNode.unsupportedType')}
            </Typography.Text>
            <Typography.Text type="tertiary" style={{ marginTop: 8 }}>
              {t('singleNode.unsupportedHint')}
            </Typography.Text>
          </div>
        ) : (
          <>
            {/* Node info */}
            <div style={{ marginBottom: 12 }}>
              <Typography.Text strong style={{ fontSize: 13 }}>
                {nodeData?.title || nodeType}
              </Typography.Text>
              <Typography.Text type="tertiary" style={{ marginLeft: 8, fontSize: 12 }}>
                ID: {nodeId}
              </Typography.Text>
            </div>

            {/* Input fields */}
            {fields.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Title heading={6} style={{ marginBottom: 8 }}>
                  {t('singleNode.inputFields')}
                </Typography.Title>
                {fields.map((field) => (
                  <div key={field.name} style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>
                      {field.name}
                      {field.required && <span style={{ color: '#f00' }}>*</span>}
                      <span style={{ color: '#999', marginLeft: 4, fontSize: 11 }}>
                        ({field.type})
                      </span>
                    </label>
                    {renderFieldInput(field)}
                  </div>
                ))}
              </div>
            )}

            {/* Custom memory context */}
            <div style={{ marginBottom: 16 }}>
              <Typography.Title heading={6} style={{ marginBottom: 8 }}>
                {t('singleNode.memoryContext')}
              </Typography.Title>
              <Typography.Text type="tertiary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {t('singleNode.memoryContextHint')}
              </Typography.Text>
              <TextArea
                value={customMemoryText}
                onChange={setCustomMemoryText}
                autosize={{ minRows: 3, maxRows: 8 }}
                style={codeAreaStyle}
                placeholder={'{"start_0": {"query": "hello"}, "param1": "value1"}'}
              />
            </div>

            {/* Result */}
            {loading && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin size="large" />
                <div style={{ marginTop: 8, color: '#666' }}>{t('singleNode.running')}</div>
              </div>
            )}

            {result && !loading && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Title heading={6} style={{ marginBottom: 8 }}>
                  {t('singleNode.result')}
                </Typography.Title>
                {result.success === false ? (
                  <div style={errorResultStyle}>
                    <Typography.Text type="danger" strong>
                      {t('singleNode.executionFailed')}
                    </Typography.Text>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 4 }}>
                      {result.error}
                    </pre>
                  </div>
                ) : (
                  <>
                    {result.timeCost !== undefined && (
                      <div style={{ marginBottom: 8 }}>
                        <Tag size="small" color="green">
                          {t('singleNode.success')} · {result.timeCost}ms
                        </Tag>
                      </div>
                    )}
                    {result.outputs && (
                      <div style={{ marginBottom: 8 }}>
                        <Typography.Text type="secondary" strong>
                          {t('singleNode.outputs')}
                        </Typography.Text>
                        <pre style={resultPreStyle}>
                          {JSON.stringify(result.outputs, null, 2)}
                        </pre>
                      </div>
                    )}
                    {result.executeResult && (
                      <div>
                        <Typography.Text type="secondary" strong>
                          {t('singleNode.rawResult')}
                        </Typography.Text>
                        <pre style={resultPreStyle}>
                          {JSON.stringify(result.executeResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {isSupported && !isReadonly && (
        <div style={footerStyle}>
          <Button
            onClick={handleRun}
            loading={loading}
            icon={<IconPlay size="small" />}
            style={runButtonStyle}
          >
            {t('singleNode.runNode')}
          </Button>
        </div>
      )}
    </div>
  );
};

// Inline styles to match the transparent white minimalist style
const containerStyle: React.CSSProperties = {
  background: 'rgb(255, 255, 255)',
  borderRadius: 8,
  height: '100%',
  width: '100%',
  border: '1px solid rgba(82, 100, 154, 0.13)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 16px',
  height: 40,
  borderBottom: '1px solid rgba(82, 100, 154, 0.13)',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 16,
  paddingBottom: 64,
};

const footerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: 56,
  borderTop: '1px solid rgba(82, 100, 154, 0.13)',
  background: '#fbfbfb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0 0 8px 8px',
};

const runButtonStyle: React.CSSProperties = {
  background: 'rgba(0, 178, 60, 1)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  width: '90%',
  height: 38,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 4,
  color: '#333',
};

const codeAreaStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
};

const resultPreStyle: React.CSSProperties = {
  background: '#f5f5f5',
  borderRadius: 4,
  padding: 8,
  marginTop: 4,
  maxHeight: 200,
  overflow: 'auto',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const errorResultStyle: React.CSSProperties = {
  background: '#fff2f0',
  borderRadius: 4,
  padding: 8,
  border: '1px solid #ffccc7',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  textAlign: 'center',
};

export const singleNodeTestPanelFactory: PanelFactory<SingleNodeTestPanelProps> = {
  key: 'single-node-test-panel',
  defaultSize: 440,
  render: (props: SingleNodeTestPanelProps) => <SingleNodeTestPanel {...props} />,
};
