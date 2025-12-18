# KeeWeb Windows 构建 `--inspect` 报错记录

本文记录一次 Windows 桌面版构建过程中出现的错误：`Fatal error: Not found: Command-line option: --inspect`，以及定位、修复、CI 适配与后续注意事项。

## 背景

- 项目：KeeWeb
- 构建目标：Windows（win32）桌面包（主要需要 x64）
- 构建命令（最初）：`grunt desktop-win32 --skip-sign`
- 依赖：Electron 13.x（项目内使用 `electron v13.6.9`）

## 现象与报错

在 Windows 本地运行：

- `grunt desktop-win32 --skip-sign`

日志在打包、复制文件等步骤后，进入压缩（`compress:win32-x64`）阶段并报错：

- `Fatal error: Not found: Command-line option: --inspect`

这类错误看起来像是“某个步骤不认识 `--inspect`”，但其实际来源与 `compress` 本身无关（见后文根因分析）。

## 关键根因

项目在打包后会执行一个补丁步骤（`electron-patch:*`），用于对 Electron 二进制做安全加固（禁用 `--inspect` 等调试开关）。

该步骤依赖 `electron-evil-feature-patcher`。它对 Windows 平台的 Electron 可执行文件内容做字符串匹配替换，期望能找到形如：

- `\0--inspect\0`

但在当前 Electron 版本/构建的 `electron.exe` 中，命令行选项更像是一整段连续表结构：

- `--inspect\0--inspect-brk\0--inspect-port\0...`

因此 `electron-evil-feature-patcher` 的匹配假设不成立，会抛出：

- `Not found: Command-line option: --inspect`

由于该异常在流水线中出现的位置/时序，会造成看起来像是后续任务（例如 `compress`）失败，实际是 patcher 在处理 Electron 二进制时失败。

## 修复方案概述

目标：在不改变项目安全意图（继续禁用调试开关）的前提下，让 Windows 构建在当前 Electron 二进制布局下可稳定完成。

采取的策略：

1. 保留上游 `electron-evil-feature-patcher` 作为首选方案（未来如果它更新支持，依旧优先走上游逻辑）。
2. 当捕获到该 patcher 的特定失败（`Not found: Command-line option: --inspect`）时，使用兼容补丁逻辑对“命令行选项表”整体做一次等长替换，从而达到同等目的。

对应实现：

- `build/util/electron-evil-feature-patcher-compat.js`
  - 兼容补丁逻辑：
    - 将选项表中的 `--inspect`、`--inspect-brk`、`--inspect-port`、`--debug` 等替换为前置空格形式（`  inspect` 等），使其不再被解析为有效开关。
    - 同时沿用上游的 `PatchedSentinel` 机制，用于标记“已打补丁”，避免重复处理。
    - 保留 fuse 相关逻辑（通过 `FuseConst.Sentinel` 定位 fuse 区域并关闭 `RunAsNode`）。

- `build/tasks/grunt-electron-patch.js`
  - 逻辑：
    - `try` 先执行上游 `electron-evil-feature-patcher`
    - `catch` 如果错误以 `Not found: Command-line option: --inspect` 开头，则执行兼容补丁

## 只构建 Windows x64

原任务 `desktop-win32` 会构建 `x64/ia32/arm64` 三套，耗时更长且与需求不符。

新增入口任务：

- `desktop-win32-x64`

它仅执行 x64 所需子任务链：

- 打包：`electron:win32-x64`
- patch：`electron-patch:win32-x64`
- 原生模块复制：`copy:native-modules-win32-x64`、`copy:native-messaging-host-win32-x64`
- 压缩：`compress:win32-x64`
- 安装包（可选，见下一节）：`nsis:*`

对应修改文件：

- `grunt.entrypoints.js`
- `grunt.tasks.js`

## NSIS（安装包）与 `--skip-installer`

Windows 安装包生成依赖 NSIS 的 `makensis.exe`。在未安装 NSIS 的环境（例如 CI 或新机器）会报：

- `spawn C:\\Program Files (x86)\\NSIS\\makensis.exe ENOENT`

为适配“只需要 zip 包即可”的场景，增加开关：

- `--skip-installer`

当传入该参数时，x64 任务链会跳过 `nsis:*` 与 `copy:desktop-win32-dist-x64`，仅生成 zip：

- `dist/desktop/KeeWeb-<version>.win.x64.zip`

同时增强 NSIS 的可执行文件查找逻辑：

- 支持 `--nsis-path=...` 或环境变量 `MAKENSIS`
- 支持 `where.exe makensis` 自动查找
- 找不到时提示更明确

对应修改文件：

- `build/tasks/grunt-nsis.js`
- `grunt.tasks.js`

## Windows 上 `tmp/desktop/**/app.asar` 被占用（EBUSY）

在本地反复构建时可能遇到：

- `Unable to delete ... app.asar (EBUSY: resource busy or locked)`

常见原因：

- 上一次构建或运行后的进程仍持有句柄
- Explorer/杀软/索引服务占用（尤其是预览窗格/实时扫描）

处理建议：

1. 确认没有运行 `KeeWeb.exe` / `electron` 等相关进程
2. 关闭打开该目录的资源管理器窗口（含预览窗格）
3. 使用 Sysinternals Process Explorer/Handle 查找占用 `app.asar` 的进程并结束

## CI（GitHub Actions）中 ESLint/Prettier 报错

CI 的 `grunt` 流水线通常会包含：

- `eslint:app`
- `eslint:desktop`
- `eslint:build`

如果新改动文件不符合 Prettier 规则，会出现类似：

- `prettier/prettier` 错误（换行/缩进/尾部空行等）

修复方式：

- `npx eslint build/tasks/grunt-electron-patch.js build/util/electron-evil-feature-patcher-compat.js --fix`
- 或 `npx grunt eslint:build` 先本地验证

## 推荐构建命令

### 仅生成 Windows x64 zip（不签名、不做安装包）

- `npx grunt desktop-win32-x64 --skip-sign --skip-installer`

产物：

- `dist/desktop/KeeWeb-<version>.win.x64.zip`

### 生成 Windows x64 安装包（需要 NSIS）

安装 NSIS 后：

- `npx grunt desktop-win32-x64 --skip-sign`

或手动指定路径：

- `npx grunt desktop-win32-x64 --skip-sign --nsis-path="C:\\path\\to\\makensis.exe"`

## 本次涉及的代码改动（与该问题直接相关）

- `build/tasks/grunt-electron-patch.js`
  - 增加对上游 patcher 失败时的兼容回退逻辑
- `build/util/electron-evil-feature-patcher-compat.js`
  - 新增 Windows Electron 二进制的兼容补丁实现
- `grunt.entrypoints.js` / `grunt.tasks.js`
  - 新增 `desktop-win32-x64` 入口与 x64-only 任务链
  - 新增 `--skip-installer` 以便无 NSIS 环境可构建 zip
- `build/tasks/grunt-nsis.js`
  - 改进 NSIS 可执行文件查找与错误提示

## 说明：compat 文件中的“长字符串”是否随机

`PatchedSentinel` 与 `FuseConst.Sentinel` 等值来自上游 patcher 的实现设计，用作“定位/标记”用途，不依赖本机编译环境随机生成。

真正可能导致失效的场景是：

- Electron 二进制内部结构在未来版本发生变化，导致无法定位 fuse 或选项表（此时会明确报错并停止，而不是静默产出错误结果）。

