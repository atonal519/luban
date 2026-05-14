"use client";

import { useState, useEffect, useRef } from "react";

type ChildNode = {
  id: string;
  title: string;
  progress: number;
  stageType: string;
  isParallel: boolean;
  parallelGroup: string;
  status?: { code: string } | null;
};

const STAGE_GROUP_MAP: Record<string, string> = {
  PENDING_SCHEDULE: "REQUIREMENT", SPEC: "REQUIREMENT", DESIGN: "REQUIREMENT",
  TMG: "DEVELOPMENT",
  DEVELOPING: "DEVELOPMENT", SELF_TEST: "DEVELOPMENT", REJECTED: "DEVELOPMENT",
  SUBMIT_TEST: "TEST", HIL: "TEST", SIL: "TEST", INTEGRATION: "TEST",
  REAL_CAR: "TEST", PRE_TEST: "TEST", PRE_PRODUCTION: "TEST",
  PENDING_RELEASE: "DELIVERY", DELIVERED: "DELIVERY", ABORTED: "DELIVERY",
};

function flowStatusOf(node: ChildNode) {
  return node.progress === 100 ? "passed" : node.progress < 0 ? "rejected" : node.progress > 0 ? "active" : "idle";
}

export function StagePopover({
  itemId,
  stageCode,
  children: allChildren,
  onChanged,
  triggerNode,
}: {
  itemId: string;
  stageCode: string;
  children: ChildNode[];
  onChanged: () => void;
  triggerNode: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const stageChildren = allChildren.filter((c) => {
    if (c.stageType === stageCode) return true;
    if (c.status?.code && STAGE_GROUP_MAP[c.status.code] === stageCode) return true;
    return false;
  });

  async function changeStatus(childId: string, val: string) {
    const progress = val === "passed" ? 100 : val === "rejected" ? -1 : val === "active" ? 50 : 0;
    await fetch(`/api/versions/${itemId}/children/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    });
    onChanged();
  }

  return (
    <div ref={ref} className="relative">
      <div onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="cursor-pointer">
        {triggerNode}
      </div>
      {open && stageChildren.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-lg shadow-xl p-2 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
          <div className="text-[10px] text-[var(--txt-3)] font-mono uppercase tracking-wider px-1 mb-1.5">节点状态</div>
          <div className="flex flex-col gap-1">
            {stageChildren.map((node) => {
              const fs = flowStatusOf(node);
              return (
                <div key={node.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[var(--bg-2)]">
                  <span className={`w-3 text-center text-[11px] ${
                    fs === "passed" ? "text-emerald-500" : fs === "rejected" ? "text-red-500" : fs === "active" ? "text-blue-500" : "text-[var(--txt-3)]"
                  }`}>
                    {fs === "passed" ? "✓" : fs === "rejected" ? "!" : fs === "active" ? "●" : "○"}
                  </span>
                  <span className="text-[12px] text-[var(--txt-0)] flex-1 truncate">{node.title}</span>
                  <select
                    value={fs}
                    onChange={(e) => changeStatus(node.id, e.target.value)}
                    className={`text-[10px] font-medium pl-1.5 pr-4 py-0.5 rounded-md border outline-none cursor-pointer ${
                      fs === "passed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : fs === "rejected" ? "bg-red-500/10 text-red-600 border-red-500/20"
                      : fs === "active" ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      : "bg-[var(--bg-3)] text-[var(--txt-2)] border-[var(--line-2)]"
                    }`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M1.5 3L4 5.5 6.5 3' stroke='%237e8da8' stroke-width='1.2' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
                  >
                    <option value="idle">未开始</option>
                    <option value="active">进行中</option>
                    <option value="passed">通过</option>
                    <option value="rejected">打回</option>
                  </select>
                </div>
              );
            })}
          </div>
          {stageChildren.length === 0 && (
            <div className="text-[11px] text-[var(--txt-3)] text-center py-2">暂无节点</div>
          )}
        </div>
      )}
    </div>
  );
}
