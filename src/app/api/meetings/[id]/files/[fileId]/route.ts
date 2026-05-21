import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { fileId } = await params;
  try {
    await prisma.meetingFile.delete({ where: { id: fileId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
