/**
 * Vercel Function: 生成差异化客户角色
 * POST /api/generate-personas
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MODEL = process.env.MODEL || 'claude-sonnet-5';

const SYSTEM_PROMPT = `你是一位资深用户研究员，擅长为产品调研构建多元化的用户角色画像。

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product_type, customer_desc, persona_count = 4 } = req.body;

  if (!product_type || !customer_desc) {
    return res.status(400).json({ error: '缺少必要参数：product_type, customer_desc' });
  }

  const userPrompt = `请为以下产品生成 ${persona_count} 个具有明显差异的目标客户角色：

产品类型：${product_type}
目标客户群体：${customer_desc}

要求这 ${persona_count} 个角色体现目标客户群体内部的关键差异（如不同职位、不同规模公司、不同使用场景等）。`;

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
        temperature: 0.9,
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

    const personas = parsePersonaJSON(text);
    return res.json({ personas });
  } catch (err) {
    console.error('generate-personas error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function parsePersonaJSON(text) {
  text = text.trim();
  if (text.startsWith('```json')) text = text.slice(7);
  if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  text = text.trim();

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON array
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']') + 1;
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end));
    }
    throw new Error(`无法解析角色 JSON: ${text.slice(0, 200)}`);
  }
}
