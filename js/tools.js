/**
 * 全部 LLM 工具函数 + 文档工具注册表（DOC_TOOLS）
 * 依赖 llm.js 的 deepseekChat / JSON 助手。
 */

// ================================================================
// 角色生成（访谈用）
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
  const clean = stripCodeFence(text);
  const data = tryParseJSON(clean);
  if (data) return data;

  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']') + 1;
  if (start >= 0 && end > start) {
    const d = tryParseJSON(clean.slice(start, end));
    if (d) return d;
  }

  console.error('Failed to parse persona JSON. Raw text:', clean.slice(0, 500));
  throw new Error(`无法解析角色 JSON，原始文本前 200 字: ${clean.slice(0, 200)}`);
}

// AI 辅助生成单个角色（供「虚拟用户库」用）
async function generateAgent({ product, roleHint }) {
  const system = `你是一位资深用户研究员。请生成一个真实、具体的虚拟用户角色画像。用中文输出（姓名、公司名除外）。返回纯 JSON 对象，包含字段：name, age(数字), role, experience, company, core_pain_points(2-3个痛点数组), use_scenarios(2-3个场景数组), tech_preference, budget_constraint, personality。只返回 JSON 对象，不要其他文字。`;

  const user = `请为「${product}」生成 1 个目标用户角色${roleHint ? `。角色倾向：${roleHint}` : ''}。`;

  const text = await deepseekChat({
    system,
    messages: [{ role: 'user', content: user }],
    temperature: 0.9,
  });

  const clean = stripCodeFence(text);
  let obj = tryParseJSON(clean);
  if (!obj) {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}') + 1;
    if (start >= 0 && end > start) obj = tryParseJSON(clean.slice(start, end));
  }
  if (!obj) throw new Error('生成角色失败，无法解析返回内容');
  return normalizePersona(obj);
}

// ================================================================
// 模拟客户访谈
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
// 需求融合 — 生成产品规格
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
  const clean = stripCodeFence(text);

  const data = tryParseJSON(clean);
  if (data) return normalizeSpec(data);

  const extracted = extractJSON(clean);
  if (extracted) {
    const d = tryParseJSON(extracted);
    if (d) return normalizeSpec(d);
  }

  const fixed = fixCommonJSONIssues(clean);
  if (fixed) {
    const extracted2 = extractJSON(fixed);
    if (extracted2) {
      const d = tryParseJSON(extracted2);
      if (d) return normalizeSpec(d);
    }
  }

  console.error('Failed to parse synthesis JSON. Raw text:', clean.slice(0, 500));
  throw new Error(`无法解析融合 JSON，请联系开发者。原始文本前 200 字: ${clean.slice(0, 200)}`);
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

// ================================================================
// 文档工具（返回 Markdown）
// ================================================================

async function generatePRD({ product, background, goals, targetUsers, scope, constraints }) {
  const user = `请为以下产品生成 PRD：

产品名称：${product}
背景与问题：${background}
产品目标：${goals}
目标用户：${targetUsers}
范围：${scope}
${constraints ? `约束条件：${constraints}` : ''}

请按以下结构输出 Markdown：
# ${product} · 产品需求文档
## 1. 产品概述
## 2. 背景与问题
## 3. 目标与成功指标
## 4. 目标用户与使用场景
## 5. 核心功能（按 P0/P1/P2）
## 6. 非功能需求
## 7. 里程碑与发布计划
## 8. 风险与依赖`;

  return await deepseekChat({
    system: '你是一位资深产品经理，擅长撰写清晰、结构化、可执行的产品需求文档（PRD）。用中文、结构化 Markdown 输出；核心功能用 P0/P1/P2 标注；目标尽量可量化；语言务实，避免空话。',
    messages: [{ role: 'user', content: user }],
    temperature: 0.5,
    maxTokens: 6000,
  });
}

async function analyzeCompetitors({ product, competitors, dimensions }) {
  const compList = splitListText(competitors);
  const user = `请对我正在做的产品做竞品分析。

我的产品：${product}
竞品列表：${compList.join('、') || '（请基于常识选取 3-5 个典型竞品）'}
${dimensions ? `重点关注维度：${dimensions}` : ''}

请输出 Markdown，包含：
## 竞品定位概览
## 功能对比（表格：行=功能维度，列=各竞品 + 我的产品）
## 各竞品优势 / 劣势
## 差异化机会
## 建议`;

  return await deepseekChat({
    system: '你是一位资深产品与市场分析师，擅长竞品研究。输出结构化 Markdown，对比要具体、有依据。',
    messages: [{ role: 'user', content: user }],
    temperature: 0.5,
    maxTokens: 6000,
  });
}

async function generateUserStories({ featureList, persona, product }) {
  const user = `请把以下功能点/需求拆解成标准用户故事。

${product ? `产品：${product}` : ''}
${persona ? `目标用户：${persona}` : ''}
功能/需求列表：
${featureList}

请输出 Markdown，每个需求对应若干条用户故事，每条包含：
- 故事：As a ...，I want ...，So that ...
- 验收标准：...
并给出建议优先级（P0/P1/P2）。`;

  return await deepseekChat({
    system: '你是一位资深产品经理，擅长把需求拆解成用户故事并写清验收标准。用中文输出。',
    messages: [{ role: 'user', content: user }],
    temperature: 0.5,
    maxTokens: 5000,
  });
}

