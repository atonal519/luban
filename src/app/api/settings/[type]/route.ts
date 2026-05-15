import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MODELS: Record<string, any> = {
  modules: prisma.module,
  natures: prisma.nature,
  statuses: prisma.statusDef,
  stageGroups: prisma.stageGroup,
  stageTemplates: prisma.stageTemplate,
  users: prisma.user,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const items = await model.findMany({
    orderBy: 'order' in (model.fields || {}) ? { order: 'asc' } : { createdAt: 'desc' },
    ...(type === 'stageTemplates' ? { include: { stageGroup: true } } : {}),
  });

  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const body = await req.json();
  const item = await model.create({ data: body });
  return NextResponse.json(item, { status: 201 });
}
