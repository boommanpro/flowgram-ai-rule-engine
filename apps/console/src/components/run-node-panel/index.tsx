/**
 * 单节点测试面板
 * 支持在工作流编辑器中独立测试单个节点的执行效果
 *
 * 核心能力：
 * 1. 从节点 inputs schema 自动提取输入字段
 * 2. 每个字段支持「常量值」和「引用变量」两种赋值模式
 * 3. 引用模式下，通过 VariableSelector 从前序节点输出和全局变量中选择
 * 4. 构建模拟内存上下文，将 ref 引用映射为对应的上游节点输出值
 *
 * 支持的节点类型：start, end, code, string-format, variable, http, llm, condition
 * 不支持：loop, block-start, block-end, continue, break, branches, workflow, group, note, comment, assignee
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

import { type PanelFactory, usePanelManager } from '@flowgram.ai/panel-manager-plugin';
import { useClientContext } from '@flowgram.ai/free-layout-editor';
import {
  Button,
  Typography,
  Input,
  TextArea,
  InputNumber,
  Switch,
  Tag,
  Spin,
  Select,
} from '@douyinfe/semi-ui';
import { IconClose, IconPlay, IconBranch } from '@douyinfe/semi-icons';

import { getApiBaseUrl } from '../../utils/apiConfig';
import { useLanguage, t } from '../../i18n';

import styles from './index.module.less';

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

type FieldMode = 'constant' | 'ref';

interface FieldState {
  mode: FieldMode;
  constantValue: any;
  refValue?: string;
}

/** 从节点 JSON 中提取输入字段定义 */
interface InputField {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: any;
}

/** 从节点 data.inputs schema 中提取输入字段 */
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

/**
 * 从 refValue（如 "start_0.query"）解析出 nodeId 和 paramName
 */
function parseRefValue(refValue: string): { nodeId: string; paramName: string } | null {
  const parts = refValue.split('.');
  if (parts.length >= 2) {
    return { nodeId: parts[0], paramName: parts[parts.length - 1] };
  }
  return null;
}

