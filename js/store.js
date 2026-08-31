/**
 * 本地存储（localStorage）+ 虚拟用户库增删改查 + JSON 导入导出
 * 无后端，数据存浏览器本地。
 */

const STORE_KEYS = {
  agents: 'pd.agents',
  settings: 'pd.settings',
};

function getItem(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setItem(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function uid() {
  return 'a' + Math.random().toString(36).slice(2, 10);
}

// ================================================================
// 虚拟用户库
// ================================================================

function loadAgents() {
  return getItem(STORE_KEYS.agents, []);
}

function saveAgents(agents) {
  setItem(STORE_KEYS.agents, agents);
}

function addAgent(agent) {
  const list = loadAgents();
  agent.id = agent.id || uid();
  list.push(agent);
  saveAgents(list);
  return agent;
}

function updateAgent(agent) {
  const list = loadAgents();
  const i = list.findIndex((a) => a.id === agent.id);
  if (i >= 0) list[i] = agent;
  saveAgents(list);
}

function deleteAgent(id) {
  saveAgents(loadAgents().filter((a) => a.id !== id));
}

function getAgent(id) {
  return loadAgents().find((a) => a.id === id);
}

// ================================================================
// 导入 / 导出
// ================================================================

function exportAgentsJSON() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    agents: loadAgents(),
  };
  downloadText(`agents-export-${timestamp()}.json`, JSON.stringify(data, null, 2));
  toast('已导出 JSON');
}

function importAgentsJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const agents = Array.isArray(data) ? data : (data.agents || []);
        saveAgents(agents);
        resolve(agents);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ================================================================
// 输入文本 → 数组（按逗号/换行/顿号/分号切分）
// ================================================================

function splitListText(text) {
  return (text || '')
    .split(/[\n,，、;；]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizePersona(raw) {
  const p = { ...raw };
  // core_pain_points / use_scenarios 统一成数组（与 buildPersonaContext 兼容）
  p.core_pain_points = Array.isArray(p.core_pain_points)
    ? p.core_pain_points
    : splitListText(p.core_pain_points);
  p.use_scenarios = Array.isArray(p.use_scenarios)
    ? p.use_scenarios
    : splitListText(p.use_scenarios);
  return p;
}
