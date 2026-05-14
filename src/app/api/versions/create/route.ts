import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, versionNo, priority, natureId, ownerId, moduleIds } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
  }

  const item = await prisma.item.create({
    data: {
      title: title.trim(),
      versionNo: versionNo?.trim() || '',
      priority: priority || 'MID',
      natureId: natureId || null,
      ownerId: ownerId || null,
      createdById: ownerId || null,
      depth: 0,
    },
  });

  // Link modules
  if (Array.isArray(moduleIds) && moduleIds.length > 0) {
    await prisma.itemModule.createMany({
      data: moduleIds.map((mid: string) => ({ itemId: item.id, moduleId: mid })),
    });
  }

  // Auto-generate child nodes from stage templates
  const templates = await prisma.stageTemplate.findMany({
    include: { stageGroup: true },
    orderBy: [{ stageGroup: { order: 'asc' } }, { order: 'asc' }],
  });

  if (templates.length > 0) {
    let globalOrder = 0;
    await prisma.item.createMany({
      data: templates.map((t) => ({
        parentId: item.id,
        title: t.name,
        stageType: t.stageGroup.code,
        isParallel: t.isParallel,
        parallelGroup: t.parallelGroup,
        order: globalOrder++,
        depth: 1,
        versionNo: item.versionNo,
      })),
    });
  }

  return NextResponse.json(item, { status: 201 });
}
