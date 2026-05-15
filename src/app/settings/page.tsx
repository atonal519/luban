"use client";

import { useState, useEffect } from "react";

const TABS = [
  { key: "modules", label: "研发模块", fields: ["name", "color"] },
  { key: "users", label: "人员", fields: ["name", "email", "role"] },
  { key: "stageGroups", label: "大节点", fields: ["label"] },
  { key: "stageTemplates", label: "子节点模板", fields: ["name", "isParallel", "parallelGroup"], grouped: true },
  { key: "natures", label: "类型", fields: ["label", "color"] },
  { key: "statuses", label: "节点状态", fields: ["label", "stageGroup", "color"] },
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
    // Auto-generate code from label for types that need it
    if ((activeTab === "natures" || activeTab === "statuses" || activeTab === "stageGroups") && data.label && !data.code) {
      data.code = data.label.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fff]/g, '_').replace(/_+/g, '_');
    }
    await fetch(`/api/settings/${activeTab}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
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
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />;
    }
    if (field === "order") {
      return <input type="number" value={value || 0} onChange={(e) => onChange(Number(e.target.value))} className="w-14 px-1.5 py-0.5 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none focus:border-[var(--accent)]" />;
    }
    if (field === "role") {
      return (
        <select value={value || "DEV"} onChange={(e) => onChange(e.target.value)} className="px-1.5 py-0.5 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none">
          <option value="PM">PM</option>
          <option value="DEV">DEV</option>
          <option value="MANAGER">MANAGER</option>
        </select>
      );
    }
    if (field === "stageGroup" && (activeTab === "statuses" || activeTab === "stageTemplates")) {
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="px-1.5 py-0.5 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none">
          <option value="">选择阶段</option>
          {stageGroups.map((g: any) => <option key={g.id} value={activeTab === "stageTemplates" ? g.id : g.code}>{g.label}</option>)}
        </select>
      );
    }
    if (field === "stageGroupId") {
      return (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="px-1.5 py-0.5 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none">
          <option value="">选择阶段</option>
          {stageGroups.map((g: any) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      );
    }
    return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="px-1.5 py-0.5 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[12px] outline-none focus:border-[var(--accent)] w-full" />;
  }

  // For stageTemplates, add stageGroupId field
  const displayFields = activeTab === "stageTemplates" ? ["name", "stageGroupId", "order", "isParallel", "parallelGroup"] : tab.fields;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-[52px] min-h-[52px] flex items-center px-5 border-b border-[var(--line)] bg-[var(--bg-1)]">
        <span className="text-[15px] font-semibold">系统设置</span>
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
            {displayFields.map(f => (
              <div key={f} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-[var(--txt-2)]">{f}</span>
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
          // Grouped display for stageTemplates
          <div className="flex flex-col gap-4">
            {stageGroups.map((g: any) => {
              const groupItems = items.filter((item: any) => (item.stageGroup?.id || item.stageGroupId) === g.id);
              return (
                <div key={g.id}>
                  <div className="text-[12px] font-medium text-[var(--txt-0)] px-2 py-1.5 bg-[var(--bg-3)] rounded-md mb-1">{g.label}（{groupItems.length}）</div>
                  <table className="w-full text-[12px] border-collapse">
                    <tbody>
                      {groupItems.map((item: any) => (
                        <tr key={item.id} className="hover:bg-[var(--bg-2)]">
                          {displayFields.map(f => (
                            <td key={f} className="px-2 py-1.5 border-b border-[var(--line)]">
                              {editingId === item.id
                                ? renderField(f, editData[f] ?? item[f], (v) => setEditData({ ...editData, [f]: v }), true)
                                : f === "isParallel" ? (item[f] ? "✓" : "")
                                : f === "stageGroupId" ? (item.stageGroup?.label || "")
                                : String(item[f] ?? "")
                              }
                            </td>
                          ))}
                          <td className="px-2 py-1.5 border-b border-[var(--line)]">
                            {editingId === item.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleSave(item.id)} className="text-[10px] text-[var(--accent)] hover:underline">保存</button>
                                <button onClick={() => setEditingId(null)} className="text-[10px] text-[var(--txt-2)]">取消</button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingId(item.id); setEditData({}); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)]">✎</button>
                                <button onClick={() => handleDelete(item.id)} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">✕</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {displayFields.map(f => (
                  <th key={f} className="text-left px-2 py-1.5 text-[11px] text-[var(--txt-2)] font-medium border-b border-[var(--line-2)]">{f}</th>
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
