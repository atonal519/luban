import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/versions/[id]/approval — 对 item 的审核操作
// body: { action, actorId, note?, evidenceUrl? }
// action: "initiate" | "submit" | "approve" | "reject" | "resubmit"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { action, actorId, note, evidenceUrl } = body;

  if (!actorId) {
    return NextResponse.json({ error: '请选择操作人' }, { status: 400 });
  }

  // Get or create approval for this item
  let approval = await prisma.approval.findUnique({ where: { itemId: id } });

  if (action === 'initiate') {
    if (approval) {
      return NextResponse.json({ error: '该节点已有审核流程' }, { status: 400 });
    }
    approval = await prisma.approval.create({
      data: { itemId: id, state: 'WAITING_SUBMIT' },
    });
    await prisma.approvalEvent.create({
      data: {
        approvalId: approval.id,
        type: 'REQUEST',
        actorId,
        note: note || '',
      },
    });
    // Mark item as requires approval
    await prisma.item.update({ where: { id }, data: { requiresApproval: true } });
    return NextResponse.json({ ok: true, state: 'WAITING_SUBMIT' });
  }

  if (!approval) {
    return NextResponse.json({ error: '该节点没有审核流程' }, { status: 400 });
  }

  if (action === 'submit') {
    if (approval.state !== 'WAITING_SUBMIT' && approval.state !== 'REJECTED') {
      return NextResponse.json({ error: '当前状态不允许提交' }, { status: 400 });
    }
    await prisma.approvalEvent.create({
      data: {
        approvalId: approval.id,
        type: approval.state === 'REJECTED' ? 'RESUBMIT' : 'SUBMIT',
        actorId,
        note: note || '',
        evidenceUrl: evidenceUrl || '',
      },
    });
    await prisma.approval.update({ where: { id: approval.id }, data: { state: 'SUBMITTED' } });
    return NextResponse.json({ ok: true, state: 'SUBMITTED' });
  }

  if (action === 'approve') {
    if (approval.state !== 'SUBMITTED') {
      return NextResponse.json({ error: '当前状态不允许审批' }, { status: 400 });
    }
    await prisma.approvalEvent.create({
      data: {
        approvalId: approval.id,
        type: 'APPROVE',
        actorId,
        note: note || '',
      },
    });
    await prisma.approval.update({ where: { id: approval.id }, data: { state: 'APPROVED' } });
    return NextResponse.json({ ok: true, state: 'APPROVED' });
  }

  if (action === 'reject') {
    if (approval.state !== 'SUBMITTED') {
      return NextResponse.json({ error: '当前状态不允许驳回' }, { status: 400 });
    }
    await prisma.approvalEvent.create({
      data: {
        approvalId: approval.id,
        type: 'REJECT',
        actorId,
        note: note || '',
      },
    });
    await prisma.approval.update({ where: { id: approval.id }, data: { state: 'REJECTED' } });
    return NextResponse.json({ ok: true, state: 'REJECTED' });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
