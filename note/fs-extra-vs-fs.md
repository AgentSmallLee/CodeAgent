# fs-extra 和 fs 的区别

## fs 是 Node 自带的吗？

**是。** `fs`（File System）是 Node.js 的内置模块，无需安装，用 `import fs from 'node:fs'` / `require('fs')` 直接引入。常用形式：

- `node:fs`：callback 风格 API（`readFile(path, cb)`）
- `node:fs/promises`：Promise 风格 API（`await readFile(path)`），Node 11.14+ 稳定
- `node:fs` 上也有同步版本（`readFileSync`）

## fs-extra 是什么

**第三方 npm 包**（需要 `npm i fs-extra`），在 fs 的基础上做了两件事：

### 1. 完整 re-export fs 的所有 API

`fs-extra` 的默认导出就是 fs 的超集，`fs.readFile`、`fs.readdir` 等原方法全部可用。

### 2. 追加了一批便捷方法（这是它存在的核心价值）

| 方法 | 作用 | 对应的原生写法 |
|---|---|---|
| `ensureDir(dir)` | 递归创建目录（mkdir -p） | `fs.mkdir(dir, { recursive: true })` |
| `remove(path)` | 删除文件/目录（rm -rf） | `fs.rm(path, { recursive: true, force: true })` |
| `copy(src, dest)` | 复制文件或整个目录 | 原生 `fs.cp`（Node 16.7+） |
| `move(src, dest)` | 移动/重命名，支持跨设备 | `fs.rename`（不能跨设备） |
| `emptyDir(dir)` | 清空目录但保留目录本身 | 需要自己组合 |
| `outputFile(file, data)` | 写文件并自动创建父目录 | 需要自己组合 mkdir + writeFile |
| `outputJson` / `readJson` / `writeJson` | JSON 读写一体化 | 需要自己 JSON.parse/stringify |
| `pathExists(path)` | Promise 版存在性检查（不抛错） | `fs.access` 包装 |

所有方法同时提供 callback 和 Promise 两种调用方式（传回调就是 callback 风格，不传就是返回 Promise）。

## 现在还需要 fs-extra 吗？

**Node 自身演进已经补齐了大部分差距：**

- `fs.promises`（Node 11.14+）解决了异步写法问题
- `fs.mkdir({ recursive: true })` 等价于 ensureDir
- `fs.rm({ recursive: true, force: true })` 等价于 remove（Node 14.14+）
- `fs.cp` 支持目录复制（Node 16.7+）

**fs-extra 剩余的差异化价值**：`move`（跨设备移动）、`emptyDir`、`outputFile`/`outputJson`（写文件自动建父目录）、`readJson` 这类组合操作。

## 结论

1. `fs` 是 Node 内置模块，零依赖；`fs-extra` 是第三方包，只是 fs 的超集
2. 只用到 `readFile` / `readdir` 这类基础 API 时，**直接用 `node:fs/promises` 即可**，没必要引 fs-extra（引了也只是多一层转发）
3. 大量操作目录、频繁读写 JSON 文件时，fs-extra 的便捷方法仍有价值
4. 本项目（CodeAgent）的 `skill.loader.ts` 目前只用了 `readFile` / `readdir`——属于情况 2，可以改为 `node:fs/promises` 去掉这个依赖
