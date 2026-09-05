import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSkills, parseSkill, buildSkillsPrompt } from '../src/skill.loader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 从 tests/ 回到项目根，指向 .codeagent/skills
const SKILLS_DIR = path.resolve(__dirname, '../.codeagent/skills')

describe('loadSkills', () => {
  test('加载 .codeagent/skills 下的所有技能', async () => {
    const skills = await loadSkills(SKILLS_DIR)
    assert.equal(skills.length, 3)
    assert.deepEqual(
      skills.map((s) => s.name).sort(),
      ['code-review', 'doc-generator', 'poem-joke'],
    )
  })

  test('每个技能的字段完整且类型正确', async () => {
    const skills = await loadSkills(SKILLS_DIR)
    for (const skill of skills) {
      assert.ok(skill.fileName.endsWith('SKILL.md'), `${skill.name}: fileName 应指向 SKILL.md`)
      assert.ok(skill.name.length > 0, 'name 不能为空')
      assert.ok(skill.description.length > 0, 'description 不能为空')
      assert.equal(typeof skill.script, 'string')
      assert.ok(skill.script.length > 0, `${skill.name}: script 不能为空`)
      assert.ok(Array.isArray(skill.examples))
      assert.ok(skill.examples.length > 0, `${skill.name}: examples 不能为空`)
      assert.ok(Array.isArray(skill.references))
      assert.ok(skill.raw.startsWith('---'), `${skill.name}: raw 应包含 frontmatter`)
    }
  })

  test('按文件名排序，加载顺序稳定', async () => {
    const first = await loadSkills(SKILLS_DIR)
    const second = await loadSkills(SKILLS_DIR)
    assert.deepEqual(
      first.map((s) => s.fileName),
      second.map((s) => s.fileName),
    )
  })

  test('目录不存在时返回空数组', async () => {
    const skills = await loadSkills(path.join(__dirname, 'not-exist-dir'))
    assert.equal(skills.length, 0)
  })
})

describe('parseSkill', () => {
  test('解析标准格式：frontmatter + Script + Examples + References', () => {
    const content = [
      '---',
      'name: demo-skill',
      'description: 一个用于测试的示例技能。',
      '---',
      '',
      '## Script',
      '1. 第一步',
      '2. 第二步',
      '',
      '## Examples',
      '输入：a',
      '',
      '输入：b',
      '',
      '## References',
      '- references/palette.md',
      '- references/api.md',
      '',
    ].join('\n')

    const skill = parseSkill(content, '/tmp/demo-skill/SKILL.md')

    assert.equal(skill.fileName, '/tmp/demo-skill/SKILL.md')
    assert.equal(skill.name, 'demo-skill')
    assert.equal(skill.description, '一个用于测试的示例技能。')
    assert.equal(skill.script, '1. 第一步\n2. 第二步')
    assert.deepEqual(skill.examples, ['输入：a', '输入：b'])
    assert.deepEqual(skill.references, ['- references/palette.md', '- references/api.md'])
    assert.equal(skill.raw, content)
  })

  test('description 中包含冒号时不影响解析', () => {
    const skill = parseSkill(
      '---\nname: a\ndescription: 触发词: "帮我看看"\n---\n\n## Script\nok',
      '/tmp/a/SKILL.md',
    )
    assert.equal(skill.name, 'a')
    assert.equal(skill.description, '触发词: "帮我看看"')
  })

  test('缺少 frontmatter 时 name/description 为空，正文照常解析', () => {
    const skill = parseSkill('## Script\n只有正文', '/tmp/b/SKILL.md')
    assert.equal(skill.name, '')
    assert.equal(skill.description, '')
    assert.equal(skill.script, '只有正文')
    assert.deepEqual(skill.examples, [])
    assert.deepEqual(skill.references, [])
  })

  test('CRLF 换行也能正确解析', () => {
    const content = '---\r\nname: crlf-skill\r\ndescription: 测试\r\n---\r\n\r\n## Script\r\n1. 步骤\r\n'
    const skill = parseSkill(content, '/tmp/c/SKILL.md')
    assert.equal(skill.name, 'crlf-skill')
    assert.equal(skill.script, '1. 步骤')
  })
})

describe('buildSkillPrompt', () => {
  // 所有用例基于真实技能目录加载的数据
  let skills: Awaited<ReturnType<typeof loadSkills>>
  let prompt: string

  before(async () => {
    skills = await loadSkills(SKILLS_DIR)
    prompt = buildSkillsPrompt(skills)
    console.log(prompt)
  })

  test('空数组返回空字符串', () => {
    assert.equal(buildSkillsPrompt([]), '')
  })

  test('以触发说明开头', () => {
    assert.ok(prompt.startsWith('你可以使用以下技能（skills）'))
  })

  test('包含每个真实技能的 name、description 和操作步骤', () => {
    for (const skill of skills) {
      assert.ok(prompt.includes(`### ${skill.name}`), `${skill.name}: 缺少标题`)
      assert.ok(prompt.includes(`技能描述：\n${skill.description}`), `${skill.name}: description 应有显式标签`)
      assert.ok(prompt.includes(skill.script), `${skill.name}: 缺少 script`)
    }
  })

  test('技能顺序与加载顺序一致', () => {
    const positions = skills.map((skill) => prompt.indexOf(`### ${skill.name}`))
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
  })

  test('包含带示例技能的示例内容（如 poem-joke）', () => {
    const poemJoke = skills.find((skill) => skill.name === 'poem-joke')
    assert.ok(poemJoke, 'poem-joke 技能应存在')
    assert.ok(prompt.includes('示例：'))
    for (const example of poemJoke!.examples) {
      // buildSkillPrompt 会将多行示例整体缩进两个空格，断言需按同样规则还原
      const indented = example.replace(/\n/g, '\n  ')
      assert.ok(prompt.includes(indented), `缺少示例: ${example.slice(0, 20)}`)
    }
  })
})
