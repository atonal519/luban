# 鲁班 (Luban)

自动驾驶研发项目管理系统。

## 技术栈

- **前端** Next.js + TypeScript + Tailwind CSS
- **后端** Next.js API Routes
- **ORM** Prisma 6
- **数据库** SQLite（可迁移 PostgreSQL）

## 快速启动

```bash
npm install
npx prisma migrate dev
npm run dev
```

浏览器打开 http://localhost:3000

## 数据库

```bash
npm run db:migrate   # 执行迁移
npm run db:seed      # 灌入演示数据
npm run db:reset     # 重置并重新灌数据
```

## 目录结构

```
src/
  app/           # Next.js 页面和 API 路由
prisma/
  schema.prisma  # 数据库模型定义
  seed.ts        # 演示数据
  migrations/    # 迁移文件
```
