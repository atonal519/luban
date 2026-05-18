import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.cookies.get('userId')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: '日志内容不能为空' }, { status: 400 });
  }

  const now = new Date();
  const logDate = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + ' '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0');

  const log = await prisma.dailyLog.create({
    data: {
      itemId: id,
      authorId: userId,
      logDate,
      content: content.trim(),
    },
    include: { author: true },
  });

  return NextResponse.json(log, { status: 201 });
}
