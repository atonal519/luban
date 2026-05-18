// 初始化用户脚本（部署时运行）
// 用法: npx tsx scripts/init-users.ts
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const existing = await p.user.count();
  if (existing > 0) {
    console.log(`用户已存在 (${existing}人)，跳过`);
    await p.$disconnect();
    return;
  }

  const users = [
    { name: 'admin', email: 'admin@ads.local', password: 'admin', role: 'PM' },
    { name: '文宇宸', email: 'wenyuchen@ads.local', password: 'luban2026', role: 'PM' },
    { name: '缪瑞', email: 'miaorui@ads.local', password: 'luban2026', role: 'PM' },
    { name: '王天旭', email: 'wangtianxu@ads.local', password: 'luban2026', role: 'PM' },
    { name: '罗舒新', email: 'luoshuxin@ads.local', password: 'luban2026', role: 'PM' },
    { name: '贺剑', email: 'hejian@ads.local', password: 'luban2026', role: 'PM' },
    { name: '杨子璇', email: 'yangzixuan@ads.local', password: 'luban2026', role: 'PM' },
    { name: '李靖雯', email: 'lijingwen@ads.local', password: 'luban2026', role: 'PM' },
  ];

  for (const u of users) {
    await p.user.create({ data: u });
    console.log('创建用户:', u.name);
  }

  console.log('\n✅ 用户创建完成');
  console.log('   admin       密码: admin');
  console.log('   其他用户    初始密码: luban2026');
  console.log('   登录后请在侧边栏修改密码');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
