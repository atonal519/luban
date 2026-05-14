"use client";

import { useState } from "react";

type Item = any;

const STAGE_GROUPS = [
  { code: "REQUIREMENT", label: "需求入口" },
  { code: "GENERATION", label: "版本生成" },
  { code: "DEVELOPMENT", label: "版本开发" },
  { code: "TEST", label: "版本测试" },
  { code: "DELIVERY", label: "版本交付" },
];

const STAGE_GROUP_MAP: Record<string, string> = {
  PENDING_SCHEDULE: "REQUIREMENT", SPEC: "REQUIREMENT", DESIGN: "REQUIREMENT",
  TMG: "GENERATION",
  DEVELOPING: "DEVELOPMENT", SELF_TEST: "DEVELOPMENT", REJECTED: "DEVELOPMENT",
  SUBMIT_TEST: "TEST", HIL: "TEST", SIL: "TEST", INTEGRATION: "TEST",
  REAL_CAR: "TEST", PRE_TEST: "TEST", PRE_PRODUCTION: "TEST",
  PENDING_RELEASE: "DELIVERY", DELIVERED: "DELIVERY", ABORTED: "DELIVERY",
};

function ApprovalChain({ approval }: { approval: any }) {
  if (!approval) return null;
  const events = approval.events || [];
  return (
    <div className="ml-6 mt-2 p-3 bg-[var(--bg-2)] rounded-lg border border-[var(--line-2)]">
      <div className="flex flex-col gap-2.5">
        {events.map((ev: any, idx: number) => {
          const isLast = idx === events.length - 1;
          const dotCls = ev.type === "APPROVE" ? "bg-emerald-500 border-emerald-500"
            : ev.type === "REJECT" ? "bg-red-500 border-red-500"
            : isLast ? "bg-blue-500 border-blue-500 shadow-[0_0_0_3px_rgba(59,111,240,0.15)]"
            : "bg-emerald-500 border-emerald-500";
          const label = ev.type === "REQUEST" ? "PM发起请求" : ev.type === "SUBMIT" ? "研发提交凭证"
            : ev.type === "APPROVE" ? "PM审核通过" : ev.type === "REJECT" ? "PM驳回" : "重新提交";
          return (
            <div key={ev.id} className="flex gap-2.5 items-start">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full border-2 ${dotCls} mt-1`} />
                {!isLast && <div className="w-px flex-1 min-h-[16px] bg-[var(--line-2)] mt-0.5" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium text-[var(--txt-0)]">{label}</span>
                  <span className="text-[10px] text-[var(--txt-2)] font-mono">{ev.createdAt?.slice(0, 10)}</span>
                  {ev.actor && <span className="text-[10px] text-blue-500">{ev.actor.name}</span>}
                </div>
                {ev.note && (
                  <div className={`mt-1 text-[11px] p-2 rounded ${ev.type === "REJECT" ? "bg-red-500/8 text-red-600 border border-red-500/15" : ev.type === "REQUEST" && isLast ? "bg-blue-500/8 text-blue-600 border border-blue-500/15" : "bg-[var(--bg-3)] text-[var(--txt-1)]"}`}>
                    {ev.note}
                  </div>
                )}
                {ev.evidenceUrl && (
                  <div className="mt-1 text-[11px] text-[var(--txt-2)]">📎 {ev.evidenceUrl}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {approval.state === "WAITING_SUBMIT" && (
        <div className="flex gap-1.5 mt-3">
          <button className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-blue-500/8 text-blue-600 border border-blue-500/15">📎 上传凭证</button>
        </div>
      )}
      {approval.state === "SUBMITTED" && (
        <div className="flex gap-1.5 mt-3">
          <button className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/8 text-emerald-600 border border-emerald-500/15">✓ 审核通过</button>
          <button className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-red-500/8 text-red-600 border border-red-500/15">✗ 驳回</button>
        </div>
      )}
      {approval.state === "REJECTED" && (
        <div className="flex gap-1.5 mt-3">
          <button className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-amber-500/8 text-amber-600 border border-amber-500/15">↻ 重新提交</button>
        </div>
      )}
    </div>
  );
}

function SubNodeList({ children, stageCode }: { children: Item[]; stageCode: string }) {
  const stageChildren = children.filter((c: Item) => {
    if (c.stageType === stageCode) return true;
    if (c.status?.code && STAGE_GROUP_MAP[c.status.code] === stageCode) return true;
    return false;
  });

  if (stageChildren.length === 0) {
    return <div className="text-[12px] text-[var(--txt-3)] py-4 text-center">暂无子节点</div>;
  }

  // Group parallel items
  const rendered: any[] = [];
  let i = 0;
  while (i < stageChildren.length) {
    const node = stageChildren[i];
    if (node.isParallel && node.parallelGroup) {
      const group = [node];
      while (i + 1 < stageChildren.length && stageChildren[i + 1].isParallel && stageChildren[i + 1].parallelGroup === node.parallelGroup) {
        i++;
        group.push(stageChildren[i]);
      }
      rendered.push({ type: "parallel", nodes: group });
    } else {
      rendered.push({ type: "linear", node });
    }
    i++;
  }

  function NodeRow({ node }: { node: Item }) {
    const statusIcon = node.progress >= 100 ? "✓" : node.progress > 0 ? "●" : "○";
    const statusColor = node.progress >= 100 ? "text-emerald-500" : node.progress > 0 ? "text-blue-500" : "text-[var(--txt-3)]";
    const apBadge = node.approval?.state === "WAITING_SUBMIT" ? { label: "待提交凭证", cls: "bg-amber-500/8 text-amber-600" }
      : node.approval?.state === "SUBMITTED" ? { label: "待PM审核", cls: "bg-blue-500/8 text-blue-600" }
      : node.approval?.state === "REJECTED" ? { label: "已驳回", cls: "bg-red-500/8 text-red-600" }
      : node.approval?.state === "APPROVED" ? { label: "已通过", cls: "bg-emerald-500/8 text-emerald-600" }
      : null;

    return (
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-2)] transition-colors">
          <span className={`w-4 text-center text-[12px] ${statusColor}`}>{statusIcon}</span>
          <span className="text-[13px] text-[var(--txt-0)] flex-1">{node.title}</span>
          <span className="text-[11px] text-[var(--txt-2)]">
            {node.progress >= 100 ? "完成" : node.progress > 0 ? `${node.progress}%` : "未开始"}
          </span>
          {apBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${apBadge.cls}`}>{apBadge.label}</span>
          )}
        </div>
        <ApprovalChain approval={node.approval} />
        {/* Sub-sub items */}
        {node.children?.length > 0 && (
          <div className="ml-6 border-l border-[var(--line)] pl-3">
            {node.children.map((sub: Item) => (
              <div key={sub.id} className="flex items-center gap-2 px-2 py-1 text-[12px]">
                <span className={`w-3 text-center ${sub.progress >= 100 ? "text-emerald-500" : sub.progress > 0 ? "text-blue-500" : "text-[var(--txt-3)]"}`}>
                  {sub.progress >= 100 ? "✓" : sub.progress > 0 ? "●" : "○"}
                </span>
                <span className="text-[var(--txt-0)] flex-1">{sub.title}</span>
                <span className="text-[var(--txt-2)]">{sub.progress}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {rendered.map((r, idx) => {
        if (r.type === "parallel") {
          return (
            <div key={idx} className="border-l-2 border-blue-400/35 ml-2 pl-3 my-1 py-1">
              <div className="text-[10px] text-blue-500 font-mono bg-blue-500/8 px-2 py-0.5 rounded inline-flex items-center gap-1 mb-1.5">⇉ 并行执行</div>
              {r.nodes.map((n: Item) => <NodeRow key={n.id} node={n} />)}
            </div>
          );
        }
        return <NodeRow key={r.node.id} node={r.node} />;
      })}
    </div>
  );
}

export function Drawer({ item, initialStage, onClose }: { item: Item; initialStage: number; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(initialStage);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[500px] bg-[var(--bg-1)] border-l border-[var(--line-2)] z-50 flex flex-col shadow-[-12px_0_40px_rgba(0,0,0,0.08)] animate-slide-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-start gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[18px] font-semibold">{item.versionNo}</div>
            <div className="text-[13px] text-[var(--txt-1)] mt-0.5 break-words">{item.title}</div>
          </div>
          {item.status && (
            <span className="px-2 py-1 rounded text-[11px] font-medium" style={{ background: item.status.color + "18", color: item.status.color }}>
              {item.status.label}
            </span>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-md border border-[var(--line-2)] flex items-center justify-center text-[var(--txt-1)] hover:bg-[var(--bg-3)] transition-colors text-[14px]">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Info Grid — 3 cols × 2 rows */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">基本信息</div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
              <div><div className="text-[11px] text-[var(--txt-2)]">创建日期</div><div className="text-[12px] font-mono mt-0.5">{item.createdAt?.slice(0, 10) || "—"}</div></div>
              <div><div className="text-[11px] text-[var(--txt-2)]">预计交付</div><div className="text-[12px] font-mono mt-0.5">{item.plannedEnd?.slice(0, 10) || "—"}</div></div>
              <div><div className="text-[11px] text-[var(--txt-2)]">计划起止</div><div className="text-[12px] font-mono mt-0.5 text-[var(--txt-3)]">待填写</div></div>
              <div><div className="text-[11px] text-[var(--txt-2)]">责任人</div><div className="text-[13px] font-medium mt-0.5">{item.owner?.name || "—"}</div></div>
              <div><div className="text-[11px] text-[var(--txt-2)]">研发模块</div><div className="text-[13px] font-medium mt-0.5 flex gap-1 flex-wrap">{item.modules?.map((im: any) => (
                <span key={im.id} className="px-2 py-0.5 rounded text-[11px]" style={{ background: im.module.color + "18", color: im.module.color }}>{im.module.name}</span>
              )) || "—"}</div></div>
              <div />
            </div>
          </div>

          {/* 规格 */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">规格</div>
            <div className="text-[12px] text-[var(--txt-1)] leading-relaxed whitespace-pre-wrap">
              {item.description || <span className="text-[var(--txt-3)]">暂无规格描述</span>}
            </div>
          </div>

          {/* MOKRA */}
          {(item.mokraMotivation || item.mokraObjects || item.mokraKeyResults || item.mokraActions) && (
            <div className="px-5 py-4 border-b border-[var(--line)]">
              <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">MOKRA</div>
              <div className="flex flex-col gap-2">
                {item.mokraMotivation && <div><span className="text-[10px] font-mono text-blue-500 bg-blue-500/8 px-1.5 py-0.5 rounded mr-2">M</span><span className="text-[12px] text-[var(--txt-1)]">{item.mokraMotivation}</span></div>}
                {item.mokraObjects && <div><span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/8 px-1.5 py-0.5 rounded mr-2">O</span><span className="text-[12px] text-[var(--txt-1)]">{item.mokraObjects}</span></div>}
                {item.mokraKeyResults && <div><span className="text-[10px] font-mono text-amber-500 bg-amber-500/8 px-1.5 py-0.5 rounded mr-2">KR</span><span className="text-[12px] text-[var(--txt-1)]">{item.mokraKeyResults}</span></div>}
                {item.mokraActions && <div><span className="text-[10px] font-mono text-purple-500 bg-purple-500/8 px-1.5 py-0.5 rounded mr-2">A</span><span className="text-[12px] text-[var(--txt-1)]">{item.mokraActions}</span></div>}
              </div>
            </div>
          )}

          {/* Stage tabs */}
          <div className="border-b border-[var(--line)]">
            <div className="px-5 pt-4">
              <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-2.5">阶段子节点</div>
            </div>
            <div className="flex overflow-x-auto">
              {STAGE_GROUPS.map((g, idx) => (
                <button
                  key={g.code}
                  onClick={() => setActiveTab(idx)}
                  className={`px-3.5 py-2.5 text-[11px] whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === idx
                      ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-dim)]"
                      : "text-[var(--txt-2)] border-transparent hover:text-[var(--txt-0)] hover:bg-[var(--bg-2)]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub nodes */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <SubNodeList children={item.children || []} stageCode={STAGE_GROUPS[activeTab].code} />
          </div>

          {/* Logs */}
          <div className="px-5 py-4">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">跟进日志</div>
            <div className="flex flex-col gap-3">
              {(item.dailyLogs || []).map((log: any) => (
                <div key={log.id} className="flex gap-2.5">
                  <div className="font-mono text-[11px] text-[var(--txt-2)] min-w-[60px] pt-0.5 flex-shrink-0">{log.logDate}</div>
                  <div>
                    <div className="text-[11px] text-blue-500 font-medium mb-0.5">{log.author?.name}</div>
                    <div className="text-[12px] text-[var(--txt-1)] leading-relaxed">{log.content}</div>
                  </div>
                </div>
              ))}
              {(!item.dailyLogs || item.dailyLogs.length === 0) && (
                <div className="text-[12px] text-[var(--txt-3)] text-center py-3">暂无日志</div>
              )}
            </div>
          </div>
        </div>

        {/* Log input */}
        <div className="px-5 py-3 border-t border-[var(--line)] flex gap-2 items-end flex-shrink-0">
          <textarea className="flex-1 bg-[var(--bg-2)] border border-[var(--line-2)] rounded-lg px-3 py-2 text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[58px] focus:border-[var(--accent)] transition-colors placeholder:text-[var(--txt-3)]" placeholder="记录今日进展…" />
          <button className="px-3.5 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium h-[58px] hover:opacity-85 transition-opacity">提交日志</button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
}
