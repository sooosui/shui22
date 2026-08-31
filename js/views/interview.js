/**
 * 需求访谈工具：角色来源（AI 生成 / 用户库 / 手动添加）+ 访谈流程 + 报告
 */

let analysisData = null;
let interviewSource = 'auto';
let manualPersonas = [];

// DOM 引用（脚本在 body 末尾加载，DOM 已就绪）
const elProgressTitle = qs('#iv-progress-title');
const elProgressBar = qs('#iv-progress-bar');
const elProgressPhase = qs('#iv-progress-phase');

// ================================================================
// 初始化
// ================================================================

function initInterview() {
  qsa('#source-tabs .source-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchInterviewSource(tab.dataset.source));
  });

  qs('#iv-product').addEventListener('input', checkForm);
  qs('#iv-customers').addEventListener('input', checkForm);
  qs('#iv-count').addEventListener('input', () => {
    qs('#iv-count-val').textContent = qs('#iv-count').value;
  });
  qs('#iv-rounds').addEventListener('input', () => {
    qs('#iv-rounds-val').textContent = qs('#iv-rounds').value;
  });

  qsa('#view-interview .btn-example').forEach((btn) => {
    btn.addEventListener('click', () => {
      qs('#iv-product').value = btn.dataset.product;
      qs('#iv-customers').value = btn.dataset.customers;
      checkForm();
    });
  });

  qs('#btn-add-persona').addEventListener('click', addManualPersona);
  qs('#btn-start').addEventListener('click', startAnalysis);
  qs('#btn-restart').addEventListener('click', restartAnalysis);
  qs('#btn-download').addEventListener('click', downloadReport);

  renderLibraryAgents();
  renderManualList();
  checkForm();
}

// ================================================================
// 角色来源切换
// ================================================================

