import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json();

    if (!name || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { name } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 401 });
    }

    // bcrypt only
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    const session = await signToken(user.id);
    const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
    res.cookies.set('session', session, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    return res;
  } catch {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
