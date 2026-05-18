"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type Module = { id: string; name: string; color: string };

export function Sidebar({
  modules,
  selectedModules,
  onModuleChange,
}: {
  modules: Module[];
  selectedModules: string[];
  onModuleChange: (ids: string[]) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showPwd, setShowPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [user, setUser] = useState<any>(null);
  const [modulesOpen, setModulesOpen] = useState(true);

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

  function toggleModule(id: string) {
    const next = selectedModules.includes(id)
      ? selectedModules.filter(m => m !== id)
      : [...selectedModules, id];
    onModuleChange(next);
  }

  function clearModules() {
    onModuleChange([]);
  }

  return (
    <aside className="w-[220px] min-w-[220px] bg-[var(--bg-1)] border-r border-[var(--line)] flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-[var(--line)]">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-[11px] font-semibold font-mono">
            LB
          </div>
          <span className="font-mono text-[15px] font-semibold text-[var(--txt-0)] tracking-wide">鲁班</span>
        </Link>
      </div>

      {/* Filter label */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-[10px] text-[var(--txt-3)] tracking-widest uppercase font-mono">
          {pathname === "/settings" ? "设置" : "筛选"}
        </span>
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2">
        {/* 研发模块 */}
        <div className="mb-1">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[var(--bg-3)] cursor-pointer" onClick={() => setModulesOpen(v => !v)}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--txt-3)]">{modulesOpen ? "▼" : "▶"}</span>
              <span className="text-[12px] font-medium text-[var(--txt-0)]">研发模块</span>
              {selectedModules.length > 0 && (
                <span className="text-[10px] font-mono bg-[var(--accent-dim)] text-[var(--accent)] px-1.5 rounded-full">{selectedModules.length}</span>
              )}
            </div>
            {selectedModules.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); clearModules(); }}
                className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)] transition-colors"
              >
                清除
              </button>
            )}
          </div>
          {modulesOpen && (
            <div className="mt-0.5 flex flex-col gap-0.5">
              {modules.map(m => {
                const selected = selectedModules.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors w-full text-left ${
                      selected ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--txt-1)] hover:bg-[var(--bg-3)]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="truncate">{m.name}</span>
                    {selected && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: settings + user */}
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
