"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type FilterBlock = {
  key: string;
  label: string;
  open: boolean;
};

export function Sidebar({
  modules, tags, priorities,
  selectedModules, selectedTags, selectedPriorities, selectedFocus, dateFrom, dateTo,
  onModuleChange, onTagChange, onPriorityChange, onFocusChange, onDateChange,
}: {
  modules: any[]; tags: any[]; priorities: any[];
  selectedModules: string[]; selectedTags: string[]; selectedPriorities: string[];
  selectedFocus: string[]; dateFrom: string; dateTo: string;
  onModuleChange: (ids: string[]) => void;
  onTagChange: (ids: string[]) => void;
  onPriorityChange: (ids: string[]) => void;
  onFocusChange: (vals: string[]) => void;
  onDateChange: (from: string, to: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");

  // Collapsible state per block
  const [open, setOpen] = useState<Record<string, boolean>>({
    focus: true, modules: true, tags: false, priorities: false, date: false,
  });

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(setUser);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleChangePwd() {
    setPwdMsg("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const data = await res.json();
    if (!res.ok) { setPwdMsg(data.error || "修改失败"); return; }
    setPwdMsg("✓ 修改成功");
    setOldPwd(""); setNewPwd("");
    setTimeout(() => { setShowPwd(false); setPwdMsg(""); }, 800);
  }

  function toggleOpen(key: string) {
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggle(arr: string[], id: string) {
    return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
  }

  // Count total active filters
  const activeCount = selectedModules.length + selectedTags.length + selectedPriorities.length
    + selectedFocus.length + (dateFrom || dateTo ? 1 : 0);

  function clearAll() {
    onModuleChange([]); onTagChange([]); onPriorityChange([]); onFocusChange([]); onDateChange("", "");
  }

  const FOCUS_OPTIONS = [
    { value: "this_week", label: "本周计划", color: "#3b6ff0" },
    { value: "next_week", label: "下周计划", color: "#059669" },
  ];

  function FilterSection({ id, label, count }: { id: string; label: string; count: number }) {
    return (
      <div
        className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-3)] cursor-pointer"
        onClick={() => toggleOpen(id)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--txt-3)]">{open[id] ? "▼" : "▶"}</span>
          <span className="text-[12px] font-medium text-[var(--txt-0)]">{label}</span>
          {count > 0 && (
            <span className="text-[10px] font-mono bg-[var(--accent-dim)] text-[var(--accent)] px-1.5 rounded-full">{count}</span>
          )}
        </div>
        {count > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (id === "modules") onModuleChange([]);
              else if (id === "tags") onTagChange([]);
              else if (id === "priorities") onPriorityChange([]);
              else if (id === "focus") onFocusChange([]);
              else if (id === "date") onDateChange("", "");
            }}
            className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]"
          >
            清除
          </button>
        )}
      </div>
    );
  }

  return (
    <aside className="w-[220px] min-w-[220px] bg-[var(--bg-1)] border-r border-[var(--line)] flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-[var(--line)]">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-[11px] font-semibold font-mono">LB</div>
          <span className="font-mono text-[15px] font-semibold text-[var(--txt-0)] tracking-wide">鲁班</span>
        </Link>
      </div>

      {/* Filter header */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[10px] text-[var(--txt-3)] tracking-widest uppercase font-mono">
          {pathname === "/settings" ? "设置" : "筛选"}
        </span>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">全部清除</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2">

        {/* 焦点 */}
        <div className="mb-1">
          <FilterSection id="focus" label="焦点计划" count={selectedFocus.length} />
          {open.focus && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              {FOCUS_OPTIONS.map(f => (
                <button
                  key={f.value}
                  onClick={() => { const next=selectedFocus.includes(f.value)?selectedFocus.filter(x=>x!==f.value):[...selectedFocus,f.value]; onFocusChange(next); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors w-full text-left ${selectedFocus.includes(f.value) ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--txt-1)] hover:bg-[var(--bg-3)]"}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                  {f.label}
                  {selectedFocus.includes(f.value) && <span className="ml-auto text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 研发模块 */}
        <div className="mb-1">
          <FilterSection id="modules" label="研发模块" count={selectedModules.length} />
          {open.modules && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              {modules.map(m => {
                const sel = selectedModules.includes(m.id);
                return (
                  <button key={m.id} onClick={() => onModuleChange(toggle(selectedModules, m.id))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors w-full text-left ${sel ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--txt-1)] hover:bg-[var(--bg-3)]"}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="truncate">{m.name}</span>
                    {sel && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 帽子 Tag */}
        <div className="mb-1">
          <FilterSection id="tags" label="帽子" count={selectedTags.length} />
          {open.tags && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              {tags.map(t => {
                const sel = selectedTags.includes(t.id);
                return (
                  <button key={t.id} onClick={() => onTagChange(toggle(selectedTags, t.id))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors w-full text-left ${sel ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--txt-1)] hover:bg-[var(--bg-3)]"}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="truncate">{t.name}</span>
                    {sel && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                );
              })}
              {tags.length === 0 && <div className="px-3 py-1 text-[11px] text-[var(--txt-3)]">暂无帽子</div>}
            </div>
          )}
        </div>

        {/* 优先级 */}
        <div className="mb-1">
          <FilterSection id="priorities" label="优先级" count={selectedPriorities.length} />
          {open.priorities && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              {priorities.map(p => {
                const sel = selectedPriorities.includes(p.id);
                return (
                  <button key={p.id} onClick={() => onPriorityChange(toggle(selectedPriorities, p.id))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors w-full text-left ${sel ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--txt-1)] hover:bg-[var(--bg-3)]"}`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span>{p.label}</span>
                    {sel && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 时间范围 */}
        <div className="mb-1">
          <FilterSection id="date" label="时间范围" count={dateFrom || dateTo ? 1 : 0} />
          {open.date && (
            <div className="mt-1 px-2 flex flex-col gap-1.5">
              <div>
                <div className="text-[10px] text-[var(--txt-3)] mb-0.5">开始 ≥</div>
                <input type="date" value={dateFrom} onChange={(e) => onDateChange(e.target.value, dateTo)}
                  className="w-full px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] text-[11px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <div className="text-[10px] text-[var(--txt-3)] mb-0.5">结束 ≤</div>
                <input type="date" value={dateTo} onChange={(e) => onDateChange(dateFrom, e.target.value)}
                  className="w-full px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] text-[11px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => onDateChange("", "")} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)] self-end">清除</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-[var(--line)] p-3 flex flex-col gap-2">
        <Link href="/settings" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-[var(--txt-1)] hover:bg-[var(--bg-3)] hover:text-[var(--txt-0)] transition-colors">
          <span>⚙</span> 系统设置
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3b6ff0] to-[#7c3aed] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
            {user?.name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[var(--txt-0)] truncate">{user?.name || "未登录"}</div>
            <div className="text-[10px] text-[var(--txt-2)]">{user?.role || ""}</div>
          </div>
          <button onClick={() => { setShowPwd(true); setOldPwd(""); setNewPwd(""); setPwdMsg(""); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)] transition-colors flex-shrink-0">改密码</button>
          <button onClick={handleLogout} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)] transition-colors flex-shrink-0">退出</button>
        </div>
      </div>

      {/* Change password modal */}
      {showPwd && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowPwd(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-xl shadow-2xl p-6 w-[300px]">
            <div className="text-[14px] font-semibold mb-4">修改密码</div>
            <div className="flex flex-col gap-3">
              <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="当前密码" className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] outline-none focus:border-[var(--accent)]" />
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleChangePwd(); }} placeholder="新密码（至少4位）" className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] outline-none focus:border-[var(--accent)]" />
              {pwdMsg && <div className={`text-[12px] ${pwdMsg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{pwdMsg}</div>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowPwd(false)} className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
                <button onClick={handleChangePwd} disabled={!oldPwd || !newPwd} className="px-3 py-1.5 rounded-lg text-[12px] text-white bg-[var(--accent)] disabled:opacity-50">确认修改</button>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
