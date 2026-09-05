# pnpm 安装常见报错与提示说明

## 1. ERR_PNPM_IGNORED_BUILDS（Ignored build scripts）

**完整提示：**
```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.27.7

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

**含义：**
pnpm 出于安全考虑，默认不会自动执行第三方依赖包的 `postinstall` / `install` 等构建脚本。`esbuild` 包需要在安装后运行构建脚本（下载对应平台的二进制文件），但被 pnpm 阻止了，所以报了这个提示。

**为什么会有这个机制：**
- 防止恶意依赖通过 `postinstall` 脚本执行危险代码
- 这是 pnpm 的供应链安全（supply-chain security）特性之一
- 类似 npm 的 `--ignore-scripts`，但 pnpm 做得更严格、更可控

**解决方法：**

```bash
# 交互式选择哪些包允许运行构建脚本
pnpm approve-builds

# 或者直接允许某个包（一次性）
pnpm add esbuild --ignore-scripts=false

# 或者在 package.json 中配置（推荐，团队共享）
# pnpm.onlyBuiltDependencies 字段
```

**在 package.json 中配置的示例：**
```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "esbuild"
    ]
  }
}
```
配置后重新 `pnpm install`，esbuild 的构建脚本就会正常执行。

**不处理会怎样：**
对于 esbuild 来说，如果构建脚本没跑，可能导致无法正常使用（因为缺少对应平台的二进制文件）。其他包视情况而定，有些包的构建脚本只是可选优化。

---

## 2. Downloading @typescript/typescript-darwin-arm64（下载进度）

**完整提示：**
```
Downloading @typescript/typescript-darwin-arm64@7.0.2: 6.39 MB/9.27 MB
```

**含义：**
这不是报错，只是下载进度条。TypeScript 7.x 开始将平台相关的二进制文件拆分成了独立的包（`@typescript/typescript-darwin-arm64` 是苹果 Silicon 芯片版本），pnpm 正在下载对应的平台二进制包。

**背景：**
- TypeScript 5.x 及以前是纯 JS 实现，安装即用
- TypeScript 7.x 引入了用 Rust 编写的新编译器内核（TSTree / 新解析器等），所以需要按平台下载原生二进制
- 不同平台对应不同的包：`darwin-arm64`、`darwin-x64`、`linux-x64`、`win32-x64` 等

**不需要处理**，等下载完就好。如果下载慢，可以考虑配置国内镜像源。

---

## 附：pnpm 常用国内镜像配置

```bash
# 设置 registry 为淘宝镜像
pnpm config set registry https://registry.npmmirror.com

# 恢复官方源
pnpm config set registry https://registry.npmjs.org
```
