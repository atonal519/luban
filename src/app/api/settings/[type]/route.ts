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
  milestones: prisma.milestone,
};

const ALLOWED_FIELDS: Record<string, string[]> = {
  modules: ['name', 'color', 'order'],
  natures: ['code', 'label', 'color', 'order', 'minDays'],
  statuses: ['code', 'label', 'stageGroup', 'color', 'order'],
  priorities: ['code', 'label', 'color', 'order'],
  stageGroups: ['code', 'label', 'order'],
  stageTemplates: ['name', 'stageGroupId', 'isParallel', 'parallelGroup', 'order'],
  users: ['name', 'email', 'role'],
  tags: ['name', 'color'],
  milestones: ['name', 'archived'],
};

const HAS_ORDER = new Set(['modules', 'natures', 'statuses', 'priorities', 'stageGroups', 'stageTemplates']);

function filterBody(type: string, body: Record<string, any>): Record<string, any> {
  const allowed = ALLOWED_FIELDS[type];
  if (!allowed) return body;
  const filtered: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) filtered[key] = body[key];
  }
  return filtered;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  try {
    const items = await model.findMany({
      orderBy: HAS_ORDER.has(type) ? { order: 'asc' } : { createdAt: 'desc' },
      ...(type === 'stageTemplates' ? { include: { stageGroup: true } } : {}),
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  try {
    const raw = await req.json();
    const data = filterBody(type, raw);
    // 新建用户时补默认密码
    if (type === 'users') {
      const bcrypt = await import('bcryptjs');
      data.password = await bcrypt.hash('luban2026', 10);
    }
    const item = await model.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: '新增失败，请检查必填字段' }, { status: 400 });
  }
}
