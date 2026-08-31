/**
 * DeepSeek (Anthropic-compatible) 直连核心客户端 + 通用 JSON 解析助手
 *
 * 浏览器直接调用 api.deepseek.com/anthropic，无需后端。
 * 配置来自 js/config.js 的 window.DEEPSEEK_CONFIG。
 */

const CFG = window.DEEPSEEK_CONFIG || {};

async function deepseekChat({ system, messages, temperature = 0.7, maxTokens = 4096 }) {
  const apiKey = CFG.apiKey;
  const baseUrl = CFG.baseUrl || 'https://api.deepseek.com/anthropic';
  const model = CFG.model || 'claude-sonnet-5';

  if (!apiKey) {
    throw new Error('缺少 API Key：请在 js/config.js 中配置 window.DEEPSEEK_CONFIG.apiKey');
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`DeepSeek API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
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
