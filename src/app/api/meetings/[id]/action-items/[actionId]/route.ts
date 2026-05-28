import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const { actionId } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ['content', 'status', 'assigneeId', 'deadline', 'sourceType']) {
      if (key in body) data[key] = key === 'deadline' && body[key] ? new Date(body[key]) : body[key];
    }
    const item = await prisma.actionItem.update({ where: { id: actionId }, data });
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const { actionId } = await params;
  try {
    await prisma.actionItem.delete({ where: { id: actionId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
