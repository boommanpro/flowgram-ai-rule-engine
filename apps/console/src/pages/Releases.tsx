/**
 * Gaia 盖亚 — Release Log Page
 * 独立发布日志页面，具备 Home / Release Log 导航
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicPath } from '../utils/public-path';

type Lang = 'en' | 'zh';

const ACCENT = '#4d53e8';
const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

const releasesItems = [
  {
    date: '2026.08.07',
    en: 'AI Agent GA: sidebar conversation (CreatePlan + step cards), debug info panel per LLM call, agent config center (models, prompts, tools, permissions), session review reuses the chat bubble style with message → debug jump, curl exports with full host URL, session titles support double-click rename.',
    zh: 'AI Agent 正式发布：侧边栏对话（CreatePlan 分步规划 + 执行卡片）、每次 LLM 调用独立调试信息面板、Agent 配置中心（模型、提示词、工具、权限）、会话审查复用侧边栏消息气泡样式并支持消息↔调试跳转、curl 导出链接带完整 host、会话标题支持双击重命名。',
    link: 'https://boommanpro.cn/post/ai-coding-gaia-ai-agent-workflow',
  },
  { date: '2026.07.14', en: 'Rebuilt as Gaia: internationalized homepage, admin console with workflow/template management, version control, multi-condition node synced from official flowgram.ai.', zh: '重建为 Gaia：国际化首页、管理后台（工作流/模板管理）、版本控制、同步官方 multi-condition 节点。' },
  { date: '2026.01.25', en: 'Added admin console with configurable server address.', zh: '增加管理端，右上角可配置自己的服务器地址。' },
  { date: '2026.01.23', en: 'Added Electron desktop app for local experience.', zh: '增加 Electron 端，可直接运行体验。' },
  { date: '2026.01.06', en: 'Merged frontend and backend repositories into one monorepo.', zh: '前后端两个仓库合并。' },
  { date: '2025.12.27', en: 'Upgraded to flowgram.ai v1.0.6, built Vue3 admin demo and server, updated docs.', zh: '跟进官网升级到 v1.0.6，开发 Vue3 管理端 demo 和服务端，更新文档。' },
  { date: '2025.10.17', en: 'Upgraded to flowgram.ai v0.5.5, fixed related code.', zh: '跟进官网升级到 v0.5.5，修复相关代码。' },
  { date: '2025.09.06', en: 'Frontend and backend support for string-format component with SpEL and Thymeleaf syntax.', zh: '前后端支持 string-format 组件，支持 SpEL、Thymeleaf 语法。' },
  { date: '2025.08.22', en: 'Server-side support released.', zh: '服务端支持发布。' },
  { date: '2025.08.20', en: 'Updated to latest official branch, refactored code.', zh: '更新分支到官网最新，重构代码分支。' },
  { date: '2025.05.27', en: 'Refactored codebase, maintained only apps/demo-free-layout directory.', zh: '重构代码分支，仅维护 apps/demo-free-layout 目录。' },
];

export const Releases = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('en');

  const t = {
    nav: {
      home: lang === 'zh' ? '首页' : 'Home',
      releases: lang === 'zh' ? '发布日志' : 'Release Log',
      admin: lang === 'zh' ? '管理后台' : 'Admin Console',
    },
    title: lang === 'zh' ? '发布日志' : 'Release Log',
    subtitle: lang === 'zh' ? '项目里程碑与版本历史' : 'Project milestones and version history',
    latest: lang === 'zh' ? '最新' : 'LATEST',
    footer: {
      desc: lang === 'zh' ? '盖亚 — 可视化 AI 工作流编辑器' : 'Gaia — Visual AI workflow editor',
      copyright: lang === 'zh' ? '© 2026 盖亚 Gaia.' : '© 2026 Gaia.',
    },
  };

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div style={{ fontFamily: FONT_STACK, background: '#fff', color: '#1a1a1a', minHeight: '100vh' }}>
      {/* Navigation */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        height: '64px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #f0f0f2',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src={publicPath('logo.svg')} alt="Gaia" style={{ width: 48, height: 48 }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>Gaia</div>
            <div style={{ fontSize: '11px', color: '#999', lineHeight: '16px' }}>
              {lang === 'zh' ? '盖亚' : 'AI Workflow Editor'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Home 按钮 */}
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '6px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#555',
              fontWeight: 500,
            }}
          >
            {t.nav.home}
          </button>
          {/* Release Log 按钮（当前页高亮） */}
          <button
            style={{
              padding: '6px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'default',
              fontSize: '14px',
              color: ACCENT,
              fontWeight: 600,
              borderBottom: `2px solid ${ACCENT}`,
            }}
          >
            {t.nav.releases}
          </button>
          <button
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            style={{
              padding: '6px 14px',
              border: '1px solid #e0e0e6',
              borderRadius: '6px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#333',
            }}
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <button
            onClick={() => navigate('/admin/workflows')}
            style={{
              padding: '8px 20px',
              background: ACCENT,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t.nav.admin}
          </button>
        </div>
      </nav>

      {/* Release Log Timeline */}
      <section id="releases" style={{ padding: '80px 48px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1 style={{ fontSize: 'clamp(28px, 3.5vw, 36px)', fontWeight: 700, margin: '0 0 12px' }}>
              {t.title}
            </h1>
            <p style={{ fontSize: '16px', color: '#666' }}>{t.subtitle}</p>
          </div>

          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: '32px' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute',
              left: '7px',
              top: '8px',
              bottom: '8px',
              width: '2px',
              background: '#e8e8ea',
            }} />

            {releasesItems.map((item, i) => (
              <div key={i} style={{ position: 'relative', marginBottom: i === releasesItems.length - 1 ? 0 : '28px' }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute',
                  left: '-32px',
                  top: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: i === 0 ? ACCENT : '#fff',
                  border: i === 0 ? 'none' : `2px solid ${i === 0 ? ACCENT : '#ccc'}`,
                }} />

                {/* Content */}
                <div style={{
                  padding: '16px 20px',
                  background: i === 0 ? '#f5f5ff' : '#fff',
                  border: `1px solid ${i === 0 ? '#e0e0ff' : '#f0f0f2'}`,
                  borderRadius: '8px',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: i === 0 ? ACCENT : '#999',
                    marginBottom: '6px',
                    fontFamily: FONT_STACK,
                  }}>
                    {item.date}
                    {i === 0 && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '1px 8px',
                        background: ACCENT,
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}>
                        {t.latest}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '14px', color: '#444', lineHeight: 1.6, margin: 0 }}>
                    {lang === 'zh' ? item.zh : item.en}
                  </p>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        marginTop: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        color: ACCENT,
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {lang === 'zh' ? '阅读更多' : 'Read more'} →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '32px 48px',
        borderTop: '1px solid #f0f0f2',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '14px', color: '#999', marginBottom: '4px' }}>{t.footer.desc}</div>
        <div style={{ fontSize: '13px', color: '#bbb' }}>{t.footer.copyright}</div>
      </footer>
    </div>
  );
};
