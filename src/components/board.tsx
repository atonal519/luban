"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "./drawer";
import { CreateModal } from "./create-modal";
import { EditableCell } from "./editable-cell";
import { ModuleCell } from "./module-cell";
import { StagePopover } from "./stage-popover";

type Item = any;

// Fallback defaults (overridden by props from DB)
const DEFAULT_STAGE_GROUPS = [
  { code: "REQUIREMENT", label: "需求入口" },
  { code: "DEVELOPMENT", label: "版本开发" },
  { code: "TEST", label: "版本测试" },
  { code: "DELIVERY", label: "版本交付" },
];

const DEFAULT_STAGE_GROUP_MAP: Record<string, string> = {
  PENDING_SCHEDULE: "REQUIREMENT", SPEC: "REQUIREMENT", DESIGN: "REQUIREMENT",
  TMG: "DEVELOPMENT",
  DEVELOPING: "DEVELOPMENT", SELF_TEST: "DEVELOPMENT", REJECTED: "DEVELOPMENT",
  SUBMIT_TEST: "TEST", HIL: "TEST", SIL: "TEST", INTEGRATION: "TEST",
  REAL_CAR: "TEST", PRE_TEST: "TEST", PRE_PRODUCTION: "TEST",
  PENDING_RELEASE: "DELIVERY", DELIVERED: "DELIVERY", ABORTED: "DELIVERY",
};

