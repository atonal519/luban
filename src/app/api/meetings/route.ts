import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const meetings = await prisma.meeting.findMany({
      include: {
        host: { select: { id: true, name: true } },
        recorder: { select: { id: true, name: true } },
        items: { include: { item: { select: { id: true, versionNo: true, title: true } } } },
        actionItems: { include: { assignee: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        files: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
    return NextResponse.json(meetings);
  } catch {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, type, scheduledAt, hostId, recorderId } = body;
    if (!title || !scheduledAt) {
      return NextResponse.json({ error: '标题和时间必填' }, { status: 400 });
    }
    const meeting = await prisma.meeting.create({
      data: {
        title,
        type: type || 'WORKSHOP',
        scheduledAt: new Date(scheduledAt),
        hostId: hostId || null,
        recorderId: recorderId || null,
      },
    });
    return NextResponse.json(meeting, { status: 201 });
  } catch {
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
