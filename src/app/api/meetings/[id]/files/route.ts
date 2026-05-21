import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { title, url, fileType } = await req.json();
    if (!title || !url) return NextResponse.json({ error: '标题和链接必填' }, { status: 400 });
    const file = await prisma.meetingFile.create({
      data: { meetingId: id, title, url, fileType: fileType || 'OTHER' },
    });
    return NextResponse.json(file, { status: 201 });
  } catch {
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
