/**
 * AgentConfigManagement — Agent 配置中心
 * 5 个 Tab：模型配置 / 提示词 & 知识库 / 工具定义 / 权限设置 / 知识图谱
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Tabs,
  TabPane,
  Table,
  Button,
  Modal,
  Input,
  TextArea,
  Select,
  Tag,
  Spin,
  Toast,
  Switch,
  Typography,
  Radio,
  RadioGroup,
} from '@douyinfe/semi-ui';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';
import { agentApi } from '../../agent/api';
import { getApiBaseUrl } from '../../utils/apiConfig';
import type { PermissionPolicy } from '../../agent/types';
import { t, useLanguage } from '../../i18n';

const ACCENT = '#4d53e8';

/* ---------------- Helpers ---------------- */

const formatDateTime = (iso?: string | number): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const tryParseJson = (raw?: string): any => {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};

const jsonStringify = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
};

/**
 * AI 生成：创建临时会话 → 调用 chat SSE → 收集 token → 清理临时会话
 * 返回生成的内容文本。
 */
async function generateWithAI(prompt: string): Promise<string> {
  const session = await agentApi.createSession('ai-gen-temp');
  const response = await fetch(`${getApiBaseUrl()}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionKey: session.sessionKey,
      message: prompt,
      locale: 'zh-CN',
    }),
  });
  if (!response.ok) {
    throw new Error(`Chat API Error: ${response.status}`);
  }
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let eventName = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        const data = line.substring(5).trim();
        if (data && eventName === 'token') {
          try {
            content += JSON.parse(data).content;
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  try {
    await agentApi.deleteSession(session.sessionKey);
  } catch {
    /* ignore cleanup errors */
  }
  return content;
}

/* ---------------- Shared AI generation modal ---------------- */

interface AiGenModalProps {
  visible: boolean;
  onClose: () => void;
  defaultPrompt: string;
  onApply: (content: string) => void;
}

const AiGenModal: React.FC<AiGenModalProps> = ({ visible, onClose, defaultPrompt, onApply }) => {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    if (visible) {
      setPrompt(defaultPrompt);
      setResult('');
      setGenerating(false);
    }
  }, [visible, defaultPrompt]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Toast.warning('请输入生成提示词');
      return;
    }
    setGenerating(true);
    setResult('');
    try {
      const content = await generateWithAI(prompt);
      setResult(content);
      if (!content) {
        Toast.warning('生成内容为空');
      }
    } catch (e) {
      Toast.error(`生成失败: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }, [prompt]);

  const handleApply = useCallback(() => {
    if (!result.trim()) {
      Toast.warning('没有可应用的内容');
      return;
    }
    onApply(result);
    onClose();
  }, [result, onApply, onClose]);

  return (
    <Modal
      title="AI 生成"
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={680}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.generatePrompt')}</Typography.Text>
          <TextArea
            value={prompt}
            onChange={(v) => setPrompt(v)}
            autosize={{ minRows: 3, maxRows: 6 }}
            placeholder="描述你希望生成的内容…"
            style={{ marginTop: 6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            theme="solid"
            style={{ background: ACCENT }}
            loading={generating}
            onClick={handleGenerate}
          >
            生成
          </Button>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
        {generating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#888', fontSize: 13 }}>
            <Spin /> {t('agent.config.generating')}
          </div>
        )}
        {result && (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.generateResult')}</Typography.Text>
            <TextArea
              value={result}
              onChange={(v) => setResult(v)}
              autosize={{ minRows: 6, maxRows: 16 }}
              style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
        )}
        {result && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button theme="solid" style={{ background: ACCENT }} onClick={handleApply}>
              应用到表单
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

/* ================================================================
 * ConfigItem — 配置项共享类型（被 PromptEditorTab 等使用）
 * ================================================================ */

interface ConfigItem {
  id?: number;
  configKey: string;
  configType?: string;
  title?: string;
  content?: string;
  description?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  /** RAG 知识块专用字段 */
  source?: string;
  metadata?: any;
  language?: string;
}

/* ================================================================
 * ToolDefinitionTab — 工具定义（系统内置，仅展示与按分组过滤，支持编辑策略/启用）
 * ================================================================ */

interface ToolDefItem {
  id?: number;
  toolName: string;
  toolGroup?: string;
  description?: string;
  parameters?: any;
  defaultPolicy?: string;
  pageContexts?: any;
  enabled?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

const ToolDefinitionTab: React.FC = () => {
  useLanguage();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ToolDefItem[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ToolDefItem>({
    toolName: '',
    toolGroup: '',
    description: '',
    parameters: '',
    defaultPolicy: 'confirm',
    pageContexts: '',
    enabled: true,
    sortOrder: 0,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentApi.listToolDefinitions();
      setList(data || []);
    } catch (e) {
      Toast.error(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 提取所有分组（去重）
  const groups = useMemo(() => {
    const set = new Set<string>();
    list.forEach((item) => {
      if (item.toolGroup) set.add(item.toolGroup);
    });
    return Array.from(set).sort();
  }, [list]);

  // 按分组过滤
  const filteredList = useMemo(() => {
    if (!groupFilter) return list;
    return list.filter((item) => item.toolGroup === groupFilter);
  }, [list, groupFilter]);

  const openEdit = (item: ToolDefItem) => {
    setForm({
      ...item,
      parameters: jsonStringify(item.parameters),
      pageContexts: jsonStringify(item.pageContexts),
    });
    setModalVisible(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.toolName) {
      Toast.warning('请填写 toolName');
      return;
    }
    const parsedParams = tryParseJson(form.parameters as any);
    if (form.parameters && parsedParams === null) {
      Toast.error('parameters 不是合法的 JSON');
      return;
    }
    const parsedContexts = tryParseJson(form.pageContexts as any);
    if (form.pageContexts && parsedContexts === null) {
      Toast.error('pageContexts 不是合法的 JSON 数组');
      return;
    }
    setSaving(true);
    try {
      await agentApi.saveToolDefinition({
        ...form,
        parameters: parsedParams || {},
        pageContexts: Array.isArray(parsedContexts) ? parsedContexts : [],
      });
      Toast.success('保存成功');
      setModalVisible(false);
      void load();
    } catch (e) {
      Toast.error(`保存失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const policyColor: Record<string, any> = {
    always: 'green',
    confirm: 'orange',
    forbid: 'red',
  };

  const columns: ColumnProps<ToolDefItem>[] = [
    { title: 'ToolName', dataIndex: 'toolName', key: 'toolName', width: 180 },
    { title: '分组', dataIndex: 'toolGroup', key: 'toolGroup', width: 100 },
    { title: '描述', dataIndex: 'description', key: 'description', width: 240 },
    {
      title: '默认策略',
      dataIndex: 'defaultPolicy',
      key: 'defaultPolicy',
      width: 100,
      render: (text: string) => (
        <Tag color={policyColor[text] || 'grey'} size="small">{text || '—'}</Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (val: boolean) => (val ? <Tag color="green" size="small">{t('common.enabled')}</Tag> : <Tag color="grey" size="small">{t('common.disabled')}</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_text: any, record: ToolDefItem) => (
        <Button size="small" theme="borderless" style={{ color: ACCENT }} onClick={() => openEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 工具栏：仅分组过滤 + 刷新 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#666', flexShrink: 0 }}>{t('agent.config.filterGroup')}：</span>
        <Select
          value={groupFilter || undefined}
          onChange={(v) => setGroupFilter(v as string || '')}
          style={{ width: 180 }}
          placeholder={t('agent.config.allGroups')}
          optionList={[
            { value: '', label: t('agent.config.allGroups') },
            ...groups.map((g) => ({ value: g, label: g })),
          ]}
        />
        <Button onClick={() => void load()}>{t('agent.config.refresh')}</Button>
        <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>
          共 {filteredList.length} 个工具
        </span>
      </div>

      <Table
        columns={columns}
        dataSource={filteredList}
        rowKey="toolName"
        loading={loading}
        pagination={false}
      />

      {/* 编辑弹窗（仅编辑策略/启用等，不可新建） */}
      <Modal
        title="编辑工具定义"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={680}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>ToolName</Typography.Text>
            <Input
              value={form.toolName}
              disabled
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>ToolGroup</Typography.Text>
            <Input
              value={form.toolGroup}
              disabled
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('common.description')}</Typography.Text>
            <Input
              value={form.description}
              disabled
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Parameters (JSON)</Typography.Text>
            <TextArea
              value={form.parameters as any}
              onChange={(v) => setForm({ ...form, parameters: v })}
              autosize={{ minRows: 5, maxRows: 14 }}
              style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.defaultPolicy')}</Typography.Text>
            <Select
              value={form.defaultPolicy}
              onChange={(v) => setForm({ ...form, defaultPolicy: v as string })}
              style={{ width: '100%', marginTop: 6 }}
              optionList={[
                { value: 'always', label: 'always（总是允许）' },
                { value: 'confirm', label: 'confirm（每次确认）' },
                { value: 'forbid', label: 'forbid（禁止）' },
              ]}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>PageContexts (JSON array)</Typography.Text>
            <TextArea
              value={form.pageContexts as any}
              onChange={(v) => setForm({ ...form, pageContexts: v })}
              autosize={{ minRows: 2, maxRows: 6 }}
              style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('common.enabled')}</Typography.Text>
            <Switch
              checked={!!form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('common.sort')}</Typography.Text>
            <Input
              value={String(form.sortOrder ?? 0)}
              onChange={(v) => setForm({ ...form, sortOrder: Number(v) || 0 })}
              style={{ marginTop: 6, width: 120 }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalVisible(false)}>{t('common.cancel')}</Button>
            <Button theme="solid" style={{ background: ACCENT }} loading={saving} onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ================================================================
 * PermissionTab — 全局权限设置（管理所有新会话的默认权限策略）
 * ================================================================ */

const PERMISSION_GROUPS: { title: string; actions: { name: string; desc: string }[] }[] = [
  {
    title: '导航',
    actions: [
      { name: 'navigate', desc: '页面导航（首页/后台/编辑器等）' },
    ],
  },
  {
    title: '查询',
    actions: [
      { name: 'query', desc: '查询工作流/模板/日志/节点详情' },
    ],
  },
  {
    title: '管理',
    actions: [
      { name: 'manage', desc: '创建/保存/删除工作流和模板' },
    ],
  },
  {
    title: '画布',
    actions: [
      { name: 'canvas', desc: '节点增删改/连线/布局/运行' },
    ],
  },
  {
    title: '计划',
    actions: [
      { name: 'createPlan', desc: '创建多步骤执行计划' },
    ],
  },
];

const ALL_PERMISSION_ACTIONS = PERMISSION_GROUPS.flatMap((g) => g.actions.map((a) => a.name));

const POLICY_OPTIONS: { value: PermissionPolicy; label: string; color: string }[] = [
  { value: 'always', label: '总是允许', color: '#1f9d55' },
  { value: 'confirm', label: '每次确认', color: '#b7791f' },
  { value: 'forbid', label: '禁止', color: '#e5404e' },
];

const PermissionTab: React.FC = () => {
  useLanguage();
  const [permissions, setPermissions] = useState<Record<string, PermissionPolicy>>({});
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentApi.getGlobalPermissions();
      setPermissions(data || {});
    } catch (e) {
      Toast.error(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = useCallback(async (action: string, policy: PermissionPolicy) => {
    setPermissions((prev) => ({ ...prev, [action]: policy }));
    try {
      await agentApi.updateGlobalPermission(action, policy);
    } catch (e) {
      Toast.error(`更新失败: ${(e as Error).message}`);
      void load();
    }
  }, [load]);

  const handleBatchSet = useCallback(async (policy: PermissionPolicy) => {
    setBatchLoading(true);
    try {
      for (const action of ALL_PERMISSION_ACTIONS) {
        setPermissions((prev) => ({ ...prev, [action]: policy }));
        await agentApi.updateGlobalPermission(action, policy);
      }
      Toast.success('批量设置成功');
    } catch (e) {
      Toast.error(`批量设置失败: ${(e as Error).message}`);
      void load();
    } finally {
      setBatchLoading(false);
    }
  }, [load]);

  const stats = useMemo(() => {
    let always = 0, confirm = 0, forbid = 0;
    for (const name of ALL_PERMISSION_ACTIONS) {
      const p = permissions[name] || 'confirm';
      if (p === 'always') always++;
      else if (p === 'confirm') confirm++;
      else if (p === 'forbid') forbid++;
    }
    return { always, confirm, forbid };
  }, [permissions]);

  return (
    <div>
      {/* 快捷操作区 */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#666', flexShrink: 0, fontWeight: 500 }}>{t('agent.config.quickActions')}：</span>
          <Button
            size="small"
            disabled={batchLoading}
            onClick={() => void handleBatchSet('always')}
            style={{ border: '1px solid #b7eb8f', background: '#f6ffed', color: '#389e0d' }}
          >
            {t('agent.config.batchAllow')}
          </Button>
          <Button
            size="small"
            disabled={batchLoading}
            onClick={() => void handleBatchSet('confirm')}
            style={{ border: '1px solid #ffd591', background: '#fff7e6', color: '#d46b08' }}
          >
            {t('agent.config.batchConfirm')}
          </Button>
          <Button
            size="small"
            disabled={batchLoading}
            onClick={() => void handleBatchSet('forbid')}
            style={{ border: '1px solid #ffccc7', background: '#fff2f0', color: '#cf1322' }}
          >
            {t('agent.config.batchForbid')}
          </Button>
          <Button size="small" onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>
            当前：{stats.always} 允许 / {stats.confirm} 确认 / {stats.forbid} 禁止
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>
          {t('agent.config.permNote')}
        </div>
      </div>

      {/* 权限分组列表 */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : (
        PERMISSION_GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: ACCENT,
                marginBottom: 8,
                letterSpacing: '0.3px',
              }}
            >
              {group.title}
            </div>
            <div
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {group.actions.map((action, idx) => {
                const current = permissions[action.name] || 'confirm';
                return (
                  <div
                    key={action.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderTop: idx === 0 ? 'none' : '1px solid #f5f5f5',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#333',
                          fontWeight: 500,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {action.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#aaa' }}>{action.desc}</span>
                    </div>
                    <RadioGroup
                      type="button"
                      buttonSize="small"
                      value={current}
                      onChange={(e) => void handleChange(action.name, e.target.value as PermissionPolicy)}
                    >
                      {POLICY_OPTIONS.map((opt) => (
                        <Radio key={opt.value} value={opt.value}>
                          {opt.label}
                        </Radio>
                      ))}
                    </RadioGroup>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

/* ================================================================
 * KnowledgeGraphTab — 知识图谱（节点 + 边）
 * ================================================================ */

interface GraphNode {
  id?: number;
  nodeKey: string;
  nodeType?: string;
  title?: string;
  properties?: any;
  createdAt?: string;
  updatedAt?: string;
}

interface GraphEdge {
  id?: number;
  sourceKey: string;
  targetKey: string;
  edgeType?: string;
  properties?: any;
}

const KnowledgeGraphTab: React.FC = () => {
  const [tabKey, setTabKey] = useState('nodes');

  // Nodes
  const [nodeLoading, setNodeLoading] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [nodeForm, setNodeForm] = useState<GraphNode>({ nodeKey: '', nodeType: '', title: '', properties: '{}' });
  const [nodeSaving, setNodeSaving] = useState(false);

  // Edges
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [edgeModalVisible, setEdgeModalVisible] = useState(false);
  const [edgeForm, setEdgeForm] = useState<GraphEdge>({ sourceKey: '', targetKey: '', edgeType: '', properties: '{}' });
  const [edgeSaving, setEdgeSaving] = useState(false);

  // Subgraph
  const [subgraphVisible, setSubgraphVisible] = useState(false);
  const [subgraphNodeType, setSubgraphNodeType] = useState('');
  const [subgraphKeyword, setSubgraphKeyword] = useState('');
  const [subgraphLoading, setSubgraphLoading] = useState(false);
  const [subgraphNodes, setSubgraphNodes] = useState<GraphNode[]>([]);
  const [subgraphEdges, setSubgraphEdges] = useState<GraphEdge[]>([]);

  const loadNodes = useCallback(async () => {
    setNodeLoading(true);
    try {
      const data = await agentApi.listGraphNodes();
      setNodes(data || []);
    } catch (e) {
      Toast.error(`加载节点失败: ${(e as Error).message}`);
    } finally {
      setNodeLoading(false);
    }
  }, []);

  const loadEdges = useCallback(async () => {
    setEdgeLoading(true);
    try {
      const data = await agentApi.listGraphEdges();
      setEdges(data || []);
    } catch (e) {
      Toast.error(`加载边失败: ${(e as Error).message}`);
    } finally {
      setEdgeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNodes();
    void loadEdges();
  }, [loadNodes, loadEdges]);

  const openCreateNode = () => {
    setEditingNode(null);
    setNodeForm({ nodeKey: '', nodeType: '', title: '', properties: '{}' });
    setNodeModalVisible(true);
  };

  const openEditNode = (node: GraphNode) => {
    setEditingNode(node);
    setNodeForm({ ...node, properties: jsonStringify(node.properties) });
    setNodeModalVisible(true);
  };

  const handleSaveNode = useCallback(async () => {
    if (!nodeForm.nodeKey) {
      Toast.warning('请填写 nodeKey');
      return;
    }
    const parsed = tryParseJson(nodeForm.properties);
    if (nodeForm.properties && parsed === null) {
      Toast.error('properties 不是合法的 JSON');
      return;
    }
    setNodeSaving(true);
    try {
      await agentApi.saveGraphNode({
        ...nodeForm,
        properties: parsed || {},
      });
      Toast.success('保存成功');
      setNodeModalVisible(false);
      void loadNodes();
    } catch (e) {
      Toast.error(`保存失败: ${(e as Error).message}`);
    } finally {
      setNodeSaving(false);
    }
  }, [nodeForm, loadNodes]);

  const handleDeleteNode = useCallback(async (nodeKey: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除节点「${nodeKey}」及其关联的边吗？`,
      onOk: async () => {
        try {
          await agentApi.deleteGraphNode(nodeKey);
          Toast.success('删除成功');
          void loadNodes();
          void loadEdges();
        } catch (e) {
          Toast.error(`删除失败: ${(e as Error).message}`);
        }
      },
    });
  }, [loadNodes, loadEdges]);

  const handleSaveEdge = useCallback(async () => {
    if (!edgeForm.sourceKey || !edgeForm.targetKey) {
      Toast.warning('请填写 sourceKey 和 targetKey');
      return;
    }
    const parsed = tryParseJson(edgeForm.properties);
    if (edgeForm.properties && parsed === null) {
      Toast.error('properties 不是合法的 JSON');
      return;
    }
    setEdgeSaving(true);
    try {
      await agentApi.saveGraphEdge({
        ...edgeForm,
        properties: parsed || {},
      });
      Toast.success('保存成功');
      setEdgeModalVisible(false);
      setEdgeForm({ sourceKey: '', targetKey: '', edgeType: '', properties: '{}' });
      void loadEdges();
    } catch (e) {
      Toast.error(`保存失败: ${(e as Error).message}`);
    } finally {
      setEdgeSaving(false);
    }
  }, [edgeForm, loadEdges]);

  const handleDeleteEdge = useCallback(async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定删除该边吗？',
      onOk: async () => {
        try {
          await agentApi.deleteGraphEdge(id);
          Toast.success('删除成功');
          void loadEdges();
        } catch (e) {
          Toast.error(`删除失败: ${(e as Error).message}`);
        }
      },
    });
  }, [loadEdges]);

  const handleSubgraph = useCallback(async () => {
    setSubgraphLoading(true);
    setSubgraphNodes([]);
    setSubgraphEdges([]);
    try {
      const ns = await agentApi.listGraphNodes(subgraphNodeType || undefined, subgraphKeyword || undefined);
      const nodeKeys = (ns || []).map((n: any) => n.nodeKey);
      setSubgraphNodes(ns || []);
      // 加载与这些节点相关的边
      const allEdges: GraphEdge[] = [];
      for (const nk of nodeKeys) {
        try {
          const out = await agentApi.listGraphEdges(nk);
          allEdges.push(...(out || []));
        } catch {
          /* ignore */
        }
      }
      // 去重
      const seen = new Set<number>();
      const dedup: GraphEdge[] = [];
      for (const e of allEdges) {
        if (e.id && !seen.has(e.id)) {
          seen.add(e.id);
          dedup.push(e);
        }
      }
      setSubgraphEdges(dedup);
    } catch (e) {
      Toast.error(`子图检索失败: ${(e as Error).message}`);
    } finally {
      setSubgraphLoading(false);
    }
  }, [subgraphNodeType, subgraphKeyword]);

  const nodeColumns: ColumnProps<GraphNode>[] = [
    { title: 'NodeKey', dataIndex: 'nodeKey', key: 'nodeKey', width: 180 },
    { title: 'Type', dataIndex: 'nodeType', key: 'nodeType', width: 120 },
    { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_text: any, record: GraphNode) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="small" theme="borderless" style={{ color: ACCENT }} onClick={() => openEditNode(record)}>
            编辑
          </Button>
          <Button size="small" theme="borderless" type="danger" onClick={() => handleDeleteNode(record.nodeKey)}>
            删除
          </Button>
        </div>
      ),
    },
  ];

  const edgeColumns: ColumnProps<GraphEdge>[] = [
    { title: 'Source', dataIndex: 'sourceKey', key: 'sourceKey', width: 180 },
    { title: 'Target', dataIndex: 'targetKey', key: 'targetKey', width: 180 },
    { title: 'EdgeType', dataIndex: 'edgeType', key: 'edgeType', width: 140 },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_text: any, record: GraphEdge) => (
        <Button size="small" theme="borderless" type="danger" onClick={() => handleDeleteEdge(record.id!)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button theme="solid" style={{ background: ACCENT }} onClick={() => setSubgraphVisible(true)}>
          子图检索
        </Button>
        <Button onClick={() => { void loadNodes(); void loadEdges(); }}>{t('agent.config.refresh')}</Button>
      </div>

      <Tabs type="line" activeKey={tabKey} onChange={(k) => setTabKey(k)}>
        <TabPane tab="节点" itemKey="nodes">
          <div style={{ marginBottom: 12 }}>
            <Button theme="solid" style={{ background: ACCENT }} onClick={openCreateNode}>
              新建节点
            </Button>
          </div>
          <Table
            columns={nodeColumns}
            dataSource={nodes}
            rowKey="nodeKey"
            loading={nodeLoading}
            pagination={{ pageSize: 10 }}
          />
        </TabPane>
        <TabPane tab="边" itemKey="edges">
          <div style={{ marginBottom: 12 }}>
            <Button theme="solid" style={{ background: ACCENT }} onClick={() => setEdgeModalVisible(true)}>
              新建边
            </Button>
          </div>
          <Table
            columns={edgeColumns}
            dataSource={edges}
            rowKey="id"
            loading={edgeLoading}
            pagination={{ pageSize: 10 }}
          />
        </TabPane>
      </Tabs>

      {/* Node edit modal */}
      <Modal
        title={editingNode ? '编辑节点' : '新建节点'}
        visible={nodeModalVisible}
        onCancel={() => setNodeModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>NodeKey</Typography.Text>
            <Input
              value={nodeForm.nodeKey}
              onChange={(v) => setNodeForm({ ...nodeForm, nodeKey: v })}
              disabled={!!editingNode}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>NodeType</Typography.Text>
            <Input
              value={nodeForm.nodeType}
              onChange={(v) => setNodeForm({ ...nodeForm, nodeType: v })}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('common.title')}</Typography.Text>
            <Input
              value={nodeForm.title}
              onChange={(v) => setNodeForm({ ...nodeForm, title: v })}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Properties (JSON)</Typography.Text>
            <TextArea
              value={nodeForm.properties as any}
              onChange={(v) => setNodeForm({ ...nodeForm, properties: v })}
              autosize={{ minRows: 4, maxRows: 12 }}
              style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setNodeModalVisible(false)}>{t('common.cancel')}</Button>
            <Button theme="solid" style={{ background: ACCENT }} loading={nodeSaving} onClick={handleSaveNode}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edge add modal */}
      <Modal
        title="新建边"
        visible={edgeModalVisible}
        onCancel={() => setEdgeModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>SourceKey</Typography.Text>
            <Input
              value={edgeForm.sourceKey}
              onChange={(v) => setEdgeForm({ ...edgeForm, sourceKey: v })}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>TargetKey</Typography.Text>
            <Input
              value={edgeForm.targetKey}
              onChange={(v) => setEdgeForm({ ...edgeForm, targetKey: v })}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>EdgeType</Typography.Text>
            <Input
              value={edgeForm.edgeType}
              onChange={(v) => setEdgeForm({ ...edgeForm, edgeType: v })}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>Properties (JSON)</Typography.Text>
            <TextArea
              value={edgeForm.properties as any}
              onChange={(v) => setEdgeForm({ ...edgeForm, properties: v })}
              autosize={{ minRows: 3, maxRows: 8 }}
              style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setEdgeModalVisible(false)}>{t('common.cancel')}</Button>
            <Button theme="solid" style={{ background: ACCENT }} loading={edgeSaving} onClick={handleSaveEdge}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      {/* Subgraph modal */}
      <Modal
        title="子图检索"
        visible={subgraphVisible}
        onCancel={() => setSubgraphVisible(false)}
        footer={null}
        width={780}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            value={subgraphNodeType}
            onChange={(v) => setSubgraphNodeType(v)}
            placeholder="nodeType（可选）"
            style={{ width: 180 }}
          />
          <Input
            value={subgraphKeyword}
            onChange={(v) => setSubgraphKeyword(v)}
            placeholder="keyword（可选）"
            style={{ flex: 1 }}
          />
          <Button theme="solid" style={{ background: ACCENT }} loading={subgraphLoading} onClick={() => void handleSubgraph()}>
            检索
          </Button>
        </div>
        {subgraphLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              节点（{subgraphNodes.length}）
            </Typography.Text>
            <Table
              columns={[
                { title: 'NodeKey', dataIndex: 'nodeKey', key: 'nodeKey', width: 160 },
                { title: 'Type', dataIndex: 'nodeType', key: 'nodeType', width: 120 },
                { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
              ]}
              dataSource={subgraphNodes}
              rowKey="nodeKey"
              pagination={false}
              size="small"
              style={{ marginBottom: 16 }}
            />
            <Typography.Text strong style={{ fontSize: 13 }}>
              边（{subgraphEdges.length}）
            </Typography.Text>
            <Table
              columns={[
                { title: 'Source', dataIndex: 'sourceKey', key: 'sourceKey', width: 160 },
                { title: 'Target', dataIndex: 'targetKey', key: 'targetKey', width: 160 },
                { title: 'Type', dataIndex: 'edgeType', key: 'edgeType', width: 120 },
              ]}
              dataSource={subgraphEdges}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ================================================================
 * ModelConfigTab — LLM 模型配置（apiHost / apiKey / model 等）
 * ================================================================ */

interface ModelConfigForm {
  apiHost: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
}

const DEFAULT_MODEL_CONFIG: ModelConfigForm = {
  apiHost: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindow: 8192,
};

const ModelConfigTab: React.FC = () => {
  useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ModelConfigForm>(DEFAULT_MODEL_CONFIG);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agentApi.listConfigs('llm_config');
      const item = (data || [])[0];
      if (item) {
        const parsed = tryParseJson(item.configData) || {};
        setForm({
          apiHost: parsed.apiHost ?? '',
          apiKey: parsed.apiKey ?? '',
          model: parsed.model ?? '',
          temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.7,
          maxTokens: typeof parsed.maxTokens === 'number' ? parsed.maxTokens : 4096,
          contextWindow: typeof parsed.contextWindow === 'number' ? parsed.contextWindow : 8192,
        });
      }
    } catch (e) {
      Toast.error(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await agentApi.saveConfig(
        {
          configKey: 'llm_config',
          configType: 'llm_config',
          title: 'LLM 模型配置',
          configData: JSON.stringify(form),
        },
        true,
      );
      Toast.success('保存成功');
    } catch (e) {
      Toast.error(`保存失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.modelHost')}</Typography.Text>
          <Input
            value={form.apiHost}
            onChange={(v) => setForm({ ...form, apiHost: v })}
            placeholder="https://api.openai.com/v1"
            style={{ marginTop: 6 }}
          />
        </div>
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.modelKey')}</Typography.Text>
          <Input
            value={form.apiKey}
            onChange={(v) => setForm({ ...form, apiKey: v })}
            placeholder="sk-..."
            style={{ marginTop: 6 }}
          />
        </div>
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.modelName')}</Typography.Text>
          <Input
            value={form.model}
            onChange={(v) => setForm({ ...form, model: v })}
            placeholder="gpt-4o / claude-3-opus / ..."
            style={{ marginTop: 6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.modelTemp')}</Typography.Text>
            <Input
              value={String(form.temperature)}
              onChange={(v) => setForm({ ...form, temperature: Number(v) || 0 })}
              style={{ marginTop: 6 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.modelMaxTokens')}</Typography.Text>
            <Input
              value={String(form.maxTokens)}
              onChange={(v) => setForm({ ...form, maxTokens: Number(v) || 0 })}
              style={{ marginTop: 6 }}
            />
          </div>
        </div>
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.modelContextWindow')}</Typography.Text>
          <Input
            value={String(form.contextWindow)}
            onChange={(v) => setForm({ ...form, contextWindow: Number(v) || 0 })}
            style={{ marginTop: 6 }}
          />
        </div>
        <div
          style={{
            padding: 12,
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 8,
            fontSize: 12,
            color: '#d46b08',
          }}
        >
          {t('agent.config.modelNote')}
        </div>
        <div>
          <Button theme="solid" style={{ background: ACCENT }} loading={saving} onClick={handleSave}>
            {t('agent.config.modelSave')}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ================================================================
 * PromptEditorTab — 提示词 & 知识库（VSCode 风格编辑器）
 * ================================================================ */

const PROMPT_EDITOR_BG = '#1e1e2e';
const PROMPT_EDITOR_SIDEBAR_BG = '#252526';
const PROMPT_EDITOR_TEXT = '#cccccc';
const PROMPT_EDITOR_ACTIVE_BG = '#37373d';

const SidebarGroup: React.FC<{
  title: string;
  items: ConfigItem[];
  selectedKey: string;
  onSelect: (item: ConfigItem) => void;
  onCreate?: () => void;
  onRename?: (item: ConfigItem) => void;
  onDelete?: (item: ConfigItem) => void;
}> = ({ title, items, selectedKey, onSelect, onCreate, onRename, onDelete }) => {
  return (
    <div>
      <div
        style={{
          padding: '8px 12px 4px',
          fontSize: 11,
          color: '#888',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>📁 {title}</span>
        {onCreate && (
          <button
            onClick={onCreate}
            title="新建"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 4px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
          >
            +
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '4px 12px 8px 24px', fontSize: 12, color: '#666', fontStyle: 'italic' }}>
          （空）
        </div>
      ) : (
        items.map((item) => {
          const active = item.configKey === selectedKey;
          return (
            <div
              key={item.configKey}
              onClick={() => onSelect(item)}
              title={item.configKey}
              style={{
                padding: '6px 12px 6px 24px',
                fontSize: 13,
                cursor: 'pointer',
                background: active ? PROMPT_EDITOR_ACTIVE_BG : 'transparent',
                color: active ? '#fff' : PROMPT_EDITOR_TEXT,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                borderLeft: active ? '2px solid #4d53e8' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {item.title || item.configKey}
              </span>
              {item.configKey?.endsWith('.en') && (
                <span style={{ fontSize: 9, color: '#4d53e8', flexShrink: 0, marginLeft: 2 }}>
                  EN
                </span>
              )}
              {active && (onRename || onDelete) && (
                <span style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 4 }}>
                  {onRename && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onRename(item); }}
                      title="重命名"
                      style={{
                        background: 'transparent', border: 'none', color: '#888',
                        cursor: 'pointer', fontSize: 11, padding: '0 2px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
                    >
                      ✎
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                      title="删除"
                      style={{
                        background: 'transparent', border: 'none', color: '#888',
                        cursor: 'pointer', fontSize: 11, padding: '0 2px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b6b'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

const PromptEditorTab: React.FC = () => {
  const lang = useLanguage();
  const [loading, setLoading] = useState(false);
  const [promptList, setPromptList] = useState<ConfigItem[]>([]);
  const [knowledgeList, setKnowledgeList] = useState<ConfigItem[]>([]);
  const [ragList, setRagList] = useState<ConfigItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyKey, setHistoryKey] = useState('');
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  // RAG 工具栏状态
  const [aiVisible, setAiVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prompts, knowledge, rags] = await Promise.all([
        agentApi.listConfigs('system_prompt'),
        agentApi.listConfigs('node_knowledge'),
        agentApi.listKnowledge(),
      ]);
      setPromptList(prompts || []);
      setKnowledgeList(knowledge || []);
      // 将 RAG 知识块转换为 ConfigItem 格式以便统一管理
      const ragItems: ConfigItem[] = (rags || []).map((r: any) => ({
        id: r.id,
        configKey: `rag_${r.id}`,
        configType: 'rag_chunk',
        title: r.title,
        content: r.content,
        source: r.source,
        metadata: r.metadata,
        language: r.language || 'zh',
      }));
      setRagList(ragItems);
    } catch (e) {
      Toast.error(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 按当前系统语言过滤：en 显示 .en 后缀的条目，zh 显示无后缀的条目
  const filteredPrompts = useMemo(() => {
    return promptList.filter((item) =>
      lang === 'en' ? item.configKey?.endsWith('.en') : !item.configKey?.endsWith('.en')
    );
  }, [promptList, lang]);

  const filteredKnowledge = useMemo(() => {
    return knowledgeList.filter((item) =>
      lang === 'en' ? item.configKey?.endsWith('.en') : !item.configKey?.endsWith('.en')
    );
  }, [knowledgeList, lang]);

  // RAG 知识块按 language 字段过滤
  const filteredRag = useMemo(() => {
    const langCode = lang === 'en' ? 'en' : 'zh';
    return ragList.filter((item) => (item.language || 'zh') === langCode);
  }, [ragList, lang]);

  // 语言切换时，如果当前选中的条目不属于当前语言，自动选中第一个匹配条目
  useEffect(() => {
    const allFiltered = [...filteredPrompts, ...filteredKnowledge, ...filteredRag];
    if (allFiltered.length === 0) {
      setSelectedKey('');
      setEditContent('');
      return;
    }
    const currentBelongsToLang = allFiltered.some((item) => item.configKey === selectedKey);
    if (!currentBelongsToLang) {
      const first = filteredPrompts[0] || filteredKnowledge[0] || filteredRag[0];
      if (first) {
        setSelectedKey(first.configKey);
        setEditContent(first.content || '');
      }
    }
  }, [lang, filteredPrompts, filteredKnowledge, filteredRag, selectedKey]);

  // 列表加载完成后，自动选中第一个项目
  useEffect(() => {
    if (!selectedKey && (filteredPrompts.length > 0 || filteredKnowledge.length > 0 || filteredRag.length > 0)) {
      const first = filteredPrompts[0] || filteredKnowledge[0] || filteredRag[0];
      if (first) {
        setSelectedKey(first.configKey);
        setEditContent(first.content || '');
      }
    }
  }, [selectedKey, filteredPrompts, filteredKnowledge, filteredRag]);

  const selectedItem = useMemo(() => {
    return [...filteredPrompts, ...filteredKnowledge, ...filteredRag].find((item) => item.configKey === selectedKey);
  }, [filteredPrompts, filteredKnowledge, filteredRag, selectedKey]);

  const handleSelect = useCallback((item: ConfigItem) => {
    setSelectedKey(item.configKey);
    setEditContent(item.content || '');
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      if (selectedItem.configType === 'rag_chunk') {
        // RAG 知识块走 knowledge API
        await agentApi.saveKnowledge({
          id: selectedItem.id,
          title: selectedItem.title || '',
          content: editContent,
          source: selectedItem.source || '',
          metadata: selectedItem.metadata || {},
          language: selectedItem.language || (lang === 'en' ? 'en' : 'zh'),
        });
        Toast.success('保存成功');
      } else {
        await agentApi.saveConfig({
          ...selectedItem,
          content: editContent,
        });
        Toast.success(t('agent.config.savedAsVersion'));
      }
      void load();
    } catch (e) {
      Toast.error(`保存失败: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [selectedItem, editContent, load, lang]);

  const openHistory = useCallback(async () => {
    if (!selectedItem) return;
    setHistoryKey(selectedItem.configKey);
    setHistoryVisible(true);
    setHistoryLoading(true);
    setHistoryList([]);
    try {
      const data = await agentApi.getConfigHistory(selectedItem.configKey);
      setHistoryList(data || []);
    } catch (e) {
      Toast.error(`加载历史失败: ${(e as Error).message}`);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedItem]);

  const handleRevert = useCallback(async (version: number) => {
    try {
      await agentApi.revertConfig(historyKey, version);
      Toast.success(t('agent.config.appliedEffective'));
      setHistoryVisible(false);
      void load();
    } catch (e) {
      Toast.error(`${t('agent.config.applyFailed')}: ${(e as Error).message}`);
    }
  }, [historyKey, load, t]);

  // 新建配置项
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createType, setCreateType] = useState<'system_prompt' | 'node_knowledge' | 'rag_chunk'>('system_prompt');
  const [createForm, setCreateForm] = useState({ configKey: '', title: '', content: '' });

  const openCreate = useCallback((type: 'system_prompt' | 'node_knowledge' | 'rag_chunk') => {
    setCreateType(type);
    setCreateForm({ configKey: '', title: '', content: '' });
    setCreateModalVisible(true);
  }, []);

  const handleCreate = useCallback(async () => {
    if (createType === 'rag_chunk') {
      if (!createForm.title) {
        Toast.warning('请填写标题');
        return;
      }
      try {
        await agentApi.saveKnowledge({
          title: createForm.title,
          content: createForm.content,
          source: 'manual',
          metadata: {},
          language: lang === 'en' ? 'en' : 'zh',
        });
        Toast.success('创建成功');
        setCreateModalVisible(false);
        void load();
      } catch (e) {
        Toast.error(`创建失败: ${(e as Error).message}`);
      }
      return;
    }
    if (!createForm.configKey) {
      Toast.warning('请填写 configKey');
      return;
    }
    try {
      await agentApi.saveConfig({
        configKey: createForm.configKey,
        configType: createType,
        title: createForm.title || createForm.configKey,
        content: createForm.content,
      });
      Toast.success('创建成功');
      setCreateModalVisible(false);
      void load();
      setSelectedKey(createForm.configKey);
    } catch (e) {
      Toast.error(`创建失败: ${(e as Error).message}`);
    }
  }, [createForm, createType, load, lang]);

  // 重命名
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameItem, setRenameItem] = useState<ConfigItem | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const openRename = useCallback((item: ConfigItem) => {
    setRenameItem(item);
    setRenameTitle(item.title || '');
    setRenameVisible(true);
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameItem) return;
    try {
      if (renameItem.configType === 'rag_chunk') {
        await agentApi.saveKnowledge({
          id: renameItem.id,
          title: renameTitle,
          content: renameItem.content,
          source: renameItem.source || '',
          metadata: renameItem.metadata || {},
          language: renameItem.language || (lang === 'en' ? 'en' : 'zh'),
        });
      } else {
        await agentApi.saveConfig(
          {
            ...renameItem,
            title: renameTitle,
          },
          true,
        );
      }
      Toast.success('重命名成功');
      setRenameVisible(false);
      void load();
    } catch (e) {
      Toast.error(`重命名失败: ${(e as Error).message}`);
    }
  }, [renameItem, renameTitle, load, lang]);

  // 删除
  const handleDelete = useCallback((item: ConfigItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除「${item.title || item.configKey}」吗？此操作不可恢复。`,
      onOk: async () => {
        try {
          if (item.configType === 'rag_chunk' && item.id) {
            await agentApi.deleteKnowledge(item.id);
          } else {
            await agentApi.deleteConfig(item.configKey);
          }
          Toast.success('删除成功');
          if (selectedKey === item.configKey) {
            setSelectedKey('');
            setEditContent('');
          }
          void load();
        } catch (e) {
          Toast.error(`删除失败: ${(e as Error).message}`);
        }
      },
    });
  }, [selectedKey, load]);

  const handleEditorScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const lineCount = useMemo(() => Math.max(editContent.split('\n').length, 1), [editContent]);

  // RAG: 重新 Embedding
  const handleReembed = useCallback(async () => {
    Modal.confirm({
      title: '重新 Embedding',
      content: '将对所有 RAG 知识块重新生成向量，可能耗时较长。确认继续？',
      onOk: async () => {
        try {
          await agentApi.reembedAll();
          Toast.success('已触发重新 Embedding');
        } catch (e) {
          Toast.error(`失败: ${(e as Error).message}`);
        }
      },
    });
  }, []);

  // RAG: 检索预览
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      Toast.warning('请输入检索内容');
      return;
    }
    setSearching(true);
    setSearchResults([]);
    try {
      const data = await agentApi.searchKnowledge(searchQuery, 5, lang === 'en' ? 'en' : 'zh');
      setSearchResults(data || []);
    } catch (e) {
      Toast.error(`检索失败: ${(e as Error).message}`);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, lang]);

  const totalCount = promptList.length + knowledgeList.length + ragList.length;

  return (
    <div>
      {/* 顶部工具栏：AI 生成 / 检索预览 / 重新 Embedding / 刷新 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Button theme="solid" style={{ background: ACCENT }} onClick={() => setAiVisible(true)}>
          {t('agent.config.aiGenerate')}
        </Button>
        <Button onClick={() => setSearchVisible(true)}>{t('agent.config.retrievalPreview')}</Button>
        <Button onClick={handleReembed}>{t('agent.config.reembed')}</Button>
        <Button onClick={() => void load()}>{t('agent.config.refresh')}</Button>
        <span style={{ fontSize: 12, color: '#aaa', marginLeft: 'auto' }}>
          {t('agent.config.promptGroup')}: {filteredPrompts.length} / {t('agent.config.knowledgeGroup')}: {filteredKnowledge.length} / {t('agent.config.ragKnowledgeGroup')}: {filteredRag.length}
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : totalCount === 0 ? (
        <div style={{ color: '#999', padding: 24, textAlign: 'center' }}>
          暂无配置项，请先创建 system_prompt、node_knowledge 或 RAG 知识块
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            height: 'calc(100vh - 300px)',
            minHeight: 440,
            border: '1px solid #333',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {/* 左侧文件树 */}
          <div
            style={{
              width: 220,
              background: PROMPT_EDITOR_SIDEBAR_BG,
              color: PROMPT_EDITOR_TEXT,
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <SidebarGroup
              title={t('agent.config.promptGroup')}
              items={filteredPrompts}
              selectedKey={selectedKey}
              onSelect={handleSelect}
              onCreate={() => openCreate('system_prompt')}
              onRename={openRename}
              onDelete={handleDelete}
            />
            <SidebarGroup
              title={t('agent.config.knowledgeGroup')}
              items={filteredKnowledge}
              selectedKey={selectedKey}
              onSelect={handleSelect}
              onCreate={() => openCreate('node_knowledge')}
              onRename={openRename}
              onDelete={handleDelete}
            />
            <SidebarGroup
              title={t('agent.config.ragKnowledgeGroup')}
              items={filteredRag}
              selectedKey={selectedKey}
              onSelect={handleSelect}
              onCreate={() => openCreate('rag_chunk')}
              onRename={openRename}
              onDelete={handleDelete}
            />
          </div>

          {/* 右侧编辑器 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: PROMPT_EDITOR_BG,
              minWidth: 0,
            }}
          >
            {/* 顶部条 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid #333',
                background: PROMPT_EDITOR_SIDEBAR_BG,
                gap: 8,
              }}
            >
              <span style={{ color: PROMPT_EDITOR_TEXT, fontSize: 13, fontWeight: 500 }}>
                {selectedItem?.title || selectedItem?.configKey || '—'}
              </span>
              {selectedItem?.configType && (
                <Tag size="small" color="blue">
                  {selectedItem.configType}
                </Tag>
              )}
              {/* 语言标识（跟随系统语言，无需手动切换） */}
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  color: '#888',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                {lang === 'en' ? 'en-US' : 'zh-CN'}
              </span>
              <Button
                theme="solid"
                size="small"
                style={{ background: ACCENT }}
                loading={saving}
                onClick={handleSave}
                disabled={!selectedItem}
              >
                {t('agent.config.save')}
              </Button>
            </div>

            {/* 编辑器主体 */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* 行号 */}
              <div
                ref={lineNumbersRef}
                style={{
                  padding: '12px 8px',
                  color: '#6e7681',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: '1.5',
                  textAlign: 'right',
                  userSelect: 'none',
                  background: PROMPT_EDITOR_BG,
                  overflow: 'hidden',
                  whiteSpace: 'pre',
                  minWidth: 48,
                }}
              >
                {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
              </div>
              {/* 文本编辑区 */}
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onScroll={handleEditorScroll}
                spellCheck={false}
                style={{
                  flex: 1,
                  background: PROMPT_EDITOR_BG,
                  color: '#d4d4d4',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: '1.5',
                  overflow: 'auto',
                }}
              />
            </div>

            {/* 底部操作栏 */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 12px',
                borderTop: '1px solid #333',
                background: PROMPT_EDITOR_SIDEBAR_BG,
              }}
            >
              <Button
                theme="solid"
                style={{ background: ACCENT }}
                loading={saving}
                onClick={handleSave}
                disabled={!selectedItem}
              >
                {t('agent.config.save')}
              </Button>
              <Button onClick={openHistory} disabled={!selectedItem}>
                {t('agent.config.history')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 版本管理 modal */}
      <Modal
        title={`${t('agent.config.versionManage')} — ${historyKey}`}
        visible={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={680}
      >
        <Typography.Text type="tertiary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          {t('agent.config.versionManageTip')}
        </Typography.Text>
        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : historyList.length === 0 ? (
          <div style={{ color: '#999', padding: 16, textAlign: 'center' }}>{t('agent.config.noHistory')}</div>
        ) : (
          <Table
            columns={[
              { title: t('agent.config.versionCol'), dataIndex: 'version', key: 'version', width: 80 },
              { title: t('common.title'), dataIndex: 'title', key: 'title', width: 160 },
              {
                title: t('agent.config.createdAt'),
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 170,
                render: (text: string) => formatDateTime(text),
              },
              {
                title: t('common.action'),
                key: 'action',
                width: 130,
                render: (_t: any, record: any) => (
                  <Button
                    size="small"
                    theme="borderless"
                    style={{ color: ACCENT }}
                    onClick={() => handleRevert(record.version)}
                  >
                    {t('agent.config.applyEffective')}
                  </Button>
                ),
              },
            ]}
            dataSource={historyList}
            rowKey="version"
            pagination={false}
          />
        )}
      </Modal>

      {/* 新建配置项 modal */}
      <Modal
        title={`新建 — ${createType === 'system_prompt' ? '系统提示词' : createType === 'node_knowledge' ? '节点知识库' : 'RAG 知识块'}`}
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {createType !== 'rag_chunk' && (
            <div>
              <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.configKey')}</Typography.Text>
              <Input
                value={createForm.configKey}
                onChange={(v) => setCreateForm({ ...createForm, configKey: v })}
                placeholder={createType === 'system_prompt' ? '如 system_prompt.custom' : '如 node_custom'}
                style={{ marginTop: 6 }}
              />
            </div>
          )}
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('common.title')}</Typography.Text>
            <Input
              value={createForm.title}
              onChange={(v) => setCreateForm({ ...createForm, title: v })}
              placeholder="显示名称"
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('common.content')}</Typography.Text>
            <TextArea
              value={createForm.content}
              onChange={(v) => setCreateForm({ ...createForm, content: v })}
              autosize={{ minRows: 4, maxRows: 12 }}
              placeholder="提示词或知识文档内容…"
              style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setCreateModalVisible(false)}>{t('common.cancel')}</Button>
            <Button theme="solid" style={{ background: ACCENT }} onClick={handleCreate}>
              创建
            </Button>
          </div>
        </div>
      </Modal>

      {/* 重命名 modal */}
      <Modal
        title="重命名"
        visible={renameVisible}
        onCancel={() => setRenameVisible(false)}
        footer={null}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              {renameItem?.configType === 'rag_chunk' ? t('common.title') : 'ConfigKey'}
            </Typography.Text>
            <Input
              value={renameItem?.configType === 'rag_chunk' ? (renameItem?.title || '') : (renameItem?.configKey || '')}
              disabled
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>{t('agent.config.newTitle')}</Typography.Text>
            <Input
              value={renameTitle}
              onChange={(v) => setRenameTitle(v)}
              style={{ marginTop: 6 }}
              onEnterPress={() => void handleRename()}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setRenameVisible(false)}>{t('common.cancel')}</Button>
            <Button theme="solid" style={{ background: ACCENT }} onClick={handleRename}>
              确认
            </Button>
          </div>
        </div>
      </Modal>

      {/* AI 生成 modal */}
      <AiGenModal
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        defaultPrompt="请生成一段 Agent 知识库文档内容，用于辅助工作流编辑器中的用户。内容应清晰、结构化，涵盖常见场景与最佳实践。"
        onApply={(content) => {
          // 生成完成后，打开新建 RAG 知识块弹窗并预填内容
          setCreateType('rag_chunk');
          setCreateForm({ configKey: '', title: '', content });
          setCreateModalVisible(true);
        }}
      />

      {/* 检索预览 modal */}
      <Modal
        title="检索预览"
        visible={searchVisible}
        onCancel={() => setSearchVisible(false)}
        footer={null}
        width={720}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            value={searchQuery}
            onChange={(v) => setSearchQuery(v)}
            placeholder="输入检索内容…"
            style={{ flex: 1 }}
            onEnterPress={() => void handleSearch()}
          />
          <Button theme="solid" style={{ background: ACCENT }} loading={searching} onClick={() => void handleSearch()}>
            检索
          </Button>
        </div>
        {searching ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : searchResults.length === 0 ? (
          <div style={{ color: '#999', padding: 16, textAlign: 'center' }}>{t('agent.config.noResult')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {searchResults.map((r, idx) => (
              <div
                key={r.id ?? idx}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.title || `#${idx + 1}`}</span>
                  {r.score !== undefined && (
                    <Tag color="blue" size="small">score: {Number(r.score).toFixed(3)}</Tag>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666', whiteSpace: 'pre-wrap' }}>
                  {(r.content || '').slice(0, 300)}
                  {(r.content || '').length > 300 ? '…' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ================================================================
 * Main page
 * ================================================================ */

export const AgentConfigManagement: React.FC = () => {
  useLanguage();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const text = await agentApi.exportConfig();
      // 触发浏览器下载
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      a.download = `agent-config-export-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Toast.success('导出成功');
    } catch (e) {
      Toast.error(`导出失败: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 重置 input 以便相同文件可再次选择
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      // 简单校验是否为合法 JSON
      try {
        JSON.parse(text);
      } catch {
        Toast.error('文件不是合法的 JSON');
        return;
      }
      const result = await agentApi.importConfig(text);
      const parts: string[] = [];
      if (result && typeof result === 'object') {
        for (const [k, v] of Object.entries(result)) {
          parts.push(`${k}: ${v}`);
        }
      }
      Toast.success(`导入成功${parts.length ? `（${parts.join('，')}）` : ''}`);
    } catch (e) {
      Toast.error(`导入失败: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  }, []);

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, minHeight: 'calc(100vh - 120px)' }}>
      {/* 顶部工具栏：导出 / 导入 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <Button loading={exporting} onClick={() => void handleExport()}>
          {t('agent.config.export')}
        </Button>
        <Button theme="solid" style={{ background: ACCENT }} loading={importing} onClick={handleImportClick}>
          {t('agent.config.import')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => void handleFileChange(e)}
        />
      </div>

      <Tabs type="line">
        <TabPane tab={t('agent.config.tabModel')} itemKey="model">
          <ModelConfigTab />
        </TabPane>
        <TabPane tab={t('agent.config.tabPrompt')} itemKey="prompts">
          <PromptEditorTab />
        </TabPane>
        <TabPane tab={t('agent.config.tabGraph')} itemKey="graph">
          <KnowledgeGraphTab />
        </TabPane>
        <TabPane tab={t('agent.config.tabTools')} itemKey="tools">
          <ToolDefinitionTab />
        </TabPane>
        <TabPane tab={t('agent.config.tabPermission')} itemKey="permission">
          <PermissionTab />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AgentConfigManagement;
