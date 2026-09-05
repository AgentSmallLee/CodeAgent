import fs from 'fs-extra'
import path from 'node:path'

/** 一个已解析的技能定义 */
export interface Skill {
  /** SKILL.md 文件路径 */
  fileName: string
  /** frontmatter 中的 name，与目录名一致 */
  name: string
  /** frontmatter 中的 description，说明做什么 + 何时触发 */
  description: string
  /** ## Script 段落内容（不含标题），空字符串表示缺失 */
  script: string
  /** ## Examples 段落按空行拆分后的示例块 */
  examples: string[]
  /** ## References 段落的每一行（引用的文件路径等），无则为空数组 */
  references: string[]
  /** 文件原始内容 */
  raw: string
}

/** 默认技能目录：<cwd>/.codeagent/skills */
const DEFAULT_SKILLS_DIR = path.resolve(process.cwd(), '.codeagent/skills')

/**
 * 解析单个 SKILL.md 内容。
 * 格式约定：YAML frontmatter（--- 包裹，name/description 单行值）+ `## Script` / `## Examples` / `## References` 段落。
 */
export function parseSkill(content: string, fileName: string): Skill {
  const skill: Skill = {
    fileName,
    name: '',
    description: '',
    script: '',
    examples: [],
    references: [],
    raw: content,
  }

  const { frontmatter, body } = splitFrontmatter(content)
  Object.assign(skill, parseFrontmatter(frontmatter))

  const sections = splitSections(body)
  skill.script = sections.get('script') ?? ''
  skill.examples = splitBlocks(sections.get('examples') ?? '')
  skill.references = splitLines(sections.get('references') ?? '')

  return skill
}

/** 加载目录下所有技能（skills/<name>/SKILL.md），目录不存在时返回空数组 */
export async function loadSkills(skillsDir: string = DEFAULT_SKILLS_DIR): Promise<Skill[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(skillsDir)
  } catch {
    return []
  }

  const skills: Skill[] = []
  for (const entry of entries.sort()) {
    const skillPath = path.join(skillsDir, entry, 'SKILL.md')
    const content = await fs.readFile(skillPath, 'utf-8').catch(() => null)
    if (content === null) continue

    const skill = parseSkill(content, skillPath)
    if (!skill.name || !skill.description) {
      // name/description 是技能被加载的前提，缺失则跳过并提示
      console.warn(`[skill-loader] skip ${skillPath}: frontmatter missing name or description`)
      continue
    }
    skills.push(skill)
  }
  return skills
}

/**
 * 将技能列表拼接为系统提示词片段，用于注入 agent 的 system prompt。
 * 空数组返回空字符串，由调用方决定是否拼接。
 */
export function buildSkillPrompt(skills: Skill[]): string {
  if (skills.length === 0) return ''

  const sections = skills.map((skill) => {
    const lines = [
      `### ${skill.name}`,
      '',
      '技能描述：',
      skill.description,
      '',
      '操作步骤：',
      skill.script,
    ]
    if (skill.examples.length > 0) {
      lines.push('', '示例：', ...skill.examples.map((example) => `- ${example.replace(/\n/g, '\n  ')}`))
    }
    if (skill.references.length > 0) {
      lines.push('', '参考资料：', ...skill.references.map((reference) => `- ${reference}`))
    }
    return lines.join('\n')
  })

  return [
    '你可以使用以下技能（skills）。当用户的请求匹配某个技能的描述时，按照该技能的操作步骤执行：',
    '',
    ...sections,
  ].join('\n\n')
}

/** 分离 frontmatter 与正文 */
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content)
  if (!match) return { frontmatter: '', body: content }
  return { frontmatter: match[1], body: match[2] }
}

/** 解析单行 key: value 形式的 frontmatter */
function parseFrontmatter(frontmatter: string): Pick<Skill, 'name' | 'description'> {
  const result = { name: '', description: '' }
  for (const line of frontmatter.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (key === 'name') result.name = value
    else if (key === 'description') result.description = value
  }
  return result
}

/** 按 `## 标题` 拆分正文，返回 小写标题 -> 段落内容 的映射 */
function splitSections(body: string): Map<string, string> {
  const sections = new Map<string, string>()
  const lines = body.split(/\r?\n/)
  let current: string | null = null
  let buffer: string[] = []

  for (const line of lines) {
    const heading = /^##\s+(.*)$/.exec(line)
    if (heading) {
      if (current !== null) sections.set(current, buffer.join('\n').trim())
      current = heading[1].trim().toLowerCase()
      buffer = []
    } else if (current !== null) {
      buffer.push(line)
    }
  }
  if (current !== null) sections.set(current, buffer.join('\n').trim())

  return sections
}

/** 按空行拆分为块，用于 Examples */
function splitBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
}

/** 拆分为非空行，用于 References */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
