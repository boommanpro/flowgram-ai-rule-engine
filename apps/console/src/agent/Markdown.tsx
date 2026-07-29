/**
 * Markdown - 轻量 Markdown 渲染 + 选项块解析
 * 零依赖，覆盖 assistant 常见输出：标题/段落/列表/加粗/行内代码/代码块/链接/引用/分隔线
 * 同时解析 ::options 选项块，渲染为可点击按钮
 */
import React, { useMemo, useCallback } from 'react';

const ACCENT = '#4d53e8';

/** 选项块解析结果 */
export interface ParsedContent {
  /** 去除选项块后的 markdown 文本（可能为空） */
  text: string;
  /** 选项列表（原文输出，点击即发送） */
  options: string[];
}

/**
 * 解析 ::options ... :: 选项块，返回纯文本与选项数组
 * 支持格式：
 *   ::options
 *   - 选项一
 *   - 选项二
 *   ::
 */
export function parseOptions(raw: string): ParsedContent {
  if (!raw) return { text: '', options: [] };
  const options: string[] = [];
  // 匹配 ::options 开头到 :: 结尾的块（跨行）
  const re = /::options\s*\n([\s\S]*?)::\s*(?:\n|$)/g;
  const text = raw.replace(re, (_m, body: string) => {
    // 提取列表项
    const lines = body.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(.+?)\s*$/);
      if (m) options.push(m[1].trim());
    }
    return '';
  });
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), options };
}

/** 转义 HTML 特殊字符 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 行内格式：加粗、行内代码、链接 */
function renderInline(text: string): string {
  let s = escapeHtml(text);
  // 行内代码 `code`
  s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // 加粗 **text** 或 __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // 斜体 *text* 或 _text_（避免与加粗冲突，要求两侧非空白）
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  // 链接 [text](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
  );
  return s;
}

/** 将 markdown 文本解析为 HTML 字符串 */
function markdownToHtml(md: string): string {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块 ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // 跳过结束 ```
      html.push(
        `<pre class="md-code-block"><code${lang ? ` class="lang-${escapeHtml(lang)}"` : ''}>${escapeHtml(
          code.join('\n')
        )}</code></pre>`
      );
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      html.push(`<h${level} class="md-h md-h${level}">${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html.push('<hr class="md-hr" />');
      i++;
      continue;
    }

    // GFM 表格（当前行含 | 且下一行是分隔线）
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-') && lines[i + 1].includes('|')) {
      const parseRow = (row: string): string[] =>
        row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

      const headers = parseRow(line);
      i += 2; // 跳过表头和分隔线

      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i++;
      }

      const thead = `<thead><tr>${headers.map((h) => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      html.push(`<table class="md-table">${thead}${tbody}</table>`);
      continue;
    }

    // 引用块
    if (line.trim().startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote class="md-quote">${renderInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i++;
      }
      html.push(`<ul class="md-ul">${items.join('')}</ul>`);
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      html.push(`<ol class="md-ol">${items.join('')}</ol>`);
      continue;
    }

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 段落（连续非空非特殊行合并）
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length > 0) {
      html.push(`<p class="md-p">${renderInline(para.join('<br/>'))}</p>`);
    }
  }

  return html.join('');
}

/** Markdown 渲染组件 */
export interface MarkdownProps {
  content: string;
  /** 选项点击回调（点击即发送该选项文本） */
  onOptionClick?: (option: string) => void;
  /** 是否禁用选项点击（如流式输出中） */
  optionsDisabled?: boolean;
}

export const Markdown: React.FC<MarkdownProps> = ({ content, onOptionClick, optionsDisabled }) => {
  const { text, options } = useMemo(() => parseOptions(content), [content]);
  const html = useMemo(() => markdownToHtml(text), [text]);

  const handleOption = useCallback(
    (opt: string) => {
      if (!optionsDisabled && onOptionClick) onOptionClick(opt);
    },
    [optionsDisabled, onOptionClick]
  );

  return (
    <div className="md-body">
      {html && <div className="md-html" dangerouslySetInnerHTML={{ __html: html }} />}
      {options.length > 0 && (
        <div className="md-options" style={{ marginTop: html ? '8px' : 0 }}>
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={optionsDisabled}
              onClick={() => handleOption(opt)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 12px',
                marginBottom: '6px',
                borderRadius: '8px',
                border: '1px solid #d8d8e8',
                background: '#fff',
                color: '#333',
                fontSize: '12.5px',
                cursor: optionsDisabled ? 'default' : 'pointer',
                opacity: optionsDisabled ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!optionsDisabled) {
                  e.currentTarget.style.borderColor = ACCENT;
                  e.currentTarget.style.color = ACCENT;
                  e.currentTarget.style.background = '#f4f4ff';
                }
              }}
              onMouseLeave={(e) => {
                if (!optionsDisabled) {
                  e.currentTarget.style.borderColor = '#d8d8e8';
                  e.currentTarget.style.color = '#333';
                  e.currentTarget.style.background = '#fff';
                }
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Markdown;
