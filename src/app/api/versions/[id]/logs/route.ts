import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { content, authorId } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: '日志内容不能为空' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const log = await prisma.dailyLog.create({
    data: {
      itemId: id,
      authorId: authorId || '',
      logDate: today,
      content: content.trim(),
    },
    include: { author: true },
  });

  return NextResponse.json(log, { status: 201 });
}
