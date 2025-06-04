# Superglue Electron Desktop Application

这个文档描述了如何构建和运行 Superglue 的桌面版本。

## 🏗️ 架构概述

Superglue Electron 版本采用以下架构：

```
packages/
├── core/           # Node.js 后端服务 (GraphQL API)
├── web/            # Next.js 前端应用 (React UI)
├── electron/       # Electron 主进程和打包配置
└── shared/         # 共享类型和工具
```

### 关键特性

- **最小侵入性**: 现有的 `core` 和 `web` 项目基本不需要修改
- **开发体验**: 支持热重载和开发者工具
- **生产构建**: 自动打包为可执行文件
- **跨平台**: 支持 Windows、macOS 和 Linux
- **自动更新**: 内置更新机制
- **原生集成**: 文件对话框、系统托盘等

## 🚀 快速开始

### 1. 安装依赖

```powershell
# 安装所有包的依赖
npm install

# 或者单独安装 Electron 包依赖
npm install --workspace=@superglue/electron
```

### 2. 开发环境

#### 方式一：使用便捷脚本（推荐）

```powershell
# 启动完整的开发环境
.\start-electron-dev.ps1

# 或者跳过某些服务
.\start-electron-dev.ps1 -SkipCore    # 跳过 Core 服务器
.\start-electron-dev.ps1 -SkipWeb     # 跳过 Web 开发服务器
```

#### 方式二：手动启动

```powershell
# 终端 1: 启动 Core 服务器
npm run dev --workspace=@superglue/core

# 终端 2: 启动 Web 开发服务器
npm run dev --workspace=@superglue/web

# 终端 3: 启动 Electron (等待前两个服务启动后)
npm run dev:electron
```

### 3. 生产构建

```powershell
# 构建所有平台
.\build-electron.ps1

# 构建特定平台
.\build-electron.ps1 -Platform win
.\build-electron.ps1 -Platform mac
.\build-electron.ps1 -Platform linux

# 构建并发布
.\build-electron.ps1 -Publish
```

## 📁 项目结构

### Electron 包结构

```
packages/electron/
├── src/
│   ├── main.ts           # Electron 主进程
│   └── preload.ts        # 预加载脚本
├── dist/                 # 编译输出
├── package.json          # Electron 特定依赖和构建配置
└── tsconfig.json         # TypeScript 配置
```

### 关键文件说明

- **`main.ts`**: Electron 主进程，负责窗口管理、Core 服务器启动、菜单等
- **`preload.ts`**: 安全的 API 桥接，暴露 Electron 功能给渲染进程
- **构建配置**: 在 `package.json` 的 `build` 字段中配置打包选项

## 🔧 配置说明

### 环境变量

- `ELECTRON=true`: 标识 Electron 环境，影响 Next.js 构建配置
- `NODE_ENV`: 开发/生产环境标识
- 其他环境变量与原项目保持一致

### Next.js 配置调整

Web 项目的 `next.config.ts` 现在支持 Electron 环境：

```typescript
const isElectron = process.env.ELECTRON === 'true';

const nextConfig = {
  // Electron 环境特殊配置
  ...(isElectron && {
    output: 'export',           // 静态导出
    trailingSlash: true,        // 兼容文件协议
    images: { unoptimized: true }, // 禁用图片优化
    assetPrefix: './',          // 相对路径
  }),
};
```

## 🔌 Electron 集成

### 在 React 组件中使用 Electron 功能

```typescript
import { useElectron } from '@/src/lib/electron-adapter';

function MyComponent() {
  const { isElectron, adapter } = useElectron();

  const handleSave = async () => {
    if (isElectron) {
      const filePath = await adapter.showSaveDialog();
      // 处理文件保存
    }
  };

  return (
    <div>
      {isElectron && <button onClick={handleSave}>Save to File</button>}
    </div>
  );
}
```

### 可用的 Electron API

- `adapter.getAppVersion()`: 获取应用版本
- `adapter.showSaveDialog()`: 显示保存文件对话框
- `adapter.showOpenDialog()`: 显示打开文件对话框
- `adapter.getStoredValue(key)`: 获取存储的值
- `adapter.setStoredValue(key, value)`: 存储值
- `adapter.onMenuNewConfig(callback)`: 监听菜单事件

## 📦 构建和分发

### 构建输出

构建完成后，可执行文件将输出到 `dist/` 目录：

```
dist/
├── win-unpacked/         # Windows 未打包版本
├── Superglue Setup.exe   # Windows 安装程序
├── Superglue.dmg         # macOS 磁盘映像
└── Superglue.AppImage    # Linux AppImage
```

### 自动更新

项目集成了 `electron-updater`，支持自动更新功能。发布新版本时，应用会自动检查并提示用户更新。

## 🐛 故障排除

### 常见问题

1. **Core 服务器启动失败**
   - 检查端口是否被占用（默认 3000）
   - 确认环境变量设置正确

2. **Web 开发服务器连接失败**
   - 等待 Next.js 完全启动（通常需要几秒钟）
   - 检查端口 3001 是否可用

3. **Electron 窗口空白**
   - 检查开发者工具中的控制台错误
   - 确认 Core 和 Web 服务都已启动

4. **构建失败**
   - 清理所有 node_modules 并重新安装
   - 检查 TypeScript 编译错误

### 调试技巧

1. **启用详细日志**
   ```powershell
   $env:DEBUG = "electron*"
   npm run dev:electron
   ```

2. **检查主进程日志**
   - Electron 主进程日志会显示在启动终端中
   - 生产版本的日志保存在用户数据目录

3. **检查渲染进程**
   - 在 Electron 窗口中按 F12 打开开发者工具
   - 与普通 web 应用调试方式相同

## 📈 性能优化

### 启动速度优化

1. **预编译依赖**: Core 项目在 Electron 启动前先构建
2. **并行启动**: 开发环境中 Core 和 Web 服务并行启动
3. **窗口预加载**: 使用 `show: false` 和 `ready-to-show` 事件

### 内存优化

1. **独立进程**: Core 服务器可选择在独立进程中运行
2. **懒加载**: 大型依赖项按需加载
3. **垃圾回收**: 适当的内存清理策略

## 🔒 安全考虑

1. **上下文隔离**: 启用 `contextIsolation` 和禁用 `nodeIntegration`
2. **预加载脚本**: 通过 preload.ts 安全地暴露 API
3. **CSP 策略**: 在生产环境中应用内容安全策略
4. **代码签名**: 发布前对应用进行代码签名

## 🤝 贡献指南

在修改 Electron 相关代码时，请确保：

1. 保持现有 Core 和 Web 项目的独立性
2. 新功能要有 fallback 机制（非 Electron 环境）
3. 更新相关文档和类型定义
4. 测试所有支持的平台

## 📚 参考资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [Next.js 静态导出](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Turborepo 文档](https://turbo.build/repo/docs)
