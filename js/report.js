/**
 * AI 产品需求分析工具 — 报告渲染 & Markdown 导出
 */

// ================================================================
// Report rendering
// ================================================================

function renderReport(data) {
  const { product, customers, personas, requirements, spec } = data;
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
                   '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];

  let html = '';

  // ── Executive Summary ──
  if (spec.executive_summary) {
    html += `
      <div class="card report-section">
        <h2>📋 执行摘要</h2>
        <p class="report-summary">${escapeHtml(spec.executive_summary)}</p>
      </div>`;
  }

  // ── Personas ──
  html += '<div class="card report-section"><h2>👥 客户角色画像</h2><div class="persona-grid">';

  personas.forEach((p, i) => {
    const color = colors[i % colors.length];
    html += `
      <div class="persona-card">
        <div class="persona-card-header">
          <div class="persona-card-avatar" style="background:${color}">${escapeHtml(p.name[0])}</div>
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

  // ── Feature Tables ──
  html += '<div class="card report-section"><h2>🎯 融合产品规格</h2>';

  // P0
  html += '<h3>🔴 P0 — 核心功能（所有角色共同需求）</h3>';
  html += buildFeatureTable(spec.p0_features || [], 'p0');

  // P1
  html += '<h3>🟡 P1 — 重要功能（多数角色需求）</h3>';
  html += buildFeatureTable(spec.p1_features || [], 'p1');

  // P2
  html += '<h3>🟢 P2 — 差异化功能（独特价值功能）</h3>';
  html += buildFeatureTable(spec.p2_features || [], 'p2');

  html += '</div>';

  // ── Contradictions ──
  if (spec.contradictions) {
    html += `
      <div class="card report-section">
        <h2>⚠️ 需求矛盾与建议</h2>
        <div class="insight-block">${escapeHtml(spec.contradictions)}</div>
      </div>`;
  }

  // ── MVP Scope ──
  if (spec.mvp_scope) {
    html += `
      <div class="card report-section">
        <h2>🚀 MVP 范围建议</h2>
        <div class="insight-block">${escapeHtml(spec.mvp_scope)}</div>
      </div>`;
  }

  // ── Tech Stack ──
  if (spec.tech_stack) {
    html += `
      <div class="card report-section">
        <h2>🛠 推荐技术栈</h2>
        <div class="insight-block">${escapeHtml(spec.tech_stack)}</div>
      </div>`;
  }

  // ── Market Insights ──
  if (spec.market_insights) {
    html += `
      <div class="card report-section">
        <h2>📊 关键市场洞察</h2>
        <div class="insight-block">${escapeHtml(spec.market_insights)}</div>
      </div>`;
  }

  // ── Interview Details ──
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

  elReportContent.innerHTML = html;
}

function buildFeatureTable(features, priorityClass) {
  if (!features || features.length === 0) {
    return '<p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px">暂无</p>';
  }

  let html = '<table class="feature-table"><thead><tr><th style="width:60px">#</th><th>功能</th><th>描述</th><th style="width:60px">优先级</th></tr></thead><tbody>';

  features.forEach((f, i) => {
    html += `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${escapeHtml(f.name)}</strong></td>
        <td>${escapeHtml(f.description)}</td>
        <td><span class="priority-badge priority-${priorityClass}">${f.priority || 'P?'}</span></td>
      </tr>`;
  });

  html += '</tbody></table>';
  return html;
}

// ================================================================
// Markdown export
// ================================================================

$('#btn-download').addEventListener('click', () => {
  if (!analysisData) return;

  const md = buildMarkdown(analysisData);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = url;
  a.download = `product-discovery-report-${timestamp}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

function buildMarkdown(data) {
  const { product, customers, personas, requirements, spec } = data;
  const now = new Date().toLocaleString('zh-CN');

  let md = '';

  md += `# 产品需求分析报告\n\n`;
  md += `**生成时间：** ${now}\n`;
  md += `**产品类型：** ${product}\n`;
  md += `**目标客户：** ${customers}\n`;
  md += `**模拟客户数：** ${personas.length}\n\n`;
  md += `---\n\n`;

  // Executive Summary
  if (spec.executive_summary) {
    md += `## 📋 执行摘要\n\n${spec.executive_summary}\n\n`;
  }

  // Personas
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

  // Interview details
  md += `## 💬 各角色需求详情\n\n`;
  requirements.forEach((req) => {
    const p = req.persona;
    md += `### ${p.name}（${p.role}）的需求\n\n`;
    req.rounds.forEach((r) => {
      md += `#### 第 ${r.round_num} 轮\n\n> **追问：** ${r.question.slice(0, 200)}...\n\n${r.answer}\n\n`;
    });
    md += `---\n\n`;
  });

  // Feature spec
  md += `## 🎯 融合产品规格\n\n`;

  md += `### 🔴 P0 — 核心功能（所有角色共同需求）\n\n`;
  md += `| # | 功能 | 描述 |\n|---|------|------|\n`;
  (spec.p0_features || []).forEach((f, i) => {
    md += `| ${i + 1} | **${f.name}** | ${f.description} |\n`;
  });
  if (!spec.p0_features || spec.p0_features.length === 0) md += `| — | *暂无* | — |\n`;
  md += `\n`;

  md += `### 🟡 P1 — 重要功能（多数角色需求）\n\n`;
  md += `| # | 功能 | 描述 |\n|---|------|------|\n`;
  (spec.p1_features || []).forEach((f, i) => {
    md += `| ${i + 1} | **${f.name}** | ${f.description} |\n`;
  });
  if (!spec.p1_features || spec.p1_features.length === 0) md += `| — | *暂无* | — |\n`;
  md += `\n`;

  md += `### 🟢 P2 — 差异化功能（独特价值功能）\n\n`;
  md += `| # | 功能 | 描述 |\n|---|------|------|\n`;
  (spec.p2_features || []).forEach((f, i) => {
    md += `| ${i + 1} | **${f.name}** | ${f.description} |\n`;
  });
  if (!spec.p2_features || spec.p2_features.length === 0) md += `| — | *暂无* | — |\n`;
  md += `\n`;

  if (spec.contradictions) {
    md += `## ⚠️ 需求矛盾与建议\n\n${spec.contradictions}\n\n`;
  }
  if (spec.mvp_scope) {
    md += `## 🚀 MVP 范围建议\n\n${spec.mvp_scope}\n\n`;
  }
  if (spec.tech_stack) {
    md += `## 🛠 推荐技术栈\n\n${spec.tech_stack}\n\n`;
  }
  if (spec.market_insights) {
    md += `## 📊 关键市场洞察\n\n${spec.market_insights}\n\n`;
  }

  md += `---\n\n*报告由 AI 多Agent客户需求分析工具生成 | ${now}*`;

  return md;
}

// ================================================================
// Helpers
// ================================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
