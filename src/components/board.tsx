"use client";

import { useState, useEffect, useRef } from "react";
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
  DESIGN: "REQUIREMENT",
  DEVELOPING: "DEVELOPMENT", REJECTED: "DEVELOPMENT",
  ABORTED: "DELIVERY", DELIVERED: "DELIVERY",
};

function priorityTag(p: any) {
  if (!p) return <span className="text-[11px] text-[var(--txt-3)]">—</span>;
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: p.color + "18", color: p.color }}>
    <span className="w-[5px] h-[5px] rounded-full bg-current" />{p.label}
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

  const done = stageChildren.filter((c: Item) => c.status?.code === "DELIVERED").length;
  const hasLate = stageChildren.some((c: Item) => c.status?.code === "REJECTED" || c.approval?.state === "REJECTED");
  const activeNodes = stageChildren.filter((c: Item) => c.status?.code && c.status.code !== "DELIVERED" && c.status.code !== "REJECTED" && c.status.code !== "ABORTED");
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
    const lateNode = stageChildren.find((c: Item) => c.status?.code === "REJECTED" || c.approval?.state === "REJECTED");
    return { label: "驳回", cls: "text-red-600 bg-red-500/8", progress: `${done}/${stageChildren.length}`, sub: lateNode?.title || subLabel, isParallelRunning, dates };
  }
  if (hasActive) {
    return { label: "进行中", cls: "text-blue-600 bg-blue-500/8", progress: `${done}/${stageChildren.length}`, sub: subLabel, isParallelRunning, dates };
  }
  return { label: "未开始", cls: "text-slate-400 bg-transparent", progress: `${done}/${stageChildren.length}`, sub: "", isParallelRunning: false, dates };
}

