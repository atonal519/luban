import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const { logId } = await params;
  const body = await req.json();

  const updated = await prisma.dailyLog.update({
    where: { id: logId },
    data: { content: body.content?.trim() || '' },
    include: { author: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; logId: string }> }
) {
  const { logId } = await params;
  await prisma.dailyLog.delete({ where: { id: logId } });
  return NextResponse.json({ ok: true });
}
