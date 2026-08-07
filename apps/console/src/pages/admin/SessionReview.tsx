/**
 * SessionReview - Agent 会话审查页面
 * 左侧会话列表（带筛选/质量/状态标记）+ 右侧详情（消息流 + 调试数据 + 人工标记 + curl 命令）
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Input, Button, Toast, TextArea, Tag } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconRefresh, IconExternalOpen } from '@douyinfe/semi-icons';

import { agentApi } from '../../agent/api';
import { useLanguage, t } from '../../i18n';
import type { AgentSession, AgentMessage } from '../../agent/types';

const ACCENT = '#4d53e8';

/** 质量评分颜色 */
function ratingColor(rating?: string | null): string {
  if (rating === 'good') return '#1f9d55';
  if (rating === 'bad') return '#e5404e';
  return '#999';
}
function ratingLabel(rating?: string | null): string {
  if (rating === 'good') return t('sessionReview.rating.good');
  if (rating === 'bad') return t('sessionReview.rating.bad');
  return t('sessionReview.rating.unset');
}

/** 状态颜色 */
function statusColor(status?: string): string {
  switch (status) {
    case 'fixed': return '#1f9d55';
    case 'analyzing': return '#b7791f';
    case 'ignored': return '#999';
    default: return '#4d53e8';
  }
}
function statusLabel(status?: string): string {
  switch (status) {
    case 'fixed': return t('sessionReview.status.fixed');
    case 'analyzing': return t('sessionReview.status.analyzing');
    case 'ignored': return t('sessionReview.status.ignored');
    default: return t('sessionReview.status.pending');
  }
}

/** 角色 badge */
function roleLabel(role: string): string {
  if (role === 'user') return t('sessionReview.role.user');
  if (role === 'assistant') return t('sessionReview.role.assistant');
  return t('sessionReview.role.tool');
}
function roleColor(role: string): string {
  if (role === 'user') return '#4d53e8';
  if (role === 'assistant') return '#1f9d55';
  return '#b7791f';
}

