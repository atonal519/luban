import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { itemId } = await req.json();
    if (!itemId) return NextResponse.json({ error: 'itemId 必填' }, { status: 400 });
    const link = await prisma.meetingItem.create({
      data: { meetingId: id, itemId },
      include: { item: { select: { id: true, versionNo: true, title: true } } },
    });
    return NextResponse.json(link, { status: 201 });
  } catch {
    return NextResponse.json({ error: '关联失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  try {
    const { itemId } = await req.json();
    await prisma.meetingItem.deleteMany({ where: { meetingId, itemId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '取消关联失败' }, { status: 500 });
  }
}
