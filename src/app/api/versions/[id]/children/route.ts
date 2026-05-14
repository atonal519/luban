import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, stageType, isParallel, parallelGroup, statusId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  }

  // Get current max order for children of this item
  const maxOrder = await prisma.item.findFirst({
    where: { parentId: id },
    orderBy: { order: 'desc' },
    select: { order: true },
  });

  const child = await prisma.item.create({
    data: {
      parentId: id,
      title: title.trim(),
      stageType: stageType || '',
      isParallel: isParallel || false,
      parallelGroup: parallelGroup || '',
      statusId: statusId || null,
      depth: 1,
      order: (maxOrder?.order ?? -1) + 1,
      // Inherit versionNo from parent
      versionNo: (await prisma.item.findUnique({ where: { id }, select: { versionNo: true } }))?.versionNo || '',
    },
    include: { status: true },
  });

  return NextResponse.json(child, { status: 201 });
}
