import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Stage gate transitions that require approval
const GATES: Record<string, { to: string; requiresApproval: boolean }> = {
  DEVELOPMENT: { to: 'TEST', requiresApproval: true },
  TEST: { to: 'DELIVERY', requiresApproval: true },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Return all stage gates for this version
  const gates = await prisma.approval.findMany({
    where: { itemId: id, scope: 'STAGE_GATE' },
    include: { events: { include: { actor: true }, orderBy: { createdAt: 'asc' } } },
  });
  return NextResponse.json(gates);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.cookies.get('userId')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json();
  const { action, stageFrom, stageTo, actorId, note, evidenceUrl } = body;

  if (!actorId) return NextResponse.json({ error: '请选择操作人' }, { status: 400 });

  let gate = await prisma.approval.findFirst({
    where: { itemId: id, scope: 'STAGE_GATE', stageFrom, stageTo },
  });

  if (action === 'initiate') {
    if (gate) return NextResponse.json({ error: '该阶段门禁已存在审核' }, { status: 400 });
    gate = await prisma.approval.create({
      data: { itemId: id, scope: 'STAGE_GATE', stageFrom, stageTo, state: 'WAITING_SUBMIT' },
    });
    await prisma.approvalEvent.create({
      data: { approvalId: gate.id, type: 'REQUEST', actorId, note: note || '' },
    });
    return NextResponse.json({ ok: true, state: 'WAITING_SUBMIT' });
  }

  if (!gate) return NextResponse.json({ error: '未找到审核' }, { status: 404 });

  if (action === 'submit') {
    await prisma.approvalEvent.create({
      data: {
        approvalId: gate.id,
        type: gate.state === 'REJECTED' ? 'RESUBMIT' : 'SUBMIT',
        actorId, note: note || '', evidenceUrl: evidenceUrl || '',
      },
    });
    await prisma.approval.update({ where: { id: gate.id }, data: { state: 'SUBMITTED' } });
    return NextResponse.json({ ok: true, state: 'SUBMITTED' });
  }

  if (action === 'approve') {
    await prisma.approvalEvent.create({
      data: { approvalId: gate.id, type: 'APPROVE', actorId, note: note || '' },
    });
    await prisma.approval.update({ where: { id: gate.id }, data: { state: 'APPROVED' } });
    return NextResponse.json({ ok: true, state: 'APPROVED' });
  }

  if (action === 'reject') {
    await prisma.approvalEvent.create({
      data: { approvalId: gate.id, type: 'REJECT', actorId, note: note || '' },
    });
    await prisma.approval.update({ where: { id: gate.id }, data: { state: 'REJECTED' } });
    return NextResponse.json({ ok: true, state: 'REJECTED' });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
