import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/jwt';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session')?.value;
    if (!token) return NextResponse.json(null);

    const userId = await verifyToken(token);
    if (!userId) return NextResponse.json(null);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, email: true },
    });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json(null);
  }
}