export const SessionReview: React.FC = () => {
  useLanguage();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 详情数据
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [debugData, setDebugData] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 审查编辑表单
  const [reviewRating, setReviewRating] = useState<string | null>(null);
  const [reviewIssue, setReviewIssue] = useState('');
  const [reviewStatus, setReviewStatus] = useState('pending');
  const [reviewFixNote, setReviewFixNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // curl 复制反馈
  const [curlCopied, setCurlCopied] = useState(false);

  // 会话标题内联编辑（双击触发）
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const startEdit = useCallback((key: string, title: string) => {
    setEditingKey(key);
    setEditingTitle(title);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingKey) return;
    const trimmed = editingTitle.trim();
    if (trimmed) {
      try {
        await agentApi.renameSession(editingKey, trimmed);
        setSessions((prev) =>
          prev.map((s) => (s.sessionKey === editingKey ? { ...s, title: trimmed } : s))
        );
      } catch (e) {
        Toast.error(`重命名失败: ${(e as Error).message}`);
      }
    }
    setEditingKey(null);
  }, [editingKey, editingTitle]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await agentApi.listSessions();
      setSessions(list || []);
    } catch (e) {
      Toast.error(`加载失败: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // 选中会话后加载详情
  const loadDetail = useCallback(async (sessionKey: string) => {
    setLoadingDetail(true);
    try {
      const [msgs, dbg] = await Promise.all([
        agentApi.getMessages(sessionKey),
        agentApi.getDebugData(sessionKey),
      ]);
      setMessages(msgs || []);
      setDebugData(dbg || '');
    } catch (e) {
      Toast.error(`加载详情失败: ${(e as Error).message}`);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // 选中会话时同步审查表单
  useEffect(() => {
    const s = sessions.find((x) => x.sessionKey === selectedKey);
    if (s) {
      setReviewRating(s.reviewRating ?? null);
      setReviewIssue(s.reviewIssue ?? '');
      setReviewStatus(s.reviewStatus ?? 'pending');
      setReviewFixNote(s.reviewFixNote ?? '');
      void loadDetail(selectedKey!);
    } else {
      setMessages([]);
      setDebugData('');
    }
  }, [selectedKey, sessions, loadDetail]);

  const handleSaveReview = useCallback(async () => {
    if (!selectedKey) return;
    setSavingReview(true);
    try {
      await agentApi.updateReview(selectedKey, {
        reviewRating,
        reviewIssue,
        reviewStatus,
        reviewFixNote,
      });
      Toast.success(t('sessionReview.reviewSaved'));
      // 刷新列表中的审查字段
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionKey === selectedKey
            ? { ...s, reviewRating, reviewIssue, reviewStatus, reviewFixNote }
            : s
        )
      );
    } catch (e) {
      Toast.error(`保存失败: ${(e as Error).message}`);
    } finally {
      setSavingReview(false);
    }
  }, [selectedKey, reviewRating, reviewIssue, reviewStatus, reviewFixNote]);

  const exportUrl = selectedKey ? agentApi.exportSessionUrl(selectedKey) : '';
  const curlCmd = exportUrl ? `curl -s "${exportUrl}"` : '';

  const handleCopyCurl = useCallback(async () => {
    if (!curlCmd) return;
    try {
      await navigator.clipboard.writeText(curlCmd);
      setCurlCopied(true);
      Toast.success(t('sessionReview.curlCopied'));
      setTimeout(() => setCurlCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = curlCmd;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCurlCopied(true);
      setTimeout(() => setCurlCopied(false), 2000);
    }
  }, [curlCmd]);

  const filtered = sessions.filter((s) =>
    !search || (s.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* 左侧会话列表 */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          background: '#fff',
          border: '1px solid #e8e8ea',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Input
            prefix={<IconSearch />}
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder={t('sessionReview.searchPlaceholder')}
            style={{ flex: 1 }}
          />
          <Button
            icon={<IconRefresh />}
            onClick={loadSessions}
            loading={loading}
            style={{ flexShrink: 0 }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: '#bbb',
                fontSize: 13,
              }}
            >
              {t('sessionReview.noSession')}
            </div>
          ) : (
            filtered.map((s) => {
              const isSel = s.sessionKey === selectedKey;
              const isEditing = editingKey === s.sessionKey;
              return (
                <div
                  key={s.sessionKey}
                  onClick={() => !isEditing && setSelectedKey(s.sessionKey)}
                  onDoubleClick={() => startEdit(s.sessionKey, s.title || '')}
                  title={s.title || t('agent.unnamedSession')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 4,
                    cursor: isEditing ? 'default' : 'pointer',
                    background: isSel ? '#f0f0ff' : 'transparent',
                    border: isSel ? `1px solid ${ACCENT}33` : '1px solid transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) e.currentTarget.style.background = '#f7f7fa';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {isEditing ? (
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={commitEdit}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        else if (e.key === 'Escape') setEditingKey(null);
                      }}
                      style={{
                        width: '100%',
                        border: `1px solid ${ACCENT}`,
                        borderRadius: 4,
                        padding: '3px 6px',
                        fontSize: 13,
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isSel ? ACCENT : '#1a1a1a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.title || t('agent.unnamedSession')}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      marginTop: 6,
                      alignItems: 'center',
                    }}
                  >
                    {s.reviewRating && (
                      <Tag
                        size="small"
                        color="white"
                        style={{
                          color: ratingColor(s.reviewRating),
                          border: `1px solid ${ratingColor(s.reviewRating)}33`,
                          fontSize: 11,
                        }}
                      >
                        {ratingLabel(s.reviewRating)}
                      </Tag>
                    )}
                    <Tag
                      size="small"
                      color="white"
                      style={{
                        color: statusColor(s.reviewStatus),
                        border: `1px solid ${statusColor(s.reviewStatus)}33`,
                        fontSize: 11,
                      }}
                    >
                      {statusLabel(s.reviewStatus)}
                    </Tag>
                    {s.createdAt && (
                      <span style={{ fontSize: 11, color: '#bbb' }}>
                        {new Date(s.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      <div
        style={{
          flex: 1,
          background: '#fff',
          border: '1px solid #e8e8ea',
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!selectedKey ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#bbb',
              fontSize: 14,
            }}
          >
            {t('sessionReview.emptyTip')}
          </div>
        ) : (
          <>
            {/* 详情头部：导出 + curl */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
                {sessions.find((s) => s.sessionKey === selectedKey)?.title}
              </span>
              <Button
                size="small"
                icon={<IconCopy />}
                onClick={handleCopyCurl}
                style={{ flexShrink: 0 }}
                type={curlCopied ? 'primary' : 'tertiary'}
              >
                {t('sessionReview.copyCurl')}
              </Button>
              <a
                href={exportUrl}
                target="_blank"
                rel="noreferrer"
                style={{ flexShrink: 0 }}
              >
                <Button size="small" icon={<IconExternalOpen />} type="tertiary">
                  {t('sessionReview.export')}
                </Button>
              </a>
            </div>

            {/* curl 命令展示 */}
            {curlCmd && (
              <div
                style={{
                  margin: '8px 16px',
                  padding: '8px 12px',
                  background: '#1e1e2e',
                  borderRadius: 6,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 12,
                  color: '#a6e3a1',
                  wordBreak: 'break-all',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: '#6c7086', marginBottom: 4, fontSize: 11 }}>
                  {t('sessionReview.exportHint')}
                </div>
                {curlCmd}
              </div>
            )}

            {/* 详情内容区：左消息流 + 右审查表单 */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* 消息流 */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px 16px',
                  borderRight: '1px solid #f0f0f0',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: '#999',
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  {t('sessionReview.messages')} · {messages.length} {t('sessionReview.msgCount')}
                </div>
                {loadingDetail ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                    Loading…
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                    {t('sessionReview.noMessage')}
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: 10,
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: '#f7f7fa',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <Tag
                          size="small"
                          color="white"
                          style={{
                            color: roleColor(m.role),
                            border: `1px solid ${roleColor(m.role)}33`,
                            fontSize: 11,
                          }}
                        >
                          {roleLabel(m.role)}
                        </Tag>
                        {m.createdAt && (
                          <span style={{ fontSize: 10, color: '#bbb' }}>
                            {new Date(m.createdAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {m.content && (
                        <div
                          style={{
                            fontSize: 13,
                            color: '#333',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.5,
                            maxHeight: 200,
                            overflow: 'hidden',
                          }}
                        >
                          {m.content}
                        </div>
                      )}
                      {m.toolCalls && (
                        <details style={{ marginTop: 6 }}>
                          <summary
                            style={{
                              cursor: 'pointer',
                              fontSize: 11,
                              color: ACCENT,
                            }}
                          >
                            {t('sessionReview.toolCalls')}
                          </summary>
                          <pre
                            style={{
                              marginTop: 4,
                              padding: 8,
                              background: '#1e1e2e',
                              color: '#cdd6f4',
                              borderRadius: 4,
                              fontSize: 11,
                              overflow: 'auto',
                              maxHeight: 240,
                            }}
                          >
                            {m.toolCalls}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}

                {/* 调试数据 */}
                <div
                  style={{
                    fontSize: 12,
                    color: '#999',
                    fontWeight: 600,
                    margin: '16px 0 8px',
                  }}
                >
                  {t('sessionReview.debugData')}
                </div>
                {debugData && debugData.trim() ? (
                  <details>
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontSize: 11,
                        color: ACCENT,
                      }}
                    >
                      {t('sessionReview.debugData')}
                    </summary>
                    <pre
                      style={{
                        marginTop: 4,
                        padding: 8,
                        background: '#1e1e2e',
                        color: '#cdd6f4',
                        borderRadius: 4,
                        fontSize: 11,
                        overflow: 'auto',
                        maxHeight: 400,
                      }}
                    >
                      {debugData}
                    </pre>
                  </details>
                ) : (
                  <div style={{ fontSize: 13, color: '#bbb' }}>
                    {t('sessionReview.noDebug')}
                  </div>
                )}
              </div>

              {/* 审查表单 */}
              <div
                style={{
                  width: 300,
                  flexShrink: 0,
                  padding: '12px 16px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                  {t('sessionReview.review')}
                </div>

                {/* 质量评分 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                    {t('sessionReview.markRating')}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      size="small"
                      type={reviewRating === 'good' ? 'primary' : 'tertiary'}
                      onClick={() => setReviewRating('good')}
                      style={
                        reviewRating === 'good'
                          ? { background: '#1f9d55' }
                          : undefined
                      }
                    >
                      {t('sessionReview.markGood')}
                    </Button>
                    <Button
                      size="small"
                      type={reviewRating === 'bad' ? 'primary' : 'tertiary'}
                      onClick={() => setReviewRating('bad')}
                      style={
                        reviewRating === 'bad'
                          ? { background: '#e5404e' }
                          : undefined
                      }
                    >
                      {t('sessionReview.markBad')}
                    </Button>
                    <Button
                      size="small"
                      type="tertiary"
                      onClick={() => setReviewRating(null)}
                    >
                      {t('sessionReview.clearRating')}
                    </Button>
                  </div>
                </div>

                {/* 状态 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                    {t('sessionReview.statusLabel')}
                  </div>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: '1px solid #e0e0e6',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  >
                    <option value="pending">{t('sessionReview.status.pending')}</option>
                    <option value="analyzing">{t('sessionReview.status.analyzing')}</option>
                    <option value="fixed">{t('sessionReview.status.fixed')}</option>
                    <option value="ignored">{t('sessionReview.status.ignored')}</option>
                  </select>
                </div>

                {/* 问题描述 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                    {t('sessionReview.issueLabel')}
                  </div>
                  <TextArea
                    value={reviewIssue}
                    onChange={(v: string) => setReviewIssue(v)}
                    placeholder={t('sessionReview.issuePlaceholder')}
                    rows={4}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* 修复建议 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 6 }}>
                    {t('sessionReview.fixNoteLabel')}
                  </div>
                  <TextArea
                    value={reviewFixNote}
                    onChange={(v: string) => setReviewFixNote(v)}
                    placeholder={t('sessionReview.fixNotePlaceholder')}
                    rows={4}
                    style={{ width: '100%' }}
                  />
                </div>

                <Button
                  theme="solid"
                  style={{ background: ACCENT }}
                  loading={savingReview}
                  onClick={handleSaveReview}
                >
                  {t('sessionReview.saveReview')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionReview;
