/**
 * WorkflowManagement — 工作流管理页面
 * 表格展示工作流列表，支持搜索、新建、编辑、删除、跳转编辑器
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workflowApi, type GaiaWorkflow, type GaiaWorkflowTemplate } from '../../services/workflow-api';
import type { CSSProperties } from 'react';
import { useLanguage, t } from '../../i18n';

const ACCENT = '#4d53e8';

interface WorkflowForm {
  workflowName: string;
  workflowCode: string;
  workflowDesc: string;
  templateCode: string;
}

const EMPTY_FORM: WorkflowForm = {
  workflowName: '',
  workflowCode: '',
  workflowDesc: '',
  templateCode: '',
};

/* ---------------- Helpers ---------------- */

const formatDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ---------------- Component ---------------- */

export const WorkflowManagement = () => {
  const navigate = useNavigate();
  useLanguage();
  const [workflows, setWorkflows] = useState<GaiaWorkflow[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<GaiaWorkflow | null>(null);
  const [workflowForm, setWorkflowForm] = useState<WorkflowForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState<GaiaWorkflowTemplate[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const wfList = await workflowApi.listWorkflows();
      setWorkflows(wfList || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredWorkflows = workflows.filter((wf) => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return true;
    return (
      (wf.workflowName || '').toLowerCase().includes(kw) ||
      (wf.workflowCode || '').toLowerCase().includes(kw)
    );
  });

  const openCreateModal = async () => {
    setEditingWorkflow(null);
    setWorkflowForm(EMPTY_FORM);
    setShowCreateModal(true);
    // 加载模板列表供下拉选择
    if (templates.length === 0) {
      try {
        const list = await workflowApi.listTemplates();
        setTemplates(list || []);
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    }
  };

  const openEditModal = (wf: GaiaWorkflow) => {
    setEditingWorkflow(wf);
    setWorkflowForm({
      workflowName: wf.workflowName || '',
      workflowCode: wf.workflowCode || '',
      workflowDesc: wf.workflowDesc || '',
      templateCode: '',
    });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingWorkflow(null);
    setWorkflowForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!workflowForm.workflowName.trim() || !workflowForm.workflowCode.trim()) {
      alert(t('admin.validate.nameAndCode'));
      return;
    }
    setSubmitting(true);
    try {
      if (editingWorkflow) {
        await workflowApi.updateWorkflow({
          id: editingWorkflow.id,
          workflowCode: editingWorkflow.workflowCode,
          workflowName: workflowForm.workflowName.trim(),
          workflowDesc: workflowForm.workflowDesc.trim(),
        });
      } else {
        await workflowApi.createWorkflow({
          workflowName: workflowForm.workflowName.trim(),
          workflowCode: workflowForm.workflowCode.trim(),
          workflowDesc: workflowForm.workflowDesc.trim(),
          templateCode: workflowForm.templateCode || undefined,
        });
      }
      closeModal();
      await loadData();
    } catch (err) {
      console.error('Submit failed:', err);
      alert(t('admin.saveFailed') + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (wf: GaiaWorkflow) => {
    if (wf.id == null) return;
    if (!confirm(t('admin.deleteWorkflow.confirm', { name: wf.workflowName }))) return;
    try {
      await workflowApi.deleteWorkflow(wf.id);
      await loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(t('admin.deleteFailed') + (err as Error).message);
    }
  };

  const handleOpenEditor = (wf: GaiaWorkflow) => {
    navigate(`/editor/${wf.workflowCode}`);
  };

  return (
    <div style={{ color: '#1a1a1a' }}>
      {/* ---------- Toolbar ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <input
          type="text"
          placeholder={t('admin.search.workflows')}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          style={searchInputStyle}
        />
        <button
          onClick={openCreateModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: ACCENT,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.18s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {t('admin.createWorkflow')}
        </button>
      </div>

      {/* ---------- Table card ---------- */}
      <div style={tableCardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {[
                t('admin.workflow.name'),
                t('admin.workflow.code'),
                t('admin.workflow.desc'),
                t('admin.workflow.createdAt'),
                t('admin.workflow.actions'),
              ].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={emptyTdStyle}>{t('Loading')}</td>
              </tr>
            ) : filteredWorkflows.length === 0 ? (
              <tr>
                <td colSpan={5} style={emptyTdStyle}>{t('admin.noData')}</td>
              </tr>
            ) : (
              filteredWorkflows.map((wf) => (
                <tr key={wf.id ?? wf.workflowCode} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={tdStyle}>{wf.workflowName}</td>
                  <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, color: '#666' }}>{wf.workflowCode}</td>
                  <td style={{ ...tdStyle, color: '#666', maxWidth: 220 }}>{wf.workflowDesc || '—'}</td>
                  <td style={{ ...tdStyle, color: '#666', whiteSpace: 'nowrap' }}>{formatDateTime(wf.createdAt)}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEditModal(wf)} style={actionBtnBlueStyle}>{t('Edit')}</button>
                    <button onClick={() => handleOpenEditor(wf)} style={actionBtnPurpleStyle}>{t('admin.openEditor')}</button>
                    <button onClick={() => handleDelete(wf)} style={actionBtnRedStyle}>{t('Delete')}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Modal ---------- */}
      {showCreateModal && (
        <div onClick={closeModal} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalCardStyle}>
            <h2 style={{ margin: '0 0 22px 0', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {editingWorkflow ? t('admin.modal.editWorkflow') : t('admin.modal.createWorkflow')}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t('admin.modal.workflowName')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={workflowForm.workflowName}
                onChange={(e) => setWorkflowForm({ ...workflowForm, workflowName: e.target.value })}
                style={inputStyle}
                placeholder={t('admin.modal.placeholder.name')}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t('admin.modal.workflowCode')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={workflowForm.workflowCode}
                onChange={(e) => setWorkflowForm({ ...workflowForm, workflowCode: e.target.value })}
                style={editingWorkflow ? { ...inputStyle, background: '#f5f5f7', color: '#999', cursor: 'not-allowed' } : inputStyle}
                placeholder={t('admin.modal.placeholder.code')}
                disabled={!!editingWorkflow}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>{t('admin.modal.workflowDesc')}</label>
              <textarea
                value={workflowForm.workflowDesc}
                onChange={(e) => setWorkflowForm({ ...workflowForm, workflowDesc: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                placeholder={t('admin.modal.placeholder.desc')}
                rows={3}
              />
            </div>

            {!editingWorkflow && (
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabelStyle}>{t('admin.modal.template')}</label>
                <select
                  value={workflowForm.templateCode}
                  onChange={(e) => setWorkflowForm({ ...workflowForm, templateCode: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">{t('admin.modal.placeholder.template')}</option>
                  {templates.map((tpl) => (
                    <option key={tpl.templateCode} value={tpl.templateCode}>
                      {tpl.templateName} ({tpl.templateCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={closeModal} style={cancelBtnStyle}>{t('Cancel')}</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ ...submitBtnStyle, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? t('Submitting') : t('Submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowManagement;

/* ---------------- Styles ---------------- */

const searchInputStyle: CSSProperties = {
  flex: 1,
  maxWidth: 360,
  padding: '9px 14px',
  background: '#ffffff',
  border: '1px solid #e8e8ea',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.18s ease',
};

const tableCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
  overflow: 'hidden',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 600,
  color: '#666',
  background: '#fafafa',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '14px 16px',
  fontSize: 14,
  verticalAlign: 'middle',
};

const emptyTdStyle: CSSProperties = {
  padding: '48px 16px',
  textAlign: 'center',
  color: '#999',
  fontSize: 14,
};

const actionBtnBase: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '4px 8px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  marginRight: 4,
};

const actionBtnBlueStyle: CSSProperties = { ...actionBtnBase, color: '#2563eb' };
const actionBtnPurpleStyle: CSSProperties = { ...actionBtnBase, color: ACCENT };
const actionBtnRedStyle: CSSProperties = { ...actionBtnBase, color: '#ef4444', marginRight: 0 };

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(20,20,20,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 24,
};

const modalCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  padding: 28,
  width: 480,
  maxWidth: '100%',
  boxShadow: '0 20px 50px -15px rgba(0,0,0,0.25)',
  boxSizing: 'border-box',
};

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 7,
  fontSize: 13,
  fontWeight: 600,
  color: '#1a1a1a',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: '#fafafa',
  border: '1px solid #e8e8ea',
  borderRadius: 8,
  fontSize: 14,
  color: '#1a1a1a',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const cancelBtnStyle: CSSProperties = {
  padding: '9px 20px',
  borderRadius: 8,
  border: '1px solid #e8e8ea',
  background: '#ffffff',
  color: '#1a1a1a',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

const submitBtnStyle: CSSProperties = {
  padding: '9px 24px',
  borderRadius: 8,
  border: 'none',
  background: ACCENT,
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
