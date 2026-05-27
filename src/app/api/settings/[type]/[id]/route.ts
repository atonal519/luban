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
  customFields: prisma.customFieldDef,
};

const ALLOWED_FIELDS: Record<string, string[]> = {
  modules: ['name', 'color', 'order'],
  natures: ['code', 'label', 'color', 'order', 'minDays'],
  statuses: ['code', 'label', 'stageGroup', 'color', 'order'],
  priorities: ['code', 'label', 'color', 'order'],
  stageGroups: ['code', 'label', 'order'],
  stageTemplates: ['name', 'stageGroupId', 'isParallel', 'parallelGroup', 'order'],
  users: ['name', 'email', 'role'],
  tags: ['name', 'color', 'parentId'],
  milestones: ['name', 'archived'],
  customFields: ['name', 'type', 'options', 'order', 'showInBoard', 'showInDrawer'],
};

const INT_FIELDS = new Set(['order', 'minDays']);

function filterBody(type: string, body: Record<string, any>): Record<string, any> {
  const allowed = ALLOWED_FIELDS[type];
  if (!allowed) return body;
  const filtered: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) {
      filtered[key] = INT_FIELDS.has(key) ? Number(body[key]) : body[key];
    }
  }
  return filtered;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  try {
    const raw = await req.json();
    const data = filterBody(type, raw);
    // parentId 空 → 直接从data中删除（避免外键约束错误）
    if (data.parentId === '' || data.parentId === null || data.parentId === undefined) {
      delete data.parentId;
    }
    const item = await model.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (e: any) {
    return NextResponse.json({ error: '更新失败', detail: e?.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const model = MODELS[type];
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  try {
    await model.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '删除失败' }, { status: 400 });
  }
}
