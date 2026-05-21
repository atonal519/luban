import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { content, sourceType, assigneeId, deadline } = await req.json();
    if (!content) return NextResponse.json({ error: '内容必填' }, { status: 400 });
    const item = await prisma.actionItem.create({
      data: {
        meetingId: id,
        content,
        sourceType: sourceType || 'TODO',
        assigneeId: assigneeId || null,
        deadline: deadline ? new Date(deadline) : null,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
