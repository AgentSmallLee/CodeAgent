# package.json 中 type 字段的区别

`package.json` 的 `"type"` 字段决定了 Node.js 如何处理 `.js` 文件的模块系统。

## "type": "module"（ESM 模块）

- `.js` 文件默认按 **ES Module** 解析
- 使用 `import` / `export` 语法
- 支持顶层 `await`
- 导入文件路径必须带扩展名：`import utils from './utils.js'`
- `__dirname` / `__filename` / `require()` 不可用（需用 `import.meta.url` 替代）
- `.cjs` 后缀的文件仍按 CommonJS 解析

## "type": "commonjs"（CommonJS 模块，默认）

- `.js` 文件默认按 **CommonJS** 解析（不写 `"type"` 字段也是这个行为）
- 使用 `require()` / `module.exports` / `exports`
- 有 `__dirname` / `__filename` / `require()` 等全局变量
- `.mjs` 后缀的文件按 ESM 解析

## 对照表

| 特性 | "type": "module" | "type": "commonjs" |
|---|---|---|
| 默认模块系统 | ESM | CommonJS |
| 导入语法 | `import` | `require()` |
| 导出语法 | `export` | `module.exports` |
| 顶层 await | ✅ | ❌ |
| `__dirname` | ❌ | ✅ |
| 导入需扩展名 | ✅ | ❌ |
| `.mjs` 文件 | ESM | ESM |
| `.cjs` 文件 | CommonJS | CommonJS |

## 选择建议

- **新项目**推荐 `"type": "module"`，ESM 是 JS 标准，前后端语法统一
- **老项目 / 依赖大量 CJS 包**保持 `commonjs` 更稳妥
- 两者可以混用（通过 `.mjs` / `.cjs` 后缀），但尽量保持一致以减少心智负担
