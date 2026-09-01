/**
 * LLM 核心客户端（经后端代理）+ 通用 JSON 解析助手
 *
 * 前端所有 AI 调用统一走 /api/chat（后端 serverless 函数），
 * API Key 只保存在服务端环境变量里，绝不出现在浏览器 / 仓库源码中。
 */

async function deepseekChat({ system, messages, temperature = 0.7, maxTokens = 4096, model }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, temperature, max_tokens: maxTokens, model }),
  });

  if (!res.ok) {
    let msg = `API 请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await res.json();
  return data.text;
}

// ================================================================
// 通用 JSON 解析助手
// ================================================================

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 从文本中提取最外层 JSON 对象
function extractJSON(text) {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

// 修复 JSON 字符串值里的未转义换行
function fixCommonJSONIssues(text) {
  let fixed = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      fixed += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      fixed += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
    }

    if (inString && ch === '\n') {
      fixed += '\\n';
    } else if (inString && ch === '\r') {
      // skip \r
    } else {
      fixed += ch;
    }
  }

  return fixed;
}

// 剥掉可能的 markdown 代码块包裹，返回纯内容
function stripCodeFence(text) {
  text = text.trim();
  text = text.replace(/^```(?:json|js|javascript|markdown|md)?\s*\n?/i, '');
  text = text.replace(/\n?\s*```\s*$/, '');
  return text.trim();
}
