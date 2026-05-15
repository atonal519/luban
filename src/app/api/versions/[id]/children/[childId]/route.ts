import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; childId: string }> }
) {
  const { childId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ('title' in body) data.title = body.title?.trim() || '';
  if ('stageType' in body) data.stageType = body.stageType || '';
  if ('statusId' in body) data.statusId = body.statusId || null;
  if ('isParallel' in body) data.isParallel = !!body.isParallel;
  if ('parallelGroup' in body) data.parallelGroup = body.parallelGroup || '';
  if ('progress' in body) data.progress = Number(body.progress) || 0;
  if ('plannedStart' in body) data.plannedStart = body.plannedStart ? new Date(body.plannedStart) : null;
  if ('plannedEnd' in body) data.plannedEnd = body.plannedEnd ? new Date(body.plannedEnd) : null;

  const updated = await prisma.item.update({
    where: { id: childId },
    data,
    include: { status: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; childId: string }> }
) {
  const { childId } = await params;

  // Delete approval and events if exists
  const approval = await prisma.approval.findUnique({ where: { itemId: childId } });
  if (approval) {
    await prisma.approvalEvent.deleteMany({ where: { approvalId: approval.id } });
    await prisma.approval.delete({ where: { id: approval.id } });
  }

  await prisma.item.delete({ where: { id: childId } });
  return NextResponse.json({ ok: true });
}
