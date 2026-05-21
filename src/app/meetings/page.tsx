"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

/* ─── 常量 ─── */

const MEETING_TYPES: Record<string, { label: string; color: string }> = {
  TMG: { label: "TMG", color: "#3b6ff0" },
  PRETEST: { label: "提测会", color: "#8b5cf6" },
  RELEASE: { label: "版本发布会", color: "#059669" },
  STANDUP: { label: "早例会", color: "#7e8da8" },
  WORKSHOP: { label: "研讨会", color: "#d97706" },
};

const MEETING_STATUS: Record<string, { label: string; cls: string }> = {
  PLANNED: { label: "计划中", cls: "bg-gray-100 text-gray-600" },
  IN_PROGRESS: { label: "进行中", cls: "bg-blue-50 text-blue-600" },
  COMPLETED: { label: "已完成", cls: "bg-emerald-50 text-emerald-600" },
};

/* ─── 类型 ─── */

type User = { id: string; name: string };

type ActionItem = {
  id: string;
  done: boolean;
};

type Meeting = {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  host: User | null;
  recorder: User | null;
  items: { item: { id: string; versionNo: string; title: string } }[];
  actionItems: ActionItem[];
};

/* ─── 分组工具 ─── */

function groupByDate(meetings: Meeting[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekStart = new Date(today.getTime() - today.getDay() * 86400000);

  const groups: { label: string; meetings: Meeting[] }[] = [
    { label: `今天 · ${fmt(today)}`, meetings: [] },
    { label: `昨天 · ${fmt(yesterday)}`, meetings: [] },
    { label: "本周", meetings: [] },
    { label: "更早", meetings: [] },
  ];

  for (const m of meetings) {
    const d = new Date(m.scheduledAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() === today.getTime()) groups[0].meetings.push(m);
    else if (day.getTime() === yesterday.getTime()) groups[1].meetings.push(m);
    else if (day >= weekStart) groups[2].meetings.push(m);
    else groups[3].meetings.push(m);
  }

  return groups.filter((g) => g.meetings.length > 0);
}

function fmt(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ─── 头像色块 ─── */

const AVATAR_COLORS = ["#3b6ff0", "#8b5cf6", "#059669", "#d97706", "#e11d48", "#0891b2"];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─── 主页面 ─── */

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchMeetings() {
    try {
      const res = await fetch("/api/meetings");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch {
      /* 静默处理 */
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch("/api/options");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      /* 静默处理 */
    }
  }

  useEffect(() => {
    fetchMeetings();
    fetchUsers();
  }, []);

  const groups = useMemo(() => groupByDate(meetings), [meetings]);

  return (
    <div className="flex flex-col h-full">
      {/* ─── 顶栏 ─── */}
      <div className="h-[52px] shrink-0 flex items-center justify-between px-5 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[15px] font-semibold text-[var(--txt-0)]">会议</h1>
          <span className="text-[11px] text-[var(--txt-3)] bg-[var(--bg-3)] px-2 py-0.5 rounded-full">
            {meetings.length} 场
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: "#3b6ff0", color: "white", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "none" }}
        >
          新建会议
        </button>
      </div>

      {/* ─── 主体 ─── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="text-[13px] text-[var(--txt-3)] text-center py-12">加载中…</div>
        ) : meetings.length === 0 ? (
          <div className="text-[13px] text-[var(--txt-3)] text-center py-12">暂无会议</div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="text-[11px] text-[var(--txt-3)] font-medium mb-2">
                  {group.label}
                </div>
                <div className="flex flex-col gap-px rounded-lg overflow-hidden border border-[var(--line)] bg-[var(--line)]">
                  {group.meetings.map((m) => {
                    const typeInfo = MEETING_TYPES[m.type] || { label: m.type, color: "#6b7280" };
                    const statusInfo = MEETING_STATUS[m.status] || MEETING_STATUS.PLANNED;
                    const doneCount = m.actionItems.filter((a) => a.done).length;
                    const totalCount = m.actionItems.length;

                    return (
                      <div
                        key={m.id}
                        onClick={() => router.push("/meetings/" + m.id)}
                        className="flex items-center gap-4 px-4 py-3 bg-[var(--bg-1)] hover:bg-[var(--bg-3)] cursor-pointer transition-colors"
                      >
                        {/* 类型 pill */}
                        <span
                          className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{ color: typeInfo.color, background: typeInfo.color + "18" }}
                        >
                          {typeInfo.label}
                        </span>

                        {/* 标题 */}
                        <span className="text-[13px] font-bold text-[var(--txt-0)] truncate min-w-0 flex-1">
                          {m.title}
                        </span>

                        {/* 时间 */}
                        <span className="shrink-0 text-[11px] text-[var(--txt-3)]">
                          {fmtTime(m.scheduledAt)}
                        </span>

                        {/* 主持人 */}
                        {m.host && (
                          <div className="shrink-0 flex items-center gap-1.5">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-medium"
                              style={{ background: avatarColor(m.host.name) }}
                            >
                              {m.host.name[0]}
                            </span>
                            <span className="text-[11px] text-[var(--txt-2)]">{m.host.name}</span>
                          </div>
                        )}

                        {/* 关联版本数 */}
                        {m.items.length > 0 && (
                          <span className="shrink-0 text-[11px] text-[var(--txt-3)] bg-[var(--bg-3)] px-1.5 py-0.5 rounded">
                            {m.items.length} 版本
                          </span>
                        )}

                        {/* 待办进度 */}
                        {totalCount > 0 && (
                          <span className="shrink-0 text-[11px] text-[var(--txt-3)]">
                            {doneCount}/{totalCount} 待办
                          </span>
                        )}

                        {/* 状态 pill */}
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${statusInfo.cls}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 新建会议 Modal ─── */}
      {showCreate && (
        <CreateMeetingModal
          users={users}
          onClose={() => setShowCreate(false)}
          onCreated={(id: string) => {
            setShowCreate(false);
            fetchMeetings();
            router.push("/meetings/" + id);
          }}
        />
      )}
    </div>
  );
}

