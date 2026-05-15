import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [users, modules, natures, statuses, stageGroups, stageTemplates, priorities] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.module.findMany({ orderBy: { order: 'asc' } }),
    prisma.nature.findMany({ orderBy: { order: 'asc' } }),
    prisma.statusDef.findMany({ orderBy: { order: 'asc' } }),
    prisma.stageGroup.findMany({ orderBy: { order: 'asc' } }),
    prisma.stageTemplate.findMany({ include: { stageGroup: true }, orderBy: [{ stageGroup: { order: 'asc' } }, { order: 'asc' }] }),
    prisma.priorityDef.findMany({ orderBy: { order: 'asc' } }),
  ]);

  return NextResponse.json({ users, modules, natures, statuses, stageGroups, stageTemplates, priorities });
}
