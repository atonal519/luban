import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const items = await prisma.item.findMany({
    where: { parentId: null },
    include: {
      nature: true,
      status: true,
      owner: true,
      modules: { include: { module: true } },
      children: {
        include: {
          nature: true,
          status: true,
          owner: true,
          approval: { include: { events: { include: { actor: true }, orderBy: { createdAt: 'asc' } } } },
          children: {
            include: { status: true, owner: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
      dailyLogs: {
        include: { author: true },
        orderBy: { logDate: 'desc' },
        take: 5,
      },
      alerts: {
        where: { dismissedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(items);
}
