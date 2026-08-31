/**
 * 通用文档工具渲染器：读 DOC_TOOLS 注册表，渲染表单 → 调 LLM → 渲染 Markdown → 导出
 */

function initDocTools() {
  DOC_TOOLS.forEach((tool) => {
    const container = qs(`[data-doc="${tool.id}"]`);
    if (!container) return;
    container.innerHTML = buildDocToolHTML(tool);
    wireDocTool(tool, container);
  });
}

function fieldToHTML(tool, f) {
  const id = `field-${tool.id}-${f.key}`;
  const ph = escapeHtml(f.placeholder || '');
  if (f.type === 'textarea') {
    return `<div class="form-group"><label>${f.label}</label><textarea id="${id}" rows="4" placeholder="${ph}"></textarea></div>`;
  }
  if (f.type === 'select') {
    const opts = (f.options || []).map((o) => `<option>${escapeHtml(o)}</option>`).join('');
    return `<div class="form-group"><label>${f.label}</label><select id="${id}">${opts}</select></div>`;
  }
  return `<div class="form-group"><label>${f.label}</label><input id="${id}" type="text" placeholder="${ph}"></div>`;
}

function buildDocToolHTML(tool) {
  const fields = tool.fields.map((f) => fieldToHTML(tool, f)).join('');
  return `
    <div class="card tool-header-card">
      <div class="tool-title"><span class="tool-icon">${tool.icon}</span> ${tool.title}</div>
      <p class="tool-desc">${tool.desc}</p>
      <form class="doc-form" id="form-${tool.id}">
        <div class="form-stack">${fields}</div>
        <button type="submit" class="btn-primary">🚀 生成</button>
      </form>
    </div>
    <div class="card result-card hidden" id="result-${tool.id}">
      <div class="result-toolbar">
        <button type="button" class="btn-secondary" data-act="copy">📋 复制</button>
        <button type="button" class="btn-outline" data-act="download">📥 下载 .md</button>
      </div>
      <div class="markdown-body" id="md-${tool.id}"></div>
    </div>`;
}

function wireDocTool(tool, container) {
  const form = qs(`#form-${tool.id}`, container);
  const resultCard = qs(`#result-${tool.id}`, container);
  const mdBox = qs(`#md-${tool.id}`, container);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = gatherInputs(tool);
    if (!validateInputs(tool, inputs)) return;

    const btn = form.querySelector('.btn-primary');
    setLoading(btn, true, '生成中...');
    resultCard.classList.add('hidden');

    try {
      const md = await tool.generate(inputs);
      mdBox.innerHTML = renderMarkdown(md);
      resultCard.dataset.md = md;
      resultCard.classList.remove('hidden');
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast('生成失败：' + err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  qsa('.result-toolbar [data-act]', container).forEach((b) => {
    b.addEventListener('click', () => {
      const md = resultCard.dataset.md || '';
      if (!md) return;
      if (b.dataset.act === 'copy') copyText(md);
      else downloadText(`${tool.title}-${timestamp()}.md`, md);
    });
  });
}

function gatherInputs(tool) {
  const inputs = {};
  tool.fields.forEach((f) => {
    const el = qs(`#field-${tool.id}-${f.key}`);
    inputs[f.key] = el ? el.value.trim() : '';
  });
  return inputs;
}

function validateInputs(tool, inputs) {
  for (const f of tool.fields) {
    if (f.required === false) continue;
    if (!inputs[f.key]) {
      toast(`请填写「${f.label}」`);
      const el = qs(`#field-${tool.id}-${f.key}`);
      if (el) el.focus();
      return false;
    }
  }
  return true;
}

function setLoading(btn, loading, label) {
  if (loading) {
    btn.dataset.orig = btn.textContent;
    btn.textContent = label || '生成中...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.orig || '🚀 生成';
    btn.disabled = false;
  }
}
