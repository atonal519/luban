import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { reason, docLink, rejectedById } = body;

  if (!reason?.trim()) {
    return NextResponse.json({ error: '打回理由不能为空' }, { status: 400 });
  }
  if (!rejectedById) {
    return NextResponse.json({ error: '请选择打回人' }, { status: 400 });
  }

  const rejection = await prisma.rejection.create({
    data: {
      itemId: id,
      reason: reason.trim(),
      docLink: docLink?.trim() || '',
      rejectedById,
    },
    include: { rejectedBy: true },
  });

  return NextResponse.json(rejection, { status: 201 });
}
