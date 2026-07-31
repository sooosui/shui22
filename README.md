# AI 产品需求分析工具

输入产品类型和目标客户，AI 自动模拟多角色客户访谈，生成融合产品规格文档。

## 功能

- 🎭 **角色生成** — 根据产品类型自动生成差异化客户角色
- 💬 **多轮访谈** — 每个角色进行多轮追问，深挖真实需求
- 🔗 **需求融合** — 按 P0/P1/P2 优先级排序，输出产品规格
- 📄 **报告导出** — 下载完整 Markdown 报告

## 本地运行

```bash
# 安装 Vercel CLI
npm i -g vercel

# 设置环境变量
export ANTHROPIC_API_KEY=sk-ant-xxx

# 启动开发服务器
vercel dev
```

打开 http://localhost:3000 即可使用。

## 部署

1. 推送到 GitHub
2. 在 Vercel 中导入项目
3. 设置环境变量 `ANTHROPIC_API_KEY`
4. 自动部署完成
