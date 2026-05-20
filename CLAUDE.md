# 鲁班 (Luban) — 项目开发规范

## Schema 修改规范

1. **改 schema 必须跑 `npx prisma migrate dev --name <描述>` 生成 migration**
2. `prisma/migrations/` 目录下新增的 migration 文件必须随 schema 改动一起提交
3. 部署机只允许 `npx prisma migrate deploy`，**禁止用 `db push`**
4. 如果部署机已经通过 `db push` 同步过表结构，新 migration 执行会失败 — 用 `prisma migrate resolve --applied <migration_name>` 标记为已应用

## 提交规范

- commit 前确保 `npm run build` 通过
- 改动完成后先本地验证 → 告知用户测试 → 确认后再 commit/push

## 认证

- 登录态为 httpOnly cookie `session`，值为 JWT（HS256 签名）
- JWT 有效期 7 天，含 userId
- middleware 校验 JWT 签名有效性
- 密码统一 bcrypt hash 存储，不允许明文

## API 安全

- settings CRUD 路由有字段白名单，不允许客户端写入未声明字段
- 上传接口有 10MB 大小限制和文件类型白名单
