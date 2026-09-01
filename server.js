import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const DEFAULT_MODEL = process.env.MODEL || 'claude-sonnet-5';

const app = express();
app.use(express.json({ limit: '1mb' }));

// 前端静态文件（dotfiles: 'deny' 禁止访问 .env/.git 等点开头文件，防止泄露）
app.use(express.static(__dirname, { dotfiles: 'deny' }));

// 通用 LLM 代理：前端所有 AI 调用走这里，key 只在服务端环境变量里
app.post('/api/chat', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 ANTHROPIC_API_KEY' });
  }

  const { system, messages, temperature = 0.7, max_tokens = 4096, model } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '缺少参数：messages' });
  }

  const maxTokens = Math.min(Number(max_tokens) || 4096, 8192);

  try {
    const upstream = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
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

    if (!upstream.ok) {
      const err = await upstream.text();
      throw new Error(`Anthropic API error: ${upstream.status} ${err}`);
    }

    const data = await upstream.json();
    const text = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return res.json({ text });
  } catch (err) {
    console.error('chat proxy error:', err);
    return res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PM Studio server running on port ${PORT}`);
});
