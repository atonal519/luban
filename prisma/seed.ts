import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── 清空旧数据 ──
  await prisma.approvalEvent.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.rejection.deleteMany();
  await prisma.itemModule.deleteMany();
  await prisma.item.deleteMany();
  await prisma.stageTemplate.deleteMany();
  await prisma.stageGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.module.deleteMany();
  await prisma.nature.deleteMany();
  await prisma.statusDef.deleteMany();

  // ── 阶段分组（4大节点）──
  const [sgRequirement, sgDevelopment, sgTest, sgDelivery] = await Promise.all([
    prisma.stageGroup.create({ data: { code: 'REQUIREMENT', label: '需求入口', order: 1 } }),
    prisma.stageGroup.create({ data: { code: 'DEVELOPMENT', label: '版本开发', order: 2 } }),
    prisma.stageGroup.create({ data: { code: 'TEST', label: '版本测试', order: 3 } }),
    prisma.stageGroup.create({ data: { code: 'DELIVERY', label: '版本交付', order: 4 } }),
  ]);

  // ── 阶段默认节点模板 ──
  await Promise.all([
    prisma.stageTemplate.create({ data: { stageGroupId: sgRequirement.id, name: '需求评审', order: 1 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDevelopment.id, name: '待排期', order: 1 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDevelopment.id, name: '开发', order: 2 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDevelopment.id, name: '自测', order: 3 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: 'SIL集成测试', order: 1 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: 'HIL测试', order: 2, isParallel: true, parallelGroup: 'TEST_A' } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '功能测试', order: 3, isParallel: true, parallelGroup: 'TEST_A' } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '性能测试', order: 4, isParallel: true, parallelGroup: 'TEST_A' } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '集成测试', order: 5 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '实车测试', order: 6 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '道路测试', order: 7 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDelivery.id, name: '交付审核', order: 1 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDelivery.id, name: '预生产', order: 2 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDelivery.id, name: '正式交付', order: 3 } }),
  ]);

  // ── 性质标签 ──
  const [ntFeature, ntBug, ntHotfix] = await Promise.all([
    prisma.nature.create({ data: { code: 'FEATURE', label: 'Feature', color: '#3b6ff0', order: 1 } }),
    prisma.nature.create({ data: { code: 'BUG', label: 'Bug', color: '#dc3535', order: 2 } }),
    prisma.nature.create({ data: { code: 'HOTFIX', label: 'Hotfix', color: '#d97706', order: 3 } }),
  ]);

  // ── 状态字典（5个通用状态）──
  await Promise.all([
    prisma.statusDef.create({ data: { code: 'DESIGN', label: '设计中', stageGroup: 'REQUIREMENT', color: '#7c3aed', order: 1 } }),
    prisma.statusDef.create({ data: { code: 'DEVELOPING', label: '进行中', stageGroup: 'DEVELOPMENT', color: '#3b6ff0', order: 2 } }),
    prisma.statusDef.create({ data: { code: 'REJECTED', label: '打回', stageGroup: 'DEVELOPMENT', color: '#dc3535', order: 3 } }),
    prisma.statusDef.create({ data: { code: 'ABORTED', label: '中止', stageGroup: 'DELIVERY', color: '#64748b', order: 4 } }),
    prisma.statusDef.create({ data: { code: 'DELIVERED', label: '已完成', stageGroup: 'DELIVERY', color: '#18a870', order: 5 } }),
  ]);

  // ── 研发模块（13个）──
  const modules = await Promise.all([
    prisma.module.create({ data: { name: '融合感知', color: '#7c3aed', order: 1 } }),
    prisma.module.create({ data: { name: '定位与标定', color: '#0891b2', order: 2 } }),
    prisma.module.create({ data: { name: '车云调度与决策', color: '#3b6ff0', order: 3 } }),
    prisma.module.create({ data: { name: '系统', color: '#64748b', order: 4 } }),
    prisma.module.create({ data: { name: '车辆与控制', color: '#059669', order: 5 } }),
    prisma.module.create({ data: { name: '监管云', color: '#d97706', order: 6 } }),
    prisma.module.create({ data: { name: '规划', color: '#2563eb', order: 7 } }),
    prisma.module.create({ data: { name: '硬件', color: '#dc2626', order: 8 } }),
    prisma.module.create({ data: { name: 'AiLab', color: '#7c3aed', order: 9 } }),
    prisma.module.create({ data: { name: '质量', color: '#0d9488', order: 10 } }),
    prisma.module.create({ data: { name: '解决方案', color: '#4f46e5', order: 11 } }),
    prisma.module.create({ data: { name: 'GTS', color: '#be123c', order: 12 } }),
    prisma.module.create({ data: { name: '地图云', color: '#0369a1', order: 13 } }),
  ]);

  // ── 用户 ──
  const [pm, dev1, dev2, dev3] = await Promise.all([
    prisma.user.create({ data: { name: '刘PM', email: 'liupm@ads.local', password: 'hashed_demo', role: 'PM', avatarSeed: 'pm' } }),
    prisma.user.create({ data: { name: '张伟', email: 'zhangwei@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'zw' } }),
    prisma.user.create({ data: { name: '李明', email: 'liming@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'lm' } }),
    prisma.user.create({ data: { name: '王芳', email: 'wangfang@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'wf' } }),
  ]);

  // ── 版本数据（2个干净的新版本）──
  // 获取模板用于自动生成子节点
  const templates = await prisma.stageTemplate.findMany({
    include: { stageGroup: true },
    orderBy: [{ stageGroup: { order: 'asc' } }, { order: 'asc' }],
  });

  // V3.0.0 — 感知融合重构
  const v300 = await prisma.item.create({
    data: {
      title: '感知融合重构',
      versionNo: 'V3.0.0',
      priority: 'T0',
      ownerId: dev1.id,
      createdById: pm.id,
      natureId: ntFeature.id,
      depth: 0,
      mokraMotivation: '当前融合延迟120ms+，需优化至80ms以满足高速场景',
      mokraObjects: '完成感知融合V3架构开发与量产验证',
      mokraKeyResults: '融合延迟≤80ms; 检测准确率≥98.5%; 零安全缺陷',
      mokraActions: '1.算法重构 2.SIL回归 3.HIL验证 4.实车路测',
    }
  });
  await prisma.itemModule.createMany({ data: [{ itemId: v300.id, moduleId: modules[0].id }, { itemId: v300.id, moduleId: modules[2].id }] });
  // 自动生成子节点
  let order = 0;
  for (const t of templates) {
    await prisma.item.create({
      data: {
        parentId: v300.id, title: t.name, stageType: t.stageGroup.code,
        isParallel: t.isParallel, parallelGroup: t.parallelGroup,
        order: order++, depth: 1, versionNo: 'V3.0.0',
        plannedStart: new Date('2026-05-15'),
        plannedEnd: new Date('2026-07-30'),
      }
    });
  }

  // V2.9.1 — 定位精度提升
  const v291 = await prisma.item.create({
    data: {
      title: '定位精度提升',
      versionNo: 'V2.9.1',
      priority: 'T1',
      ownerId: dev2.id,
      createdById: pm.id,
      natureId: ntFeature.id,
      depth: 0,
      mokraMotivation: 'GNSS弱信号场景定位精度不足，偏差>20cm',
      mokraObjects: '弱信号场景定位精度≤10cm',
      mokraKeyResults: '城市峡谷场景精度≤10cm; 隧道口切换<1s',
      mokraActions: '1.IMU融合优化 2.多源定位切换 3.HIL精度测试',
    }
  });
  await prisma.itemModule.createMany({ data: [{ itemId: v291.id, moduleId: modules[1].id }] });
  order = 0;
  for (const t of templates) {
    await prisma.item.create({
      data: {
        parentId: v291.id, title: t.name, stageType: t.stageGroup.code,
        isParallel: t.isParallel, parallelGroup: t.parallelGroup,
        order: order++, depth: 1, versionNo: 'V2.9.1',
        plannedStart: new Date('2026-05-20'),
        plannedEnd: new Date('2026-08-15'),
      }
    });
  }

  console.log('✅ Seed 完成');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