async function prioritizeRequirements({ requirements, method }) {
  const list = splitListText(requirements);
  const m = method === 'MoSCoW' ? 'MoSCoW（Must have / Should have / Could have / Won\'t have）' : 'RICE（Reach / Impact / Confidence / Effort）';

  const user = `请对以下需求列表用 ${m} 方法打分排序。

需求列表：
${list.map((r, i) => `${i + 1}. ${r}`).join('\n')}

请输出 Markdown：
- 一张排序表（含各项得分/分类与理由）
- 排序结论与建议（哪些先做、哪些可砍、哪些后置）`;

  return await deepseekChat({
    system: '你是一位资深产品经理，擅长需求优先级评估与取舍。用中文输出。',
    messages: [{ role: 'user', content: user }],
    temperature: 0.4,
    maxTokens: 5000,
  });
}

async function generateRoadmap({ goals, features, timeline }) {
  const user = `请根据以下信息制定产品路线图。

产品目标：${goals}
功能池：${features}
${timeline ? `期望时间跨度：${timeline}` : ''}

请输出 Markdown，包含：
## 版本规划（V1.0 / V1.5 / V2.0 ...，每个版本含：主题、核心功能、目标）
## 里程碑时间线（表格）
## 依赖与风险提示`;

  return await deepseekChat({
    system: '你是一位资深产品经理，擅长产品路线图与版本规划。用中文输出。',
    messages: [{ role: 'user', content: user }],
    temperature: 0.5,
    maxTokens: 5000,
  });
}

// ================================================================
// 文档工具注册表
// ================================================================

const DOC_TOOLS = [
  {
    id: 'prd',
    title: 'PRD 文档生成',
    icon: '📄',
    desc: '输入产品背景、目标与范围，生成结构化产品需求文档',
    generate: generatePRD,
    fields: [
      { key: 'product', label: '产品名称', type: 'text', placeholder: '例如：协同笔记工具' },
      { key: 'background', label: '背景与问题', type: 'textarea', placeholder: '要解决什么痛点？为什么现在做？' },
      { key: 'goals', label: '产品目标', type: 'textarea', placeholder: '希望达成什么？尽量可量化' },
      { key: 'targetUsers', label: '目标用户', type: 'textarea', placeholder: '面向哪些用户群体？' },
      { key: 'scope', label: '范围', type: 'textarea', placeholder: '包含 / 不包含什么' },
      { key: 'constraints', label: '约束条件（可选）', type: 'textarea', placeholder: '技术、时间、资源等限制', required: false },
    ],
  },
  {
    id: 'competitor',
    title: '竞品分析',
    icon: '⚔️',
    desc: '输入产品与竞品，生成定位、功能对比、差异化机会',
    generate: analyzeCompetitors,
    fields: [
      { key: 'product', label: '我的产品', type: 'text', placeholder: '例如：AI 笔记应用' },
      { key: 'competitors', label: '竞品列表', type: 'textarea', placeholder: '每行一个，例如：\nNotion\n飞书文档\n语雀' },
      { key: 'dimensions', label: '关注维度（可选）', type: 'text', placeholder: '例如：协作、AI 能力、价格', required: false },
    ],
  },
  {
    id: 'stories',
    title: '用户故事生成',
    icon: '📝',
    desc: '把功能点拆解成标准用户故事 + 验收标准 + 优先级',
    generate: generateUserStories,
    fields: [
      { key: 'product', label: '产品（可选）', type: 'text', placeholder: '例如：报销审批系统', required: false },
      { key: 'persona', label: '目标用户（可选）', type: 'text', placeholder: '例如：中小企业财务', required: false },
      { key: 'featureList', label: '功能 / 需求列表', type: 'textarea', placeholder: '每行一个功能点' },
    ],
  },
  {
    id: 'priority',
    title: '需求优先级排序',
    icon: '🎯',
    desc: '用 RICE 或 MoSCoW 对需求列表打分排序',
    generate: prioritizeRequirements,
    fields: [
      { key: 'requirements', label: '需求列表', type: 'textarea', placeholder: '每行一个需求' },
      { key: 'method', label: '排序方法', type: 'select', options: ['RICE', 'MoSCoW'] },
    ],
  },
  {
    id: 'roadmap',
    title: '产品路线图',
    icon: '🗺️',
    desc: '根据目标与功能规划版本里程碑与时间线',
    generate: generateRoadmap,
    fields: [
      { key: 'goals', label: '产品目标', type: 'textarea', placeholder: '未来 6-12 个月要达成什么？' },
      { key: 'features', label: '功能池', type: 'textarea', placeholder: '每行一个功能 / 主题' },
      { key: 'timeline', label: '时间跨度（可选）', type: 'text', placeholder: '例如：6 个月，2026 Q4 上线', required: false },
    ],
  },
];
