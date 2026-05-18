import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const MODELS: Record<string, any> = {
  modules: prisma.module,
  natures: prisma.nature,
  statuses: prisma.statusDef,
  priorities: prisma.priorityDef,
  stageGroups: prisma.stageGroup,
  stageTemplates: prisma.stageTemplate,
  users: prisma.user,
  tags: prisma.tag,
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const body = await req.json();
  const item = await model.update({ where: { id }, data: body });
  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  await model.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
