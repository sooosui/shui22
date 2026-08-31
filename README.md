# AI 产品需求分析工具

**🌐 在线使用：[sooosui.github.io/shui22](https://sooosui.github.io/shui22/)**

输入产品类型和目标客户，AI 自动模拟多角色客户访谈，生成融合产品规格文档。

## 功能

- 🎭 **角色生成** — 根据产品类型自动生成差异化客户角色
- 💬 **多轮访谈** — 每个角色进行多轮追问，深挖真实需求
- 🔗 **需求融合** — 按 P0/P1/P2 优先级排序，输出产品规格
- 📄 **报告导出** — 下载完整 Markdown 报告

## 部署架构

前端直连 DeepSeek（Anthropic 兼容接口），纯静态托管在 GitHub Pages，国内无需 VPN 即可访问。

- 前端：`index.html` + `css/` + `js/`
- 业务逻辑：`js/llm.js`（生成角色 / 访谈 / 融合 三个步骤直接在浏览器调用 DeepSeek）
- 配置：`js/config.js`（含 API key，已提交进仓库）

## 本地运行

任选一种静态服务器即可：

```bash
# 方式一：Python
python -m http.server 8000

# 方式二：npx serve
npx serve .

# 方式三：Vercel CLI（仍兼容）
vercel dev
```

然后打开 http://localhost:8000（或提示的地址）。

## 部署（GitHub Pages）

推送到 `master` 分支即自动发布。首次需在仓库 Settings → Pages 里把 Source 设为 "Deploy from a branch"（分支 `master`、目录 `/`）。

> ⚠️ `js/config.js` 里的 API key 会公开在网站源码中（前端直连的代价）。建议在 DeepSeek 后台单独开一个有消费限额的 key。

## 说明

- 模型名 `claude-sonnet-5` 经 DeepSeek 兼容接口映射到其内部模型；如需更强/不同模型，改 `js/config.js` 的 `model` 即可。
- `api/` 目录为旧 Vercel serverless 版本，保留作回退，GitHub Pages 不使用它。
