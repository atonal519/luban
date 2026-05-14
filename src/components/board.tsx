"use client";

import { useState } from "react";
import { Drawer } from "./drawer";

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

function priorityTag(p: string) {
  const cls = p === "HIGH" ? "bg-red-500/8 text-red-600" : p === "MID" ? "bg-amber-500/8 text-amber-600" : "bg-slate-500/8 text-slate-500";
  const label = p === "HIGH" ? "高" : p === "MID" ? "中" : "低";
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${cls}`}>
    <span className="w-[5px] h-[5px] rounded-full bg-current" />{label}
  </span>;
}

function overallStatus(item: Item): { label: string; cls: string } {
  // 完成：进度100或状态为DELIVERED
  if (item.progress >= 100 || item.status?.code === "DELIVERED") {
    return { label: "完成", cls: "bg-blue-500/12 text-blue-600" };
  }
  // 延期：有子节点被驳回，或有告警为LATE
  const hasLate = (item.children || []).some((c: Item) => c.approval?.state === "REJECTED");
  const hasLateAlert = (item.alerts || []).some((a: any) => a.level === "LATE");
  if (hasLate || hasLateAlert) {
    return { label: "延期", cls: "bg-red-500/12 text-red-600" };
  }
  // 风险：有告警为RISK，或有子节点有审核卡着
  const hasRisk = (item.alerts || []).some((a: any) => a.level === "RISK");
  const hasWaiting = (item.children || []).some((c: Item) => c.approval?.state === "WAITING_SUBMIT");
  if (hasRisk || hasWaiting) {
    return { label: "风险", cls: "bg-amber-500/12 text-amber-600" };
  }
  // 正常
  return { label: "正常", cls: "bg-emerald-500/12 text-emerald-600" };
}

function stageStatus(item: Item, stageCode: string) {
  const children = (item.children || []) as Item[];
  const stageChildren = children.filter((c: Item) => {
    if (c.stageType === stageCode) return true;
    if (c.status?.code && STAGE_GROUP_MAP[c.status.code] === stageCode) return true;
    return false;
  });

  if (stageChildren.length === 0) {
    // Check if the item itself is at or past this stage
    const itemStageGroup = item.status?.code ? STAGE_GROUP_MAP[item.status.code] : item.stageType;
    const itemIdx = STAGE_GROUPS.findIndex(g => g.code === itemStageGroup);
    const stageIdx = STAGE_GROUPS.findIndex(g => g.code === stageCode);
    if (stageIdx < itemIdx) return { label: "完成", cls: "text-emerald-600 bg-emerald-500/8", progress: "—", sub: "" };
    if (stageIdx === itemIdx) return { label: item.status?.label || "进行中", cls: "text-blue-600 bg-blue-500/8", progress: "", sub: "" };
    return { label: "未开始", cls: "text-slate-400 bg-transparent", progress: "", sub: "" };
  }

  const done = stageChildren.filter((c: Item) => c.progress >= 100 || c.status?.code === "DELIVERED").length;
  const hasLate = stageChildren.some((c: Item) => c.approval?.state === "REJECTED");
  const hasActive = stageChildren.some((c: Item) => c.progress > 0 && c.progress < 100);
  const activeChild = stageChildren.find((c: Item) => c.progress > 0 && c.progress < 100);
  const hasParallel = stageChildren.some((c: Item) => c.isParallel);

  if (done === stageChildren.length) {
    return { label: "完成", cls: "text-emerald-600 bg-emerald-500/8", progress: `${done}/${stageChildren.length}`, sub: "" };
  }
  if (hasLate) {
    return { label: "驳回", cls: "text-red-600 bg-red-500/8", progress: `${done}/${stageChildren.length}`, sub: activeChild?.title || "", hasParallel };
  }
  if (hasActive) {
    return { label: "进行中", cls: "text-blue-600 bg-blue-500/8", progress: `${done}/${stageChildren.length}`, sub: activeChild?.title || "", hasParallel };
  }
  return { label: "未开始", cls: "text-slate-400 bg-transparent", progress: `${done}/${stageChildren.length}`, sub: "" };
}

function AlertBar({ items }: { items: Item[] }) {
  const alerts = items.flatMap((item: Item) =>
    (item.alerts || []).map((a: any) => ({ ...a, item }))
  );
  if (alerts.length === 0) return null;

  return (
    <div className="flex items-center gap-2.5 px-5 py-2 bg-red-500/7 border-b border-red-500/15 text-[12px] text-red-700">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
      <div className="flex gap-4 flex-wrap">
        {alerts.map((a: any) => (
          <div key={a.id} className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-red-500/15 text-red-600">
              {a.level === "LATE" ? "延期" : "风险"}
            </span>
            {a.item.versionNo} {a.item.title} · {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  REQUIREMENT: "需求看板",
  DEVELOPMENT: "开发看板",
  TEST: "测试看板",
  DELIVERY: "交付看板",
};

export function Board({ items, stageFilter = "" }: { items: Item[]; stageFilter?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerStage, setDrawerStage] = useState(0);
  const [quickInput, setQuickInput] = useState("");
  const selectedItem = items.find((i: Item) => i.id === selectedId);

  // Stage filter: only show versions that have children in the selected stage
  const filteredItems = stageFilter
    ? items.filter((item: Item) => {
        // Check if item itself belongs to this stage
        const itemStageGroup = item.status?.code ? STAGE_GROUP_MAP[item.status.code] : item.stageType;
        if (itemStageGroup === stageFilter) return true;
        // Check if any child belongs to this stage
        return (item.children || []).some((c: Item) => {
          if (c.stageType === stageFilter) return true;
          if (c.status?.code && STAGE_GROUP_MAP[c.status.code] === stageFilter) return true;
          return false;
        });
      })
    : items;

  const boardTitle = stageFilter ? (STAGE_LABELS[stageFilter] || "版本看板") : "全部版本";

  function openDrawer(item: Item, stageIdx?: number) {
    setSelectedId(item.id);
    setDrawerStage(stageIdx ?? 0);
  }

  function handleQuickCreate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && quickInput.trim()) {
      // TODO Phase 2: 弹出创建弹窗填写模块/责任人等
      alert(`[Phase 2] 将创建版本：${quickInput.trim()}\n后续会弹出弹窗填写详细信息`);
      setQuickInput("");
    }
  }

  return (
    <>
      {/* Topbar: 左=标题  中=快速新建  右=看板筛选+搜索 */}
      <div className="h-[52px] min-h-[52px] flex items-center px-5 border-b border-[var(--line)] bg-[var(--bg-1)] gap-3">
        {/* Left: title */}
        <span className="text-[15px] font-semibold flex-shrink-0">{boardTitle}</span>
        <span className="font-mono text-[11px] text-[var(--txt-2)] bg-[var(--bg-3)] px-2 py-0.5 rounded flex-shrink-0">
          {filteredItems.length} 个版本
        </span>

        {/* Center: quick create */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] w-[360px] focus-within:border-[var(--accent)] transition-colors">
            <span className="text-[var(--accent)] text-[14px] font-bold flex-shrink-0">+</span>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={handleQuickCreate}
              placeholder="输入项目名，回车快速新建版本…"
              className="bg-transparent outline-none text-[13px] text-[var(--txt-0)] w-full placeholder:text-[var(--txt-3)]"
            />
          </div>
        </div>

        {/* Right: stage filter tabs + search */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {[
            { code: "", label: "全部" },
            { code: "REQUIREMENT", label: "需求" },
            { code: "DEVELOPMENT", label: "开发" },
            { code: "TEST", label: "测试" },
            { code: "DELIVERY", label: "交付" },
          ].map(tab => (
            <a
              key={tab.code}
              href={tab.code ? `/?stage=${tab.code}` : "/"}
              className={`px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                stageFilter === tab.code
                  ? "bg-[var(--accent)] text-white font-medium"
                  : "border border-[var(--line-2)] bg-[var(--bg-1)] text-[var(--txt-1)] hover:border-[var(--accent)] hover:text-[var(--txt-0)]"
              }`}
            >
              {tab.label}
            </a>
          ))}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] w-[160px] ml-1">
            <span className="text-[var(--txt-3)]">🔍</span>
            <input type="text" placeholder="搜索版本 / 项目名" className="bg-transparent outline-none text-[12px] text-[var(--txt-0)] w-full placeholder:text-[var(--txt-3)]" />
          </div>
        </div>
      </div>

      <AlertBar items={filteredItems} />

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 py-4">
        <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr>
              {["版本号", "项目名称", "研发模块", "类型", "责任人", "优先级"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[11px] text-[var(--txt-2)] font-medium bg-[var(--bg-1)] border-b border-[var(--line-2)] sticky top-0 z-10 whitespace-nowrap">
                  {h}
                </th>
              ))}
              {STAGE_GROUPS.map(g => (
                <th key={g.code} className="px-3 py-2 text-left text-[10px] text-[var(--txt-2)] font-medium bg-[var(--bg-1)] border-b border-[var(--line-2)] sticky top-0 z-10 font-mono tracking-wider uppercase whitespace-nowrap">
                  {g.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-[11px] text-[var(--txt-2)] font-medium bg-[var(--bg-1)] border-b border-[var(--line-2)] sticky top-0 z-10 whitespace-nowrap">整体状态</th>
              <th className="px-3 py-2 text-left text-[11px] text-[var(--txt-2)] font-medium bg-[var(--bg-1)] border-b border-[var(--line-2)] sticky top-0 z-10">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item: Item) => (
              <tr
                key={item.id}
                onClick={() => openDrawer(item)}
                className={`cursor-pointer group ${selectedId === item.id ? "bg-blue-500/5" : ""}`}
              >
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors sticky left-0 z-[3]">
                  <span className="font-mono text-[12px] font-semibold">{item.versionNo}</span>
                </td>
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <span className="text-[13px] font-medium max-w-[160px] truncate block">{item.title}</span>
                </td>
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <div className="flex gap-1 flex-wrap">
                    {item.modules?.map((im: any) => (
                      <span key={im.id} className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: im.module.color + "18", color: im.module.color }}>
                        {im.module.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  {item.nature && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: item.nature.color + "18", color: item.nature.color }}>
                      {item.nature.label}
                    </span>
                  )}
                </td>
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <span className="text-[12px]">{item.owner?.name || "—"}</span>
                </td>
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  {priorityTag(item.priority)}
                </td>
                {STAGE_GROUPS.map((g, gi) => {
                  const st = stageStatus(item, g.code);
                  return (
                    <td
                      key={g.code}
                      className="px-2 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors min-w-[130px]"
                      onClick={(e) => { e.stopPropagation(); openDrawer(item, gi); }}
                    >
                      <div className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md ${st.cls}`}>
                        <div className="flex items-center gap-1">
                          <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" />
                          <span className="text-[11px] font-medium">{st.label}</span>
                          {st.progress && <span className="font-mono text-[9px] text-[var(--txt-2)] bg-[var(--bg-3)] px-1 rounded ml-auto">{st.progress}</span>}
                        </div>
                        {st.sub && <span className="text-[10px] font-mono text-[var(--txt-2)] truncate">{st.sub}</span>}
                        {st.hasParallel && <span className="text-[10px] text-blue-500">⇉ 并行</span>}
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  {(() => {
                    const os = overallStatus(item);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${os.cls}`}>
                        <span className="w-[6px] h-[6px] rounded-full bg-current" />
                        {os.label}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <button
                    onClick={(e) => { e.stopPropagation(); openDrawer(item); }}
                    className="px-2.5 py-1 rounded-md border border-[var(--line-2)] text-[var(--txt-2)] text-[12px] hover:bg-[var(--bg-3)] hover:text-[var(--txt-0)] transition-colors"
                  >
                    ···
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selectedItem && (
        <Drawer
          item={selectedItem}
          initialStage={drawerStage}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