function priorityTag(p: string) {
  const cls = p === "FATAL" ? "bg-red-700/10 text-red-700" : p === "T0" ? "bg-red-500/8 text-red-600" : p === "T1" ? "bg-amber-500/8 text-amber-600" : "bg-slate-500/8 text-slate-500";
  const label = p === "FATAL" ? "致命" : p === "T0" ? "T0" : p === "T1" ? "T1" : "T2";
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

function stageStatus(item: Item, stageCode: string, STAGE_GROUPS: {code:string;label:string}[], STAGE_GROUP_MAP: Record<string,string>) {
  const children = (item.children || []) as Item[];
  const stageChildren = children.filter((c: Item) => {
    if (c.stageType === stageCode) return true;
    if (c.status?.code && STAGE_GROUP_MAP[c.status.code] === stageCode) return true;
    return false;
  });

  // Calculate date range from children's plannedStart/plannedEnd
  function dateRange(nodes: Item[]) {
    const starts = nodes.map(n => n.plannedStart).filter(Boolean).sort();
    const ends = nodes.map(n => n.plannedEnd).filter(Boolean).sort();
    const s = starts[0]?.slice(5, 10)?.replace("-", "/");
    const e = ends[ends.length - 1]?.slice(5, 10)?.replace("-", "/");
    if (s && e) return `${s}-${e}`;
    if (s) return `${s}-`;
    return "";
  }

  if (stageChildren.length === 0) {
    const itemStageGroup = item.status?.code ? STAGE_GROUP_MAP[item.status.code] : item.stageType;
    const itemIdx = STAGE_GROUPS.findIndex(g => g.code === itemStageGroup);
    const stageIdx = STAGE_GROUPS.findIndex(g => g.code === stageCode);
    if (stageIdx < itemIdx) return { label: "完成", cls: "text-emerald-600 bg-emerald-500/8", progress: "—", sub: "", dates: "" };
    if (stageIdx === itemIdx) return { label: item.status?.label || "进行中", cls: "text-blue-600 bg-blue-500/8", progress: "", sub: "", dates: "" };
    return { label: "未开始", cls: "text-slate-400 bg-transparent", progress: "", sub: "", dates: "" };
  }

  const done = stageChildren.filter((c: Item) => c.progress >= 100 || c.status?.code === "DELIVERED").length;
  const hasLate = stageChildren.some((c: Item) => c.approval?.state === "REJECTED" || c.progress < 0);
  const activeNodes = stageChildren.filter((c: Item) => c.progress > 0 && c.progress < 100);
  const hasActive = activeNodes.length > 0;
  const dates = dateRange(stageChildren);

  // Build sub label: show active node names, joined with /
  const parallelActive = activeNodes.filter((c: Item) => c.isParallel);
  const isParallelRunning = parallelActive.length > 1;
  const subLabel = activeNodes.length > 0
    ? activeNodes.map((c: Item) => c.title).join("/")
    : "";

  if (done === stageChildren.length) {
    return { label: "完成", cls: "text-emerald-600 bg-emerald-500/8", progress: `${done}/${stageChildren.length}`, sub: "", isParallelRunning, dates };
  }
  if (hasLate) {
    const lateNode = stageChildren.find((c: Item) => c.approval?.state === "REJECTED" || c.progress < 0);
    return { label: "驳回", cls: "text-red-600 bg-red-500/8", progress: `${done}/${stageChildren.length}`, sub: lateNode?.title || subLabel, isParallelRunning, dates };
  }
  if (hasActive) {
    return { label: "进行中", cls: "text-blue-600 bg-blue-500/8", progress: `${done}/${stageChildren.length}`, sub: subLabel, isParallelRunning, dates };
  }
  return { label: "未开始", cls: "text-slate-400 bg-transparent", progress: `${done}/${stageChildren.length}`, sub: "", isParallelRunning: false, dates };
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


export function Board({ items, stageFilter = "", stageGroupMap: propMap, stageGroups: propGroups }: { items: Item[]; stageFilter?: string; stageGroupMap?: Record<string, string>; stageGroups?: { code: string; label: string }[] }) {
  const STAGE_GROUPS = propGroups || DEFAULT_STAGE_GROUPS;
  const STAGE_GROUP_MAP = propMap || DEFAULT_STAGE_GROUP_MAP;
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerStage, setDrawerStage] = useState(0);
  const [quickInput, setQuickInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [options, setOptions] = useState<any>(null);
  const selectedItem = items.find((i: Item) => i.id === selectedId);

  useEffect(() => {
    fetch("/api/options").then(r => r.json()).then(setOptions);
  }, []);

  async function saveField(itemId: string, field: string, value: string) {
    await fetch(`/api/versions/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    router.refresh();
  }

  async function saveModules(itemId: string, moduleIds: string[]) {
    await fetch(`/api/versions/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIds }),
    });
    router.refresh();
  }

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

  const boardTitle = stageFilter ? (STAGE_GROUPS.find(g => g.code === stageFilter)?.label || "看板") : "全部版本";

  function openDrawer(item: Item, stageIdx?: number) {
    setSelectedId(item.id);
    setDrawerStage(stageIdx ?? 0);
  }

  function handleQuickCreate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && quickInput.trim()) {
      setShowCreate(true);
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
        <table className="w-full border-separate border-spacing-0 text-[12px] table-fixed" style={{ minWidth: '1400px' }}>
          <colgroup><col style={{ width: '90px' }} /><col style={{ width: '200px' }} /><col style={{ width: '120px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} /><col style={{ width: '75px' }} /><col style={{ width: '140px' }} /><col style={{ width: '140px' }} /><col style={{ width: '140px' }} /><col style={{ width: '140px' }} /><col style={{ width: '80px' }} /><col style={{ width: '50px' }} /></colgroup>
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
                {/* 版本号 - editable text */}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors sticky left-0 z-[3]">
                  <EditableCell
                    value={item.versionNo || ""}
                    itemId={item.id}
                    field="versionNo"
                    onSave={saveField}
                    displayNode={<span className="font-mono text-[12px] font-semibold">{item.versionNo || "—"}</span>}
                  />
                </td>
                {/* 项目名称 - editable text */}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <EditableCell
                    value={item.title || ""}
                    itemId={item.id}
                    field="title"
                    onSave={saveField}
                    displayNode={<span className="text-[13px] font-medium block leading-tight" title={item.title} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</span>}
                  />
                </td>
                {/* 研发模块 - multi-select popover */}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <ModuleCell
                    itemId={item.id}
                    currentModules={item.modules || []}
                    allModules={options?.modules || []}
                    onSave={saveModules}
                  />
                </td>
                {/* 类型 - editable select */}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <EditableCell
                    value={item.natureId || ""}
                    itemId={item.id}
                    field="natureId"
                    type="select"
                    options={options?.natures?.map((n: any) => ({ value: n.id, label: n.label, color: n.color })) || []}
                    onSave={saveField}
                    displayNode={item.nature ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: item.nature.color + "18", color: item.nature.color }}>
                        {item.nature.label}
                      </span>
                    ) : <span className="text-[var(--txt-3)] text-[11px]">—</span>}
                  />
                </td>
                {/* 责任人 - editable select */}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <EditableCell
                    value={item.ownerId || ""}
                    itemId={item.id}
                    field="ownerId"
                    type="select"
                    options={options?.users?.map((u: any) => ({ value: u.id, label: u.name })) || []}
                    onSave={saveField}
                    displayNode={<span className="text-[12px]">{item.owner?.name || "—"}</span>}
                  />
                </td>
                {/* 优先级 - editable select */}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                  <EditableCell
                    value={item.priority || "T1"}
                    itemId={item.id}
                    field="priority"
                    type="select"
                    options={[
                      { value: "FATAL", label: "致命" },
                      { value: "T0", label: "T0" },
                      { value: "T1", label: "T1" },
                      { value: "T2", label: "T2" },
                    ]}
                    onSave={saveField}
                    displayNode={priorityTag(item.priority)}
                  />
                </td>
                {STAGE_GROUPS.map((g, gi) => {
                  const st = stageStatus(item, g.code, STAGE_GROUPS, STAGE_GROUP_MAP);
                  return (
                    <td
                      key={g.code}
                      className="px-2 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors"
                    >
                      <StagePopover
                        itemId={item.id}
                        stageCode={g.code}
                        children={item.children || []}
                        onChanged={() => router.refresh()}
                        triggerNode={
                          <div className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md ${st.cls}`}>
                            {st.dates && <span className="font-mono text-[9px] text-[var(--txt-2)]">计划 {st.dates}</span>}
                            <div className="flex items-center gap-1">
                              <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" />
                              <span className="text-[11px] font-medium">{st.label}</span>
                              {st.progress && <span className="font-mono text-[9px] text-[var(--txt-2)] bg-[var(--bg-3)] px-1 rounded ml-auto">{st.progress}</span>}
                            </div>
                            {st.sub && <span className="text-[10px] font-mono text-[var(--txt-2)] truncate">{st.sub}</span>}
                            {st.isParallelRunning && <span className="text-[9px] text-blue-500 font-mono">⇉ 并行中</span>}
                          </div>
                        }
                      />
                    </td>
                  );
                })}
                <td className="px-3 h-[68px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors cursor-pointer" onClick={() => openDrawer(item)}>
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

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          initialTitle={quickInput}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setQuickInput("");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
