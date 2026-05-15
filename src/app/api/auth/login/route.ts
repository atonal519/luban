import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  if (!name || !password) {
    return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { name } });
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  }

  // Support hashed_demo legacy, plain text dev passwords, and bcrypt
  let valid = false;
  if (user.password === 'hashed_demo') {
    valid = password === 'demo123';
  } else if (user.password === password) {
    valid = true;
  } else {
    valid = await bcrypt.compare(password, user.password);
  }

  if (!valid) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
  res.cookies.set('userId', user.id, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 });
  return res;
}
