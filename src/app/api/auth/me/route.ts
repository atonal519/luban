import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('userId')?.value;
  if (!userId) {
    return NextResponse.json(null);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, email: true },
  });

  return NextResponse.json(user);
}
