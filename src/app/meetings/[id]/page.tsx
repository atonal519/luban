"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { RichEditor } from "@/components/rich-editor";

/* ── 常量 ─────────────────────────────────────────── */
const MEETING_TYPES: Record<string, { label: string; color: string }> = {
  TMG:      { label: "TMG",    color: "#3b6ff0" },
  PRETEST:  { label: "提测会",  color: "#8b5cf6" },
  RELEASE:  { label: "发布会",  color: "#18a870" },
  STANDUP:  { label: "站会",    color: "#d97706" },
  WORKSHOP: { label: "专题会",  color: "#6366f1" },
};

const MEETING_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  PLANNED:     { label: "计划中",  bg: "rgba(59,111,240,0.10)",  text: "#3b6ff0" },
  IN_PROGRESS: { label: "进行中",  bg: "rgba(217,119,6,0.10)",   text: "#d97706" },
  COMPLETED:   { label: "已完成",  bg: "rgba(24,168,112,0.10)",  text: "#18a870" },
};

const FILE_TYPES: Record<string, string> = {
  REPORT:   "测试报告",
  DESIGN:   "设计文档",
  PPT:      "会议PPT",
  DINGTALK: "钉钉文档",
  OTHER:    "其他",
};

/* ── 类型 ─────────────────────────────────────────── */
type User = { id: string; name: string };
type MeetingItem = { id: string; item: { id: string; versionNo: string; title: string; status: string } };
type ActionItemT = {
  id: string; content: string; sourceType: string; status: string;
  assigneeId: string | null; assignee: User | null; deadline: string | null; createdAt: string;
};
type MeetingFileT = { id: string; title: string; url: string; fileType: string; createdAt: string };
type Meeting = {
  id: string; title: string; type: string; status: string;
  scheduledAt: string; summary: string;
  hostId: string | null; host: User | null;
  recorderId: string | null; recorder: User | null;
  items: MeetingItem[]; actionItems: ActionItemT[]; files: MeetingFileT[];
};

