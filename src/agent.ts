import OpenAI from 'openai'
import { loadSkills, buildSkillsPrompt, type Skill } from './skill.loader.js'
import { createSandbox, type SandboxConfig, type SandboxContext } from './sandbox.js'
import { hitlCheckpoint, type HitlConfig } from './hitl.js'

export interface AgentConfig {
  name: string
  model?: string
  apiKey?: string
  /** API 端点，兼容 OpenAI 协议的服务地址，默认 https://ark.cn-beijing.volces.com/api/v3 */
  baseUrl?: string
  temperature?: number
  skillsDir?: string
  sandbox?: SandboxConfig
  hitl?: HitlConfig
  systemPrompt?: string
  maxTokens?: number
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResult {
  content: string
  messages: AgentMessage[]
  filesWritten: string[]
}

export class CodeAgent {
  private client: OpenAI
  private config: Required<AgentConfig>
  private skills: Skill[] = []
  private sandbox: SandboxContext | null = null
  private conversationHistory: AgentMessage[] = []

  constructor(config: AgentConfig) {
    this.config = {
      name: config.name,
      model: config.model ?? (process.env.DOUBAO_MODEL || 'doubao-seed-2-1-turbo-260628'),
      apiKey: config.apiKey ?? process.env.DOUBAO_API_KEY ?? '',
      baseUrl: config.baseUrl ?? process.env.DOUBAO_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
      temperature: config.temperature ?? Number(process.env.DOUBAO_TEMPERATURE ?? 0.7),
      skillsDir: config.skillsDir ?? '.codeagent/skills',
      sandbox: config.sandbox ?? {
        workspacePath: process.cwd(),
        outputDir: 'output',
        verbose: true,
      },
      hitl: config.hitl ?? { enabled: true, autoApprove: false },
      systemPrompt: config.systemPrompt ?? '',
      maxTokens: config.maxTokens ?? 4096,
    }

    if (!this.config.apiKey) {
      throw new Error('缺少 DOUBAO_API_KEY，请在 .env 文件中配置')
    }

    // OpenAI 兼容协议，通过 baseUrl 切换服务端（DeepSeek、豆包 Ark 等）
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    })
  }

  async init(): Promise<void> {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`🤖 ${this.config.name} 启动中...`)
    console.log(`${'='.repeat(50)}`)

    console.log('\n📂 [CodeAgent] 正在加载 Skill 文件...')
    this.skills = await loadSkills(this.config.skillsDir)
    console.log(`[CodeAgent] 共加载 ${this.skills.length} 个 Skill`)

    console.log('\n🔒 [CodeAgent] 正在初始化沙箱...')
    this.sandbox = createSandbox(this.config.sandbox)

    console.log(`\n✅ [CodeAgent] 初始化完成，模型：${this.config.model}`)
    console.log(`${'='.repeat(50)}\n`)
  }

  private buildSystemPrompt(): string {
    const skillsSection = buildSkillsPrompt(this.skills)
    const sandboxSection = this.sandbox
      ? `\n## 工作区信息\n当前输出路径：${this.sandbox.outputPath}\n所有文件操作都写入此目录。`
      : ''

    return `你是 ${this.config.name}，一个基于 Doubao 的通用型 AI 智能体。

## 核心能力
- 理解用户的自然语言目标，自动规划执行步骤
- 调用相应的 Skill 技能处理专项任务
- 将结果写入本地文件系统
${skillsSection}
${sandboxSection}

## 行为准则
- 每次回复说明你正在做什么（Planning → 执行 → 输出）
- 需要写文件时，使用以下格式：
\`\`\`filename:文件名.md
文件内容
\`\`\`
- 使用中文回复

${this.config.systemPrompt}`
  }

  async invoke(userMessage: string): Promise<AgentResult> {
    const approved = await hitlCheckpoint(userMessage, this.config.hitl)
    if (!approved) {
      return {
        content: '操作已被用户取消。',
        messages: this.conversationHistory,
        filesWritten: [],
      }
    }

    this.conversationHistory.push({ role: 'user', content: userMessage })

    console.log(`\n📨 [CodeAgent] 收到任务：${userMessage.slice(0, 80)}${userMessage.length > 80 ? '...' : ''}`)
    console.log('[CodeAgent] 正在思考...\n')

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    })

    const assistantContent = response.choices[0]?.message?.content ?? ''
    this.conversationHistory.push({ role: 'assistant', content: assistantContent })

    const filesWritten = await this.processFileOperations(assistantContent)

    console.log('\n' + '─'.repeat(50))
    console.log('🎯 [CodeAgent] 执行完成')
    if (filesWritten.length > 0) {
      console.log(`📄 写入文件：${filesWritten.join(', ')}`)
    }

    return { content: assistantContent, messages: this.conversationHistory, filesWritten }
  }

  async invokeStream(userMessage: string): Promise<AgentResult> {
    const approved = await hitlCheckpoint(userMessage, this.config.hitl)
    if (!approved) {
      return {
        content: '操作已被用户取消。',
        messages: this.conversationHistory,
        filesWritten: [],
      }
    }

    this.conversationHistory.push({ role: 'user', content: userMessage })

    console.log(`\n📨 [CodeAgent] 收到任务：${userMessage.slice(0, 80)}${userMessage.length > 80 ? '...' : ''}`)
    console.log('[CodeAgent] 开始输出：\n')
    console.log('─'.repeat(50))

    let fullContent = ''

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true,
      messages: [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.conversationHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        process.stdout.write(delta)
        fullContent += delta
      }
    }

    console.log('\n' + '─'.repeat(50))
    console.log(`🎯  流式输出完整内容\n ${fullContent}`)
    this.conversationHistory.push({ role: 'assistant', content: fullContent })

    const filesWritten = await this.processFileOperations(fullContent)

    console.log('\n✅ [CodeAgent] 执行完成')
    if (filesWritten.length > 0) {
      console.log(`📄 写入文件：${filesWritten.join(', ')}`)
    }

    return { content: fullContent, messages: this.conversationHistory, filesWritten }
  }

  private async processFileOperations(content: string): Promise<string[]> {
    if (!this.sandbox) return []

    const filesWritten: string[] = []
    const blocks = this.extractFileBlocks(content)

    for (const { filename, content: fileContent } of blocks) {
      try {
        const approved = await hitlCheckpoint(
          `写入文件：${filename}`,
          this.config.hitl
        )
        if (approved) {
          const writtenPath = this.sandbox.writeFile(filename, fileContent)
          filesWritten.push(filename)
          console.log(`[CodeAgent] ✅ 已写入：${writtenPath}`)
        }
      } catch (err) {
        console.error(`[CodeAgent] ❌ 写入失败 ${filename}:`, err)
      }
    }

    return filesWritten
  }

  /**
   * 从 AI 回复中提取 ```filename:xxx.md 代码块。
   * 用行扫描 + 围栏计数，正确处理代码块内部嵌套的 ```
   * （如 ```bash、```python 等不会提前终止外层匹配）。
   */
  private extractFileBlocks(content: string): Array<{ filename: string; content: string }> {
    const lines = content.split('\n')
    const blocks: Array<{ filename: string; content: string }> = []

    let fenceDepth = 0     // 当前代码围栏嵌套层级
    let inFileBlock = false
    let currentFilename = ''
    let currentLines: string[] = []

    for (const line of lines) {
      const fenceMatch = /^(`{3,})/.exec(line)

      if (fenceMatch) {
        const fenceLen = fenceMatch[1].length

        if (!inFileBlock) {
          // 尝试匹配 filename 或 file 开头的代码块
          const fileMatch = /^`{3,}\s*(?:filename|file)\s*:\s*(\S+)/i.exec(line)
          if (fileMatch) {
            inFileBlock = true
            currentFilename = fileMatch[1]
            currentLines = []
            fenceDepth = 1
            continue
          }
          // 普通代码块，跳过
          continue
        }

        // 在 file block 内部
        // 内部新开代码块（```python / ```bash 等）：围栏长度 >= 当前层级才是开启新一层
        const isClosing = line.trim().length === fenceLen   // 整行只有反引号（```）
        if (isClosing) {
          fenceDepth--
          if (fenceDepth === 0) {
            // file block 结束
            inFileBlock = false
            blocks.push({
              filename: currentFilename,
              content: currentLines.join('\n').trim(),
            })
            continue
          }
          // 内部代码块结束，仍计入内容
          currentLines.push(line)
          continue
        }

        // 内部代码块开始（```xxx 形式）
        fenceDepth++
        currentLines.push(line)
        continue
      }

      if (inFileBlock) {
        currentLines.push(line)
      }
    }

    // 如果 AI 回复被截断（没有闭合的 ```），也把已有的内容算进去
    if (inFileBlock && currentLines.length > 0) {
      blocks.push({
        filename: currentFilename,
        content: currentLines.join('\n').trim(),
      })
    }

    return blocks
  }

  writeFile(filename: string, content: string): string {
    if (!this.sandbox) throw new Error('沙箱未初始化')
    return this.sandbox.writeFile(filename, content)
  }

  getSandbox(): SandboxContext | null {
    return this.sandbox
  }

  clearHistory(): void {
    this.conversationHistory = []
    console.log('[CodeAgent] 对话历史已清空')
  }

  getSkills(): Skill[] {
    return this.skills
  }
}

export async function createCodeAgent(config: AgentConfig): Promise<CodeAgent> {
  const agent = new CodeAgent(config)
  await agent.init()
  return agent
}