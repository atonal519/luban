import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();

    const allowed = [
      'title', 'versionNo', 'priorityId', 'natureId', 'statusId',
      'ownerId', 'description', 'stageType', 'progress',
      'plannedStart', 'plannedEnd', 'actualStart', 'actualEnd',
      'mokraMotivation', 'mokraObjects', 'mokraKeyResults', 'mokraActions',
      'applicationScope', 'tagId', 'focus', 'milestoneId',
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) {
        if (['plannedStart', 'plannedEnd', 'actualStart', 'actualEnd'].includes(key)) {
          data[key] = body[key] ? new Date(body[key]) : null;
        } else {
          data[key] = body[key];
        }
      }
    }

    if ('moduleIds' in body) {
      await prisma.itemModule.deleteMany({ where: { itemId: id } });
      if (Array.isArray(body.moduleIds) && body.moduleIds.length > 0) {
        await prisma.itemModule.createMany({
          data: body.moduleIds.map((mid: string) => ({ itemId: id, moduleId: mid })),
        });
      }
    }

    if ('customFieldValues' in body && typeof body.customFieldValues === 'object' && body.customFieldValues !== null) {
      for (const [fieldId, value] of Object.entries(body.customFieldValues)) {
        await prisma.customFieldValue.upsert({
          where: { itemId_fieldId: { itemId: id, fieldId } },
          update: { value: String(value) },
          create: { itemId: id, fieldId, value: String(value) },
        });
      }
    }

    const updated = await prisma.item.update({
      where: { id },
      data,
      include: { nature: true, status: true, owner: true, modules: { include: { module: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const children = await prisma.item.findMany({ where: { parentId: id }, select: { id: true } });
    const childIds = children.map(c => c.id);

    await prisma.$transaction(async (tx) => {
      // Children's approvals
      const childApprovals = await tx.approval.findMany({ where: { itemId: { in: childIds } } });
      if (childApprovals.length > 0) {
        await tx.approvalEvent.deleteMany({ where: { approvalId: { in: childApprovals.map(a => a.id) } } });
        await tx.approval.deleteMany({ where: { itemId: { in: childIds } } });
      }
      await tx.item.deleteMany({ where: { parentId: id } });

      // Parent's related data
      const parentApprovals = await tx.approval.findMany({ where: { itemId: id } });
      if (parentApprovals.length > 0) {
        await tx.approvalEvent.deleteMany({ where: { approvalId: { in: parentApprovals.map(a => a.id) } } });
        await tx.approval.deleteMany({ where: { itemId: id } });
      }
      await tx.dailyLog.deleteMany({ where: { itemId: id } });
      await tx.rejection.deleteMany({ where: { itemId: id } });
      await tx.alert.deleteMany({ where: { itemId: id } });
      await tx.itemModule.deleteMany({ where: { itemId: id } });
      await tx.item.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
