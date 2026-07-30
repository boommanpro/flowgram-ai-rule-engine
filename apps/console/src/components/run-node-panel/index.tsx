/**
 * 单节点测试面板
 * 支持在工作流编辑器中独立测试单个节点的执行效果
 *
 * 核心能力：
 * 1. 自动识别节点 inputsValues 中的 ref 引用字段
 * 2. 为每个 ref 字段提供输入框，让用户输入模拟值（无需手写 JSON）
 * 3. 构建模拟内存上下文，将 ref 引用映射为对应的上游节点输出值
 * 4. 常量字段已在节点配置中设置，无需重复输入
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
} from '@douyinfe/semi-ui';
import { IconClose, IconPlay } from '@douyinfe/semi-icons';

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

/** ref 引用字段定义 */
interface RefField {
  /** 字段名 */
  name: string;
  /** 引用的上游节点 ID */
  refNodeId: string;
  /** 引用的上游节点参数名 */
  refParamName: string;
  /** 上游节点标题（用于展示） */
  refNodeTitle: string;
  /** 字段类型 */
  type: string;
}

/** 从节点 data.inputs schema 中提取字段类型映射 */
function extractFieldTypeMap(nodeData: any): Record<string, string> {
  const inputsSchema = nodeData?.inputs;
  if (!inputsSchema || typeof inputsSchema !== 'object') return {};
  const properties = inputsSchema.properties;
  if (!properties || typeof properties !== 'object') return {};
  const map: Record<string, string> = {};
  for (const [name, schema] of Object.entries(properties) as [string, any][]) {
    map[name] = schema.type || 'string';
  }
  return map;
}

/**
 * 从 inputsValues 中提取所有 ref 引用字段
 * ref 格式：{ type: 'ref', content: [nodeId, paramName] }
 */
function extractRefFields(nodeData: any, fieldTypeMap: Record<string, string>): RefField[] {
  const inputsValues = nodeData?.inputsValues;
  if (!inputsValues || typeof inputsValues !== 'object') return [];

  const refFields: RefField[] = [];
  for (const [name, val] of Object.entries(inputsValues) as [string, any][]) {
    if (val?.type === 'ref' && Array.isArray(val.content) && val.content.length >= 2) {
      const [refNodeId, refParamName] = val.content;
      refFields.push({
        name,
        refNodeId,
        refParamName,
        refNodeTitle: refNodeId,
        type: fieldTypeMap[name] || 'string',
      });
    }
  }
  return refFields;
}

export const SingleNodeTestPanel: React.FC<SingleNodeTestPanelProps> = ({ nodeId }) => {
  const { document, playground } = useClientContext();
  const panelManager = usePanelManager();
  useLanguage();

  const [refValues, setRefValues] = useState<Record<string, string>>({});
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

  const fieldTypeMap = useMemo(() => extractFieldTypeMap(nodeData), [nodeData]);
  const refFields = useMemo(() => extractRefFields(nodeData, fieldTypeMap), [nodeData, fieldTypeMap]);

  /** 补充 ref 节点标题（通过 document 查询） */
  const refFieldsWithTitle = useMemo(() => {
    return refFields.map((field) => {
      const refNode = document.getNode(field.refNodeId);
      const refNodeData = refNode?.toJSON()?.data || {};
      return {
        ...field,
        refNodeTitle: refNodeData.title || field.refNodeId,
      };
    });
  }, [refFields, document]);

  /** 初始化 ref 字段的模拟值 */
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of refFieldsWithTitle) {
      // 默认空字符串，用户需输入模拟值
      initial[field.name] = '';
    }
    setRefValues(initial);
  }, [refFieldsWithTitle]);

  const handleClose = useCallback(() => {
    panelManager.close('single-node-test-panel');
  }, [panelManager]);

  const handleRefValueChange = useCallback((fieldName: string, value: any) => {
    setRefValues((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  /**
   * 构建模拟内存上下文
   * - 将每个 ref 字段的用户输入值映射为 memory[refNodeId][refParamName]
   * - 保留 inputsValues 中的常量值（http url/method 等）
   */
  const buildMemoryContext = useCallback((): Record<string, any> => {
    const memory: Record<string, any> = {};

    // 1. 注入 ref 字段的模拟值
    for (const field of refFieldsWithTitle) {
      const userInput = refValues[field.name];
      if (userInput !== '' && userInput !== undefined && userInput !== null) {
        if (!memory[field.refNodeId]) {
          memory[field.refNodeId] = {};
        }
        // 尝试按类型转换
        let parsedValue: any = userInput;
        if (field.type === 'integer' || field.type === 'number') {
          const num = Number(userInput);
          if (!isNaN(num)) parsedValue = num;
        } else if (field.type === 'boolean') {
          parsedValue = userInput === 'true';
        } else if (field.type === 'object' || field.type === 'array') {
          try {
            parsedValue = JSON.parse(userInput);
          } catch {
            // 保持字符串
          }
        }
        (memory[field.refNodeId] as any)[field.refParamName] = parsedValue;
      }
    }

    // 2. 合并 inputsValues 中的常量值（http url/method/systemPrompt 等）
    const inputsValues = nodeData?.inputsValues;
    if (inputsValues) {
      for (const [key, val] of Object.entries(inputsValues)) {
        const v = val as any;
        if (v?.type === 'constant' && v.content !== undefined && memory[key] === undefined) {
          memory[key] = v.content;
        } else if (v?.type === 'template' && v.content !== undefined && memory[key] === undefined) {
          memory[key] = v.content;
        }
      }
    }

    return memory;
  }, [refFieldsWithTitle, refValues, nodeData]);

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

  /** 渲染 ref 字段的模拟值输入框 */
  const renderRefInput = (field: RefField) => {
    const value = refValues[field.name] ?? '';
    switch (field.type) {
      case 'boolean':
        return <Switch checked={!!value} onChange={(v) => handleRefValueChange(field.name, v)} />;
      case 'integer':
      case 'number':
        return (
          <InputNumber
            value={value === '' ? undefined : Number(value)}
            onChange={(v) => handleRefValueChange(field.name, v)}
            placeholder={t('singleNode.placeholderMockValue')}
            style={{ width: '100%' }}
            size="small"
          />
        );
      case 'object':
      case 'array':
        return (
          <TextArea
            value={value}
            onChange={(v: string) => handleRefValueChange(field.name, v)}
            placeholder={t('singleNode.placeholderJson')}
            autosize={{ minRows: 2, maxRows: 4 }}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(v) => handleRefValueChange(field.name, v)}
            placeholder={t('singleNode.placeholderMockValue')}
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

            {/* Ref fields - input form */}
            {refFieldsWithTitle.length > 0 ? (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>
                  {t('singleNode.refInputs')}
                  <Tag size="small" color="grey">
                    {refFieldsWithTitle.length}
                  </Tag>
                </div>
                <Typography.Text type="tertiary" style={{ fontSize: 11 }}>
                  {t('singleNode.refInputsHint')}
                </Typography.Text>
                {refFieldsWithTitle.map((field) => (
                  <div key={field.name} className={styles.fieldRow}>
                    <div className={styles.fieldHeader}>
                      <div className={styles.fieldLabel}>
                        {field.name}
                        <span className={styles.fieldType}>({field.type})</span>
                      </div>
                      <Tag size="small" color="light-blue">
                        {field.refNodeTitle}.{field.refParamName}
                      </Tag>
                    </div>
                    {renderRefInput(field)}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noRefState}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('singleNode.noRefFields')}
                </Typography.Text>
              </div>
            )}

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

      {/* Footer - 运行按钮固定在底部 */}
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
