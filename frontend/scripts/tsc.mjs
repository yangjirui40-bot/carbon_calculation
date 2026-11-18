// 跨平台 tsc 启动器：TypeScript 7 的 bin/tsc 为无扩展名 ESM 文件，
// 在 Windows + Node 24 下（extensionless ESM 已移除）无法被 shim 直接执行。
// 本脚本按 typescript 官方 getExePath 逻辑定位原生编译器二进制并转发参数。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import module from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = module.createRequire(import.meta.url)
const pkgJson = require.resolve('typescript/package.json')
const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'))
const baseName = pkg.name.startsWith('@') ? pkg.name.split('/')[1] : pkg.name
const platformPkg = `@typescript/${baseName}-${process.platform}-${process.arch}`
const binName = baseName === 'typescript' ? 'tsc' : 'tsgo'

let exe = null
// pnpm 将 optionalDependencies 内嵌在 typescript 包的同级 node_modules 内；npm 则提升到项目根
const pkgDir = path.dirname(pkgJson) // .../typescript
const nested = path.join(
  path.dirname(pkgDir), // .../.pnpm/typescript@x/node_modules（pnpm）或 typescript 的父目录（npm）
  '@typescript',
  platformPkg.split('/')[1],
  'lib',
  binName,
)
const hoisted = (() => {
  try {
    const p = require.resolve(`${platformPkg}/package.json`)
    return path.join(path.dirname(p), 'lib', binName)
  } catch {
    return null
  }
})()
for (const candidate of [nested, hoisted]) {
  const withExt = process.platform === 'win32' ? `${candidate}.exe` : candidate
  if (candidate && fs.existsSync(withExt)) {
    exe = withExt
    break
  }
}
if (!exe) {
  console.error(`未找到 ${platformPkg}；当前平台无 TypeScript 原生编译器可用。`)
  process.exit(1)
}
try {
  execFileSync(exe, process.argv.slice(2), { stdio: 'inherit' })
} catch (e) {
  if (typeof e.status === 'number') process.exit(e.status)
  throw e
}
