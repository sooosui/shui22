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
- 配置：`js/config.js`（含 API key，本地文件，已 gitignore）

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

> 首次运行前需在 `js/config.js` 填入你的 DeepSeek API key。

## 部署（GitHub Pages）

1. 在 GitHub 仓库 Settings → Secrets → Actions 添加 `DEEPSEEK_API_KEY`
   （可选：`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`）
2. 推送到 `master` 分支，GitHub Actions 会自动构建并部署
3. 在 Settings → Pages 里 Source 选择 "GitHub Actions"

`js/config.js` 会在部署时由 Actions 从 Secret 注入，不会提交进 git。

## 说明

- 模型名 `claude-sonnet-5` 经 DeepSeek 兼容接口映射到其内部模型；如需更强/不同模型，改 `js/config.js` 的 `model` 即可。
- `api/` 目录为旧 Vercel serverless 版本，保留作回退，GitHub Pages 不使用它。
