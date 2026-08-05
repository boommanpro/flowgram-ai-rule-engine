/**
 * Gaia Workflow Editor & Viewer
 * Based on flowgram.ai free-layout editor
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  useClientContext,
} from '@flowgram.ai/free-layout-editor';
import { Dropdown, Button as SemiButton } from '@douyinfe/semi-ui';
import { IconChevronDown, IconPlus, IconHistory } from '@douyinfe/semi-icons';

import '@flowgram.ai/free-layout-editor/index.css';
import './index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';
import { DemoTools } from './components/tools';
import { workflowApi, GaiaWorkflowVersion, GaiaWorkflowTemplate } from './services/workflow-api';
import { useLanguage, t } from './i18n';
import { LanguageToggle } from './components/language-toggle';
import { EditorCanvasBridge } from './agent';

const ACCENT = '#4d53e8';

/**
 * 空工作流的默认数据：包含 Start → End 节点链路
 * Defense 3: 默认提供 Start/End 唯一节点，确保工作流始终有合法的起止节点
 */
const emptyWorkflowData = {
  nodes: [
    {
      id: 'start_0',
      type: 'start',
      meta: { position: { x: 200, y: 200 } },
      data: {
        title: 'Start',
        outputs: { type: 'object', properties: {} },
      },
    },
    {
      id: 'end_0',
      type: 'end',
      meta: { position: { x: 500, y: 200 } },
      data: {
        title: 'End',
        inputsValues: {},
        inputs: { type: 'object', properties: {} },
      },
    },
  ],
  edges: [
    {
      sourceNodeID: 'start_0',
      targetNodeID: 'end_0',
    },
  ],
};

// Editor component that loads workflow data from backend when workflowCode is provided
export const Editor = () => {
  const { workflowCode } = useParams<{ workflowCode: string }>();
  const navigate = useNavigate();
  useLanguage();
  const [workflowData, setWorkflowData] = useState<any>(
    workflowCode ? emptyWorkflowData : initialData
  );
  const [loading, setLoading] = useState(!!workflowCode);
  const [workflowInfo, setWorkflowInfo] = useState<any>(null);
  const [versions, setVersions] = useState<GaiaWorkflowVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<number | undefined>();
  const [remountKey, setRemountKey] = useState(0);

  const loadVersions = useCallback(async (code: string) => {
    try {
      const vList = await workflowApi.listVersions(code);
      setVersions(vList || []);
      const current = vList?.find((v: any) => v.isCurrent === 1);
      if (current) {
        setCurrentVersionId(current.id);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!workflowCode) return;

    setLoading(true);
    workflowApi.getWorkflowByCode(workflowCode).then(async (workflow) => {
      if (!workflow) {
        setLoading(false);
        return;
      }
      setWorkflowInfo(workflow);

      let versionData: any = null;

      if (workflow.currentVersionId) {
        try {
          const version = await workflowApi.getVersionById(workflow.currentVersionId);
          if (version && version.workflowData) {
            versionData = version;
          }
        } catch { /* ignore */ }
      }

      if (!versionData) {
        try {
          const versions = await workflowApi.listVersions(workflowCode);
          if (versions && versions.length > 0) {
            versionData = versions.find((v: any) => v.isCurrent === 1) || versions[0];
          }
        } catch { /* ignore */ }
      }

      if (versionData && versionData.workflowData) {
        try {
          const parsed = typeof versionData.workflowData === 'string'
            ? JSON.parse(versionData.workflowData)
            : versionData.workflowData;
          setWorkflowData(parsed);
          setCurrentVersionId(versionData.id);
        } catch {
          setWorkflowData(emptyWorkflowData);
        }
      } else {
        setWorkflowData(emptyWorkflowData);
      }
      setLoading(false);

      // Load version list
      loadVersions(workflowCode);
    }).catch(() => setLoading(false));
  }, [workflowCode, loadVersions]);

  const handleSwitchVersion = useCallback(async (versionId: number) => {
    try {
      const version = await workflowApi.getVersionById(versionId);
      if (version && version.workflowData) {
        const parsed = typeof version.workflowData === 'string'
          ? JSON.parse(version.workflowData)
          : version.workflowData;
        setWorkflowData(parsed);
        setCurrentVersionId(versionId);
        setRemountKey(k => k + 1); // Force remount to reload editor
      }
    } catch (error) {
      console.error('Failed to switch version:', error);
    }
  }, []);

  const editorProps = useEditorProps(workflowData, nodeRegistries);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>{t('editor.loadingWorkflow')}</div>
      </div>
    );
  }

  return (
    <FreeLayoutEditorProvider {...editorProps} key={remountKey}>
      <EditorCanvasBridge />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <EditorHeader
          workflowCode={workflowCode}
          workflowName={workflowInfo ? workflowInfo.workflowName : t('editor.newWorkflow')}
          onBack={() => navigate('/admin/workflows')}
          versions={versions}
          currentVersionId={currentVersionId}
          onSwitchVersion={handleSwitchVersion}
          onVersionsChanged={() => workflowCode && loadVersions(workflowCode)}
        />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div className="demo-container" style={{ width: '100%', height: '100%' }}>
            <EditorRenderer className="demo-editor" />
          </div>
          <DemoTools hideSave />
        </div>
      </div>
    </FreeLayoutEditorProvider>
  );
};

