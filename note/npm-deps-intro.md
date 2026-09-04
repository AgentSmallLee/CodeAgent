# 常用 npm 依赖说明

## openai

OpenAI 官方 Node.js SDK，用于调用 OpenAI 的各种 API。

**主要用途：**
- 调用 Chat Completions API（GPT 对话）
- 调用 Embeddings API（文本向量化）
- 调用 Images API（DALL-E 生成图片）
- 调用 Audio API（语音转文字 / TTS）
- 调用 Assistants API、Files API、Fine-tuning API 等
- 支持流式响应（streaming）、函数调用（function calling）
- 同时支持 Node.js 和浏览器环境

**基本用法：**
```js
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '你好' }]
})
```

---

## dotenv

从 `.env` 文件加载环境变量到 `process.env` 的工具库。

**主要用途：**
- 将敏感配置（API Key、数据库密码等）放在 `.env` 文件中，不提交到 Git
- 开发环境下快速加载环境变量，不用手动 export
- 支持多环境配置（`.env.development`、`.env.production` 等）
- 支持变量插值、注释等

**基本用法：**
```js
import 'dotenv/config'
// 或者
import dotenv from 'dotenv'
dotenv.config()

console.log(process.env.OPENAI_API_KEY) // 读取 .env 文件中的变量
```

**.gitignore 建议：**
```
.env
.env.local
.env.*.local
```

---

## fs-extra

Node.js 内置 `fs` 模块的增强版，提供更便捷的文件系统操作 API。

**主要用途：**
- 完全兼容原生 `fs` 的所有 API
- 提供 Promise 化的异步 API（比原生 `fs/promises` 更丰富）
- 常用便捷方法：
  - `fs.copy()` — 复制文件/目录（递归）
  - `fs.move()` — 移动文件/目录
  - `fs.remove()` — 删除文件/目录（等价于 rm -rf）
  - `fs.ensureDir()` — 确保目录存在，不存在则创建（含父目录）
  - `fs.ensureFile()` — 确保文件存在
  - `fs.readJson()` / `fs.writeJson()` — 直接读写 JSON 文件
  - `fs.emptyDir()` — 清空目录

**基本用法：**
```js
import fs from 'fs-extra'

// 确保目录存在
await fs.ensureDir('./data/output')

// 读写 JSON
const data = await fs.readJson('./config.json')
await fs.writeJson('./result.json', { ok: true }, { spaces: 2 })

// 复制整个目录
await fs.copy('./src', './dist')
```

---

## 三者组合使用场景

开发 AI 应用时的典型搭配：
1. **dotenv** 加载 `.env` 中的 OpenAI API Key
2. **openai** 调用大模型完成任务
3. **fs-extra** 读写本地文件、保存生成结果
