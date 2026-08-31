/**
 * 应用外壳：导航路由 + 初始化
 */

const TOOL_IDS = ['interview', 'agents', 'prd', 'competitor', 'stories', 'priority', 'roadmap'];

function switchTool(name) {
  qsa('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
  qsa('.tool-view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));

  // 切换时刷新依赖本地数据的视图
  if (name === 'agents') renderAgents();
  if (name === 'interview') renderLibraryAgents();

  window.scrollTo({ top: 0 });
}

function initApp() {
  qsa('.nav-item').forEach((b) => b.addEventListener('click', () => switchTool(b.dataset.tool)));
  initInterview();
  initAgents();
  initDocTools();
  switchTool('interview');
}

initApp();