/**
 * 可交互工作流预览组件（用于首页嵌入）
 * 可拖拽平移/缩放、可新增节点，但不可运行（隐藏 Test Run / Save）
 * 无边框、无标题、无 Read-only 标签
 */
export const WorkflowViewer = ({
  data,
  height = 480,
}: {
  data: any;
  height?: number | string;
}) => {
  // readonly=false：允许拖拽节点与新增节点；通过 DemoTools 隐藏运行/保存按钮
  const editorProps = useEditorProps(data || initialData, nodeRegistries, false);

  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <div style={{
        height: typeof height === 'number' ? `${height}px` : height,
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
      }}>
        <EditorRenderer className="demo-editor" />
        {/* 可新增节点等工具，但隐藏 Save 与 Test Run（不可运行） */}
        <DemoTools hideSaveAndTestRun hideSave />
      </div>
    </FreeLayoutEditorProvider>
  );
};

// Header with back button, version selector, and save button
// Transparent white minimalist style
const EditorHeader = ({
  workflowCode,
  workflowName,
  onBack,
  versions,
  currentVersionId,
  onSwitchVersion,
  onVersionsChanged,
}: {
  workflowCode?: string;
  workflowName: string;
  onBack: () => void;
  versions: GaiaWorkflowVersion[];
  currentVersionId?: number;
  onSwitchVersion: (versionId: number) => void;
  onVersionsChanged: () => void;
}) => {
  const ctx = useClientContext();
  useLanguage();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  const currentVersion = versions.find(v => v.id === currentVersionId);

  const handleSave = async () => {
    if (!ctx?.document) return;
    setSaving(true);
    try {
      const jsonData = ctx.document.toJSON();
      const dataStr = JSON.stringify(jsonData);

      if (workflowCode) {
        const allVersions = await workflowApi.listVersions(workflowCode);

        if (allVersions && allVersions.length > 0) {
          const currentVer = allVersions.find((v: any) => v.isCurrent === 1) || allVersions[0];
          await workflowApi.updateVersion({
            ...currentVer,
            workflowData: dataStr,
          });
        } else {
          await workflowApi.createVersion({
            workflowCode,
            versionNumber: 'v1.0',
            versionDesc: 'Initial version',
            workflowData: dataStr,
            createdBy: 'user',
          });
          const newVersions = await workflowApi.listVersions(workflowCode);
          if (newVersions && newVersions.length > 0) {
            const newest = newVersions[0];
            await workflowApi.setCurrentVersion(newest.id!);
          }
        }
        onVersionsChanged();
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
      alert(t('editor.saveFailed') + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsNewVersion = async () => {
    if (!ctx?.document || !workflowCode) return;
    setSaving(true);
    try {
      const jsonData = ctx.document.toJSON();
      const dataStr = JSON.stringify(jsonData);
      const versionCount = versions.length + 1;
      const newVersionNumber = `v1.${versionCount}`;

      await workflowApi.createVersion({
        workflowCode,
        versionNumber: newVersionNumber,
        versionDesc: `Version ${newVersionNumber}`,
        workflowData: dataStr,
        createdBy: 'user',
      });

      // Set as current version
      const newVersions = await workflowApi.listVersions(workflowCode);
      if (newVersions && newVersions.length > 0) {
        const newest = newVersions[0];
        await workflowApi.setCurrentVersion(newest.id!);
      }

      onVersionsChanged();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Save as new version failed:', error);
      alert(t('editor.saveAsVersionFailed') + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '52px',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e8e8ea',
      flexShrink: 0,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid #e0e0e6',
            color: '#333',
            padding: '5px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f7'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {t('editor.back')}
        </button>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>{workflowName}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Version dropdown */}
        {workflowCode && versions.length > 0 && (
          <Dropdown
            visible={showVersionDropdown}
            onVisibleChange={setShowVersionDropdown}
            position="bottomRight"
            render={
              <div style={{
                background: '#fff',
                border: '1px solid #e8e8ea',
                borderRadius: '8px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                padding: '6px',
                minWidth: '240px',
                maxHeight: '360px',
                overflowY: 'auto',
              }}>
                {/* New Version button */}
                <button
                  onClick={() => { handleSaveAsNewVersion(); setShowVersionDropdown(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: ACCENT,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    borderRadius: '6px',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <IconPlus size="small" />
                  {t('editor.saveAsNewVersion')}
                </button>

                {versions.length > 0 && (
                  <div style={{ borderTop: '1px solid #f0f0f0', margin: '4px 0' }} />
                )}

                {/* Version list */}
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { onSwitchVersion(v.id!); setShowVersionDropdown(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: v.id === currentVersionId ? '#f0f0ff' : 'transparent',
                      color: '#1a1a1a',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { if (v.id !== currentVersionId) e.currentTarget.style.background = '#f5f5f7'; }}
                    onMouseLeave={(e) => { if (v.id !== currentVersionId) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{v.versionNumber}</span>
                      {v.id === currentVersionId && (
                        <span style={{
                          fontSize: '10px',
                          color: ACCENT,
                          background: '#f0f0ff',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}>{t('editor.current')}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: '#999' }}>{formatDate(v.createdAt)}</span>
                  </button>
                ))}
              </div>
            }
          >
            <SemiButton
              theme="borderless"
              icon={<IconHistory />}
              style={{ fontSize: '13px', color: '#555', height: '32px' }}
            >
              {currentVersion ? currentVersion.versionNumber : t('editor.version')}
              <IconChevronDown size="small" style={{ marginLeft: '4px' }} />
            </SemiButton>
          </Dropdown>
        )}

        <LanguageToggle />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saving ? '#c5c5e8' : ACCENT,
            border: 'none',
            color: '#fff',
            padding: '7px 22px',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          {saving ? t('Saving') : saved ? `✓ ${t('Saved')}` : t('Save')}
        </button>
      </div>
    </div>
  );
};

/**
 * 模板编辑器 — 可视化编辑工作流模板数据
 * 加载模板 → 编辑 → 保存更新模板数据
 */
export const TemplateEditor = () => {
  const { templateCode } = useParams<{ templateCode: string }>();
  const navigate = useNavigate();
  useLanguage();
  const [templateData, setTemplateData] = useState<any>(initialData);
  const [templateInfo, setTemplateInfo] = useState<GaiaWorkflowTemplate | null>(null);
  const [loading, setLoading] = useState(!!templateCode);

  useEffect(() => {
    if (!templateCode) return;
    setLoading(true);
    workflowApi.listTemplates().then((list) => {
      const tpl = list?.find((t) => t.templateCode === templateCode);
      if (!tpl) {
        setLoading(false);
        return;
      }
      setTemplateInfo(tpl);
      if (tpl.templateData) {
        try {
          const parsed = typeof tpl.templateData === 'string'
            ? JSON.parse(tpl.templateData)
            : tpl.templateData;
          setTemplateData(parsed);
        } catch {
          setTemplateData(initialData);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [templateCode]);

  const editorProps = useEditorProps(templateData, nodeRegistries);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontSize: '18px', color: '#666' }}>{t('editor.loadingTemplate')}</div>
      </div>
    );
  }

  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <EditorCanvasBridge />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <TemplateEditorHeader
          templateInfo={templateInfo}
          onBack={() => navigate('/admin/templates')}
        />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div className="demo-container" style={{ width: '100%', height: '100%' }}>
            <EditorRenderer className="demo-editor" />
          </div>
          <DemoTools hideSaveAndTestRun hideSave />
        </div>
      </div>
    </FreeLayoutEditorProvider>
  );
};

const TemplateEditorHeader = ({
  templateInfo,
  onBack,
}: {
  templateInfo: GaiaWorkflowTemplate | null;
  onBack: () => void;
}) => {
  const ctx = useClientContext();
  useLanguage();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!ctx?.document || !templateInfo) return;
    setSaving(true);
    try {
      const jsonData = ctx.document.toJSON();
      const dataStr = JSON.stringify(jsonData);
      await workflowApi.updateTemplate({
        id: templateInfo.id,
        templateCode: templateInfo.templateCode,
        templateName: templateInfo.templateName,
        templateDesc: templateInfo.templateDesc,
        templateData: dataStr,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
      alert(t('editor.saveFailed') + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '52px',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e8e8ea',
      flexShrink: 0,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: '1px solid #e0e0e6',
            color: '#333',
            padding: '5px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f7'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {t('editor.back')}
        </button>
        <span style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a1a' }}>
          {templateInfo?.templateName || t('editor.template')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <LanguageToggle />
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saving ? '#c5c5e8' : ACCENT,
            border: 'none',
            color: '#fff',
            padding: '7px 22px',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          {saving ? t('Saving') : saved ? `✓ ${t('Saved')}` : t('Save')}
        </button>
      </div>
    </div>
  );
};
