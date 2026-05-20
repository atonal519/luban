// 一次性脚本：把所有明文密码迁移为 bcrypt hash
// 运行: node scripts/hash-passwords.cjs
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    // 已经是 bcrypt hash 的跳过（$2a$ 或 $2b$ 开头）
    if (user.password.startsWith('$2')) {
      console.log(`${user.name}: 已是 bcrypt hash，跳过`);
      continue;
    }
    // 明文密码 hash 化
    const hashed = await bcrypt.hash(user.password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    console.log(`${user.name}: ${user.password} → hashed`);
  }
  
  await prisma.$disconnect();
  console.log('\n全部完成！现在所有密码都是 bcrypt hash 了。');
}

main().catch(console.error);
