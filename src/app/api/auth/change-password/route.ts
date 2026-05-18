import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('userId')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { oldPassword, newPassword } = await req.json();
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: '新密码至少4位' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  // Verify old password
  let valid = false;
  if (user.password === 'hashed_demo') valid = oldPassword === 'demo123';
  else if (user.password === oldPassword) valid = true;
  else valid = await bcrypt.compare(oldPassword, user.password);

  if (!valid) return NextResponse.json({ error: '原密码错误' }, { status: 401 });

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true });
}
