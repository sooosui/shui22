/**
 * 虚拟用户库：角色 CRUD + AI 生成 + 导入导出
 */

let editingAgentId = null;

function initAgents() {
  qs('#btn-new-agent').addEventListener('click', () => openAgentEditor(null));
  qs('#btn-save-agent').addEventListener('click', saveAgentFromEditor);
  qs('#btn-cancel-agent').addEventListener('click', closeAgentEditor);
  qs('#btn-ai-generate').addEventListener('click', aiGenerateAgent);

  qs('#btn-export-agents').addEventListener('click', exportAgentsJSON);
  qs('#btn-import-agents').addEventListener('click', () => qs('#import-file').click());
  qs('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importAgentsJSON(file);
      renderAgents();
      toast('导入成功');
    } catch {
      toast('导入失败：文件格式不正确');
    }
    e.target.value = '';
  });

  renderAgents();
}

// ================================================================
// 渲染列表
// ================================================================

function renderAgents() {
  const agents = loadAgents();
  const list = qs('#agents-list');
  qs('#agents-count').textContent = agents.length;

  if (agents.length === 0) {
    list.innerHTML = '<p class="empty-hint">还没有角色。点「＋ 新建角色」手动创建，或「✨ AI 帮我生成」。</p>';
    return;
  }

  list.innerHTML = agents
    .map(
      (a) => `
    <div class="agent-card">
      <div class="agent-card-header">
        <div class="persona-avatar" style="background:${colorFor(a.name)}">${escapeHtml((a.name || '?')[0])}</div>
        <div class="agent-card-meta">
          <div class="agent-card-name">${escapeHtml(a.name)}</div>
          <div class="agent-card-role">${escapeHtml(a.role)} · ${a.age || '-'}岁</div>
        </div>
        <div class="agent-card-actions">
          <button class="btn-outline btn-xs" onclick="openAgentEditor('${a.id}')">编辑</button>
          <button class="btn-outline btn-xs" onclick="deleteAgentAndRender('${a.id}')">删除</button>
        </div>
      </div>
      <div class="agent-card-detail">
        ${a.core_pain_points && a.core_pain_points.length ? `<p><strong>痛点：</strong>${escapeHtml(a.core_pain_points.join('、'))}</p>` : ''}
        ${a.use_scenarios && a.use_scenarios.length ? `<p><strong>场景：</strong>${escapeHtml(a.use_scenarios.join('、'))}</p>` : ''}
        ${a.company ? `<p><strong>公司：</strong>${escapeHtml(a.company)}</p>` : ''}
        ${a.personality ? `<p><strong>性格：</strong>${escapeHtml(a.personality)}</p>` : ''}
      </div>
    </div>`
    )
    .join('');
}

function deleteAgentAndRender(id) {
  if (!confirm('确定删除这个角色吗？')) return;
  deleteAgent(id);
  renderAgents();
  toast('已删除');
}

// ================================================================
// 编辑器
// ================================================================

function openAgentEditor(id) {
  editingAgentId = id || null;
  qs('#agent-editor-title').textContent = id ? '编辑角色' : '新建角色';

  if (id) {
    const a = getAgent(id);
    if (a) fillAgentForm(a);
  } else {
    clearAgentForm();
  }

  qs('#agent-editor').classList.add('open');
  qs('#agent-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeAgentEditor() {
  editingAgentId = null;
  qs('#agent-editor').classList.remove('open');
}

function fillAgentForm(a) {
  qs('#ag-name').value = a.name || '';
  qs('#ag-role').value = a.role || '';
  qs('#ag-age').value = a.age || '';
  qs('#ag-company').value = a.company || '';
  qs('#ag-pain').value = Array.isArray(a.core_pain_points) ? a.core_pain_points.join('\n') : (a.core_pain_points || '');
  qs('#ag-scenarios').value = Array.isArray(a.use_scenarios) ? a.use_scenarios.join('\n') : (a.use_scenarios || '');
  qs('#ag-tech').value = a.tech_preference || '';
  qs('#ag-budget').value = a.budget_constraint || '';
  qs('#ag-personality').value = a.personality || '';
  qs('#ag-experience').value = a.experience || '';
}

function clearAgentForm() {
  ['#ag-name', '#ag-role', '#ag-age', '#ag-company', '#ag-pain', '#ag-scenarios', '#ag-tech', '#ag-budget', '#ag-personality', '#ag-experience']
    .forEach((sel) => { qs(sel).value = ''; });
}

function saveAgentFromEditor() {
  const name = qs('#ag-name').value.trim();
  if (!name) { toast('请填写姓名'); return; }

  const agent = normalizePersona({
    name,
    role: qs('#ag-role').value.trim() || '目标用户',
    age: parseInt(qs('#ag-age').value) || 30,
    company: qs('#ag-company').value.trim(),
    core_pain_points: qs('#ag-pain').value,
    use_scenarios: qs('#ag-scenarios').value,
    tech_preference: qs('#ag-tech').value.trim(),
    budget_constraint: qs('#ag-budget').value.trim(),
    personality: qs('#ag-personality').value.trim(),
    experience: qs('#ag-experience').value.trim(),
  });

  if (editingAgentId) {
    agent.id = editingAgentId;
    updateAgent(agent);
  } else {
    addAgent(agent);
  }

  renderAgents();
  closeAgentEditor();
  toast('已保存');
}

async function aiGenerateAgent() {
  const hint = prompt('请描述产品与目标用户，AI 帮你生成一个角色。\n例如：报销审批系统，中小企业财务');
  if (!hint) return;

  try {
    toast('AI 生成中...');
    const p = await generateAgent({ product: hint });
    fillAgentForm(p);
    qs('#agent-editor').classList.add('open');
    toast('已生成，可编辑后保存');
  } catch (e) {
    toast('生成失败：' + e.message);
  }
}
