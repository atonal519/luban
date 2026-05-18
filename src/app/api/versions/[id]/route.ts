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
    'title', 'versionNo', 'priorityId', 'natureId', 'statusId',
    'ownerId', 'description', 'stageType', 'progress',
    'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd',
    'mokraMotivation', 'mokraObjects', 'mokraKeyResults', 'mokraActions',
    'applicationScope', 'tagId',
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Cascade: delete children's approvals/events, then children, then parent's related data
  const children = await prisma.item.findMany({ where: { parentId: id }, select: { id: true } });
  const childIds = children.map(c => c.id);

  // Delete approval events and approvals for children
  const childApprovals = await prisma.approval.findMany({ where: { itemId: { in: childIds } } });
  if (childApprovals.length > 0) {
    await prisma.approvalEvent.deleteMany({ where: { approvalId: { in: childApprovals.map(a => a.id) } } });
    await prisma.approval.deleteMany({ where: { itemId: { in: childIds } } });
  }

  // Delete children
  await prisma.item.deleteMany({ where: { parentId: id } });

  // Delete parent's related data
  const parentApproval = await prisma.approval.findUnique({ where: { itemId: id } });
  if (parentApproval) {
    await prisma.approvalEvent.deleteMany({ where: { approvalId: parentApproval.id } });
    await prisma.approval.delete({ where: { id: parentApproval.id } });
  }
  await prisma.dailyLog.deleteMany({ where: { itemId: id } });
  await prisma.rejection.deleteMany({ where: { itemId: id } });
  await prisma.alert.deleteMany({ where: { itemId: id } });
  await prisma.itemModule.deleteMany({ where: { itemId: id } });

  // Delete the item itself
  await prisma.item.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
