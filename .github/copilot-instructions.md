# GitHub Copilot 指令
## 通用规则
- 当我使用中文提问时，请用中文回答
- 直接给出解决方案和代码，不要说"你可以这样做"之类的废话
- 保持简洁，像专家一样交流
- 预判我的需求，提供我没想到的解决方案
- 给出准确和详尽的答案

## 代码规范
- 使用 TypeScript 严格模式
- 遵循项目的 ESLint 和 Prettier 配置
- 变量名和函数名使用英文，注释可以使用中文
- 保留有意义的代码注释，除非完全无关才删除
- 优先使用现代 JavaScript/TypeScript 语法

## 项目特定规则
- 这是一个 Electron + Next.js 项目
- 使用 Turbo 作为 monorepo 管理工具
- 核心包在 packages/core，Web 应用在 packages/web
- 使用 Supabase 作为后端服务
- 集成了 GraphQL 和 LLM 功能

## 技术栈
- Frontend: Next.js, React, Tailwind CSS
- Backend: Node.js, GraphQL, Supabase
- Desktop: Electron
- Database: PostgreSQL, Redis
- AI: OpenAI, Gemini
- Testing: Vitest

## 响应格式
- 代码修改时只显示变更部分及前后几行
- 可以分多个代码块回答
- 技术术语保持准确，必要时中英对照
