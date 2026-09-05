---
name: code-review
description: 审查代码质量，从命名规范、类型安全、逻辑正确性、性能、错误处理五个维度分析代码，按优先级输出问题并给出修改示例。当用户粘贴代码并要求"帮我看看"、"有什么问题"、"怎么优化"时触发。适用于 TypeScript、JavaScript、Vue3、React、Node.js 等前端及全栈技术栈。
---

## Script

1. 读取用户提供的代码内容
2. 分析以下维度：
   - 命名规范：变量、函数、组件是否遵循约定（camelCase、PascalCase）
   - 类型安全：TypeScript 类型标注是否完整，有无 any 滥用
   - 逻辑正确性：有无明显的逻辑错误、边界未处理
   - 性能问题：有无不必要的重复计算、内存泄漏风险
   - 错误处理：async/await 是否有 try/catch，Promise 是否处理了 reject
3. 按优先级排序输出：严重问题 > 性能问题 > 规范问题 > 风格建议
4. 为每个问题提供：问题描述、影响说明、修改后的代码示例
5. 最后给出整体评分（1-10分）和改进总结

## Examples

输入：

```typescript
function getUser(id) {
  let data = await fetch('/api/user/' + id)
  return data
}
```

输出：
- 严重问题：`await` 用在非 async 函数中会报语法错误；`fetch` 返回的 Response 未调用 `.json()`
- 规范问题：参数 `id` 缺少类型标注，返回值缺少 `Promise<User>` 类型
- 修改示例：`async function getUser(id: string): Promise<User> { const res = await fetch(...); if (!res.ok) throw new Error(...); return res.json() }`