function switchInterviewSource(name) {
  interviewSource = name;
  qsa('#source-tabs .source-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.source === name));
  ['auto', 'library', 'manual'].forEach((s) => {
    const el = qs('#panel-' + s);
    if (el) el.classList.toggle('hidden', s !== name);
  });
  if (name === 'library') renderLibraryAgents();
  checkForm();
}

function checkForm() {
  let ok = false;
  if (interviewSource === 'auto') {
    ok = !!(qs('#iv-product').value.trim() && qs('#iv-customers').value.trim());
  } else if (interviewSource === 'library') {
    ok = qsa('#agent-list .agent-check:checked').length > 0;
  } else {
    ok = manualPersonas.length > 0;
  }
  qs('#btn-start').disabled = !ok;
}

// ================================================================
// 用户库选择
// ================================================================

function renderLibraryAgents() {
  const agents = loadAgents();
  const listEl = qs('#agent-list');
  if (!listEl) return;

  if (agents.length === 0) {
    listEl.innerHTML =
      '<p class="empty-hint">用户库为空。<a href="#" id="go-agents">去「用户库」创建角色 →</a></p>';
    const a = qs('#go-agents');
    if (a) a.addEventListener('click', (e) => { e.preventDefault(); switchTool('agents'); });
  } else {
    listEl.innerHTML = agents
      .map(
        (a) => `
      <label class="agent-check-item">
        <input type="checkbox" class="agent-check" data-id="${a.id}" onchange="checkForm()">
        <span class="agent-avatar-sm" style="background:${colorFor(a.name)}">${escapeHtml((a.name || '?')[0])}</span>
        <span class="agent-check-info">
          <span class="agent-check-name">${escapeHtml(a.name)}</span>
          <span class="agent-check-role">${escapeHtml(a.role)} · ${a.age || '-'}岁</span>
        </span>
      </label>`
      )
      .join('');
  }
  checkForm();
}

function getSelectedAgents() {
  const ids = qsa('#agent-list .agent-check:checked').map((c) => c.dataset.id);
  return loadAgents().filter((a) => ids.includes(a.id)).map(normalizePersona);
}

// ================================================================
// 手动添加角色
// ================================================================

function addManualPersona() {
  const name = qs('#mp-name').value.trim();
  if (!name) { toast('请填写姓名'); return; }

  const persona = normalizePersona({
    name,
    role: qs('#mp-role').value.trim() || '目标用户',
    age: parseInt(qs('#mp-age').value) || 30,
    experience: '',
    company: '',
    core_pain_points: qs('#mp-pain').value,
    use_scenarios: qs('#mp-scenarios').value,
    tech_preference: '',
    budget_constraint: '',
    personality: '',
  });

  manualPersonas.push(persona);
  renderManualList();
  ['#mp-name', '#mp-role', '#mp-age', '#mp-pain', '#mp-scenarios'].forEach((sel) => {
    qs(sel).value = '';
  });
  checkForm();
}

function renderManualList() {
  const el = qs('#manual-list');
  if (!el) return;
  el.innerHTML =
    manualPersonas
      .map(
        (p, i) => `
    <div class="persona-card-mini">
      <div class="persona-avatar" style="background:${colorFor(p.name)}">${escapeHtml((p.name || '?')[0])}</div>
      <div class="persona-info-mini">
        <div class="persona-name-mini">${escapeHtml(p.name)}</div>
        <div class="persona-role-mini">${escapeHtml(p.role)} · ${p.age}岁</div>
      </div>
      <button class="btn-outline btn-xs" onclick="removeManualPersona(${i})">移除</button>
    </div>`
      )
      .join('') || '<p class="empty-hint">尚未添加角色</p>';
}

function removeManualPersona(i) {
  manualPersonas.splice(i, 1);
  renderManualList();
  checkForm();
}

// ================================================================
// 主流程
// ================================================================

function showInterviewView(name) {
  ['input', 'progress', 'report'].forEach((n) => {
    const el = qs('#iv-' + n);
    if (el) el.classList.toggle('hidden', n !== name);
  });
}

function updateStepper(activeStep) {
  qsa('#stepper .step').forEach((s) => {
    const step = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (step < activeStep) s.classList.add('done');
    if (step === activeStep) s.classList.add('active');
  });
}

async function startAnalysis() {
  const count = parseInt(qs('#iv-count').value);
  const rounds = parseInt(qs('#iv-rounds').value);

  showInterviewView('progress');
  updateStepper(2);

  try {
    let product, customers, personas;

    elProgressTitle.textContent = '正在准备客户角色...';
    elProgressBar.style.width = '10%';
    elProgressPhase.innerHTML =
      '<p style="text-align:center;color:var(--text-secondary)">🤖 AI 正在分析目标客户群体...</p>';

    if (interviewSource === 'auto') {
      product = qs('#iv-product').value.trim();
      customers = qs('#iv-customers').value.trim();
      elProgressTitle.textContent = '正在生成差异化客户角色...';
      const result = await generatePersonas({
        product_type: product,
        customer_desc: customers,
        persona_count: count,
      });
      personas = result.personas;
    } else if (interviewSource === 'library') {
      personas = getSelectedAgents();
      product = qs('#iv-product').value.trim() || '我的产品';
      customers = '从用户库选择的虚拟用户';
    } else {
      personas = manualPersonas.slice();
      product = qs('#iv-product').value.trim() || '我的产品';
      customers = '手动添加的虚拟用户';
    }

    analysisData = { product, customers, count: personas.length, rounds, personas, requirements: [] };

    renderPersonaCards(personas);
    elProgressBar.style.width = '25%';
    updateStepper(3);

    // ---- 访谈 ----
    elProgressTitle.textContent = '正在模拟客户访谈...';
    const totalRounds = rounds + 1;
    let interviewHTML = '';
    personas.forEach((p, i) => {
      const color = colorFor(p.name);
      interviewHTML += `
        <div class="persona-card-mini" id="persona-row-${i}" style="animation-delay:${i * 0.1}s">
          <div class="persona-avatar" style="background:${color}">${escapeHtml((p.name || '?')[0])}</div>
          <div class="persona-info-mini">
            <div class="persona-name-mini">${escapeHtml(p.name)}</div>
            <div class="persona-role-mini">${escapeHtml(p.role)} · ${p.age}岁</div>
          </div>
          <span class="persona-status status-pending" id="status-${i}">等待中</span>
        </div>`;
    });
    elProgressPhase.innerHTML = interviewHTML;

    for (let i = 0; i < personas.length; i++) {
      const p = personas[i];
      updatePersonaStatus(i, 'running', '访谈中...');

      const req = { persona: p, rounds: [] };
      for (let r = 0; r < totalRounds; r++) {
        updatePersonaStatus(i, 'running', `第${r + 1}/${totalRounds}轮...`);
        const roundResult = await interviewRound({
          persona: p,
          product_type: product,
          round_idx: r,
          history: req.rounds.map((rr) => ({ question: rr.question, answer: rr.answer })),
        });
        req.rounds.push({
          round_num: r + 1,
          question: roundResult.question,
          answer: roundResult.answer,
        });
      }

      analysisData.requirements.push(req);
      updatePersonaStatus(i, 'done', '完成 ✓');
      elProgressBar.style.width = `${25 + ((i + 1) / personas.length) * 40}%`;
    }

    updateStepper(4);

    // ---- 融合 ----
    elProgressTitle.textContent = '正在融合需求，生成产品规格...';
    elProgressBar.style.width = '70%';
    elProgressPhase.innerHTML =
      '<p style="text-align:center;color:var(--text-secondary)">🔄 AI 正在分析所有客户的需求，提炼共性...</p>';

    const synthResult = await synthesize({
      requirements: analysisData.requirements,
      product_type: product,
      customer_desc: customers,
    });
    analysisData.spec = synthResult.spec;
    elProgressBar.style.width = '100%';

    updateStepper(5);
    setTimeout(() => {
      showInterviewView('report');
      renderReport(analysisData);
    }, 500);
  } catch (err) {
    elProgressPhase.innerHTML = `
      <div style="text-align:center;padding:24px">
        <p style="color:var(--red);font-size:18px;font-weight:700;margin-bottom:8px">❌ 分析失败</p>
        <p style="color:var(--text-secondary)">${escapeHtml(err.message)}</p>
        <button class="btn-outline" onclick="restartAnalysis()" style="margin-top:16px">🔄 重新开始</button>
      </div>`;
    elProgressTitle.textContent = '出错了';
    elProgressBar.style.width = '100%';
    elProgressBar.style.background = 'var(--red)';
  }
}

function renderPersonaCards(personas) {
  let html = '';
  personas.forEach((p, i) => {
    html += `
      <div class="persona-card-mini" style="animation-delay:${i * 0.1}s">
        <div class="persona-avatar" style="background:${colorFor(p.name)}">${escapeHtml((p.name || '?')[0])}</div>
        <div class="persona-info-mini">
          <div class="persona-name-mini">${escapeHtml(p.name)} — ${escapeHtml(p.role)}</div>
          <div class="persona-role-mini">${escapeHtml(p.company)} · ${escapeHtml(p.experience)} · 痛点：${escapeHtml(p.core_pain_points)}</div>
        </div>
        <span class="persona-status status-done">✅</span>
      </div>`;
  });
  elProgressPhase.innerHTML = html;
}

function updatePersonaStatus(index, mode, text) {
  const statusEl = qs(`#status-${index}`);
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `persona-status status-${mode}`;
}

function restartAnalysis() {
  analysisData = null;
  showInterviewView('input');
  updateStepper(1);
  elProgressBar.style.width = '0%';
  elProgressBar.style.background = '';
}

// ================================================================
// 报告渲染 + Markdown 导出（原 report.js）
// ================================================================

function renderReport(data) {
  const { product, customers, personas, requirements, spec } = data;
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];

  let html = '';

  if (spec.executive_summary) {
    html += `
      <div class="card report-section">
        <h2>📋 执行摘要</h2>
        <p class="report-summary">${escapeHtml(spec.executive_summary)}</p>
      </div>`;
  }

  html += '<div class="card report-section"><h2>👥 客户角色画像</h2><div class="persona-grid">';
  personas.forEach((p, i) => {
    const color = colors[i % colors.length];
    html += `
      <div class="persona-card">
        <div class="persona-card-header">
          <div class="persona-card-avatar" style="background:${color}">${escapeHtml((p.name || '?')[0])}</div>
          <div>
            <div class="persona-card-name">${escapeHtml(p.name)}</div>
            <div class="persona-card-role">${escapeHtml(p.role)} · ${p.age}岁</div>
          </div>
        </div>
        <div class="persona-card-detail">
          <p><strong>公司：</strong>${escapeHtml(p.company)}</p>
          <p><strong>经验：</strong>${escapeHtml(p.experience)}</p>
          <p><strong>核心痛点：</strong>${escapeHtml(p.core_pain_points)}</p>
          <p><strong>使用场景：</strong>${escapeHtml(p.use_scenarios)}</p>
          <p><strong>技术偏好：</strong>${escapeHtml(p.tech_preference)}</p>
          <p><strong>预算：</strong>${escapeHtml(p.budget_constraint)}</p>
          <p><strong>性格：</strong>${escapeHtml(p.personality)}</p>
        </div>
      </div>`;
  });
  html += '</div></div>';

  html += '<div class="card report-section"><h2>🎯 融合产品规格</h2>';
  html += '<h3>🔴 P0 — 核心功能（所有角色共同需求）</h3>';
  html += buildFeatureTable(spec.p0_features || [], 'p0');
  html += '<h3>🟡 P1 — 重要功能（多数角色需求）</h3>';
  html += buildFeatureTable(spec.p1_features || [], 'p1');
  html += '<h3>🟢 P2 — 差异化功能（独特价值功能）</h3>';
  html += buildFeatureTable(spec.p2_features || [], 'p2');
  html += '</div>';

  if (spec.contradictions) {
    html += `<div class="card report-section"><h2>⚠️ 需求矛盾与建议</h2><div class="insight-block">${escapeHtml(spec.contradictions)}</div></div>`;
  }
  if (spec.mvp_scope) {
    html += `<div class="card report-section"><h2>🚀 MVP 范围建议</h2><div class="insight-block">${escapeHtml(spec.mvp_scope)}</div></div>`;
  }
  if (spec.tech_stack) {
    html += `<div class="card report-section"><h2>🛠 推荐技术栈</h2><div class="insight-block">${escapeHtml(spec.tech_stack)}</div></div>`;
  }
  if (spec.market_insights) {
    html += `<div class="card report-section"><h2>📊 关键市场洞察</h2><div class="insight-block">${escapeHtml(spec.market_insights)}</div></div>`;
  }

  html += '<div class="card report-section"><h2>💬 访谈详情</h2>';
  requirements.forEach((req, i) => {
    const p = req.persona;
    html += `<h3>${escapeHtml(p.name)}（${escapeHtml(p.role)}）</h3>`;
    req.rounds.forEach((r) => {
      html += `<p style="color:var(--text-secondary);font-size:13px;margin-top:12px"><strong>第 ${r.round_num} 轮追问：</strong></p>`;
      html += `<div class="insight-block">${escapeHtml(r.answer)}</div>`;
    });
    if (i < requirements.length - 1) {
      html += '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0">';
    }
  });
  html += '</div>';

  qs('#iv-report-content').innerHTML = html;
}

