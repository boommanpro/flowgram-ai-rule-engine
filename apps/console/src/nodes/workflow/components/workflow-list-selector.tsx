/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useState } from 'react';

import { Button, Card, Divider, Empty, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconInfoCircle, IconPlayCircle } from '@douyinfe/semi-icons';
import { getApiBaseUrl } from '../../../utils/apiConfig'; // 导入API配置
import { useLanguage, t } from '../../../i18n';

const { Title, Text } = Typography;

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  definition: any;
  inputs?: any;
  outputs?: any;
  tags?: string;
  isExample?: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
}

// 从后端API获取workflow数据
const fetchWorkflowsFromAPI = async (): Promise<WorkflowDefinition[]> => {
  try {
    // 使用动态API基础URL
    const apiUrl = `${getApiBaseUrl()}/workflows`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('获取工作流列表失败');
    }
    const workflows = await response.json();

    // 转换inputs和outputs从字符串格式为对象格式
    return workflows.map((workflow: any) => ({
      ...workflow,
      inputs: workflow.inputs ? JSON.parse(workflow.inputs) : undefined,
      outputs: workflow.outputs ? JSON.parse(workflow.outputs) : undefined,
      definition: workflow.definition ? JSON.parse(workflow.definition) : {},
    }));
  } catch (error) {
    console.error('获取工作流列表失败:', error);
    // 如果API失败，返回空数组
    return [];
  }
};

export interface WorkflowListSelectorProps {
  value?: string;
  onChange?: (workflowId: string) => void;
  onWorkflowChange?: (workflowId: string, workflow: WorkflowDefinition) => void;
}

export const WorkflowListSelector: React.FC<WorkflowListSelectorProps> = ({
  value,
  onChange,
  onWorkflowChange,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  useLanguage();

  useEffect(() => {
    // 从API获取workflow列表
    fetchWorkflowsFromAPI()
      .then((apiWorkflows) => {
        setWorkflows(apiWorkflows);
        if (apiWorkflows.length === 0) {
          console.warn('API未返回工作流数据');
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('获取工作流列表失败:', error);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (value) {
      const workflow = workflows.find((w) => w.id === value);
      setSelectedWorkflow(workflow || null);
    }
  }, [value, workflows]);

  const handleWorkflowSelect = (workflow: WorkflowDefinition) => {
    setSelectedWorkflow(workflow);
    if (onWorkflowChange) {
      onWorkflowChange(workflow.id, workflow);
    }
    if (onChange) {
      onChange(workflow.id);
    }
  };

  const renderParameterSchema = (schema: any, title: string) => {
    if (!schema || !schema.properties) {
      return <Text type="secondary">{t('workflow.empty', { title })}</Text>;
    }

    const properties = Object.entries(schema.properties);
    return (
      <div>
        <Text strong>{title}:</Text>
        <div style={{ marginTop: 4 }}>
          {properties.map(([key, prop]: [string, any]) => (
            <Tag key={key} style={{ marginBottom: 4 }}>
              {key}: {prop.type}
            </Tag>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <Space vertical style={{ width: '100%' }}>
          <div>
            <Text strong>{t('workflow.selectWorkflow')}</Text>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Text>{t('workflow.loadingList')}</Text>
            </div>
          </div>
        </Space>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div>
        <Space vertical style={{ width: '100%' }}>
          <div>
            <Text strong>{t('workflow.selectWorkflow')}</Text>
            <Empty
              title={t('workflow.noAvailable')}
              description=""
              style={{ padding: '20px 0' }}
            />
          </div>
        </Space>
      </div>
    );
  }

  return (
    <div>
      <Space vertical style={{ width: '100%' }}>
        <div>
          <Text strong>{t('workflow.selectWorkflow')}</Text>
          <div style={{ marginTop: 8, maxHeight: '400px', overflowY: 'auto' }}>
            <Space vertical style={{ width: '100%' }}>
              {workflows.map((workflow) => (
                <Card
                  key={workflow.id}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                    border:
                      selectedWorkflow?.id === workflow.id
                        ? '2px solid #1890ff'
                        : '1px solid #e0e0e0',
                    marginBottom: 8,
                    backgroundColor: selectedWorkflow?.id === workflow.id ? '#f0f5ff' : '#ffffff',
                  }}
                  bodyStyle={{ padding: '12px' }}
                  {...{ onClick: () => handleWorkflowSelect(workflow) } as any}
                >
                  <Space vertical style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Title heading={5} style={{ margin: 0 }}>
                        {workflow.isExample && (
                          <Tag color="blue" style={{ marginRight: 8 }}>
                            示例
                          </Tag>
                        )}
                        {workflow.name}
                      </Title>
                      {selectedWorkflow?.id === workflow.id && (
                        <span style={{ color: '#1890ff', fontSize: '16px', fontWeight: 'bold' }}>
                          ✓
                        </span>
                      )}
                    </div>

                    <Text type="secondary" style={{ margin: '4px 0 8px 0', fontSize: 12 }}>
                      {workflow.description}
                    </Text>

                    <Divider style={{ margin: '8px 0' }} />

                    {renderParameterSchema(workflow.inputs, t('workflow.inputParams'))}

                    <div style={{ marginTop: 8 }}>
                      {renderParameterSchema(workflow.outputs, t('workflow.outputParams'))}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 12,
                      }}
                    >
                      <Space>
                        {workflow.tags &&
                          workflow.tags.split(',').map((tag, index) => (
                            <Tag key={index} color="green">
                              {tag.trim()}
                            </Tag>
                          ))}
                      </Space>

                      <Button
                        theme="borderless"
                        size="small"
                        icon={<IconPlayCircle />}
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('查看workflow详情:', workflow.id);
                        }}
                      >
                        查看详情
                      </Button>
                    </div>
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        </div>

        {selectedWorkflow && (
          <Card
            style={{ backgroundColor: '#f0f5ff', border: '2px solid #1890ff' }}
            bodyStyle={{ padding: '12px' }}
          >
            <Space vertical style={{ width: '100%' }}>
              <Title heading={5} style={{ margin: 0 }}>
                <IconInfoCircle /> {t('workflow.selected')}: {selectedWorkflow.name}
              </Title>
              <Text type="secondary" style={{ margin: '4px 0 8px 0', fontSize: 12 }}>
                {selectedWorkflow.description}
              </Text>
              <Divider style={{ margin: '8px 0' }} />
              <Text strong>ID: </Text>
              <Text code>{selectedWorkflow.id}</Text>
              {selectedWorkflow.version && (
                <>
                  <Text strong style={{ marginLeft: 8 }}>
                    版本:{' '}
                  </Text>
                  <Text>{selectedWorkflow.version}</Text>
                </>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
};

// 作为Field组件使用的包装器
export interface WorkflowListSelectorFieldProps {
  value?: string;
  onChange?: (workflowId: string) => void;
  onWorkflowChange?: (workflowId: string, workflow: WorkflowDefinition) => void;
}

export const WorkflowListSelectorField: React.FC<WorkflowListSelectorFieldProps> = ({
  value,
  onChange,
  onWorkflowChange,
}) => (
  <WorkflowListSelector
    value={value}
    onChange={(workflowId: string) => {
      // 同时调用标准的字段变更回调
      if (onChange) {
        onChange(workflowId);
      }
    }}
    onWorkflowChange={onWorkflowChange}
  />
);
