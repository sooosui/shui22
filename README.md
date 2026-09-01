# AI 产品需求分析工具

输入产品类型和目标客户，AI 自动模拟多角色客户访谈，生成融合产品规格文档。

## 功能

- 🎭 **角色生成** — 根据产品类型自动生成差异化客户角色
- 💬 **多轮访谈** — 每个角色进行多轮追问，深挖真实需求
- 🔗 **需求融合** — 按 P0/P1/P2 优先级排序，输出产品规格
- 📄 **报告导出** — 下载完整 Markdown 报告

## 部署架构（安全版）

前端所有 AI 调用统一走后端 **`/api/chat`** 代理，DeepSeek API Key **只保存在服务端环境变量里**，绝不出现在浏览器或仓库源码中。

- 前端：`index.html` + `css/` + `js/`（浏览器直接访问，不含任何密钥）
- 后端：`server.js`（Node/Express，同时托管静态文件 + `/api/chat` 代理）
- 链路：前端 `js/llm.js` → `/api/chat` → 转发 DeepSeek

> ⚠️ **API Key 永远不会提交到 git、也不会暴露给浏览器。** `.env` 已被 `.gitignore` 忽略；生产环境的 key 只配在部署平台的环境变量里。

## 本地运行

```bash
npm install
npm start
```

打开 http://localhost:3000（先在 `.env` 里填好 key，或设置环境变量 `ANTHROPIC_API_KEY`）。

## 部署（Railway，推荐）

1. 登录 [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo，选择本仓库
2. 在 Variables 里添加：
   - `ANTHROPIC_API_KEY` = 你的 DeepSeek key
   - `ANTHROPIC_BASE_URL` = `https://api.deepseek.com/anthropic`
   - （可选）`MODEL` = `claude-sonnet-5`
3. Deploy 后，Railway 会给你一个公开地址，发出去即可用

> 也可用 Vercel：改用 `api/chat.js`（serverless 函数），`server.js` 是给 Railway 这类常驻服务的，二者逻辑相同、选其一即可。

## 安全建议

- 在 DeepSeek 后台为这个项目**单独开一个 key 并设置消费限额**，被盗可随时吊销，损失可控。
- 如果只想给特定的人用，可加个简单访问密码或限制来源。

## 说明

- 模型名 `claude-sonnet-5` 经 DeepSeek 兼容接口映射到其内部模型；如需更改，改部署平台的 `MODEL` 环境变量。
- `api/` 下是 Vercel serverless 版代理，`server.js` 是 Railway/自托管版。
