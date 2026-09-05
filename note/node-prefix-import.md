# import 'path' 和 import 'node:path' 的区别

两种写法引用的是**同一个模块**，拿到的是同一个对象（`require('path') === require('node:path')` 为 `true`）。区别在解析行为和适用范围。

## 区别

### 1. 模块解析方式

- `import 'node:path'`：带 `node:` 前缀会**跳过所有查找规则，直接命中 Node 内置模块**，绝不会碰 `node_modules`
- `import 'path'`：走正常模块解析。内置模块优先级高于 `node_modules`（不会被同名 npm 包遮蔽），但解析过程会先判断"是不是内置模块"

`node:` 前缀的原始动机之一是安全性：无论解析规则如何变化，`node:` 是唯一能 100% 保证拿到内置模块的写法。

### 2. 部分内置模块只能用 `node:` 前缀（prefix-only）

- `node:test`
- `node:sqlite`
- `node:sea`

`node:test` 设计成 prefix-only，就是为了避免和社区里叫 `test` 的 npm 包产生歧义。

### 3. 版本兼容

- CJS 里 `require('node:path')` 需要 Node ≥ 14.18 / 16
- ESM 里从支持 ESM 的版本（12.20+）开始就可用

Node 20+ 的项目不存在兼容性问题。

## 结论

功能上没区别，但**推荐统一用 `node:` 前缀**：

1. **意图明确**——一眼看出是内置模块，不是项目依赖或本地文件
2. **绝对安全**——不参与任何模块查找竞争
3. **和 prefix-only 模块写法一致**——`node:test` 必须写前缀，全项目统一风格

本项目（CodeAgent）的惯例：`src/skill.loader.ts` 的 `node:path`，测试里的 `node:test` / `node:path` / `node:url`。