export const SingleNodeTestPanel: React.FC<SingleNodeTestPanelProps> = ({ nodeId }) => {
  const { document, playground } = useClientContext();
  const panelManager = usePanelManager();
  useLanguage();

  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
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

  /** 获取前序节点（通过 document.toJSON().edges 遍历连线） */
  const upstreamNodes = useMemo(() => {
    if (!node) return [];
    const docJson = document.toJSON() as any;
    const edges = docJson?.edges || [];
    const upstreamNodeIds = new Set<string>();
    for (const edge of edges) {
      const targetId = edge.to?.id || edge.toNodeId || edge.targetNodeID;
      const sourceId = edge.from?.id || edge.fromNodeId || edge.sourceNodeID;
      if (targetId === nodeId && sourceId) {
        upstreamNodeIds.add(sourceId);
      }
    }
    return Array.from(upstreamNodeIds)
      .map((id) => document.getNode(id))
      .filter(Boolean) as any[];
  }, [node, nodeId, document]);

  /** 初始化字段状态：根据 inputsValues 判断是 ref 还是 constant */
  useEffect(() => {
    if (!nodeData) return;
    const inputsValues = nodeData.inputsValues;
    const states: Record<string, FieldState> = {};

    for (const field of fields) {
      const inputVal = inputsValues?.[field.name] as any;
      if (inputVal?.type === 'ref' && Array.isArray(inputVal.content) && inputVal.content.length >= 2) {
        // ref 引用：转换为 "nodeId.paramName" 格式
        states[field.name] = {
          mode: 'ref',
          constantValue: field.defaultValue !== undefined ? field.defaultValue : '',
          refValue: `${inputVal.content[0]}.${inputVal.content[1]}`,
        };
      } else if (inputVal?.type === 'constant' && inputVal.content !== undefined) {
        states[field.name] = {
          mode: 'constant',
          constantValue: inputVal.content,
          refValue: undefined,
        };
      } else {
        states[field.name] = {
          mode: 'constant',
          constantValue: field.defaultValue !== undefined ? field.defaultValue : '',
          refValue: undefined,
        };
      }
    }
    setFieldStates(states);
  }, [nodeData, fields]);

  const handleClose = useCallback(() => {
    panelManager.close('single-node-test-panel');
  }, [panelManager]);

  const handleModeChange = useCallback((fieldName: string, mode: FieldMode) => {
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], mode },
    }));
  }, []);

  const handleConstantChange = useCallback((fieldName: string, value: any) => {
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], constantValue: value },
    }));
  }, []);

  const handleRefChange = useCallback((fieldName: string, value: string | undefined) => {
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: { ...prev[fieldName], refValue: value },
    }));
  }, []);

  /**
   * 构建模拟内存上下文
   * - ref 模式：将 "nodeId.paramName" 转为 memory[nodeId][paramName] 结构
   * - constant 模式：直接放入 memory[fieldName]
   * - 合并用户自定义的 JSON 上下文
   */
  const buildMemoryContext = useCallback((): Record<string, any> => {
    const memory: Record<string, any> = {};

    for (const field of fields) {
      const state = fieldStates[field.name];
      if (!state) continue;

      if (state.mode === 'ref' && state.refValue) {
        const parsed = parseRefValue(state.refValue);
        if (parsed) {
          // 构造 memory[nodeId][paramName] = placeholder 结构
          if (!memory[parsed.nodeId]) {
            memory[parsed.nodeId] = {};
          }
          // 使用占位值（实际值由用户在自定义内存上下文中提供，或直接选 ref 时让后端解析）
          // 但后端单节点执行时不会执行前序节点，所以需要用户提供模拟值
          // 这里我们提供一个占位符，用户可在下方自定义上下文中覆盖
          (memory[parsed.nodeId] as any)[parsed.paramName] = `[ref:${state.refValue}]`;
        }
      } else if (state.mode === 'constant' && state.constantValue !== '' && state.constantValue !== undefined) {
        memory[field.name] = state.constantValue;
      }
    }

    // 合并 inputsValues 中非字段声明的常量值（如 http 的 url/method 等）
    const inputsValues = nodeData?.inputsValues;
    if (inputsValues) {
      for (const [key, val] of Object.entries(inputsValues)) {
        const v = val as any;
        if (v?.type === 'constant' && v.content !== undefined && memory[key] === undefined) {
          memory[key] = v.content;
        }
      }
    }

    // 合并用户自定义的内存上下文（覆盖上面的占位值）
    try {
      const customMemory = JSON.parse(customMemoryText);
      if (typeof customMemory === 'object' && customMemory !== null) {
        for (const [key, val] of Object.entries(customMemory)) {
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            memory[key] = { ...(memory[key] || {}), ...val };
          } else {
            memory[key] = val;
          }
        }
      }
    } catch {
      // 自定义内存非合法 JSON 时忽略
    }

    return memory;
  }, [fields, fieldStates, nodeData, customMemoryText]);

  const handleRun = useCallback(async () => {
    if (!node) return;
    setLoading(true);
    setResult(null);
    try {
      const nodeJson = node.toJSON();
      const inputs = buildMemoryContext();

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
  }, [node, buildMemoryContext]);

  if (!node) {
    return null;
  }

  /** 渲染常量值输入框 */
  const renderConstantInput = (field: InputField, state: FieldState) => {
    const value = state.constantValue;
    switch (field.type) {
      case 'boolean':
        return <Switch checked={!!value} onChange={(v) => handleConstantChange(field.name, v)} />;
      case 'integer':
      case 'number':
        return (
          <InputNumber
            value={value}
            onChange={(v) => handleConstantChange(field.name, v)}
            placeholder={t('singleNode.placeholderValue')}
            style={{ width: '100%' }}
            size="small"
          />
        );
      case 'object':
      case 'array':
        return (
          <TextArea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(v: string) => handleConstantChange(field.name, v)}
            placeholder={t('singleNode.placeholderJson')}
            autosize={{ minRows: 2, maxRows: 6 }}
          />
        );
      default:
        return (
          <Input
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(v) => handleConstantChange(field.name, v)}
            placeholder={t('singleNode.placeholderValue')}
            size="small"
          />
        );
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          {t('singleNode.title')}
          <Tag size="small" color="blue">
            {nodeType}
          </Tag>
        </div>
        <Button
          type="tertiary"
          icon={<IconClose />}
          size="small"
          theme="borderless"
          onClick={handleClose}
          className={styles.closeBtn}
        />
      </div>

      {/* Content */}
      <div className={styles.content}>
        {!isSupported ? (
          <div className={styles.emptyState}>
            <Typography.Text type="danger">{t('singleNode.unsupportedType')}</Typography.Text>
            <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
              {t('singleNode.unsupportedHint')}
            </Typography.Text>
          </div>
        ) : (
          <>
            {/* Node info */}
            <div className={styles.nodeInfo}>
              <Typography.Text className={styles.nodeTitle}>
                {nodeData?.title || nodeType}
              </Typography.Text>
              <Typography.Text type="tertiary" className={styles.nodeId}>
                ID: {nodeId}
              </Typography.Text>
            </div>

            {/* Input fields with ref/constant toggle */}
            {fields.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  {t('singleNode.inputFields')}
                  <Tag size="small" color="grey">
                    {upstreamNodes.length} {t('singleNode.availableVars')}
                  </Tag>
                </div>
                {fields.map((field) => {
                  const state = fieldStates[field.name] || { mode: 'constant' as FieldMode, constantValue: '' };
                  return (
                    <div key={field.name} className={styles.fieldRow}>
                      <div className={styles.fieldHeader}>
                        <div className={styles.fieldLabel}>
                          {field.name}
                          {field.required && <span className={styles.required}>*</span>}
                          <span className={styles.fieldType}>({field.type})</span>
                        </div>
                        <div className={styles.modeSwitch}>
                          <button
                            className={`${styles.modeBtn} ${state.mode === 'constant' ? styles.active : ''}`}
                            onClick={() => handleModeChange(field.name, 'constant')}
                          >
                            {t('singleNode.modeConstant')}
                          </button>
                          <button
                            className={`${styles.modeBtn} ${state.mode === 'ref' ? styles.active : ''}`}
                            onClick={() => handleModeChange(field.name, 'ref')}
                          >
                            {t('singleNode.modeRef')}
                          </button>
                        </div>
                      </div>
                      {state.mode === 'constant' ? (
                        renderConstantInput(field, state)
                      ) : (
                        <>
                          <Select
                            value={state.refValue}
                            onChange={(v) => handleRefChange(field.name, v as string)}
                            size="small"
                            style={{ width: '100%' }}
                            placeholder={t('singleNode.selectVariable')}
                            showClear
                            optionList={upstreamNodes.flatMap((upNode: any) => {
                              const upData = upNode.toJSON()?.data || {};
                              const upOutputs = upData.outputs?.properties || {};
                              const upNodeId = upNode.id;
                              return Object.keys(upOutputs).map((paramName) => ({
                                label: `${upData.title || upNode.flowNodeType}.${paramName}`,
                                value: `${upNodeId}.${paramName}`,
                              }));
                            })}
                          />
                          <div className={styles.refHint}>
                            {t('singleNode.refHint')}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom memory context */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <IconBranch size="small" />
                {t('singleNode.memoryContext')}
              </div>
              <Typography.Text type="tertiary" style={{ fontSize: 11 }}>
                {t('singleNode.memoryContextHint')}
              </Typography.Text>
              <TextArea
                value={customMemoryText}
                onChange={setCustomMemoryText}
                autosize={{ minRows: 3, maxRows: 8 }}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
                placeholder={'{"start_0": {"query": "hello"}}'}
              />
            </div>

            {/* Result */}
            {loading && (
              <div className={styles.loadingWrap}>
                <Spin size="large" />
                <span>{t('singleNode.running')}</span>
              </div>
            )}

            {result && !loading && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>{t('singleNode.result')}</div>
                {result.success === false ? (
                  <div className={`${styles.resultBlock} ${styles.resultError}`}>
                    <Typography.Text type="danger" strong>
                      {t('singleNode.executionFailed')}
                    </Typography.Text>
                    <pre className={styles.resultPre}>{result.error}</pre>
                  </div>
                ) : (
                  <div className={`${styles.resultBlock} ${styles.resultSuccess}`}>
                    {result.timeCost !== undefined && (
                      <div style={{ marginBottom: 8 }}>
                        <Tag size="small" color="green">
                          {t('singleNode.success')} · {result.timeCost}ms
                        </Tag>
                      </div>
                    )}
                    {result.outputs && (
                      <div style={{ marginBottom: 8 }}>
                        <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
                          {t('singleNode.outputs')}
                        </Typography.Text>
                        <pre className={styles.resultPre}>
                          {JSON.stringify(result.outputs, null, 2)}
                        </pre>
                      </div>
                    )}
                    {result.executeResult && (
                      <div>
                        <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>
                          {t('singleNode.rawResult')}
                        </Typography.Text>
                        <pre className={styles.resultPre}>
                          {JSON.stringify(result.executeResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {isSupported && !isReadonly && (
        <div className={styles.footer}>
          <Button
            onClick={handleRun}
            loading={loading}
            icon={<IconPlay size="small" />}
            className={styles.runButton}
          >
            {t('singleNode.runNode')}
          </Button>
        </div>
      )}
    </div>
  );
};

export const singleNodeTestPanelFactory: PanelFactory<SingleNodeTestPanelProps> = {
  key: 'single-node-test-panel',
  defaultSize: 440,
  render: (props: SingleNodeTestPanelProps) => <SingleNodeTestPanel {...props} />,
};
