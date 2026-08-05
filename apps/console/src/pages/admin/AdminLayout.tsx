/**
 * AdminLayout — 管理后台布局
 * 左侧固定侧边栏 + 右侧主内容区（顶部 header bar + Outlet）
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Modal, Input, Button as SemiButton } from '@douyinfe/semi-ui';
import { workflowApi } from '../../services/workflow-api';
import { getApiBaseUrl, updateApiBaseUrl } from '../../utils/apiConfig';
import { publicPath } from '../../utils/public-path';
import { useLanguage, t } from '../../i18n';
import { LanguageToggle } from '../../components/language-toggle';

const ACCENT = '#4d53e8';

/* ---------------- Inline SVG icons ---------------- */

const IconWorkflow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="13" width="7" height="8" rx="1.5" />
    <path d="M10 6.5h4M10 6.5a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2" />
  </svg>
);

const IconTemplate = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 9v12" />
  </svg>
);

const IconConfig = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconBackHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

/* ---------------- Page title map ---------------- */

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/admin/workflows': 'admin.workflows',
  '/admin/templates': 'admin.templates',
  '/admin/agent-config': 'Agent 配置中心',
};

const getPageTitle = (pathname: string): string => {
  const key = PAGE_TITLE_KEYS[pathname];
  if (key) {
    // i18n keys use the t() helper; the agent-config entry is a literal string.
    if (key.startsWith('admin.')) return t(key);
    return key;
  }
  if (pathname.startsWith('/admin/workflows')) return t('admin.workflows');
  if (pathname.startsWith('/admin/templates')) return t('admin.templates');
  if (pathname.startsWith('/admin/agent-config')) return 'Agent 配置中心';
  return t('admin.title.default');
};

/* ---------------- Layout component ---------------- */

export const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // 订阅语言切换，语言变化时触发重渲染
  useLanguage();
  const pageTitle = getPageTitle(location.pathname);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    workflowApi.health().then(() => setChecking(false)).catch(() => {
      // 后端未连接，自动弹窗让用户配置服务端地址
      setChecking(false);
      setServerUrl(getApiBaseUrl());
      setShowServerConfig(true);
    });
  }, []);

  const navLinkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: isActive ? ACCENT : '#1a1a1a',
    background: isActive ? '#f0f0ff' : 'transparent',
    textDecoration: 'none',
    transition: 'background 0.18s ease, color 0.18s ease',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: '#1a1a1a' }}>
      {/* ---------- Sidebar ---------- */}
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: '#ffffff',
          borderRight: '1px solid #e8e8ea',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: 'auto',
        }}
      >
        {/* Logo area — click to go home */}
        <div
          style={{ padding: '24px 20px 20px 20px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
          onClick={() => navigate('/')}
          title={t('admin.returnHome')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={publicPath('logo.svg')} alt="Gaia" style={{ width: 48, height: 48 }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em' }}>Gaia</span>
              <span style={{ fontSize: 11.5, color: '#999', marginTop: 2 }}>{t('admin.layout.title')}</span>
            </div>
          </div>
        </div>

        {/* Nav menu */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/admin/workflows" style={navLinkStyle}>
            <IconWorkflow />
            <span>{t('admin.workflows')}</span>
          </NavLink>
          <NavLink to="/admin/templates" style={navLinkStyle}>
            <IconTemplate />
            <span>{t('admin.templates')}</span>
          </NavLink>
          <NavLink to="/admin/agent-config" style={navLinkStyle}>
            <IconConfig />
            <span>Agent 配置</span>
          </NavLink>
        </nav>

        {/* Sidebar footer: language toggle + return home */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid #e8e8ea',
              borderRadius: 6,
              fontSize: 13,
              color: '#555',
              cursor: 'pointer',
            }}
            title={t('admin.returnHome')}
          >
            <IconBackHome />
            <span>{t('admin.returnHome')}</span>
          </button>
          <LanguageToggle />
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header bar */}
        <header
          style={{
            height: 56,
            flexShrink: 0,
            background: '#ffffff',
            borderBottom: '1px solid #e8e8ea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: '#1a1a1a' }}>
            {pageTitle}
          </h1>
        </header>

        {/* Content area */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#f5f5f7',
            padding: 24,
          }}
        >
          {checking ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', fontSize: 15 }}>
              {t('admin.connecting')}
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* 后端未连接时弹窗配置服务端地址 */}
      <Modal
        title={t('serverConfig.title')}
        visible={showServerConfig}
        closable={false}
        maskClosable={false}
        footer={null}
        width={480}
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 1.6 }}>
            {t('serverConfig.desc')}
          </p>
          <Input
            value={serverUrl}
            onChange={(v) => setServerUrl(v)}
            placeholder="http://127.0.0.1:48080/api"
            style={{ width: '100%', marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <SemiButton
              onClick={() => {
                setShowServerConfig(false);
                navigate('/');
              }}
              style={{ borderRadius: 6 }}
            >
              {t('serverConfig.returnHome')}
            </SemiButton>
            <SemiButton
              theme="solid"
              style={{ background: ACCENT, borderRadius: 6 }}
              onClick={() => {
                if (serverUrl.trim()) {
                  updateApiBaseUrl(serverUrl.trim());
                  window.location.reload();
                }
              }}
            >
              {t('serverConfig.saveReconnect')}
            </SemiButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminLayout;
