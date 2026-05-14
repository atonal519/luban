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

  return NextResponse.json(item, { status: 201 });
}
