/**
 * Vercel Function: 模拟单轮客户访谈
 * POST /api/interview
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MODEL = process.env.MODEL || 'claude-sonnet-5';

const ROUND_PROMPTS = [
  // Round 0: 初始需求探索
  `你是{name}，一个{role}。请从你的角度，详细描述你理想中的{product_type}是什么样的？

请包括：
- 你最需要它解决什么问题？
- 你会在什么场景下使用它？
- 它最关键的 3-5 个功能是什么？
- 你现在是怎么解决这些问题的？有什么不满？`,

  // Round 1: 场景深挖
  `感谢你的分享。我想深入了解你提到的使用场景。

针对"{product_type}"，请具体描述一个典型的工作日场景——从你打开这个产品到完成任务的完整过程。
- 每个步骤具体做什么？
- 哪个环节最让你头疼？
- 你期望的理想体验是什么样的？`,

  // Round 2: 优先级与决策
  `现在我们来谈谈优先级和实际决策。

关于{product_type}：
- 如果只能保留 3 个功能，你会选哪 3 个？为什么？
- 你愿意为这样的产品付多少钱（月费或年费）？
- 你之前尝试过哪些替代方案？它们哪里让你不满意？
- 什么样的产品会让你觉得"非用不可"？`,

  // Round 3: 补充深挖
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { persona, product_type, round_idx = 0, history = [] } = req.body;

  if (!persona || !product_type) {
    return res.status(400).json({ error: '缺少必要参数：persona, product_type' });
  }

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

  // Build the question from template
  const roundIdx = Math.min(round_idx, ROUND_PROMPTS.length - 1);
  const questionTemplate = ROUND_PROMPTS[roundIdx];
  const question = questionTemplate
    .replace(/\{name\}/g, persona.name)
    .replace(/\{role\}/g, persona.role)
    .replace(/\{product_type\}/g, product_type);

  // Build messages with history
  const messages = [];

  // Add history from previous rounds
  for (const h of history) {
    messages.push({ role: 'user', content: h.question });
    messages.push({ role: 'assistant', content: h.answer });
  }

  // Add current question
  messages.push({ role: 'user', content: question });

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
        temperature: 0.7,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const answer = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return res.json({ question, answer });
  } catch (err) {
    console.error('interview error:', err);
    return res.status(500).json({ error: err.message });
  }
}
