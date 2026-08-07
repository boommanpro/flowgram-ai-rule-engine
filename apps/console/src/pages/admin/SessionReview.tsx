/**
 * SessionReview - Agent 会话审查页面
 * 左侧会话列表（带筛选/质量/状态标记）+ 右侧详情（复用 Agent 消息渲染 + 调试面板 + 人工标记 + curl 命令）
 *
 * 核心复用：
 *   - convertMessages (AgentContext) 将 AgentMessage[] 转为 DisplayMessage[]
 *   - MessageItem / GroupedToolCard / MarkdownStyle (MessageList) 渲染完全一致的消息气泡
 *   - DebugPanel(entries prop) 完全一致的调试面板，点击 assistant 消息"调试详情"跳转定位
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Input, Button, Toast, TextArea, Tag } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconRefresh, IconExternalOpen } from '@douyinfe/semi-icons';

import { agentApi } from '../../agent/api';
import { useLanguage, t } from '../../i18n';
import type { AgentSession, AgentMessage, DisplayMessage } from '../../agent/types';
import { convertMessages } from '../../agent/AgentContext';
import {
  MessageItem,
  GroupedToolCard,
  MarkdownStyle,
} from '../../agent/MessageList';
import { DebugPanel, DebugEntry, parseDebugData } from '../../agent/DebugPanel';

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

/** 将 DisplayMessage 按连续 role 分组，渲染出与 MessageList 完全一致的布局 */
function renderDisplayMessages(
  messages: DisplayMessage[],
  onDebugJump: (id: string) => void
): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === 'tool') {
      // 合并连续 tool 消息为 GroupedToolCard（与侧边栏相同的卡片风格）
      const group: DisplayMessage[] = [];
      while (i < messages.length && messages[i].role === 'tool') {
        group.push(messages[i]);
        i++;
      }
      nodes.push(<GroupedToolCard key={`grp-${group[0].id}`} messages={group} />);
    } else {
      nodes.push(
        <MessageItem
          key={m.id}
          message={m}
          streaming={false}
          onOptionClick={() => { /* 审查页只读，不触发 */ }}
          onDebugJump={onDebugJump}
        />
      );
      i++;
    }
  }
  return nodes;
}

/** 为 assistant DisplayMessage 关联 debugEntryId
 *  策略：按顺序匹配 —— 第 N 个 assistant content 消息 ↔ 第 N 个 DebugEntry
 *  （与侧边栏相同的语义：每条 LLM 回复对应一个 debug_request/debug_response 对）
 */
function attachDebugEntryIds(
  displayMsgs: DisplayMessage[],
  entries: DebugEntry[]
): DisplayMessage[] {
  if (entries.length === 0) return displayMsgs;
  const assistants = displayMsgs.filter((m) => m.role === 'assistant' && m.content);
  if (assistants.length === 0) return displayMsgs;
  // 匹配逻辑：
  //   如果 DebugEntry 数 <= assistant 消息数：用 entries 按顺序匹配最新 N 条 assistant
  //   如果 DebugEntry 数 > assistant 消息数：按时间戳对齐（entries[i].timestamp 与 message.timestamp 最接近的）
  const assiCopy = [...assistants];
  // 简单策略：按出现顺序 1:1 分配
  const result = [...displayMsgs];
  for (let k = 0; k < Math.min(entries.length, assiCopy.length); k++) {
    const assi = assiCopy[k];
    const entry = entries[k];
    const idx = result.indexOf(assi);
    if (idx >= 0) {
      result[idx] = { ...assi, debugEntryId: entry.id };
    }
  }
  return result;
}

