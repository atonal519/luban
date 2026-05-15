"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "登录失败");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="w-[380px] bg-[var(--bg-1)] rounded-xl shadow-lg border border-[var(--line-2)] p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white text-[14px] font-semibold font-mono">
            LB
          </div>
          <div>
            <div className="font-mono text-[18px] font-semibold text-[var(--txt-0)]">鲁班</div>
            <div className="text-[11px] text-[var(--txt-2)]">自动驾驶项目管理</div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] text-[var(--txt-2)] block mb-1">用户名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[14px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="输入用户名"
            />
          </div>
          <div>
            <label className="text-[12px] text-[var(--txt-2)] block mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[14px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="输入密码"
            />
          </div>

          {error && (
            <div className="text-[12px] text-red-600 bg-red-500/8 px-3 py-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !name || !password}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-[var(--txt-3)] text-center">
          默认密码：demo123
        </div>
      </div>
    </div>
  );
}
