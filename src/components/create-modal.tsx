"use client";

import { useState, useEffect } from "react";

type Options = {
  users: { id: string; name: string }[];
  modules: { id: string; name: string; color: string }[];
  natures: { id: string; code: string; label: string; color: string }[];
};

export function CreateModal({
  initialTitle,
  onClose,
  onCreated,
}: {
  initialTitle: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [versionNo, setVersionNo] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [natureId, setNatureId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/options")
      .then((r) => r.json())
      .then(setOptions);
  }, []);

  function toggleModule(id: string) {
    setModuleIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("项目名称不能为空");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/versions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          versionNo: versionNo.trim(),
          priorityId: priorityId || null,
          natureId: natureId || null,
          ownerId: ownerId || null,
          moduleIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "创建失败");
        setSubmitting(false);
        return;
      }

      onCreated();
    } catch {
      setError("网络错误");
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] bg-[var(--bg-1)] rounded-xl shadow-2xl border border-[var(--line-2)] animate-modal-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <span className="text-[15px] font-semibold">新建版本</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-[var(--line-2)] flex items-center justify-center text-[var(--txt-1)] hover:bg-[var(--bg-3)] text-[14px]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3.5">
          {/* 项目名称 */}
          <div>
            <label className="text-[11px] text-[var(--txt-2)] block mb-1">
              项目名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="例：感知融合模块升级"
            />
          </div>

          {/* 版本号 */}
          <div>
            <label className="text-[11px] text-[var(--txt-2)] block mb-1">版本号</label>
            <input
              type="text"
              value={versionNo}
              onChange={(e) => setVersionNo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)] transition-colors font-mono"
              placeholder="例：V2.5.0"
            />
          </div>

          {/* 类型 + 优先级 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--txt-2)] block mb-1">类型</label>
              <select
                value={natureId}
                onChange={(e) => setNatureId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">选择类型</option>
                {options?.natures.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--txt-2)] block mb-1">优先级</label>
              <select
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">选择优先级</option>
                {options?.priorities?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 责任人 */}
          <div>
            <label className="text-[11px] text-[var(--txt-2)] block mb-1">责任人</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">选择责任人</option>
              {options?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* 研发模块（多选） */}
          <div>
            <label className="text-[11px] text-[var(--txt-2)] block mb-1">研发模块（可多选）</label>
            <div className="flex gap-2 flex-wrap">
              {options?.modules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModule(m.id)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                    moduleIds.includes(m.id)
                      ? "border-current"
                      : "border-[var(--line-2)] hover:border-current"
                  }`}
                  style={{
                    color: m.color,
                    background: moduleIds.includes(m.id)
                      ? m.color + "18"
                      : "transparent",
                  }}
                >
                  {m.name}
                </button>
              ))}
              {!options && (
                <span className="text-[12px] text-[var(--txt-3)]">加载中…</span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-[12px] text-red-600 bg-red-500/8 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--line)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--line-2)] text-[13px] text-[var(--txt-1)] hover:bg-[var(--bg-3)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-85 transition-opacity disabled:opacity-50"
          >
            {submitting ? "创建中…" : "创建版本"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        .animate-modal-in {
          animation: modal-in 0.2s ease;
        }
      `}</style>
    </>
  );
}