export const SessionReview: React.FC = () => {
  useLanguage();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 详情数据（已转换为 DisplayMessage + DebugEntry）
  const [rawMessages, setRawMessages] = useState<AgentMessage[]>([]);
  const [rawDebugData, setRawDebugData] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const debugEntries = useMemo<DebugEntry[]>(
    () => parseDebugData(rawDebugData),
    [rawDebugData]
  );
  const displayMessages = useMemo<DisplayMessage[]>(() => {
    const converted = convertMessages(rawMessages);
    return attachDebugEntryIds(converted, debugEntries);
  }, [rawMessages, debugEntries]);

  // 审查编辑表单
  const [reviewRating, setReviewRating] = useState<string | null>(null);
  const [reviewIssue, setReviewIssue] = useState('');
  const [reviewStatus, setReviewStatus] = useState('pending');
  const [reviewFixNote, setReviewFixNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  // curl 复制反馈
  const [curlCopied, setCurlCopied] = useState(false);

  // 会话列表行标题内联编辑（双击触发）
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // 详情头部标题内联编辑（双击触发）
  const [detailEditingTitle, setDetailEditingTitle] = useState(false);
  const [detailEditingTitleValue, setDetailEditingTitleValue] = useState('');
  const detailEditRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (detailEditingTitle && detailEditRef.current) {
      detailEditRef.current.focus();
      detailEditRef.current.select();
    }
  }, [detailEditingTitle]);

  // 调试面板状态
  const [debugOpen, setDebugOpen] = useState(false);
  const [focusDebugEntryId, setFocusDebugEntryId] = useState<string | null>(null);

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
      setRawMessages(msgs || []);
      setRawDebugData(dbg || '');
    } catch (e) {
      Toast.error(`加载详情失败: ${(e as Error).message}`);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // 选中会话时同步审查表单 + 关闭调试面板
  useEffect(() => {
    setDetailEditingTitle(false);
    setDebugOpen(false);
    setFocusDebugEntryId(null);
    const s = selectedKey ? sessions.find((x) => x.sessionKey === selectedKey) : undefined;
    if (s && selectedKey) {
      setReviewRating(s.reviewRating ?? null);
      setReviewIssue(s.reviewIssue ?? '');
      setReviewStatus(s.reviewStatus ?? 'pending');
      setReviewFixNote(s.reviewFixNote ?? '');
      void loadDetail(selectedKey);
    } else {
      setRawMessages([]);
      setRawDebugData('');
    }
  }, [selectedKey, sessions, loadDetail]);

  const handleDetailStartEditTitle = useCallback(() => {
    const s = sessions.find((x) => x.sessionKey === selectedKey);
    if (!s) return;
    setDetailEditingTitle(true);
    setDetailEditingTitleValue(s.title || '');
  }, [selectedKey, sessions]);

  const handleDetailCommitTitleEdit = useCallback(async () => {
    if (!selectedKey || !detailEditingTitle) return;
    const trimmed = detailEditingTitleValue.trim();
    const s = sessions.find((x) => x.sessionKey === selectedKey);
    const prev = s?.title || '';
    if (trimmed && trimmed !== prev) {
      try {
        await agentApi.renameSession(selectedKey, trimmed);
        setSessions((prev2) =>
          prev2.map((x) => (x.sessionKey === selectedKey ? { ...x, title: trimmed } : x))
        );
      } catch (e) {
        Toast.error(`重命名失败: ${(e as Error).message}`);
      }
    }
    setDetailEditingTitle(false);
  }, [selectedKey, detailEditingTitle, detailEditingTitleValue, sessions]);

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

  const handleDebugJump = useCallback((entryId: string) => {
    setDebugOpen(true);
    setFocusDebugEntryId(entryId);
    // 同帧内 focus id 不变化时要重置一次，触发 DebugPanel 的跳转 useEffect
    setTimeout(() => setFocusDebugEntryId(entryId), 50);
  }, []);

  const filtered = sessions.filter((s) =>
    !search || (s.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <MarkdownStyle />
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
                          if (e.key === 'Enter') void commitEdit();
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
            position: 'relative',
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
              {/* 详情头部：导出 + curl + 调试按钮 */}
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
                {detailEditingTitle ? (
                  <input
                    ref={detailEditRef}
                    value={detailEditingTitleValue}
                    onChange={(e) => setDetailEditingTitleValue(e.target.value)}
                    onBlur={() => void handleDetailCommitTitleEdit()}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleDetailCommitTitleEdit();
                      else if (e.key === 'Escape') setDetailEditingTitle(false);
                    }}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      border: `1px solid ${ACCENT}`,
                      borderRadius: 4,
                      padding: '3px 8px',
                      outline: 'none',
                      background: '#fff',
                      fontFamily: 'inherit',
                      minWidth: 200,
                      flex: 1,
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={handleDetailStartEditTitle}
                    title={t('sessionReview.doubleClickToRename')}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1a1a1a',
                      cursor: 'text',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {sessions.find((s) => s.sessionKey === selectedKey)?.title}
                  </span>
                )}
                <Button
                  size="small"
                  onClick={() => { setDebugOpen((v) => !v); setFocusDebugEntryId(null); }}
                  type={debugOpen ? 'primary' : 'tertiary'}
                  style={{ flexShrink: 0 }}
                >
                  {debugOpen ? '关闭调试' : '调试面板'} ({debugEntries.length})
                </Button>
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

              {/* 详情内容区：左消息流（复用 Agent 气泡） + 右审查表单 */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* 消息流：完全复用 MessageItem / GroupedToolCard 样式 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 24px',
                    borderRight: '1px solid #f0f0f0',
                    background: '#fff',
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
                    {t('sessionReview.messages')} · {displayMessages.length} 条
                  </div>
                  {loadingDetail ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                      Loading…
                    </div>
                  ) : displayMessages.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                      {t('sessionReview.noMessage')}
                    </div>
                  ) : (
                    <div style={{ maxWidth: 720, margin: '0 auto' }}>
                      {renderDisplayMessages(displayMessages, handleDebugJump)}
                    </div>
                  )}

                  {/* 调试数据原始 JSON（保留但折叠，便于定位问题） */}
                  {debugEntries.length === 0 && rawDebugData && rawDebugData.trim() && (
                    <div style={{ marginTop: 24 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#999',
                          fontWeight: 600,
                          margin: '16px 0 8px',
                        }}
                      >
                        {t('sessionReview.debugData')} (原始 JSON 未识别为条目)
                      </div>
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
                        {rawDebugData}
                      </pre>
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

      {/* 调试面板 — 使用 entries prop 显示当前会话的调试条目 */}
      {debugOpen && selectedKey && (
        <DebugPanel
          entries={debugEntries}
          sessionKeyLabel={selectedKey}
          focusEntryId={focusDebugEntryId}
          onClose={() => { setDebugOpen(false); setFocusDebugEntryId(null); }}
          rightOffset={0}
        />
      )}
    </>
  );
};

export default SessionReview;