/* ─── 新建会议弹窗 ─── */

function CreateMeetingModal({
  users,
  onClose,
  onCreated,
}: {
  users: User[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("TMG");
  const [scheduledAt, setScheduledAt] = useState("");
  const [hostId, setHostId] = useState("");
  const [recorderId, setRecorderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!title.trim()) {
      setError("会议标题不能为空");
      return;
    }
    if (!scheduledAt) {
      setError("请选择会议时间");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          scheduledAt,
          hostId: hostId || null,
          recorderId: recorderId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "创建失败");
        setSubmitting(false);
        return;
      }

      const meeting = await res.json();
      onCreated(meeting.id);
    } catch {
      setError("网络错误");
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[440px] bg-[var(--bg-1)] rounded-xl shadow-2xl border border-[var(--line-2)] animate-[modal-in_0.2s_ease]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <span className="text-[15px] font-semibold">新建会议</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-[var(--line-2)] flex items-center justify-center text-[var(--txt-1)] hover:bg-[var(--bg-3)] text-[14px]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3.5">
          {/* 标题 */}
          <div>
            <label className="text-[11px] text-[var(--txt-2)] block mb-1">
              会议标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="例：V2.5 提测评审"
            />
          </div>

          {/* 类型 + 时间 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--txt-2)] block mb-1">类型</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              >
                {Object.entries(MEETING_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--txt-2)] block mb-1">
                时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* 主持人 + 记录人 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--txt-2)] block mb-1">主持人</label>
              <select
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">选择主持人</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--txt-2)] block mb-1">记录人</label>
              <select
                value={recorderId}
                onChange={(e) => setRecorderId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">选择记录人</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
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
            style={{ padding: "8px 20px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.12)", fontSize: "13px", color: "#4a5270", cursor: "pointer", background: "transparent" }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ background: submitting ? "#3b6ff099" : "#3b6ff0", color: "white", padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", border: "none" }}
          >
            {submitting ? "创建中…" : "创建会议"}
          </button>
        </div>
      </div>
    </>
  );
}
