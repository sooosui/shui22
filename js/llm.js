/**
 * DeepSeek (Anthropic-compatible) 直连客户端 + 三步分析业务逻辑
 *
 * 浏览器直接调用 api.deepseek.com/anthropic，无需后端函数。
 * 配置来自 js/config.js 的 window.DEEPSEEK_CONFIG。
 */

const CFG = window.DEEPSEEK_CONFIG || {};

// ================================================================
// 底层调用：Anthropic Messages 兼容接口
// ================================================================

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
// 步骤 1：生成差异化客户角色
// ================================================================

const PERSONA_SYSTEM_PROMPT = `你是一位资深用户研究员，擅长为产品调研构建多元化的用户角色画像。

你的任务是根据给定的产品类型和目标客户群体，生成一批有深度、有明显差异的真实用户画像。

要求：
1. 角色之间必须有明显差异（不同职业、不同经验水平、不同使用场景、不同痛点）
2. 每个角色应该像真实的人，有具体的背景和动机
3. 角色应该覆盖目标客户群体的不同子类型
4. 用中文输出（姓名、公司名除外）

返回纯 JSON 数组，每个元素包含以下字段：
- name: 姓名
- age: 年龄（数字）
- role: 职业/角色
- experience: 经验水平描述
- company: 所在公司类型
- core_pain_points: 核心痛点（2-3个具体痛点）
- use_scenarios: 典型使用场景（2-3个具体场景）
- tech_preference: 技术偏好和熟练度
- budget_constraint: 预算约束描述
- personality: 性格特点

只返回 JSON 数组，不要任何其他文字。`;

async function generatePersonas({ product_type, customer_desc, persona_count = 4 }) {
  const userPrompt = `请为以下产品生成 ${persona_count} 个具有明显差异的目标客户角色：

产品类型：${product_type}
目标客户群体：${customer_desc}

要求这 ${persona_count} 个角色体现目标客户群体内部的关键差异（如不同职位、不同规模公司、不同使用场景等）。`;

  const text = await deepseekChat({
    system: PERSONA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.9,
  });

  return { personas: parsePersonaJSON(text) };
}

function parsePersonaJSON(text) {
  text = text.trim();
  text = text.replace(/^```(?:json|js|javascript)?\s*\n?/i, '');
  text = text.replace(/\n?\s*```\s*$/, '');
  text = text.trim();

  const data = tryParseJSON(text);
  if (data) return data;

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']') + 1;
  if (start >= 0 && end > start) {
    const extracted = text.slice(start, end);
    const d = tryParseJSON(extracted);
    if (d) return d;
  }

  console.error('Failed to parse persona JSON. Raw text:', text.slice(0, 500));
  throw new Error(`无法解析角色 JSON，原始文本前 200 字: ${text.slice(0, 200)}`);
}

// ================================================================
// 步骤 2：模拟单轮客户访谈
// ================================================================

const ROUND_PROMPTS = [
  `你是{name}，一个{role}。请从你的角度，详细描述你理想中的{product_type}是什么样的？

请包括：
- 你最需要它解决什么问题？
- 你会在什么场景下使用它？
- 它最关键的 3-5 个功能是什么？
- 你现在是怎么解决这些问题的？有什么不满？`,

  `感谢你的分享。我想深入了解你提到的使用场景。

针对"{product_type}"，请具体描述一个典型的工作日场景——从你打开这个产品到完成任务的完整过程。
- 每个步骤具体做什么？
- 哪个环节最让你头疼？
- 你期望的理想体验是什么样的？`,

  `现在我们来谈谈优先级和实际决策。

关于{product_type}：
- 如果只能保留 3 个功能，你会选哪 3 个？为什么？
- 你愿意为这样的产品付多少钱（月费或年费）？
- 你之前尝试过哪些替代方案？它们哪里让你不满意？
- 什么样的产品会让你觉得"非用不可"？`,

  `最后，让我们再深入一下你之前提到的一些细节。

回顾你之前的回答，关于{product_type}：
- 有没有什么你特别想强调但之前没机会说的需求？
- 在选择这类产品时，你最看重什么？（价格、易用性、功能、服务？）
- 如果让你给产品团队提一个最重要的建议，那会是什么？
- 你所在行业的未来趋势会如何影响你对这类产品的需求？`,
];

function buildPersonaContext(persona) {
  return `姓名：${persona.name}
年龄：${persona.age}岁
职业：${persona.role}
经验：${persona.experience}
公司：${persona.company}
核心痛点：${persona.core_pain_points}
使用场景：${persona.use_scenarios}
技术偏好：${persona.tech_preference}
预算：${persona.budget_constraint}
性格：${persona.personality}`;
}

async function interviewRound({ persona, product_type, round_idx = 0, history = [] }) {
  const personaContext = buildPersonaContext(persona);
  const systemPrompt = `你正在参与一个用户需求访谈。请完全代入以下角色身份进行回答：

${personaContext}

重要规则：
1. 完全代入这个角色，用第一人称回答
2. 基于角色的背景、痛点和使用场景来思考问题
3. 回答要具体、真实，像是真人在接受访谈
4. 可以适当抱怨现有工具的不足，表达真实情绪
5. 如果问题涉及你不熟悉的领域，基于角色背景做合理推测
6. 用口语化的中文回答，自然流畅
7. 每次回答控制在 200-400 字`;

  const roundIdx = Math.min(round_idx, ROUND_PROMPTS.length - 1);
  const questionTemplate = ROUND_PROMPTS[roundIdx];
  const question = questionTemplate
    .replace(/\{name\}/g, persona.name)
    .replace(/\{role\}/g, persona.role)
    .replace(/\{product_type\}/g, product_type);

  const messages = [];
  for (const h of history) {
    messages.push({ role: 'user', content: h.question });
    messages.push({ role: 'assistant', content: h.answer });
  }
  messages.push({ role: 'user', content: question });

  const answer = await deepseekChat({
    system: systemPrompt,
    messages,
    temperature: 0.7,
  });

  return { question, answer };
}

// ================================================================
// 步骤 3：需求融合 — 生成产品规格
// ================================================================

const SYNTH_SYSTEM_PROMPT = `你是一位资深产品经理，擅长从多个用户访谈中提炼和融合需求，形成产品规格文档。

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
  const parts = [];
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

async function synthesize({ requirements, product_type, customer_desc }) {
  const interviewsText = buildInterviewsSummary(requirements);

  const userPrompt = `请分析以下 ${requirements.length} 个客户角色的需求访谈记录，融合生成产品规格。

产品类型：${product_type}
目标客户：${customer_desc}

---
${interviewsText}
---

请按照系统指令中的框架进行分析，输出 JSON。`;

  const text = await deepseekChat({
    system: SYNTH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    temperature: 0.5,
  });

  return { spec: parseSpecJSON(text) };
}

function parseSpecJSON(text) {
  text = text.trim();

  text = text.replace(/^```(?:json|js|javascript)?\s*\n?/i, '');
  text = text.replace(/\n?\s*```\s*$/, '');
  text = text.trim();

  const data = tryParseJSON(text);
  if (data) return normalizeSpec(data);

  const extracted = extractJSON(text);
  if (extracted) {
    const d = tryParseJSON(extracted);
    if (d) return normalizeSpec(d);
  }

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

function tryParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
