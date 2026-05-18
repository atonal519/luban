import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const { name, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: '帽子名称不能为空' }, { status: 400 });
  const tag = await prisma.tag.create({ data: { name: name.trim(), color: color || '#6366f1' } });
  return NextResponse.json(tag, { status: 201 });
}