function ActionMenu({ onDetail, onDelete, onAddChild }: { onDetail: () => void; onDelete: () => void; onAddChild?: () => void }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="px-2 py-0.5 rounded-md text-[14px] text-[var(--txt-2)] hover:bg-[var(--bg-3)] transition-colors"
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-lg shadow-lg py-1 min-w-[100px]" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { onDetail(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--txt-0)] hover:bg-[var(--bg-2)]">详情</button>
          {onAddChild && <button onClick={() => { onAddChild(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--accent)] hover:bg-[var(--bg-2)]">+ 添加子项目</button>}
          <button onClick={() => { onDelete(); setOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--late)] hover:bg-red-500/5">删除</button>
        </div>
      )}
    </div>
  );
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const [showCreate, setShowCreate] = useState(false);
  const [options, setOptions] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedItem = items.find((i: Item) => i.id === selectedId);

  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/options").then(r => r.json()).then(setOptions);
    fetch("/api/auth/me").then(r => r.json()).then(setCurrentUser);
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

  async function deleteVersion(itemId: string) {
    if (!confirm("确认删除？所有子项目、日志、审核记录将一并删除。")) return;
    await fetch(`/api/versions/${itemId}`, { method: "DELETE" });
    setSelectedId(null);
    router.refresh();
  }

  // Inline add: { parentId, depth } when user clicks "添加子项目"
  const [inlineAdd, setInlineAdd] = useState<{ parentId: string; depth: number } | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");

  function startInlineAdd(parentId: string, parentDepth: number) {
    setExpandedIds(prev => new Set(prev).add(parentId));
    setInlineAdd({ parentId, depth: parentDepth + 1 });
    setInlineTitle("");
  }

  async function submitInlineAdd() {
    if (!inlineTitle.trim() || !inlineAdd) { setInlineAdd(null); return; }
    await fetch("/api/versions/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: inlineTitle.trim(), parentId: inlineAdd.parentId, depth: inlineAdd.depth }),
    });
    setInlineAdd(null);
    setInlineTitle("");
    router.refresh();
  }
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

  // Search filter
  const searchedItems = searchQuery.trim()
    ? filteredItems.filter((item: Item) => {
        const q = searchQuery.toLowerCase();
        return (item.versionNo || "").toLowerCase().includes(q)
          || (item.title || "").toLowerCase().includes(q)
          || (item.owner?.name || "").toLowerCase().includes(q);
      })
    : filteredItems;

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
          {searchedItems.length} 个版本
        </span>

        {/* Center: quick create */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] w-[420px] focus-within:border-[var(--accent)] transition-colors">
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
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] w-[220px] ml-1">
            <span className="text-[var(--txt-3)]">🔍</span>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索版本 / 项目名 / 责任人" className="bg-transparent outline-none text-[12px] text-[var(--txt-0)] w-full placeholder:text-[var(--txt-3)]" />
          </div>
        </div>
      </div>

      <AlertBar items={searchedItems} />

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
            {(() => {
              // Recursive row renderer — renders item + its children if expanded
              function renderItemRows(item: Item, indentLevel: number): React.ReactNode[] {
                const isExpanded = expandedIds.has(item.id);
                // Only top-level items have "sub-version" children (depth=0 children that aren't stageType nodes)
                const subItems = (item.children || []).filter((c: Item) => !c.stageType || c.stageType === "");
                const hasSubItems = subItems.length > 0;
                const indentPx = indentLevel * 20;

                const row = (
                  <tr
                    key={item.id}
                    onClick={() => openDrawer(item)}
                    className={`cursor-pointer group ${selectedId === item.id ? "bg-blue-500/5" : ""}`}
                  >
                    {/* 版本号 - with indent + expand toggle */}
                    <td className="px-2 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors sticky left-0 z-[3]">
                      <div className="flex items-center gap-1" style={{ paddingLeft: `${indentPx}px` }}>
                        {hasSubItems ? (
                          <button
                            onClick={(e) => toggleExpand(item.id, e)}
                            className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)] transition-colors flex-shrink-0 w-3"
                          >
                            {isExpanded ? "▼" : "▶"}
                          </button>
                        ) : (
                          <span className="w-3 flex-shrink-0" />
                        )}
                        <EditableCell
                          value={item.versionNo || ""}
                          itemId={item.id}
                          field="versionNo"
                          onSave={saveField}
                          displayNode={
                            <span className={`font-mono font-semibold ${indentLevel === 0 ? "text-[12px]" : "text-[11px] text-[var(--txt-1)]"}`}>
                              {item.versionNo || "—"}
                            </span>
                          }
                        />
                      </div>
                    </td>
                    {/* 项目名称 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                      <div style={{ paddingLeft: `${indentPx}px` }}>
                        <EditableCell
                          value={item.title || ""}
                          itemId={item.id}
                          field="title"
                          onSave={saveField}
                          displayNode={
                            <span className="text-[13px] font-medium block leading-tight" title={item.title} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {item.title}
                            </span>
                          }
                        />
                      </div>
                    </td>
                    {/* 研发模块 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                      <ModuleCell itemId={item.id} currentModules={item.modules || []} allModules={options?.modules || []} onSave={saveModules} />
                    </td>
                    {/* 类型 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                      <EditableCell value={item.natureId || ""} itemId={item.id} field="natureId" type="select" options={options?.natures?.map((n: any) => ({ value: n.id, label: n.label, color: n.color })) || []} onSave={saveField}
                        displayNode={item.nature ? <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: item.nature.color + "18", color: item.nature.color }}>{item.nature.label}</span> : <span className="text-[var(--txt-3)] text-[11px]">—</span>}
                      />
                    </td>
                    {/* 责任人 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                      <EditableCell value={item.ownerId || ""} itemId={item.id} field="ownerId" type="select" options={options?.users?.map((u: any) => ({ value: u.id, label: u.name })) || []} onSave={saveField}
                        displayNode={<span className="text-[12px]">{item.owner?.name || "—"}</span>}
                      />
                    </td>
                    {/* 优先级 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                      <EditableCell value={item.priorityId || ""} itemId={item.id} field="priorityId" type="select" options={options?.priorities?.map((p: any) => ({ value: p.id, label: p.label })) || []} onSave={saveField}
                        displayNode={priorityTag(item.priority)}
                      />
                    </td>
                    {/* 阶段格子 */}
                    {STAGE_GROUPS.map((g) => {
                      const st = stageStatus(item, g.code, STAGE_GROUPS, STAGE_GROUP_MAP);
                      return (
                        <td key={g.code} className="px-2 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors">
                          <StagePopover itemId={item.id} stageCode={g.code} children={item.children || []} onChanged={() => router.refresh()} statuses={options?.statuses}
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
                    {/* 整体状态 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors cursor-pointer" onClick={() => openDrawer(item)}>
                      {(() => { const os = overallStatus(item); return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${os.cls}`}><span className="w-[6px] h-[6px] rounded-full bg-current" />{os.label}</span>; })()}
                    </td>
                    {/* 操作 */}
                    <td className="px-3 h-[60px] border-b border-[var(--line)] bg-[var(--bg-1)] group-hover:bg-[var(--bg-2)] transition-colors relative">
                      <ActionMenu
                        onDetail={() => openDrawer(item)}
                        onDelete={() => deleteVersion(item.id)}
                        onAddChild={() => startInlineAdd(item.id, indentLevel)}
                      />
                    </td>
                  </tr>
                );

                // Recurse into sub-items if expanded
                const childRows: React.ReactNode[] = isExpanded
                  ? subItems.flatMap((child: Item) => renderItemRows(child, indentLevel + 1))
                  : [];

                // Inline add row
                const addRow = (inlineAdd?.parentId === item.id) ? [(
                  <tr key={`${item.id}-inline-add`}>
                    <td className="px-2 h-[48px] border-b border-[var(--line)] bg-blue-500/5" style={{ paddingLeft: `${(indentLevel + 1) * 20 + 12}px` }}>
                      <span className="text-[var(--accent)] text-[11px]">└</span>
                    </td>
                    <td className="px-2 h-[48px] border-b border-[var(--line)] bg-blue-500/5" colSpan={11}>
                      <input
                        autoFocus
                        type="text"
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitInlineAdd();
                          if (e.key === "Escape") setInlineAdd(null);
                        }}
                        onBlur={() => { if (!inlineTitle.trim()) setInlineAdd(null); }}
                        placeholder="输入子项目名称，Enter 确认，Esc 取消"
                        className="w-full bg-transparent outline-none text-[13px] text-[var(--txt-0)] placeholder:text-[var(--txt-3)]"
                      />
                    </td>
                  </tr>
                )] : [];

                return [row, ...childRows, ...addRow];
              }

              return searchedItems.flatMap((item: Item) => renderItemRows(item, 0));
            })()}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selectedItem && (
        <Drawer
          item={selectedItem}
          initialStage={drawerStage}
          onClose={() => setSelectedId(null)}
          currentUser={currentUser}
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
