import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('userId')?.value;
  if (!userId) return NextResponse.json({});

  const prefs = await prisma.userFilterPref.findMany({ where: { userId } });
  const result: Record<string, string[]> = {};
  for (const p of prefs) {
    try { result[p.filterKey] = JSON.parse(p.values); } catch { result[p.filterKey] = []; }
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('userId')?.value;
  if (!userId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { filterKey, values } = await req.json();
  await prisma.userFilterPref.upsert({
    where: { userId_filterKey: { userId, filterKey } },
    update: { values: JSON.stringify(values) },
    create: { userId, filterKey, values: JSON.stringify(values) },
  });
  return NextResponse.json({ ok: true });
}
