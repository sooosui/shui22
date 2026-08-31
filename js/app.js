/**
 * AI 产品需求分析工具 — 主控制器
 */

// ================================================================
// DOM 引用
// ================================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const views = {
  input: $('#view-input'),
  progress: $('#view-progress'),
  report: $('#view-report'),
};

const stepperSteps = $$('.step');

// Input elements
const elProduct = $('#product');
const elCustomers = $('#customers');
const elCount = $('#count');
const elRounds = $('#rounds');
const elBtnStart = $('#btn-start');
const elCountVal = $('#count-val');
const elRoundsVal = $('#rounds-val');

// Progress elements
const elProgressTitle = $('#progress-title');
const elProgressBar = $('#progress-bar');
const elProgressPhase = $('#progress-phase');

// Report
const elReportContent = $('#report-content');

// ================================================================
// State
// ================================================================

let analysisData = null; // Full result for download

// ================================================================
// Form validation
// ================================================================

function checkForm() {
  const product = elProduct.value.trim();
  const customers = elCustomers.value.trim();
  elBtnStart.disabled = !product || !customers;
}

elProduct.addEventListener('input', checkForm);
elCustomers.addEventListener('input', checkForm);

// Range sliders
elCount.addEventListener('input', () => {
  elCountVal.textContent = elCount.value;
});

elRounds.addEventListener('input', () => {
  const labels = ['仅初问', '追问1轮', '追问2轮', '深度追问3轮'];
  elRoundsVal.textContent = elRounds.value;
});

// ================================================================
// Quick examples
// ================================================================

$$('.btn-example').forEach((btn) => {
  btn.addEventListener('click', () => {
    elProduct.value = btn.dataset.product;
    elCustomers.value = btn.dataset.customers;
    checkForm();
    elProduct.focus();
  });
});

// ================================================================
// View switching
// ================================================================

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

function updateStepper(activeStep) {
  stepperSteps.forEach((s) => {
    const step = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (step < activeStep) s.classList.add('done');
    if (step === activeStep) s.classList.add('active');
  });
}

// ================================================================
// API helpers
// ================================================================

// LLM 直连逻辑已移到 js/llm.js：generatePersonas / interviewRound / synthesize

// ================================================================
// Main flow
// ================================================================

elBtnStart.addEventListener('click', startAnalysis);

async function startAnalysis() {
  const product = elProduct.value.trim();
  const customers = elCustomers.value.trim();
  const count = parseInt(elCount.value);
  const rounds = parseInt(elRounds.value);

  // Switch to progress view
  showView('progress');
  updateStepper(2);

  try {
    // ---- Phase 1: Generate Personas ----
    elProgressTitle.textContent = '正在生成差异化客户角色...';
    elProgressBar.style.width = '10%';
    elProgressPhase.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">🤖 AI 正在分析目标客户群体...</p>';

    const personaResult = await generatePersonas({
      product_type: product,
      customer_desc: customers,
      persona_count: count,
    });

    const personas = personaResult.personas;
    analysisData = { product, customers, count, rounds, personas, requirements: [] };

    // Show persona cards
    renderPersonaCards(personas);
    elProgressBar.style.width = '25%';
    updateStepper(3);

    // ---- Phase 2: Interviews ----
    elProgressTitle.textContent = '正在模拟客户访谈...';
    const totalRounds = rounds + 1; // initial + follow-ups

    // Build interview display
    let interviewHTML = '';
    personas.forEach((p, i) => {
      const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
                       '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];
      const color = colors[i % colors.length];
      interviewHTML += `
        <div class="persona-card-mini" id="persona-row-${i}" style="animation-delay:${i * 0.1}s">
          <div class="persona-avatar" style="background:${color}">${p.name[0]}</div>
          <div class="persona-info-mini">
            <div class="persona-name-mini">${p.name}</div>
            <div class="persona-role-mini">${p.role} · ${p.age}岁</div>
          </div>
          <span class="persona-status status-pending" id="status-${i}">等待中</span>
        </div>`;
    });
    elProgressPhase.innerHTML = interviewHTML;

    // Run interviews
    for (let i = 0; i < personas.length; i++) {
      const p = personas[i];
      updatePersonaStatus(i, 'running', '访谈中...');

      const req = { persona: p, rounds: [] };

      // Multi-round interview
      for (let r = 0; r < totalRounds; r++) {
        updatePersonaStatus(i, 'running', `第${r + 1}/${totalRounds}轮...`);

        const roundResult = await interviewRound({
          persona: p,
          product_type: product,
          round_idx: r,
          history: req.rounds.map((rr) => ({
            question: rr.question,
            answer: rr.answer,
          })),
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

    // ---- Phase 3: Synthesis ----
    elProgressTitle.textContent = '正在融合需求，生成产品规格...';
    elProgressBar.style.width = '70%';
    elProgressPhase.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">🔄 AI 正在分析所有客户的需求，提炼共性...</p>';

    const synthResult = await synthesize({
      requirements: analysisData.requirements,
      product_type: product,
      customer_desc: customers,
    });

    analysisData.spec = synthResult.spec;
    elProgressBar.style.width = '100%';

    // ---- Done: Show Report ----
    updateStepper(5);
    setTimeout(() => {
      showView('report');
      renderReport(analysisData);
    }, 500);

  } catch (err) {
    elProgressPhase.innerHTML = `
      <div style="text-align:center;padding:24px">
        <p style="color:var(--red);font-size:18px;font-weight:700;margin-bottom:8px">❌ 分析失败</p>
        <p style="color:var(--text-secondary)">${err.message}</p>
        <button class="btn-outline" onclick="location.reload()" style="margin-top:16px">🔄 重新开始</button>
      </div>`;
    elProgressTitle.textContent = '出错了';
    elProgressBar.style.width = '100%';
    elProgressBar.style.background = 'var(--red)';
  }
}

function renderPersonaCards(personas) {
  const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6',
                   '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'];
  let html = '';
  personas.forEach((p, i) => {
    const color = colors[i % colors.length];
    html += `
      <div class="persona-card-mini" style="animation-delay:${i * 0.1}s">
        <div class="persona-avatar" style="background:${color}">${p.name[0]}</div>
        <div class="persona-info-mini">
          <div class="persona-name-mini">${p.name} — ${p.role}</div>
          <div class="persona-role-mini">${p.company} · ${p.experience} · 痛点：${p.core_pain_points}</div>
        </div>
        <span class="persona-status status-done">✅</span>
      </div>`;
  });
  elProgressPhase.innerHTML = html;
}

function updatePersonaStatus(index, mode, text) {
  const statusEl = $(`#status-${index}`);
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `persona-status status-${mode}`;
}

// ================================================================
// Restart
// ================================================================

$('#btn-restart').addEventListener('click', () => {
  analysisData = null;
  showView('input');
  updateStepper(1);
  elProgressBar.style.width = '0%';
  elProgressBar.style.background = '';
});
