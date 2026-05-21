import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true } },
        recorder: { select: { id: true, name: true } },
        items: { include: { item: { select: { id: true, versionNo: true, title: true, status: true } } } },
        actionItems: { include: { assignee: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        files: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!meeting) return NextResponse.json({ error: '会议不存在' }, { status: 404 });
    return NextResponse.json(meeting);
  } catch {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

const ALLOWED = ['title', 'type', 'status', 'scheduledAt', 'summary', 'hostId', 'recorderId'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (key in body) {
        data[key] = key === 'scheduledAt' && body[key] ? new Date(body[key]) : body[key];
      }
    }
    const meeting = await prisma.meeting.update({ where: { id }, data });
    return NextResponse.json(meeting);
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
    await prisma.$transaction(async (tx) => {
      await tx.actionItem.deleteMany({ where: { meetingId: id } });
      await tx.meetingFile.deleteMany({ where: { meetingId: id } });
      await tx.meetingItem.deleteMany({ where: { meetingId: id } });
      await tx.meeting.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
