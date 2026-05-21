import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  if (q.length < 1) return NextResponse.json([]);

  try {
    const items = await prisma.item.findMany({
      where: {
        parentId: null,
        OR: [
          { versionNo: { contains: q } },
          { title: { contains: q } },
        ],
      },
      select: { id: true, versionNo: true, title: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
