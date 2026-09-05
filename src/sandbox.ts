import fs from 'fs-extra'
import path from 'node:path'

export interface SandboxConfig {
    /** 工作区根目录（项目根目录的真实路径） */
    workspacePath: string
    /** 输出子目录，相对于 workspacePath，默认 'output' */
    outputDir?: string
    /** 是否打印操作日志，默认 true */
    verbose?: boolean
}

export interface SandboxContext {
    workspacePath: string
    outputPath: string
    writeFile: (filename: string, content: string) => string
    readFile: (filename: string) => string | null
    listFiles: () => string[]
    isPathSafe: (targetPath: string) => boolean
}

export function createSandbox(config: SandboxConfig): SandboxContext {
    // 解析成绝对路径，避免相对路径歧义
    const workspacePath = path.resolve(config.workspacePath)
    const outputDir = config.outputDir || 'output'
    const outputPath = path.join(workspacePath, outputDir)
    const verbose = config.verbose ?? true

    // 沙箱初始化时确保输出目录存在
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true })
        // recursive: true 表示如果父目录不存在也一并创建
    }

    if (verbose) {
        console.log(`[Sandbox] 工作区初始化完成`)
        console.log(`[Sandbox]   真实路径：${workspacePath}`)
        console.log(`[Sandbox]   输出目录：${outputPath}`)
    }

    /**
     * 路径安全检查
     * 目标路径必须在 outputPath 目录内
     */
    function isPathSafe(targetPath: string): boolean {
        const resolved = path.resolve(outputPath, targetPath)
        // 必须用 path.sep 兜底，否则 outputPath 的兄弟目录（如 /a/output-evil）
        // 会通过 /a/output 的前缀检查
        return resolved === outputPath || resolved.startsWith(outputPath + path.sep)
    }

    /**
     * 在沙箱内写文件
     * 自动创建子目录
     */
    function writeFile(filename: string, content: string): string {
        // 先做安全检查
        if (!isPathSafe(filename)) {
            throw new Error(`[Sandbox] 安全拦截：路径越界，无法写入 ${filename}`)
        }

        const targetPath = path.join(outputPath, filename)

        // 如果文件路径包含子目录（如 reports/2025/data.md），确保目录存在
        const dir = path.dirname(targetPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        fs.writeFileSync(targetPath, content, 'utf-8')

        if (verbose) {
            // 显示相对于工作区的路径，更易读
            console.log(`[Sandbox] 文件已写入：${path.relative(workspacePath, targetPath)}`)
        }

        return targetPath
    }

    /**
     * 在沙箱内读文件
     * 文件不存在时返回 null，不抛异常
     */
    function readFile(filename: string): string | null {
        if (!isPathSafe(filename)) {
            throw new Error(`[Sandbox] 安全拦截：路径越界，无法读取 ${filename}`)
        }

        const targetPath = path.join(outputPath, filename)
        if (!fs.existsSync(targetPath)) {
            return null
        }

        return fs.readFileSync(targetPath, 'utf-8')
    }

    /**
     * 列出输出目录下的所有文件（相对路径）
     */
    function listFiles(): string[] {
        // 目录在初始化后被外部删除时，视为没有文件而不是抛 ENOENT
        if (!fs.existsSync(outputPath)) {
            return []
        }

        const files: string[] = []

        function walk(dir: string, prefix: string): void {
            for (const entry of fs.readdirSync(dir)) {
                const fullPath = path.join(dir, entry)
                const relative = prefix ? `${prefix}/${entry}` : entry
                if (fs.statSync(fullPath).isDirectory()) {
                    walk(fullPath, relative)
                } else {
                    files.push(relative)
                }
            }
        }

        walk(outputPath, '')
        return files
    }

    return {
        workspacePath,
        outputPath,
        writeFile,
        readFile,
        listFiles,
        isPathSafe,
    }
}