const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get references
  const statuses = await p.statusDef.findMany();
  const sMap = Object.fromEntries(statuses.map(s => [s.code, s.id]));
  const modules = await p.module.findMany({ orderBy: { order: 'asc' } });
  const users = await p.user.findMany();
  const natures = await p.nature.findMany();
  const templates = await p.stageTemplate.findMany({ include: { stageGroup: true }, orderBy: [{ stageGroup: { order: 'asc' } }, { order: 'asc' }] });

  const pm = users.find(u => u.role === 'PM');
  const devs = users.filter(u => u.role === 'DEV');
  const ntFeature = natures.find(n => n.code === 'FEATURE');
  const ntBug = natures.find(n => n.code === 'BUG');
  const ntHotfix = natures.find(n => n.code === 'HOTFIX');

  // Helper: create version with auto-generated children at various stages
  async function createVersion(opts) {
    const item = await p.item.create({
      data: {
        title: opts.title, versionNo: opts.versionNo, priority: opts.priority,
        ownerId: opts.owner.id, createdById: pm.id, natureId: opts.nature.id,
        depth: 0, description: opts.description || '',
        mokraMotivation: opts.mokra?.[0] || '', mokraObjects: opts.mokra?.[1] || '',
        mokraKeyResults: opts.mokra?.[2] || '', mokraActions: opts.mokra?.[3] || '',
      }
    });
    // Link modules
    for (const m of opts.modules) {
      await p.itemModule.create({ data: { itemId: item.id, moduleId: m.id } });
    }
    // Create children from templates with specified statuses
    let order = 0;
    for (const t of templates) {
      const statusForNode = opts.nodeStatuses?.[t.name] || null;
      await p.item.create({
        data: {
          parentId: item.id, title: t.name, stageType: t.stageGroup.code,
          isParallel: t.isParallel, parallelGroup: t.parallelGroup,
          order: order++, depth: 1, versionNo: opts.versionNo,
          statusId: statusForNode ? sMap[statusForNode] : null,
          plannedStart: opts.plannedStart ? new Date(opts.plannedStart) : null,
          plannedEnd: opts.plannedEnd ? new Date(opts.plannedEnd) : null,
        }
      });
    }
    // Add some logs
    if (opts.logs) {
      for (const log of opts.logs) {
        await p.dailyLog.create({ data: { itemId: item.id, authorId: opts.owner.id, logDate: log.date, content: log.text } });
      }
    }
    console.log(`  ✓ ${opts.versionNo} ${opts.title}`);
    return item;
  }

  // ── V3.1.0 — 全部已完成 ──
  await createVersion({
    title: '底盘通信协议升级', versionNo: 'V3.1.0', priority: 'T1',
    owner: devs[0], nature: ntFeature, modules: [modules[3], modules[4]],
    description: 'CAN总线协议从2.0升级至FD，提升通信带宽至8Mbps',
    mokra: ['底盘通信瓶颈，延迟>5ms', '完成CAN FD协议适配', '通信延迟≤2ms', '1.协议适配 2.硬件验证 3.整车测试'],
    nodeStatuses: { '需求评审': 'DELIVERED', '待排期': 'DELIVERED', '开发': 'DELIVERED', '自测': 'DELIVERED', 'SIL集成测试': 'DELIVERED', 'HIL测试': 'DELIVERED', '功能测试': 'DELIVERED', '性能测试': 'DELIVERED', '集成测试': 'DELIVERED', '实车测试': 'DELIVERED', '道路测试': 'DELIVERED', '交付审核': 'DELIVERED', '预生产': 'DELIVERED', '正式交付': 'DELIVERED' },
    plannedStart: '2026-01-10', plannedEnd: '2026-04-20',
    logs: [{ date: '2026-04-20 16:30', text: '正式交付完成，全链路通过。' }],
  });

  // ── V3.2.0 — 测试阶段，有并行 ──
  await createVersion({
    title: '高速场景轨迹规划优化', versionNo: 'V3.2.0', priority: 'T0',
    owner: devs[1], nature: ntFeature, modules: [modules[6], modules[0]],
    description: '高速公路场景下轨迹规划抖动，乘客舒适性投诉频率高',
    mokra: ['高速变道轨迹抖动>0.3m/s²', '平滑度提升50%', '横向加速度≤0.15m/s²; 纵向jerk≤1.5m/s³', '1.曲线拟合优化 2.预测模块联调 3.SIL/HIL回归'],
    nodeStatuses: { '需求评审': 'DELIVERED', '待排期': 'DELIVERED', '开发': 'DELIVERED', '自测': 'DELIVERED', 'SIL集成测试': 'DELIVERED', 'HIL测试': 'DEVELOPING', '功能测试': 'DEVELOPING', '性能测试': 'DEVELOPING' },
    plannedStart: '2026-03-01', plannedEnd: '2026-06-30',
    logs: [
      { date: '2026-05-15 10:20', text: 'HIL测试进行中，200个标准场景已跑完160个，通过率97.5%。' },
      { date: '2026-05-14 14:00', text: '功能测试同步推进，变道场景覆盖率85%。' },
    ],
  });

  // ── V2.8.3 — Bug修复，开发阶段被打回 ──
  await createVersion({
    title: '低速泊车碰撞检测误报修复', versionNo: 'V2.8.3', priority: 'T0',
    owner: devs[2], nature: ntBug, modules: [modules[0]],
    description: '低速泊车场景下超声波传感器误报率>15%，导致AEB频繁误触发',
    mokra: ['泊车误报率15%+', '误报率降至<2%', 'AEB误触发率<1%; 无漏检', '1.滤波算法优化 2.多传感器融合 3.场景回归'],
    nodeStatuses: { '需求评审': 'DELIVERED', '待排期': 'DELIVERED', '开发': 'REJECTED', '自测': null },
    plannedStart: '2026-04-15', plannedEnd: '2026-06-15',
    logs: [
      { date: '2026-05-13 09:15', text: '代码评审被打回：滤波窗口参数硬编码，需改为可配置。' },
      { date: '2026-05-12 17:30', text: '完成超声波滤波算法V2，误报率降至3.8%，尚未达标。' },
    ],
  });

  // ── V3.3.0 — 需求阶段，设计中 ──
  await createVersion({
    title: '车路协同V2X接入', versionNo: 'V3.3.0', priority: 'T1',
    owner: devs[0], nature: ntFeature, modules: [modules[2], modules[5], modules[12]],
    description: 'V2X路侧单元信号接入，实现红绿灯倒计时和前方事故预警',
    mokra: ['当前无V2X能力', '完成V2X基础能力接入', '支持SPAT/MAP消息解析; 红绿灯识别准确率≥99%', '1.协议栈开发 2.路侧模拟 3.实车路测'],
    nodeStatuses: { '需求评审': 'DESIGN' },
    plannedStart: '2026-06-01', plannedEnd: '2026-09-30',
    logs: [{ date: '2026-05-15 11:00', text: '需求评审文档V1已提交，待技术委员会评审。' }],
  });

  // ── V2.7.1 — Hotfix，交付阶段 ──
  await createVersion({
    title: 'OTA升级包签名校验修复', versionNo: 'V2.7.1', priority: 'FATAL',
    owner: devs[1], nature: ntHotfix, modules: [modules[3]],
    description: '线上发现OTA包签名校验绕过漏洞，需紧急修复',
    mokra: ['安全漏洞CVE-2026-XXXX', '修复签名校验逻辑', '无法绕过签名校验; 回归测试100%通过', '1.漏洞修复 2.安全审计 3.紧急发版'],
    nodeStatuses: { '需求评审': 'DELIVERED', '待排期': 'DELIVERED', '开发': 'DELIVERED', '自测': 'DELIVERED', 'SIL集成测试': 'DELIVERED', 'HIL测试': 'DELIVERED', '功能测试': 'DELIVERED', '性能测试': 'DELIVERED', '集成测试': 'DELIVERED', '实车测试': 'DELIVERED', '道路测试': 'DELIVERED', '交付审核': 'DEVELOPING', '预生产': null, '正式交付': null },
    plannedStart: '2026-05-10', plannedEnd: '2026-05-20',
    logs: [
      { date: '2026-05-15 08:30', text: '交付审核中，等待安全团队签字确认。' },
      { date: '2026-05-14 20:00', text: '紧急道路测试通过，无回归缺陷。' },
    ],
  });

  // ── V2.6.0 — 中止 ──
  await createVersion({
    title: '激光雷达降本方案评估', versionNo: 'V2.6.0', priority: 'T2',
    owner: devs[2], nature: ntFeature, modules: [modules[0], modules[7]],
    description: '评估替换为国产低成本激光雷达的可行性',
    nodeStatuses: { '需求评审': 'DELIVERED', '待排期': 'DELIVERED', '开发': 'ABORTED' },
    plannedStart: '2026-02-01', plannedEnd: '2026-05-01',
    logs: [{ date: '2026-04-10 14:00', text: '经评估，国产雷达精度不达标，项目中止。' }],
  });

  console.log('\n✅ Demo 数据灌入完成');
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
