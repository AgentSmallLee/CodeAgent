# openai.chat.completions.create 返回对象结构（openai SDK v7.9.0）

基于本项目安装的 openai@7.9.0 的 TypeScript 类型定义整理。非流式调用（默认）返回 `APIPromise<ChatCompletion>`，`await` 后得到如下结构。

## 顶层结构 ChatCompletion

```ts
interface ChatCompletion {
  id: string                        // 本次补全的唯一 ID，如 "chatcmpl-xxx"
  object: 'chat.completion'          // 固定值，可用于区分对象类型
  created: number                    // 创建时间，Unix 时间戳（秒）
  model: string                      // 实际使用的模型名（可能与请求的不同，如带版本后缀）
  choices: Choice[]                  // 候选结果，请求 n>1 时有多个，日常取 choices[0]
  usage?: CompletionUsage            // token 用量统计
  service_tier?: 'auto' | 'default' | 'flex' | 'scale' | 'priority' | 'fast' | null
  system_fingerprint?: string        // 已废弃，后端配置指纹（配合 seed 判断确定性）
  metadata?: Record<string, string> | null  // 请求时传入的附加键值对原样返回
}
```

## choices[i] —— Choice

```ts
interface Choice {
  index: number          // 该候选在数组中的下标，取 choices[0] 时恒为 0
  message: ChatCompletionMessage  // 模型生成的消息（见下）
  finish_reason:         // 模型停止生成的原因，agent 循环的关键判断字段
    | 'stop'             //   自然结束，或命中 stop 序列
    | 'length'           //   达到 max_tokens 被截断
    | 'tool_calls'       //   模型请求调用工具（agent 循环应继续）
    | 'content_filter'   //   内容被安全过滤
    | 'function_call'    //   已废弃的旧函数调用
  logprobs: Choice.Logprobs | null  // 仅请求 logprobs 时非空
}
```

## choices[i].message —— ChatCompletionMessage

```ts
interface ChatCompletionMessage {
  role: 'assistant'                       // 固定为 assistant
  content: string | null                  // 文本回复；模型只调工具不说话时为 null
  refusal: string | null                  // 模型拒绝回答时的说明（安全策略触发）
  tool_calls?: ChatCompletionMessageToolCall[]  // 模型请求的工具调用列表
  annotations?: Annotation[]              // 网页搜索的 URL 引用（type: 'url_citation'）
  audio?: ChatCompletionAudio | null       // 请求音频输出时的音频数据
  function_call?: { name, arguments } | null  // 已废弃，被 tool_calls 取代
}
```

### tool_calls[i]（agent 场景最重要）

```ts
interface ChatCompletionMessageFunctionToolCall {
  id: string          // 本次工具调用的 ID，如 "call_xxx"
  type: 'function'    // 或 'custom'（自定义工具）
  function: {
    name: string      // 要调用的函数名
    arguments: string // 参数，注意是 JSON 字符串，需自己 JSON.parse
  }
}
```

**坑**：`arguments` 是字符串不是对象——官方注释明确说模型不保证生成合法 JSON，可能幻觉出不存在的参数，`JSON.parse` 后要校验。

## usage —— CompletionUsage

```ts
interface CompletionUsage {
  prompt_tokens: number      // 输入 token 数
  completion_tokens: number  // 输出 token 数
  total_tokens: number       // 合计（计费依据）
  prompt_tokens_details?: {
    cached_tokens?: number   // 命中缓存的输入 token（缓存部分按折扣计费）
    audio_tokens?: number
    image_tokens?: number
  }
  completion_tokens_details?: {
    reasoning_tokens?: number  // 推理模型（o 系列 / R1）的思考 token
    audio_tokens?: number
    text_tokens?: number
  }
}
```

## 完整 JSON 示例

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1757123456,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么可以帮你的吗？",
        "refusal": null
      },
      "finish_reason": "stop",
      "logprobs": null
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 9,
    "total_tokens": 21,
    "prompt_tokens_details": { "cached_tokens": 0 },
    "completion_tokens_details": { "reasoning_tokens": 0 }
  },
  "service_tier": "default"
}
```

## 常用访问模式

```ts
const response = await client.chat.completions.create({ ... })

// 文本回复
const text = response.choices[0].message.content

// agent 循环：先看 finish_reason
const choice = response.choices[0]
if (choice.finish_reason === 'tool_calls') {
  for (const call of choice.message.tool_calls ?? []) {
    const args = JSON.parse(call.function.arguments)  // 需 try/catch
    // ... 执行工具，把结果以 role: 'tool' 消息回传，再次调用 create
  }
}

// token 用量
const { prompt_tokens, completion_tokens, total_tokens } = response.usage ?? {}
```

## 相关但不同的返回类型

| 调用方式 | 返回类型 | 区别 |
|---|---|---|
| `create({ ... })` | `ChatCompletion` | 本文结构，一次性完整返回 |
| `create({ ..., stream: true })` | `Stream<ChatCompletionChunk>` | 每块 `choices[0]` 是 `delta` 而非 `message`，只含增量片段；`usage` 默认为空，需 `stream_options: { include_usage: true }` |
| `parse({ ... })` | `ParsedChatCompletion<T>` | 结构同上，`tool_calls` 额外多 `parsed_arguments`（已按 schema 解析的对象） |
| `client.responses.create` | `Response` | 另一套 Responses API，结构与 Chat Completions 完全不同 |

## DeepSeek 兼容性说明

本项目用 DeepSeek 端点（OpenAI 兼容协议）：

- 上述结构 DeepSeek 全部兼容
- `deepseek-reasoner`（R1）额外在 `message` 上返回非标准字段 `reasoning_content`（思考链文本），openai SDK 类型里没有，访问需要类型断言
- `service_tier`、`annotations`、`moderation` 等 OpenAI 专有字段 DeepSeek 通常不返回或为空

## TypeScript 类型引用

```ts
import type { ChatCompletion } from 'openai/resources/chat/completions'
// 或
import type OpenAI from 'openai'
type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion
```
