import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { stageFrom, stageTo, actorId, reason, meetingType } = await req.json();
    if (!actorId || !reason?.trim()) {
      return NextResponse.json({ error: '操作人和原因必填' }, { status: 400 });
    }
    const skip = await prisma.gateSkip.create({
      data: { itemId: id, stageFrom, stageTo, meetingType: meetingType || '', reason: reason.trim(), actorId },
    });
    return NextResponse.json(skip, { status: 201 });
  } catch {
    return NextResponse.json({ error: '记录失败' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const skips = await prisma.gateSkip.findMany({
      where: { itemId: id },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(skips);
  } catch {
    return NextResponse.json([]);
  }
}