function buildFeatureTable(features, priorityClass) {
  if (!features || features.length === 0) {
    return '<p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">暂无</p>';
  }
  let html = '<table class="feature-table"><thead><tr><th style="width:60px">#</th><th>功能</th><th>描述</th><th style="width:60px">优先级</th></tr></thead><tbody>';
  features.forEach((f, i) => {
    html += `<tr><td>${i + 1}</td><td><strong>${escapeHtml(f.name)}</strong></td><td>${escapeHtml(f.description)}</td><td><span class="priority-badge priority-${priorityClass}">${f.priority || 'P?'}</span></td></tr>`;
  });
  html += '</tbody></table>';
  return html;
}

function downloadReport() {
  if (!analysisData) return;
  downloadText(`product-discovery-report-${timestamp()}.md`, buildMarkdown(analysisData));
}

function buildMarkdown(data) {
  const { product, customers, personas, requirements, spec } = data;
  const now = new Date().toLocaleString('zh-CN');

  let md = `# 产品需求分析报告\n\n`;
  md += `**生成时间：** ${now}\n`;
  md += `**产品类型：** ${product}\n`;
  md += `**目标客户：** ${customers}\n`;
  md += `**模拟客户数：** ${personas.length}\n\n`;
  md += `---\n\n`;

  if (spec.executive_summary) md += `## 📋 执行摘要\n\n${spec.executive_summary}\n\n`;

  md += `## 👥 客户角色画像\n\n`;
  personas.forEach((p, i) => {
    md += `### 角色 ${i + 1}：${p.name} — ${p.role}\n\n`;
    md += `| 属性 | 详情 |\n|------|------|\n`;
    md += `| 年龄 | ${p.age}岁 |\n`;
    md += `| 职业 | ${p.role} |\n`;
    md += `| 经验 | ${p.experience} |\n`;
    md += `| 公司 | ${p.company} |\n`;
    md += `| 核心痛点 | ${p.core_pain_points} |\n`;
    md += `| 使用场景 | ${p.use_scenarios} |\n`;
    md += `| 技术偏好 | ${p.tech_preference} |\n`;
    md += `| 预算 | ${p.budget_constraint} |\n`;
    md += `| 性格 | ${p.personality} |\n\n`;
  });

  md += `## 💬 各角色需求详情\n\n`;
  requirements.forEach((req) => {
    const p = req.persona;
    md += `### ${p.name}（${p.role}）的需求\n\n`;
    req.rounds.forEach((r) => {
      md += `#### 第 ${r.round_num} 轮\n\n> **追问：** ${r.question.slice(0, 200)}...\n\n${r.answer}\n\n`;
    });
    md += `---\n\n`;
  });

  md += `## 🎯 融合产品规格\n\n`;
  md += `### 🔴 P0 — 核心功能（所有角色共同需求）\n\n`;
  md += `| # | 功能 | 描述 |\n|---|------|------|\n`;
  (spec.p0_features || []).forEach((f, i) => { md += `| ${i + 1} | **${f.name}** | ${f.description} |\n`; });
  if (!spec.p0_features || spec.p0_features.length === 0) md += `| — | *暂无* | — |\n`;
  md += `\n### 🟡 P1 — 重要功能（多数角色需求）\n\n| # | 功能 | 描述 |\n|---|------|------|\n`;
  (spec.p1_features || []).forEach((f, i) => { md += `| ${i + 1} | **${f.name}** | ${f.description} |\n`; });
  if (!spec.p1_features || spec.p1_features.length === 0) md += `| — | *暂无* | — |\n`;
  md += `\n### 🟢 P2 — 差异化功能（独特价值功能）\n\n| # | 功能 | 描述 |\n|---|------|------|\n`;
  (spec.p2_features || []).forEach((f, i) => { md += `| ${i + 1} | **${f.name}** | ${f.description} |\n`; });
  if (!spec.p2_features || spec.p2_features.length === 0) md += `| — | *暂无* | — |\n`;
  md += `\n`;

  if (spec.contradictions) md += `## ⚠️ 需求矛盾与建议\n\n${spec.contradictions}\n\n`;
  if (spec.mvp_scope) md += `## 🚀 MVP 范围建议\n\n${spec.mvp_scope}\n\n`;
  if (spec.tech_stack) md += `## 🛠 推荐技术栈\n\n${spec.tech_stack}\n\n`;
  if (spec.market_insights) md += `## 📊 关键市场洞察\n\n${spec.market_insights}\n\n`;

  md += `---\n\n*报告由 PM Studio 生成 | ${now}*`;
  return md;
}

// ================================================================
// 颜色（按姓名哈希取稳定色）
// ================================================================

function colorFor(name) {
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}
