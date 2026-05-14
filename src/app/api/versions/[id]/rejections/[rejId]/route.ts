import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rejId: string }> }
) {
  const { rejId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if ('reason' in body) data.reason = body.reason?.trim() || '';
  if ('docLink' in body) data.docLink = body.docLink?.trim() || '';

  const updated = await prisma.rejection.update({
    where: { id: rejId },
    data,
    include: { rejectedBy: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rejId: string }> }
) {
  const { rejId } = await params;
  await prisma.rejection.delete({ where: { id: rejId } });
  return NextResponse.json({ ok: true });
}
