/**
 * Vercel Function: 需求融合 — 生成产品规格
 * POST /api/synthesize
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MODEL = process.env.MODEL || 'claude-sonnet-5';

const SYSTEM_PROMPT = `你是一位资深产品经理，擅长从多个用户访谈中提炼和融合需求，形成产品规格文档。

你的任务是分析多个客户角色的需求访谈记录，输出一份融合后的产品规格。

分析框架：
1. 识别所有角色共同提到的需求 → P0（必须有，MVP核心）
2. 识别多数角色（>50%）提到的需求 → P1（应该有，V1.0）
3. 识别个别角色的独特但有价值的洞察 → P2（可以有，差异化）
4. 识别角色之间的需求矛盾，给出折中建议
5. 提炼关键市场洞察
6. 推荐适合的技术栈

输出纯 JSON，格式如下：
{
  "executive_summary": "一段话概述这个产品的核心价值主张和要解决的关键问题",
  "p0_features": [
    {"name": "功能名", "description": "功能描述（含为什么这是P0）"}
  ],
  "p1_features": [
    {"name": "功能名", "description": "功能描述"}
  ],
  "p2_features": [
    {"name": "功能名", "description": "功能描述"}
  ],
  "contradictions": "角色之间的需求矛盾分析，以及建议的折中方案",
  "mvp_scope": "MVP 应该包含的范围、建议的第一个版本做什么不做什么",
  "tech_stack": "基于需求分析推荐的技术栈（前端/后端/数据库/部署等）",
  "market_insights": "从访谈中提炼的关键市场洞察和产品定位建议"
}

只返回 JSON，不要任何其他文字。`;

function buildInterviewsSummary(requirements) {
  let parts = [];
  requirements.forEach((req, i) => {
    const p = req.persona;
    parts.push(`### 角色 ${i + 1}：${p.name}（${p.role}，${p.age}岁）`);
    parts.push(`背景：${p.company} | 经验：${p.experience}`);
    parts.push(`痛点：${p.core_pain_points}`);
    parts.push(`使用场景：${p.use_scenarios}`);
    parts.push(`性格：${p.personality}`);
    parts.push('');

    req.rounds.forEach((r) => {
      parts.push(`**第${r.round_num}轮：** ${r.answer}`);
      parts.push('');
    });

    parts.push('---\n');
  });

  return parts.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { requirements, product_type, customer_desc } = req.body;

  if (!requirements || !product_type) {
    return res.status(400).json({ error: '缺少必要参数：requirements, product_type' });
  }

  const interviewsText = buildInterviewsSummary(requirements);

  const userPrompt = `请分析以下 ${requirements.length} 个客户角色的需求访谈记录，融合生成产品规格。

产品类型：${product_type}
目标客户：${customer_desc}

---
${interviewsText}
---

请按照系统指令中的框架进行分析，输出 JSON。`;

  try {
    const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.5,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
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

    const spec = parseSpecJSON(text);
    return res.json({ spec });
  } catch (err) {
    console.error('synthesize error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function parseSpecJSON(text) {
  // Step 1: Normalize whitespace and strip markdown
  text = text.trim();

  // Remove markdown code blocks — handle all variations
  text = text.replace(/^```(?:json|js|javascript)?\s*\n?/i, '');
  text = text.replace(/\n?\s*```\s*$/, '');
  text = text.trim();

  // Step 2: Try parsing directly
  const data = tryParseJSON(text);
  if (data) return normalizeSpec(data);

  // Step 3: Try to extract JSON object boundaries
  const extracted = extractJSON(text);
  if (extracted) {
    const d = tryParseJSON(extracted);
    if (d) return normalizeSpec(d);
  }

  // Step 4: Last resort — try to fix common issues
  const fixed = fixCommonJSONIssues(text);
  if (fixed) {
    const extracted2 = extractJSON(fixed);
    if (extracted2) {
      const d = tryParseJSON(extracted2);
      if (d) return normalizeSpec(d);
    }
  }

  console.error('Failed to parse synthesis JSON. Raw text:', text.slice(0, 500));
  throw new Error(`无法解析融合 JSON，请联系开发者。原始文本前 200 字: ${text.slice(0, 200)}`);
}

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJSON(text) {
  // Find the outermost JSON object
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

function fixCommonJSONIssues(text) {
  // Fix unescaped newlines in string values (within quotes)
  // This is a simplified fix — we replace raw newlines inside JSON strings
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

    // Replace unescaped newlines inside strings
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

function normalizeSpec(data) {
  const addPriority = (items, priority) =>
    (items || []).map((f) => ({ ...f, priority: f.priority || priority }));

  return {
    executive_summary: data.executive_summary || '',
    p0_features: addPriority(data.p0_features, 'P0'),
    p1_features: addPriority(data.p1_features, 'P1'),
    p2_features: addPriority(data.p2_features, 'P2'),
    contradictions: data.contradictions || '',
    mvp_scope: data.mvp_scope || '',
    tech_stack: data.tech_stack || '',
    market_insights: data.market_insights || '',
  };
}
