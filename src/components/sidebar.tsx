"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/", label: "总览", icon: "☰" },
  { href: "/alerts", label: "告警中心", icon: "⚠", badge: true },
  { href: "/settings", label: "系统设置", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(setUser);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="w-[220px] min-w-[220px] bg-[var(--bg-1)] border-r border-[var(--line)] flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-[11px] font-semibold font-mono">
            LB
          </div>
          <span className="font-mono text-[15px] font-semibold text-[var(--txt-0)] tracking-wide">
            鲁班
          </span>
        </div>
        <div className="text-[10px] text-[var(--txt-2)] pl-[37px]">
          自动驾驶项目管理
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5">
        <div className="text-[10px] text-[var(--txt-3)] tracking-widest uppercase px-2 py-1 font-mono">
          导航
        </div>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors relative ${
                active
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--txt-1)] hover:bg-[var(--bg-3)] hover:text-[var(--txt-0)]"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--accent)] rounded-r" />
              )}
              <span className="text-sm w-4 text-center">{item.icon}</span>
              {item.label}
              {item.badge && (
                <span className="ml-auto bg-[var(--late)] text-white text-[10px] font-mono font-semibold px-1.5 rounded-full min-w-[18px] text-center">
                  3
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3.5 py-3 border-t border-[var(--line)] flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#3b6ff0] to-[#7c3aed] flex items-center justify-center text-white text-xs font-semibold">
          {user?.name?.[0] || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[var(--txt-0)]">{user?.name || "未登录"}</div>
          <div className="text-[11px] text-[var(--txt-2)]">{user?.role || ""}</div>
        </div>
        <button onClick={handleLogout} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)] transition-colors" title="退出登录">
          退出
        </button>
      </div>
    </aside>
  );
}
