/**
 * 通用 LLM 代理：前端所有 AI 调用统一走这里。
 * DeepSeek API Key 只从服务端环境变量读取，绝不出现在浏览器 / 仓库源码中。
 *
 * POST /api/chat
 * body: { system?, messages, temperature?, max_tokens?, model? }
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const DEFAULT_MODEL = process.env.MODEL || 'claude-sonnet-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 ANTHROPIC_API_KEY，请在部署平台的环境变量里设置' });
  }

  const { system, messages, temperature = 0.7, max_tokens = 4096, model } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '缺少参数：messages' });
  }

  // 限制单次请求 token，防止滥用
  const maxTokens = Math.min(Number(max_tokens) || 4096, 8192);

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: maxTokens,
        temperature: Number(temperature) || 0.7,
        ...(system ? { system } : {}),
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const text = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return res.json({ text });
  } catch (err) {
    console.error('chat proxy error:', err);
    return res.status(502).json({ error: err.message });
  }
}
