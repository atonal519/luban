import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Only allow updating specific fields
  const allowed = [
    'title', 'versionNo', 'priority', 'natureId', 'statusId',
    'ownerId', 'description', 'stageType', 'progress',
    'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd',
    'mokraMotivation', 'mokraObjects', 'mokraKeyResults', 'mokraActions',
    'applicationScope',
  ];

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      // Handle date fields
      if (['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'].includes(key)) {
        data[key] = body[key] ? new Date(body[key]) : null;
      } else {
        data[key] = body[key];
      }
    }
  }

  // Handle moduleIds separately (many-to-many)
  if ('moduleIds' in body) {
    await prisma.itemModule.deleteMany({ where: { itemId: id } });
    if (Array.isArray(body.moduleIds) && body.moduleIds.length > 0) {
      await prisma.itemModule.createMany({
        data: body.moduleIds.map((mid: string) => ({ itemId: id, moduleId: mid })),
      });
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data,
    include: {
      nature: true,
      status: true,
      owner: true,
      modules: { include: { module: true } },
    },
  });

  return NextResponse.json(updated);
}
