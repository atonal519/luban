#!/bin/bash
# 鲁班项目一键部署脚本
# 用法: bash deploy.sh

set -e

echo "=========================================="
echo "  鲁班 (Luban) 部署脚本"
echo "=========================================="

# 检查 Node.js 版本
echo ""
echo "▶ 检查环境..."
NODE_VER=$(node -v 2>/dev/null || echo "未安装")
echo "  Node.js: $NODE_VER"

if [[ "$NODE_VER" == "未安装" ]] || [[ "$NODE_VER" < "v18" ]]; then
  echo "  ❌ 需要 Node.js 18+，请先安装："
  echo "     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
  echo "     source ~/.bashrc && nvm install 18 && nvm use 18"
  exit 1
fi
echo "  ✓ Node.js 版本 OK"

# 检查 PM2
PM2_VER=$(pm2 -v 2>/dev/null || echo "未安装")
if [[ "$PM2_VER" == "未安装" ]]; then
  echo "  安装 PM2..."
  npm install -g pm2
fi
echo "  ✓ PM2: $PM2_VER"

# 安装依赖
echo ""
echo "▶ 安装依赖..."
npm install --production=false

# 创建 .env（如果不存在）
if [ ! -f .env ]; then
  echo ""
  echo "▶ 创建 .env 配置..."
  cat > .env << 'EOF'
DATABASE_URL="file:./prisma/prod.db"
EOF
  echo "  ✓ .env 已创建"
else
  echo ""
  echo "▶ .env 已存在，跳过"
fi

# 初始化/迁移数据库
echo ""
echo "▶ 初始化数据库..."
npx prisma migrate deploy
echo "  ✓ 数据库迁移完成"

# 检查是否需要 seed
USER_COUNT=$(npx tsx -e "const p=new(require('@prisma/client').PrismaClient)();p.user.count().then(c=>{console.log(c);p.\$disconnect()})" 2>/dev/null || echo "0")
echo "  当前用户数: $USER_COUNT"

if [[ "$USER_COUNT" == "0" ]]; then
  echo "  灌入初始数据..."
  npx tsx prisma/seed.ts
  npx tsx scripts/init-users.ts
  echo "  ✓ 初始数据完成"
else
  echo "  用户已存在，跳过 seed"
fi

# Build
echo ""
echo "▶ 构建项目..."
npm run build
echo "  ✓ 构建完成"

# 启动/重启 PM2
echo ""
echo "▶ 启动服务..."
if pm2 list | grep -q "luban"; then
  pm2 reload luban
  echo "  ✓ 服务已重载"
else
  pm2 start ecosystem.config.cjs
  echo "  ✓ 服务已启动"
fi

pm2 save

echo ""
echo "=========================================="
echo "  ✅ 部署完成！"
echo ""
echo "  访问地址: http://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3000"
echo "  PM2 状态: pm2 list"
echo "  查看日志: pm2 logs luban"
echo "  开机自启: pm2 startup (按提示执行命令)"
echo "=========================================="
