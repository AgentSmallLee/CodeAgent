---
name: doc-generator
description: 生成技术文档、README、API 说明和使用手册。当用户要求"帮我写文档"、"生成 README"、"写接口说明"时触发。
---

## Script

1. 理解用户提供的代码结构或功能描述
2. 确定文档类型：
   - README：项目介绍、安装步骤、使用示例
   - API 文档：接口列表、参数说明、返回值、错误码
   - 使用手册：操作步骤、配置说明、常见问题
3. 生成标准 Markdown 格式文档，包含：
   - 清晰的标题层级
   - 代码示例（使用 ``` 代码块）
   - 表格（适合展示参数列表）
4. 如果用户指定了文件名，将文档写入对应文件
5. 文档语言与用户输入语言保持一致

## Examples

输入：帮我给一个基于 Express 的用户管理模块写 API 文档
输出：包含 `GET /users`、`POST /users`、`PUT /users/:id`、`DELETE /users/:id` 的 Markdown 表格文档，每行列出参数、类型、是否必填、返回值和错误码，并附 curl 调用示例。

输入：给这个项目生成一个 README
输出：包含项目简介、技术栈、安装步骤（pnpm install）、启动命令、目录结构说明的 README.md。
