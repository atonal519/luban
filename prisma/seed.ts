import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── 清空旧数据 ──
  await prisma.approvalEvent.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.itemModule.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();
  await prisma.module.deleteMany();
  await prisma.nature.deleteMany();
  await prisma.statusDef.deleteMany();
  await prisma.stageGroup.deleteMany();

  // ── 阶段分组（4大节点，版本生成已删）──
  const [sgRequirement, sgDevelopment, sgTest, sgDelivery] = await Promise.all([
    prisma.stageGroup.create({ data: { code: 'REQUIREMENT', label: '需求入口', order: 1 } }),
    prisma.stageGroup.create({ data: { code: 'DEVELOPMENT', label: '版本开发', order: 2 } }),
    prisma.stageGroup.create({ data: { code: 'TEST', label: '版本测试', order: 3 } }),
    prisma.stageGroup.create({ data: { code: 'DELIVERY', label: '版本交付', order: 4 } }),
  ]);

  // ── 阶段默认节点模板 ──
  await Promise.all([
    // 需求入口
    prisma.stageTemplate.create({ data: { stageGroupId: sgRequirement.id, name: '需求评审', order: 1 } }),
    // 版本开发
    prisma.stageTemplate.create({ data: { stageGroupId: sgDevelopment.id, name: '待排期', order: 1 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDevelopment.id, name: '开发', order: 2 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgDevelopment.id, name: '自测', order: 3 } }),
    // 版本测试
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: 'SIL集成测试', order: 1 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: 'HIL测试', order: 2, isParallel: true, parallelGroup: 'TEST_A' } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '功能测试', order: 3, isParallel: true, parallelGroup: 'TEST_A' } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '性能测试', order: 4, isParallel: true, parallelGroup: 'TEST_A' } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '集成测试', order: 5 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '实车测试', order: 6 } }),
    prisma.stageTemplate.create({ data: { stageGroupId: sgTest.id, name: '道路测试', order: 7 } }),
    // 版本交付
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

  // ── 状态字典 ──
  const statuses = await Promise.all([
    prisma.statusDef.create({ data: { code: 'PENDING_SCHEDULE', label: '待排期', stageGroup: 'REQUIREMENT', color: '#94a3b8', order: 1 } }),
    prisma.statusDef.create({ data: { code: 'SPEC', label: '规格', stageGroup: 'REQUIREMENT', color: '#8b5cf6', order: 2 } }),
    prisma.statusDef.create({ data: { code: 'DESIGN', label: '设计', stageGroup: 'REQUIREMENT', color: '#7c3aed', order: 3 } }),
    prisma.statusDef.create({ data: { code: 'TMG', label: 'TMG', stageGroup: 'DEVELOPMENT', color: '#0891b2', order: 4 } }),
    prisma.statusDef.create({ data: { code: 'DEVELOPING', label: '开发/推进', stageGroup: 'DEVELOPMENT', color: '#3b6ff0', order: 5 } }),
    prisma.statusDef.create({ data: { code: 'SELF_TEST', label: '自测', stageGroup: 'DEVELOPMENT', color: '#6366f1', order: 6 } }),
    prisma.statusDef.create({ data: { code: 'REJECTED', label: '打回', stageGroup: 'DEVELOPMENT', color: '#dc3535', order: 7 } }),
    prisma.statusDef.create({ data: { code: 'SUBMIT_TEST', label: '提测', stageGroup: 'TEST', color: '#0891b2', order: 8 } }),
    prisma.statusDef.create({ data: { code: 'HIL', label: 'HIL', stageGroup: 'TEST', color: '#059669', order: 9 } }),
    prisma.statusDef.create({ data: { code: 'SIL', label: 'SIL', stageGroup: 'TEST', color: '#10b981', order: 10 } }),
    prisma.statusDef.create({ data: { code: 'INTEGRATION', label: '集成', stageGroup: 'TEST', color: '#14b8a6', order: 11 } }),
    prisma.statusDef.create({ data: { code: 'REAL_CAR', label: '实车', stageGroup: 'TEST', color: '#f59e0b', order: 12 } }),
    prisma.statusDef.create({ data: { code: 'PRE_TEST', label: '预测', stageGroup: 'TEST', color: '#d97706', order: 13 } }),
    prisma.statusDef.create({ data: { code: 'PRE_PRODUCTION', label: '预生产', stageGroup: 'TEST', color: '#ea580c', order: 14 } }),
    prisma.statusDef.create({ data: { code: 'PENDING_RELEASE', label: '待上线', stageGroup: 'DELIVERY', color: '#8b5cf6', order: 15 } }),
    prisma.statusDef.create({ data: { code: 'DELIVERED', label: '交付/完成', stageGroup: 'DELIVERY', color: '#18a870', order: 16 } }),
    prisma.statusDef.create({ data: { code: 'ABORTED', label: '中止', stageGroup: 'DELIVERY', color: '#64748b', order: 17 } }),
  ]);

  const statusMap = Object.fromEntries(statuses.map(s => [s.code, s]));

  // ── 研发模块 ──
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
  const modPerception = modules[0];
  const modControl = modules[2];
  const modLocation = modules[1];
  const modSystem = modules[3];

  // ── 用户 ──
  const [pm, zhangwei, liming, wangfang, chenhao, liuyang] = await Promise.all([
    prisma.user.create({ data: { name: '刘PM', email: 'liupm@ads.local', password: 'hashed_demo', role: 'PM', avatarSeed: 'pm' } }),
    prisma.user.create({ data: { name: '张伟', email: 'zhangwei@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'zw' } }),
    prisma.user.create({ data: { name: '李明', email: 'liming@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'lm' } }),
    prisma.user.create({ data: { name: '王芳', email: 'wangfang@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'wf' } }),
    prisma.user.create({ data: { name: '陈浩', email: 'chenhao@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'ch' } }),
    prisma.user.create({ data: { name: '刘洋', email: 'liuyang@ads.local', password: 'hashed_demo', role: 'DEV', avatarSeed: 'ly' } }),
  ]);

  // ── 版本数据 ──────────────────────────────────────────────
  // V2.4.1 — 感知融合模块升级
  const v241 = await prisma.item.create({
    data: {
      title: '感知融合模块升级',
      versionNo: 'V2.4.1',
      priority: 'HIGH',
      ownerId: zhangwei.id,
      createdById: pm.id,
      natureId: ntFeature.id,
      statusId: statusMap.DEVELOPING.id,
      stageType: 'DEVELOPMENT',
      plannedStart: new Date('2026-02-01'),
      plannedEnd: new Date('2026-06-10'),
      progress: 45,
      mokraMotivation: '当前感知融合延迟较高(>120ms)，需优化到80ms内以满足高速场景需求',
      mokraObjects: '完成感知融合模块V2架构开发与验证',
      mokraKeyResults: '融合延迟≤80ms; 目标检测准确率≥98%; 无安全等级以上缺陷',
      mokraActions: '1.激光雷达融合算法重构 2.摄像头同步接口优化 3.SIL仿真验证 4.HIL台架测试',
      depth: 0,
    }
  });

  await prisma.itemModule.create({ data: { itemId: v241.id, moduleId: modPerception.id } });

  // V2.4.1 子项
  const v241_req = await prisma.item.create({
    data: {
      parentId: v241.id, title: '需求评审通过', versionNo: 'V2.4.1', depth: 1, order: 1,
      stageType: 'REQUIREMENT', statusId: statusMap.SPEC.id, ownerId: zhangwei.id, createdById: pm.id,
      progress: 100, plannedStart: new Date('2026-02-01'), plannedEnd: new Date('2026-02-14'),
      actualStart: new Date('2026-02-01'), actualEnd: new Date('2026-02-14'),
    }
  });

  const v241_dev = await prisma.item.create({
    data: {
      parentId: v241.id, title: '激光雷达融合开发', versionNo: 'V2.4.1', depth: 1, order: 2,
      stageType: 'DEVELOPMENT', statusId: statusMap.DEVELOPING.id, ownerId: zhangwei.id, createdById: pm.id,
      natureId: ntFeature.id, progress: 60,
      plannedStart: new Date('2026-03-01'), plannedEnd: new Date('2026-04-15'),
      actualStart: new Date('2026-03-01'),
      requiresApproval: true,
    }
  });

  await prisma.itemModule.create({ data: { itemId: v241_dev.id, moduleId: modPerception.id } });

  // V2.4.1 子项的子项（第三层）
  await prisma.item.create({
    data: {
      parentId: v241_dev.id, title: '坐标系对齐模块重构', versionNo: 'V2.4.1', depth: 2, order: 1,
      stageType: 'DEVELOPMENT', statusId: statusMap.DEVELOPING.id, ownerId: zhangwei.id, createdById: pm.id,
      progress: 80, plannedStart: new Date('2026-03-01'), plannedEnd: new Date('2026-03-20'),
      actualStart: new Date('2026-03-01'),
    }
  });
  await prisma.item.create({
    data: {
      parentId: v241_dev.id, title: '摄像头数据同步接口', versionNo: 'V2.4.1', depth: 2, order: 2,
      stageType: 'DEVELOPMENT', statusId: statusMap.DEVELOPING.id, ownerId: zhangwei.id, createdById: pm.id,
      progress: 40, plannedStart: new Date('2026-03-15'), plannedEnd: new Date('2026-04-10'),
      actualStart: new Date('2026-03-15'),
    }
  });

  // V2.4.1 测试（并行）
  const v241_hil = await prisma.item.create({
    data: {
      parentId: v241.id, title: 'HIL测试', versionNo: 'V2.4.1', depth: 1, order: 3,
      stageType: 'TEST', statusId: statusMap.PENDING_SCHEDULE.id, ownerId: zhangwei.id, createdById: pm.id,
      isParallel: true, parallelGroup: 'A', progress: 0,
      plannedStart: new Date('2026-04-16'), plannedEnd: new Date('2026-05-10'),
    }
  });
  await prisma.item.create({
    data: {
      parentId: v241.id, title: 'SIL集成测试', versionNo: 'V2.4.1', depth: 1, order: 4,
      stageType: 'TEST', statusId: statusMap.PENDING_SCHEDULE.id, ownerId: zhangwei.id, createdById: pm.id,
      isParallel: true, parallelGroup: 'A', progress: 0,
      plannedStart: new Date('2026-04-16'), plannedEnd: new Date('2026-05-10'),
    }
  });

  // V2.4.1 审核流转
  const v241_approval = await prisma.approval.create({
    data: { itemId: v241_dev.id, state: 'WAITING_SUBMIT' }
  });
  await prisma.approvalEvent.create({
    data: {
      approvalId: v241_approval.id, type: 'REQUEST', actorId: pm.id,
      note: '请提交激光雷达融合模块代码合入CR链接及评审通过截图',
    }
  });

  // V2.4.1 日志
  await prisma.dailyLog.create({ data: { itemId: v241.id, authorId: zhangwei.id, logDate: '2026-05-13', content: '完成激光雷达融合模块代码集成，消除坐标系对齐bug。等待PM审核后提交CR凭证。' } });
  await prisma.dailyLog.create({ data: { itemId: v241.id, authorId: zhangwei.id, logDate: '2026-05-12', content: '前融合模块单元测试覆盖率提升至87%，识别出3处边界条件未覆盖，已补充。' } });

  // ── V2.3.5 — 规划控制优化 ──
  const v235 = await prisma.item.create({
    data: {
      title: '规划控制优化', versionNo: 'V2.3.5', priority: 'HIGH',
      ownerId: liming.id, createdById: pm.id, natureId: ntFeature.id,
      statusId: statusMap.SIL.id, stageType: 'TEST', progress: 70,
      plannedStart: new Date('2026-01-10'), plannedEnd: new Date('2026-06-01'),
      actualStart: new Date('2026-01-10'),
      mokraMotivation: '变道决策舒适性投诉率高(月均12起)，需提升横向规划品质',
      mokraObjects: '完成规控V2.3.5优化并通过SIL验证',
      mokraKeyResults: '变道舒适性指标提升15%; SIL通过率≥95%; 无功能安全问题',
      mokraActions: '1.变道决策参数优化 2.SIL场景回归 3.HIL台架验证 4.实车路测',
      depth: 0,
    }
  });
  await prisma.itemModule.create({ data: { itemId: v235.id, moduleId: modControl.id } });

  // V2.3.5 并行测试子项
  const v235_hil = await prisma.item.create({
    data: {
      parentId: v235.id, title: 'HIL测试', versionNo: 'V2.3.5', depth: 1, order: 1,
      stageType: 'TEST', statusId: statusMap.HIL.id, ownerId: liming.id, createdById: pm.id,
      isParallel: true, parallelGroup: 'B', progress: 60,
      plannedStart: new Date('2026-04-01'), plannedEnd: new Date('2026-05-15'),
      actualStart: new Date('2026-04-01'),
      requiresApproval: true,
    }
  });
  await prisma.item.create({
    data: {
      parentId: v235.id, title: '功能测试', versionNo: 'V2.3.5', depth: 1, order: 2,
      stageType: 'TEST', statusId: statusMap.SUBMIT_TEST.id, ownerId: liming.id, createdById: pm.id,
      isParallel: true, parallelGroup: 'B', progress: 40,
      plannedStart: new Date('2026-04-01'), plannedEnd: new Date('2026-05-15'),
      actualStart: new Date('2026-04-01'),
    }
  });

  // V2.3.5 HIL 审核（已提交待审核）
  const v235_approval = await prisma.approval.create({
    data: { itemId: v235_hil.id, state: 'SUBMITTED' }
  });
  await prisma.approvalEvent.create({
    data: { approvalId: v235_approval.id, type: 'REQUEST', actorId: pm.id, note: '请上传HIL台架测试报告及测试通过截图' }
  });
  await prisma.approvalEvent.create({
    data: { approvalId: v235_approval.id, type: 'SUBMIT', actorId: liming.id, note: '', evidenceUrl: 'HIL_Report_V2.3.5_0511.pdf', evidenceText: 'HIL台架测试报告已上传' }
  });

  // V2.3.5 日志
  await prisma.dailyLog.create({ data: { itemId: v235.id, authorId: liming.id, logDate: '2026-05-13', content: 'SIL仿真200个标准场景通过率96.5%，7个失败用例已记录。HIL报告已提交PM审核中。' } });

  // ── V2.3.2 — 高精地图接口对接（延期）──
  const v232 = await prisma.item.create({
    data: {
      title: '高精地图接口对接', versionNo: 'V2.3.2', priority: 'MID',
      ownerId: wangfang.id, createdById: pm.id, natureId: ntFeature.id,
      statusId: statusMap.HIL.id, stageType: 'TEST', progress: 55,
      plannedStart: new Date('2026-01-05'), plannedEnd: new Date('2026-06-05'),
      actualStart: new Date('2026-01-05'),
      mokraMotivation: '高精地图SDK升级至V3，旧接口将于Q2 EOL',
      mokraObjects: '完成V3 SDK适配并通过全量测试',
      mokraKeyResults: '地图更新频率≥10Hz; 绝对定位精度≤10cm; 无回归缺陷',
      mokraActions: '1.SDK接口适配 2.HIL精度测试 3.实车道路验证',
      depth: 0,
    }
  });
  await prisma.itemModule.create({ data: { itemId: v232.id, moduleId: modLocation.id } });

  // V2.3.2 HIL（已驳回）
  const v232_hil = await prisma.item.create({
    data: {
      parentId: v232.id, title: 'HIL精度测试', versionNo: 'V2.3.2', depth: 1, order: 1,
      stageType: 'TEST', statusId: statusMap.HIL.id, ownerId: wangfang.id, createdById: pm.id,
      progress: 70, requiresApproval: true,
      plannedStart: new Date('2026-03-01'), plannedEnd: new Date('2026-05-10'),
      actualStart: new Date('2026-03-01'),
    }
  });
  const v232_approval = await prisma.approval.create({
    data: { itemId: v232_hil.id, state: 'REJECTED' }
  });
  await prisma.approvalEvent.create({
    data: { approvalId: v232_approval.id, type: 'REQUEST', actorId: pm.id, note: '请上传HIL台架测试报告' }
  });
  await prisma.approvalEvent.create({
    data: { approvalId: v232_approval.id, type: 'SUBMIT', actorId: wangfang.id, evidenceUrl: 'HIL_Report_V2.3.2_0507.pdf', evidenceText: 'HIL测试报告已提交' }
  });
  await prisma.approvalEvent.create({
    data: { approvalId: v232_approval.id, type: 'REJECT', actorId: pm.id, note: '测试报告第3项精度指标超差15cm，未达合同要求，请补充GNSS异常排查记录后重新提交。' }
  });

  // V2.3.2 告警
  await prisma.alert.create({ data: { itemId: v232.id, level: 'LATE', message: 'HIL测试已超期3天，凭证被驳回' } });

  // V2.3.2 日志
  await prisma.dailyLog.create({ data: { itemId: v232.id, authorId: wangfang.id, logDate: '2026-05-13', content: 'HIL超差问题：正在排查GNSS更新频率，预计明日提供补充排查记录。' } });

  // ── V2.2.8 — 障碍物检测精度提升 ──
  const v228 = await prisma.item.create({
    data: {
      title: '障碍物检测精度提升', versionNo: 'V2.2.8', priority: 'MID',
      ownerId: chenhao.id, createdById: pm.id, natureId: ntFeature.id,
      statusId: statusMap.PENDING_RELEASE.id, stageType: 'DELIVERY', progress: 90,
      plannedStart: new Date('2025-12-01'), plannedEnd: new Date('2026-05-20'),
      actualStart: new Date('2025-12-01'),
      depth: 0,
    }
  });
  await prisma.itemModule.create({ data: { itemId: v228.id, moduleId: modPerception.id } });
  await prisma.dailyLog.create({ data: { itemId: v228.id, authorId: chenhao.id, logDate: '2026-05-13', content: '客户验收第二轮评审完成，识别率98.2%达标。等待签字文件。' } });

  // ── V2.2.1 — 底层驱动兼容性修复（已完成）──
  const v221 = await prisma.item.create({
    data: {
      title: '底层驱动兼容性修复', versionNo: 'V2.2.1', priority: 'LOW',
      ownerId: liuyang.id, createdById: pm.id, natureId: ntBug.id,
      statusId: statusMap.DELIVERED.id, stageType: 'DELIVERY', progress: 100,
      plannedStart: new Date('2025-10-10'), plannedEnd: new Date('2025-12-20'),
      actualStart: new Date('2025-10-10'), actualEnd: new Date('2025-12-20'),
      depth: 0,
    }
  });
  await prisma.itemModule.create({ data: { itemId: v221.id, moduleId: modSystem.id } });
  await prisma.dailyLog.create({ data: { itemId: v221.id, authorId: liuyang.id, logDate: '2025-12-20', content: '正式交付完成，支持Ubuntu 22.04/20.04双版本，文档已归档。' } });

  console.log('✅ Seed 完成');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
