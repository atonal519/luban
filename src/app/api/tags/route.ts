import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' }, include: { children: true } });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const { name, color, parentId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'RR名称不能为空' }, { status: 400 });
  const tag = await prisma.tag.create({ data: { name: name.trim(), color: color || '#6366f1', parentId: parentId || null } });
  return NextResponse.json(tag, { status: 201 });
}