/* ── 主页面 ───────────────────────────────────────── */
export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  /* 纪要编辑 */

  /* 新增过程文件 */
  const [showFileForm, setShowFileForm] = useState(false);
  const [addingFile, setAddingFile] = useState(false);
  const [newFile, setNewFile] = useState({ title: "", url: "", fileType: "OTHER" });

  /* 新增待办 */
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [newTodo, setNewTodo] = useState({ content: "", assigneeId: "", deadline: "" });

  /* 新增遗留 */
  const [showLegacyForm, setShowLegacyForm] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!statusMenuOpen) return;
    function handler(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuOpen]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [versionQuery, setVersionQuery] = useState("");
  const [versionResults, setVersionResults] = useState<{id:string;versionNo:string;title:string}[]>([]);
  const [showVersionSearch, setShowVersionSearch] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [newLegacy, setNewLegacy] = useState({ content: "", assigneeId: "", deadline: "" });

  /* ── 数据获取 ───────────────────────────────────── */
  const fetchMeeting = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMeeting(data);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [, optRes] = await Promise.all([
          fetchMeeting(),
          fetch("/api/options"),
        ]);
        const opts = await optRes.json();
        setUsers(opts.users || []);
      } catch { /* ignore */ }
      setLoading(false);
    }
    init();
  }, [fetchMeeting]);

  /* ── PATCH 通用 ─────────────────────────────────── */
  async function patchMeeting(data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) await fetchMeeting();
    } catch { /* ignore */ }
  }

  /* ── 删除会议 ───────────────────────────────────── */
  async function deleteMeeting() {
    if (!confirm("确定删除此会议？所有关联数据将被清除。")) return;
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/meetings");
    } catch { /* ignore */ }
  }

  /* ── 纪要保存 ───────────────────────────────────── */


  async function loadVersionPreview(itemId: string) {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/versions/" + itemId);
      if (res.ok) {
        const data = await res.json();
        setPreviewVersion(data);
      }
    } catch {} finally { setPreviewLoading(false); }
  }

  async function searchVersions(q: string) {
    setVersionQuery(q);
    if (q.length < 1) { setVersionResults([]); return; }
    try {
      const res = await fetch("/api/versions/search?q=" + encodeURIComponent(q));
      const data = await res.json();
      const linked = new Set(meeting?.items.map((mi: any) => mi.item.id) || []);
      setVersionResults(data.filter((v: any) => !linked.has(v.id)));
    } catch { setVersionResults([]); }
  }

  async function linkVersion(itemId: string) {
    try {
      await fetch("/api/meetings/" + id + "/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      await fetchMeeting();
      setVersionQuery(""); setVersionResults([]); setShowVersionSearch(false);
    } catch {}
  }

  async function unlinkVersion(itemId: string) {
    try {
      await fetch("/api/meetings/" + id + "/items", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      await fetchMeeting();
    } catch {}
  }

  /* ── 过程文件 ───────────────────────────────────── */
  async function addFile() {
    if (!newFile.title || !newFile.url || addingFile) return;
    setAddingFile(true);
    try {
      const res = await fetch(`/api/meetings/${id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFile),
      });
      if (res.ok) {
        await fetchMeeting();
        setNewFile({ title: "", url: "", fileType: "OTHER" });
        setShowFileForm(false);
      }
    } catch { /* ignore */ } finally {
      setAddingFile(false);
    }
  }

  async function deleteFile(fileId: string) {
    try {
      const res = await fetch(`/api/meetings/${id}/files/${fileId}`, { method: "DELETE" });
      if (res.ok) await fetchMeeting();
    } catch { /* ignore */ }
  }

  /* ── 待办/遗留 ──────────────────────────────────── */
  async function addActionItem(sourceType: "TODO" | "LEGACY") {
    const form = sourceType === "TODO" ? newTodo : newLegacy;
    if (!form.content) return;
    try {
      const res = await fetch(`/api/meetings/${id}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: form.content,
          sourceType,
          assigneeId: form.assigneeId || null,
          deadline: form.deadline || null,
        }),
      });
      if (res.ok) {
        await fetchMeeting();
        if (sourceType === "TODO") {
          setNewTodo({ content: "", assigneeId: "", deadline: "" });
          setShowTodoForm(false);
        } else {
          setNewLegacy({ content: "", assigneeId: "", deadline: "" });
          setShowLegacyForm(false);
        }
      }
    } catch { /* ignore */ }
  }

  async function toggleActionStatus(item: ActionItemT) {
    const next = item.status === "DONE" ? "OPEN" : "DONE";
    try {
      const res = await fetch(`/api/meetings/${id}/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) await fetchMeeting();
    } catch { /* ignore */ }
  }

  async function deleteActionItem(actionId: string) {
    try {
      const res = await fetch(`/api/meetings/${id}/action-items/${actionId}`, { method: "DELETE" });
      if (res.ok) await fetchMeeting();
    } catch { /* ignore */ }
  }



  /* ── Loading / 404 ──────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>

    );
  }
  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <span className="text-[var(--txt-2)] text-sm">会议不存在或已被删除</span>
        <button onClick={() => router.push("/meetings")} className="text-sm text-[var(--accent)] hover:underline">
          返回会议列表
        </button>
      </div>
    );
  }

  /* ── 数据派生 ────────────────────────────────────── */
  const todos = meeting.actionItems;
  const todoDone = todos.filter(i => i.status === "DONE").length;
  const typeInfo = MEETING_TYPES[meeting.type] || { label: meeting.type, color: "#6b7280" };
  const statusInfo = MEETING_STATUS[meeting.status] || MEETING_STATUS.PLANNED;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>

      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* ── 面包屑导航 ──────────────────────────── */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
            <span onClick={() => router.push("/meetings")} style={{ color: "#3b6ff0", cursor: "pointer" }}>会议</span>
            <span style={{ color: "#b0b8cc" }}>›</span>
            <span style={{ color: "#4a5270", fontWeight: 500, maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle" }} title={meeting.title}>{meeting.title}</span>
          </div>
          <button onClick={deleteMeeting} style={{ fontSize: "11px", color: "#dc3535", cursor: "pointer", background: "none", border: "none", opacity: 0.7 }}>
            删除
          </button>
        </div>

        {/* ── 主体 ──────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "visible", padding: "20px 24px" }}>

        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 63%", minWidth: 0 }}>
            <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: "8px", padding: "20px" }}>
              {/* 标题 + pills — 和纪要之间有间距 */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "nowrap", overflow: "hidden", minWidth: 0 }}>
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={() => { if (titleDraft.trim()) patchMeeting({ title: titleDraft.trim() }); setEditingTitle(false); }}
                    onKeyDown={e => { if (e.key === "Enter") { if (titleDraft.trim()) patchMeeting({ title: titleDraft.trim() }); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
                    style={{ fontSize: "18px", fontWeight: 700, border: "none", borderBottom: "2px solid #3b6ff0", outline: "none", background: "transparent", color: "#1a1f2e", flex: "1 1 0%", minWidth: 0 }}
                  />
                ) : (
                  <h1
                    onClick={() => { setTitleDraft(meeting.title); setEditingTitle(true); }}
                    style={{ fontSize: "18px", fontWeight: 700, color: "#1a1f2e", lineHeight: "1.3", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "1 1 0%", minWidth: 0 }}
                    title={meeting.title + " (点击编辑)"}
                  >
                    {meeting.title}
                  </h1>
                )}
                <span style={{ fontSize: "11px", fontWeight: 500, padding: "0 10px", height: "24px", lineHeight: "24px", borderRadius: "999px", background: typeInfo.color + "18", color: typeInfo.color, flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
                  {typeInfo.label}
                </span>
                {/* 状态下拉（自定义） */}
                <div ref={statusRef} style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setStatusMenuPos({ top: r.bottom + 4, left: r.left }); setStatusMenuOpen(prev => !prev); }}
                    style={{
                      background: statusInfo.bg,
                      color: statusInfo.text,
                      fontSize: "11px",
                      fontWeight: 500,
                      padding: "0 10px",
                      height: "24px",
                      borderRadius: "999px",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                    }}
                  >
                    {statusInfo.label}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {statusMenuOpen && (
                    <div style={{ position: "fixed", top: statusMenuPos.top, left: statusMenuPos.left, minWidth: "92px", background: "white", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "8px", boxShadow: "0 8px 20px rgba(0,0,0,0.12)", zIndex: 200, overflow: "hidden" }}>
                      {Object.entries(MEETING_STATUS).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => { patchMeeting({ status: k }); setStatusMenuOpen(false); }}
                          style={{ width: "100%", textAlign: "left", padding: "8px 10px", fontSize: "12px", color: "#1a1f2e", background: meeting.status === k ? "rgba(59,111,240,0.12)" : "white", border: "none", cursor: "pointer" }}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>


              <div style={{ height: "1px", background: "rgba(0,0,0,0.07)", margin: "16px 0" }} />
              {/* ── 纪要区（富文本编辑器）────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-[var(--txt-0)]">会议纪要</span>
                  <span className="text-[10px] text-[var(--txt-3)]">实时保存</span>
                </div>
                <RichEditor
                  content={meeting.summary || ""}
                  onChange={(html) => {
                    if (html !== meeting.summary) {
                      clearTimeout((window as any).__saveSummaryTimer);
                      (window as any).__saveSummaryTimer = setTimeout(() => {
                        patchMeeting({ summary: html });
                      }, 1000);
                    }
                  }}
                  placeholder="输入会议纪要…（支持富文本格式）"
                />
              </div>
            </div>
          </div>
          {/* ── 右侧 37% ──────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* ── 卡片1：基本信息 ─────────────────── */}
            <Card title="基本信息">
              <Field label="会议时间">
                <input
                  type="datetime-local"
                  value={meeting.scheduledAt ? meeting.scheduledAt.slice(0, 16) : ""}
                  onChange={e => patchMeeting({ scheduledAt: e.target.value })}
                  className="w-full text-[12px] text-[var(--txt-0)] bg-[var(--bg-2)] border border-[var(--line)] rounded px-2 py-1 outline-none focus:border-[var(--accent)] transition-colors"
                />
              </Field>
              <Field label="主持人">
                <select
                  value={meeting.hostId || ""}
                  onChange={e => patchMeeting({ hostId: e.target.value || null })}
                  className="w-full text-[12px] text-[var(--txt-0)] bg-[var(--bg-2)] border border-[var(--line)] rounded px-2 py-1 outline-none focus:border-[var(--accent)] transition-colors"
                >
                  <option value="">未指定</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <Field label="记录人">
                <select
                  value={meeting.recorderId || ""}
                  onChange={e => patchMeeting({ recorderId: e.target.value || null })}
                  className="w-full text-[12px] text-[var(--txt-0)] bg-[var(--bg-2)] border border-[var(--line)] rounded px-2 py-1 outline-none focus:border-[var(--accent)] transition-colors"
                >
                  <option value="">未指定</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            </Card>

            {/* ── 卡片2：关联版本 ─────────────────── */}
            <Card title="关联版本" badge={meeting.items.length > 0 ? String(meeting.items.length) : undefined}>
              {meeting.items.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
                  {meeting.items.map((mi: any) => (
                    <div key={mi.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", overflow: "hidden" }} className="group">
                      <span onClick={() => loadVersionPreview(mi.item.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", minWidth: 0 }} title={mi.item.versionNo + " " + mi.item.title}>
                        <span style={{ fontFamily: "monospace", color: "#3b6ff0", flexShrink: 0 }}>{mi.item.versionNo}</span>
                        <span style={{ color: "#7e8da8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mi.item.title}</span>
                      </span>
                      <button onClick={() => unlinkVersion(mi.item.id)} style={{ fontSize: "10px", color: "#b0b8cc", cursor: "pointer", background: "none", border: "none", opacity: 0 }} className="group-hover:!opacity-100" title="取消关联">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {meeting.items.length === 0 && !showVersionSearch && (
                <div style={{ fontSize: "12px", color: "#b0b8cc", padding: "4px 0" }}>暂无关联版本</div>
              )}
              {showVersionSearch ? (
                <div style={{ position: "relative" }}>
                  <input
                    autoFocus
                    value={versionQuery}
                    onChange={e => searchVersions(e.target.value)}
                    placeholder="搜索版本号或项目名…"
                    style={{ width: "100%", fontSize: "12px", padding: "6px 8px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "6px", outline: "none" }}
                  />
                  {versionResults.length > 0 && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: "4px", background: "white", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 30, maxHeight: "160px", overflowY: "auto" }}>
                      {versionResults.map(v => (
                        <button key={v.id} onClick={() => linkVersion(v.id)}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", fontSize: "12px", cursor: "pointer", background: "white", border: "none", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                          <span style={{ fontFamily: "monospace", color: "#3b6ff0" }}>{v.versionNo}</span>
                          <span style={{ color: "#7e8da8", marginLeft: "6px" }}>{v.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowVersionSearch(false); setVersionQuery(""); setVersionResults([]); }}
                    style={{ fontSize: "11px", color: "#7e8da8", cursor: "pointer", background: "none", border: "none", marginTop: "4px" }}>取消</button>
                </div>
              ) : (
                <button onClick={() => setShowVersionSearch(true)}
                  style={{ fontSize: "12px", color: "#3b6ff0", cursor: "pointer", background: "none", border: "none", marginTop: "4px" }}>+ 关联版本</button>
              )}
            </Card>

            {/* ── 卡片3：过程文件 ─────────────────── */}
            <Card title="过程文件" badge={meeting.files.length > 0 ? String(meeting.files.length) : undefined}>
              {meeting.files.length === 0 && !showFileForm && (
                <div className="text-[12px] text-[var(--txt-3)] py-1">暂无文件</div>
              )}
              <div className="flex flex-col gap-1.5">
                {meeting.files.map(f => (
                  <div key={f.id} className="flex items-center justify-between group text-[12px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="shrink-0">📄</span>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--accent)] hover:underline truncate"
                      >
                        {f.title}
                      </a>
                      <span className="shrink-0 text-[10px] text-[var(--txt-2)] bg-[var(--bg-3)] px-1.5 py-0.5 rounded">
                        {FILE_TYPES[f.fileType] || f.fileType}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteFile(f.id)}
                      className="text-[var(--txt-3)] hover:text-[var(--late)] opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {showFileForm ? (
                <div className="mt-2 flex flex-col gap-2 p-2 bg-[var(--bg-2)] rounded border border-[var(--line)]">
                  <input
                    placeholder="文件标题"
                    value={newFile.title}
                    onChange={e => setNewFile({ ...newFile, title: e.target.value })}
                    className="text-[12px] px-2 py-1 rounded border border-[var(--line)] bg-white outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    placeholder="链接地址"
                    value={newFile.url}
                    onChange={e => setNewFile({ ...newFile, url: e.target.value })}
                    className="text-[12px] px-2 py-1 rounded border border-[var(--line)] bg-white outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newFile.fileType}
                      onChange={e => setNewFile({ ...newFile, fileType: e.target.value })}
                      className="flex-1 text-[12px] px-2 py-1 rounded border border-[var(--line)] bg-white outline-none focus:border-[var(--accent)]"
                    >
                      {Object.entries(FILE_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button
                      onClick={addFile}
                      className="text-[11px] text-white bg-[var(--accent)] px-2.5 py-1 rounded hover:opacity-90 transition-opacity"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => { setShowFileForm(false); setNewFile({ title: "", url: "", fileType: "OTHER" }); }}
                      className="text-[11px] text-[var(--txt-2)] hover:text-[var(--txt-1)]"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowFileForm(true)}
                  className="text-[12px] text-[var(--accent)] mt-2 hover:opacity-80 transition-opacity"
                >
                  + 添加文件
                </button>
              )}
            </Card>

            {/* ── 卡片4：待办项 ───────────────────── */}
            <Card
              title="待办项"
              badge={todos.length > 0 ? todoDone + "/" + todos.length : undefined}
            >
              <ActionList
                items={todos}
                today={today}
                users={users}
                onToggle={toggleActionStatus}
                onDelete={deleteActionItem}
              />
              {showTodoForm ? (
                <ActionForm
                  form={newTodo}
                  onChange={setNewTodo}
                  users={users}
                  onConfirm={() => addActionItem("TODO")}
                  onCancel={() => { setShowTodoForm(false); setNewTodo({ content: "", assigneeId: "", deadline: "" }); }}
                />
              ) : (
                <button
                  onClick={() => setShowTodoForm(true)}
                  className="text-[12px] text-[var(--accent)] mt-2 hover:opacity-80 transition-opacity"
                >
                  + 添加待办
                </button>
              )}
            </Card>
          </div>
        </div>
      </div>
      </div>
    {/* 版本预览弹窗 */}
      {(previewVersion || previewLoading) && (
        <>
          <div onClick={() => setPreviewVersion(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "white", borderRadius: "12px", padding: "0", width: "480px", maxWidth: "90vw", zIndex: 101, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            {previewLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#7e8da8", fontSize: "13px" }}>加载中…</div>
            ) : previewVersion && (
              <>
                {/* 头部 */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, fontFamily: "monospace" }}>{previewVersion.versionNo}</span>
                    {previewVersion.priority && <span style={{ fontSize: "10px", fontWeight: 500, padding: "2px 6px", borderRadius: "4px", background: (previewVersion.priority.color || "#6b7280") + "18", color: previewVersion.priority.color || "#6b7280" }}>{previewVersion.priority.label}</span>}
                    {previewVersion.status && <span style={{ fontSize: "10px", fontWeight: 500, padding: "2px 6px", borderRadius: "4px", background: (previewVersion.status.color || "#6b7280") + "18", color: previewVersion.status.color || "#6b7280" }}>{previewVersion.status.label}</span>}
                  </div>
                  <button onClick={() => setPreviewVersion(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#7e8da8" }}>✕</button>
                </div>

                {/* 项目名称 */}
                <div style={{ padding: "12px 20px 0", fontSize: "13px", color: "#1a1f2e", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={previewVersion.title}>{previewVersion.title}</div>

                {/* 信息网格 */}
                <div style={{ padding: "0 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <InfoRow label="责任人" value={previewVersion.owner?.name || "未指定"} />
                  <InfoRow label="研发模块" value={previewVersion.modules?.map((m: any) => m.module?.name).filter(Boolean).join("、") || "—"} />
                  <InfoRow label="创建日期" value={previewVersion.createdAt?.slice(0, 10) || "—"} />
                  <InfoRow label="预计交付" value={previewVersion.plannedEnd?.slice(0, 10) || "—"} />
                  <InfoRow label="当前进度" value={previewVersion.progress + "%"} />
                  <InfoRow label="性质" value={previewVersion.nature?.label || "—"} />
                </div>

                {/* 底部 */}
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "flex-end" }}>
                  <a href={"/?detail=" + previewVersion.id} style={{ fontSize: "12px", color: "#3b6ff0", textDecoration: "none", padding: "6px 14px", border: "1px solid rgba(59,111,240,0.2)", borderRadius: "6px", background: "rgba(59,111,240,0.06)" }}>
                    前往版本详情 →
                  </a>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ── 子组件 ───────────────────────────────────────── */

function Card({
  title, titleColor, badge, children,
}: {
  title: string; titleColor?: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)", borderRadius: "8px", padding: "14px 16px" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-semibold" style={{ color: titleColor || "var(--txt-0)" }}>
          {title}
        </span>
        {badge && (
          <span className="text-[10px] font-medium text-[var(--txt-2)] bg-[var(--bg-3)] px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <span style={{ fontSize: "11px", color: "#b0b8cc" }}>{label}</span>
      <div style={{ fontSize: "12px", color: "#1a1f2e" }}>{children}</div>
    </div>
  );
}

function ActionList({
  items, today, users, onToggle, onDelete, highlightOverdue,
}: {
  items: ActionItemT[]; today: string; users: User[];
  onToggle: (item: ActionItemT) => void; onDelete: (id: string) => void;
  highlightOverdue?: boolean;
}) {
  if (items.length === 0) {
    return <div className="text-[12px] text-[var(--txt-3)] py-1">暂无</div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(item => {
        const done = item.status === "DONE";
        const overdue = highlightOverdue && item.deadline && item.deadline.slice(0, 10) < today && !done;
        return (
          <div key={item.id} className="flex items-start gap-2 group text-[12px]">
            <input
              type="checkbox"
              checked={done}
              onChange={() => onToggle(item)}
              className="mt-0.5 shrink-0 accent-[var(--accent)] cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <span className={done ? "line-through text-[var(--txt-3)]" : "text-[var(--txt-0)]"}>
                {item.content}
              </span>
              {item.sourceType === "LEGACY" && <span style={{ fontSize: "9px", color: "#dc3535", background: "rgba(220,53,53,0.08)", padding: "1px 4px", borderRadius: "3px", marginLeft: "4px" }}>遗留</span>}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {item.assignee && (
                  <span className="text-[10px] text-[var(--accent)] bg-[var(--accent-dim)] px-1.5 py-0.5 rounded">
                    {item.assignee.name}
                  </span>
                )}
                {item.deadline && (
                  <span
                    className="text-[10px]"
                    style={{ color: overdue ? "var(--late)" : "var(--txt-2)" }}
                  >
                    {item.deadline.slice(0, 10)}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onDelete(item.id)}
              className="text-[var(--txt-3)] hover:text-[var(--late)] opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ActionForm({
  form, onChange, users, onConfirm, onCancel,
}: {
  form: { content: string; assigneeId: string; deadline: string };
  onChange: (f: { content: string; assigneeId: string; deadline: string }) => void;
  users: User[]; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 p-2 bg-[var(--bg-2)] rounded border border-[var(--line)]">
      <input
        placeholder="内容"
        value={form.content}
        onChange={e => onChange({ ...form, content: e.target.value })}
        className="text-[12px] px-2 py-1 rounded border border-[var(--line)] bg-white outline-none focus:border-[var(--accent)]"
      />
      <div className="flex items-center gap-2">
        <select
          value={form.assigneeId}
          onChange={e => onChange({ ...form, assigneeId: e.target.value })}
          className="flex-1 text-[12px] px-2 py-1 rounded border border-[var(--line)] bg-white outline-none focus:border-[var(--accent)]"
        >
          <option value="">责任人（可选）</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input
          type="date"
          value={form.deadline}
          onChange={e => onChange({ ...form, deadline: e.target.value })}
          className="text-[12px] px-2 py-1 rounded border border-[var(--line)] bg-white outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onConfirm}
          className="text-[11px] text-white bg-[var(--accent)] px-2.5 py-1 rounded hover:opacity-90 transition-opacity"
        >
          确认
        </button>
        <button
          onClick={onCancel}
          className="text-[11px] text-[var(--txt-2)] hover:text-[var(--txt-1)]"
        >
          取消
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: "12px" }}>
      <div style={{ color: "#b0b8cc", fontSize: "10px", marginBottom: "2px" }}>{label}</div>
      <div style={{ color: "#1a1f2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={value}>{value}</div>
    </div>
  );
}
