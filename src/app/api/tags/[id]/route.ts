import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if ('name' in body) data.name = body.name?.trim();
  if ('color' in body) data.color = body.color;
  const tag = await prisma.tag.update({ where: { id }, data });
  return NextResponse.json(tag);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.item.updateMany({ where: { tagId: id }, data: { tagId: null } });
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
