"use client";

import { useState, useEffect } from "react";

const TABS = [
  { key: "modules", label: "研发模块", fields: ["name", "color"] },
  { key: "users", label: "人员", fields: ["name", "email", "role"] },
  { key: "stageGroups", label: "大节点", fields: ["label"] },
  { key: "stageTemplates", label: "子节点模板", fields: ["name", "isParallel", "parallelGroup"], grouped: true },
  { key: "priorities", label: "优先级", fields: ["label", "color"] },
  { key: "natures", label: "类型", fields: ["label", "color"] },
  { key: "statuses", label: "节点状态", fields: ["label", "color"] },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("modules");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addData, setAddData] = useState<any>({});
  const [stageGroups, setStageGroups] = useState<any[]>([]);

  const tab = TABS.find(t => t.key === activeTab)!;

  useEffect(() => {
    loadItems();
    if (activeTab === "stageTemplates" || activeTab === "statuses") {
      fetch("/api/settings/stageGroups").then(r => r.json()).then(setStageGroups);
    }
  }, [activeTab]);

  async function loadItems() {
    setLoading(true);
    const res = await fetch(`/api/settings/${activeTab}`);
    setItems(await res.json());
    setLoading(false);
  }

  async function handleAdd() {
    const data = { ...addData };
    if ((activeTab === "natures" || activeTab === "statuses" || activeTab === "stageGroups") && data.label && !data.code) {
      data.code = data.label.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fff]/g, '_').replace(/_+/g, '_');
    }
    const res = await fetch(`/api/settings/${activeTab}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert("新增失败，请检查必填字段");
      return;
    }
    setShowAdd(false); setAddData({});
    loadItems();
  }

  async function handleSave(id: string) {
    await fetch(`/api/settings/${activeTab}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    setEditingId(null);
    loadItems();
  }

  async function handleDelete(id: string) {
    if (!confirm("确认删除？")) return;
    await fetch(`/api/settings/${activeTab}/${id}`, { method: "DELETE" });
    loadItems();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    // For grouped tabs, find neighbors within the same visible list
    const visibleItems = (tab as any).grouped
      ? items.filter((i: any) => {
          const groupId = items.find((x: any) => x.id === id)?.stageGroup?.id || items.find((x: any) => x.id === id)?.stageGroupId;
          return (i.stageGroup?.id || i.stageGroupId) === groupId;
        })
      : items;

    const idx = visibleItems.findIndex((i: any) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= visibleItems.length) return;

    const a = visibleItems[idx], b = visibleItems[swapIdx];
    const orderA = a.order ?? idx, orderB = b.order ?? swapIdx;

    await Promise.all([
      fetch(`/api/settings/${activeTab}/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: orderB }) }),
      fetch(`/api/settings/${activeTab}/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: orderA }) }),
    ]);
    loadItems();
  }

  function renderField(field: string, value: any, onChange: (v: any) => void, isEdit = false) {
    if (field === "color") {
      return (
        <div className="flex items-center gap-1.5">
          <input type="color" value={value || "#6366f1"} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded border border-[var(--line-2)] cursor-pointer" />
          <span className="text-[10px] font-mono text-[var(--txt-2)]">{value}</span>
        </div>
      );
    }
    if (field === "isParallel") {
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`px-2.5 h-[26px] rounded-md border text-[12px] font-medium transition-colors leading-[20px] ${
            value ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-[var(--bg-2)] text-[var(--txt-3)] border-[var(--line-2)]"
          }`}
        >
          {value ? "是" : "否"}
        </button>
      );
    }
    if (field === "order") {
      return <input type="number" value={value || 0} onChange={(e) => onChange(Number(e.target.value))} className="w-14 px-1.5 h-[26px] rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none focus:border-[var(--accent)]" />;
    }
    if (field === "role") {
      return (
        <select value={value || "DEV"} onChange={(e) => onChange(e.target.value)} className="px-1.5 h-[26px] rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none">
          <option value="PM">PM</option>
          <option value="DEV">DEV</option>
          <option value="MANAGER">MANAGER</option>
        </select>
      );
    }
    if (field === "stageGroup" && (activeTab === "statuses" || activeTab === "stageTemplates")) {
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="px-1.5 h-[26px] rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none">
          <option value="">选择阶段</option>
          {stageGroups.map((g: any) => <option key={g.id} value={activeTab === "stageTemplates" ? g.id : g.code}>{g.label}</option>)}
        </select>
      );
    }
    if (field === "stageGroupId") {
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="px-1.5 h-[26px] rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none">
          <option value="">选择阶段</option>
          {stageGroups.map((g: any) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      );
    }
    return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="px-1.5 h-[26px] rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none focus:border-[var(--accent)] w-full" />;
  }

  // For stageTemplates, add stageGroupId field
  const displayFields = activeTab === "stageTemplates" ? ["name", "isParallel", "parallelGroup"] : tab.fields;
  const addFields = activeTab === "stageTemplates" ? ["name", "stageGroupId", "isParallel", "parallelGroup"] : tab.fields;

  const fieldLabels: Record<string, string> = {
    name: "名称", label: "名称", color: "颜色", order: "排序",
    email: "邮箱", role: "角色", code: "编码",
    isParallel: "并行", parallelGroup: "并行组",
    stageGroup: "所属阶段", stageGroupId: "所属阶段",
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-[52px] min-h-[52px] flex items-center px-5 border-b border-[var(--line)] bg-[var(--bg-1)]">
        <span className="text-[15px] font-semibold">系统设置</span>
        <a href="/" className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--txt-2)] hover:text-[var(--accent)] transition-colors">
          <span>←</span> 返回主页
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--line)] bg-[var(--bg-1)] px-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key); setEditingId(null); setShowAdd(false); }}
            className={`px-4 py-2.5 text-[12px] border-b-2 transition-colors ${
              activeTab === t.key ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-dim)]" : "text-[var(--txt-2)] border-transparent hover:text-[var(--txt-0)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {/* Add button */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] text-[var(--txt-2)] font-mono uppercase tracking-wider">{tab.label} · {items.length} 条</span>
          <button onClick={() => { setShowAdd(true); setAddData({}); }} className="text-[11px] text-[var(--accent)] hover:underline">+ 新增</button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-3 p-3 bg-[var(--bg-2)] rounded-lg border border-[var(--line-2)] flex gap-2 items-end flex-wrap">
            {addFields.map(f => (
              <div key={f} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--txt-2)]">{fieldLabels[f] || f}</span>
                {renderField(f, addData[f], (v) => setAddData({ ...addData, [f]: v }))}
              </div>
            ))}
            <button onClick={handleAdd} className="px-3 py-1 rounded-md text-[11px] text-white bg-[var(--accent)]">添加</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-md text-[11px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-[12px] text-[var(--txt-3)] text-center py-8">加载中…</div>
        ) : (tab as any).grouped ? (
          // Grouped display for stageTemplates — single table with group header rows
          <table className="text-[12px] border-collapse">
            <colgroup>
              <col style={{ width: '160px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '60px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-[10px] text-[var(--txt-3)] font-medium border-b border-[var(--line-2)]">名称</th>
                <th className="text-left px-2 py-1.5 text-[10px] text-[var(--txt-3)] font-medium border-b border-[var(--line-2)]">并行</th>
                <th className="text-left px-2 py-1.5 text-[10px] text-[var(--txt-3)] font-medium border-b border-[var(--line-2)]">并行组</th>
                <th className="text-left px-2 py-1.5 text-[10px] text-[var(--txt-3)] font-medium border-b border-[var(--line-2)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {stageGroups.map((g: any) => {
                const groupItems = items.filter((item: any) => (item.stageGroup?.id || item.stageGroupId) === g.id);
                return [
                  <tr key={`h-${g.id}`}>
                    <td colSpan={4} className="px-2 pt-4 pb-1 text-[12px] font-semibold text-[var(--txt-0)]">{g.label}（{groupItems.length}）</td>
                  </tr>,
                  ...groupItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-[var(--bg-2)]">
                      <td className="px-2 py-1.5 border-b border-[var(--line)]">
                        {editingId === item.id
                          ? renderField("name", editData.name ?? item.name, (v) => setEditData({ ...editData, name: v }))
                          : item.name
                        }
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--line)]">
                        {editingId === item.id
                          ? renderField("isParallel", editData.isParallel ?? item.isParallel, (v) => setEditData({ ...editData, isParallel: v }))
                          : item.isParallel ? "✓" : ""
                        }
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--line)]">
                        {editingId === item.id
                          ? renderField("parallelGroup", editData.parallelGroup ?? item.parallelGroup, (v) => setEditData({ ...editData, parallelGroup: v }))
                          : item.parallelGroup || ""
                        }
                      </td>
                      <td className="px-2 py-1.5 border-b border-[var(--line)]">
                        {editingId === item.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleSave(item.id)} className="text-[10px] text-[var(--accent)] hover:underline">保存</button>
                            <button onClick={() => setEditingId(null)} className="text-[10px] text-[var(--txt-2)]">取消</button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => handleMove(item.id, "up")} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--txt-0)]">↑</button>
                            <button onClick={() => handleMove(item.id, "down")} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--txt-0)]">↓</button>
                            <button onClick={() => { setEditingId(item.id); setEditData({}); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)]">✎</button>
                            <button onClick={() => handleDelete(item.id)} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        ) : (
          <table className="text-[12px] border-collapse">
            <thead>
              <tr>
                {displayFields.map(f => (
                  <th key={f} className="text-left px-2 py-1.5 text-[11px] text-[var(--txt-2)] font-medium border-b border-[var(--line-2)]">{fieldLabels[f] || f}</th>
                ))}
                <th className="text-left px-2 py-1.5 text-[11px] text-[var(--txt-2)] font-medium border-b border-[var(--line-2)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-[var(--bg-2)]">
                  {displayFields.map(f => (
                    <td key={f} className="px-2 py-2 border-b border-[var(--line)]">
                      {editingId === item.id
                        ? renderField(f, editData[f] ?? item[f], (v) => setEditData({ ...editData, [f]: v }), true)
                        : f === "color"
                          ? <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: item[f] }} /><span className="font-mono text-[10px]">{item[f]}</span></span>
                          : f === "isParallel"
                            ? item[f] ? "✓" : ""
                            : f === "stageGroupId"
                              ? item.stageGroup?.label || item[f]
                              : String(item[f] ?? "")
                      }
                    </td>
                  ))}
                  <td className="px-2 py-2 border-b border-[var(--line)]">
                    {editingId === item.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleSave(item.id)} className="text-[10px] text-[var(--accent)] hover:underline">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-[10px] text-[var(--txt-2)]">取消</button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => handleMove(item.id, "up")} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--txt-0)]">↑</button>
                        <button onClick={() => handleMove(item.id, "down")} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--txt-0)]">↓</button>
                        <button onClick={() => { setEditingId(item.id); setEditData({}); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)]">✎</button>
                        <button onClick={() => handleDelete(item.id)} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
