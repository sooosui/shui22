/**
 * 轻量 Markdown 渲染器 + 文本导出/复制/提示
 * 不依赖任何 CDN，国内可直接访问。
 */

// ================================================================
// 通用工具
// ================================================================

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

const qs = (sel, root) => (root || document).querySelector(sel);
const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast('已复制到剪贴板');
  } catch {
    toast('复制失败，请手动选择复制');
  }
}

function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

// ================================================================
// Markdown → HTML（安全：先转义再按块级语法重建）
// ================================================================

function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let i = 0;
  let listType = null; // 'ul' | 'ol'
  let inCode = false;
  let codeBuf = [];

  const closeList = () => {
    if (listType) {
      html += `</${listType}>\n`;
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // 代码块围栏
    if (/^```/.test(line.trim())) {
      closeList();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        html += `<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>\n`;
        inCode = false;
        codeBuf = [];
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) {
      closeList();
      i++;
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      html += `<h${lvl}>${inlineMd(h[2])}</h${lvl}>\n`;
      i++;
      continue;
    }

    // 分隔线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closeList();
      html += '<hr>\n';
      i++;
      continue;
    }

    // 表格：当前行以 | 开头，且下一行是分隔行
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList();
      const rows = [line];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i]);
        i++;
      }
      html += renderTable(rows) + '\n';
      continue;
    }

    // 引用
    if (/^>\s?/.test(line)) {
      closeList();
      const qlines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qlines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html += `<blockquote>${renderMarkdown(qlines.join('\n'))}</blockquote>\n`;
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList();
        html += '<ul>\n';
        listType = 'ul';
      }
      html += `<li>${inlineMd(line.replace(/^\s*[-*+]\s+/, ''))}</li>\n`;
      i++;
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (listType !== 'ol') {
        closeList();
        html += '<ol>\n';
        listType = 'ol';
      }
      html += `<li>${inlineMd(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>\n`;
      i++;
      continue;
    }

    // 段落
    closeList();
    html += `<p>${inlineMd(line)}</p>\n`;
    i++;
  }

  closeList();
  if (inCode) {
    html += `<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>\n`;
  }
  return html;
}

function isTableSeparator(line) {
  const t = line.trim();
  return t.startsWith('|') && t.includes('-') && /^[\s|:\-]+$/.test(t);
}

function renderTable(rows) {
  const parseRow = (r) =>
    r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  const header = parseRow(rows[0]);
  const body = rows.slice(2).map(parseRow);

  let html = '<table><thead><tr>';
  header.forEach((h) => {
    html += `<th>${inlineMd(h)}</th>`;
  });
  html += '</tr></thead><tbody>';

  body.forEach((r) => {
    html += '<tr>';
    r.forEach((c) => {
      html += `<td>${inlineMd(c)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

// 行内格式（在已转义文本上处理）
function inlineMd(text) {
  text = escapeHtml(text);
  // 行内代码
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 链接 [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // 粗体
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // 斜体
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return text;
}
