"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Item = any;

const STAGE_GROUPS = [
  { code: "REQUIREMENT", label: "需求入口" },
  { code: "DEVELOPMENT", label: "版本开发" },
  { code: "TEST", label: "版本测试" },
  { code: "DELIVERY", label: "版本交付" },
];

const STAGE_GROUP_MAP: Record<string, string> = {
  PENDING_SCHEDULE: "REQUIREMENT", SPEC: "REQUIREMENT", DESIGN: "REQUIREMENT",
  TMG: "DEVELOPMENT",
  DEVELOPING: "DEVELOPMENT", SELF_TEST: "DEVELOPMENT", REJECTED: "DEVELOPMENT",
  SUBMIT_TEST: "TEST", HIL: "TEST", SIL: "TEST", INTEGRATION: "TEST",
  REAL_CAR: "TEST", PRE_TEST: "TEST", PRE_PRODUCTION: "TEST",
  PENDING_RELEASE: "DELIVERY", DELIVERED: "DELIVERY", ABORTED: "DELIVERY",
};

function ApprovalChain({ approval, nodeId, options, onChanged }: { approval: any; nodeId: string; options: any; onChanged: () => void }) {
  const [actionForm, setActionForm] = useState<string | null>(null); // "initiate"|"submit"|"approve"|"reject"|"resubmit"
  const [actorId, setActorId] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setImageUrl(data.url || "");
    setUploading(false);
  }

  async function doAction() {
    if (!actorId || submitting) return;
    setSubmitting(true);
    await fetch(`/api/versions/${nodeId}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionForm, actorId, note: note.trim(), evidenceUrl: imageUrl }),
    });
    setActionForm(null); setActorId(""); setNote(""); setImageUrl("");
    setSubmitting(false);
    onChanged();
  }

  const users = options?.users || [];

  // No approval yet — show initiate button
  if (!approval) {
    return (
      <div className="ml-6 mt-2">
        {actionForm === "initiate" ? (
          <div className="p-3 bg-[var(--bg-2)] rounded-lg border border-[var(--line-2)] flex flex-col gap-2">
            <select value={actorId} onChange={(e) => setActorId(e.target.value)} className="px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] outline-none">
              <option value="">发起人</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAction(); } }} placeholder="审核要求…" className="px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] outline-none resize-none min-h-[32px]" />
            <div className="flex gap-1 justify-end">
              <button onClick={() => setActionForm(null)} className="px-2 py-0.5 rounded text-[10px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
              <button onClick={doAction} disabled={!actorId || submitting} className="px-2 py-0.5 rounded text-[10px] text-white bg-[var(--accent)] disabled:opacity-50">{submitting ? "…" : "发起"}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setActionForm("initiate")} className="text-[11px] text-[var(--accent)] hover:underline">+ 发起审核</button>
        )}
      </div>
    );
  }

  const events = approval.events || [];

  return (
    <div className="ml-6 mt-2 p-3 bg-[var(--bg-2)] rounded-lg border border-[var(--line-2)]">
      {/* Event chain */}
      <div className="flex flex-col gap-2.5">
        {events.map((ev: any, idx: number) => {
          const isLast = idx === events.length - 1;
          const dotCls = ev.type === "APPROVE" ? "bg-emerald-500 border-emerald-500"
            : ev.type === "REJECT" ? "bg-red-500 border-red-500"
            : isLast ? "bg-blue-500 border-blue-500 shadow-[0_0_0_3px_rgba(59,111,240,0.15)]"
            : "bg-emerald-500 border-emerald-500";
          const label = ev.type === "REQUEST" ? "发起审核" : ev.type === "SUBMIT" ? "提交凭证"
            : ev.type === "APPROVE" ? "审核通过" : ev.type === "REJECT" ? "驳回" : "重新提交";
          return (
            <div key={ev.id} className="flex gap-2.5 items-start">
              <div className="flex flex-col items-center">
                <div className={`w-2 h-2 rounded-full border-2 ${dotCls} mt-1`} />
                {!isLast && <div className="w-px flex-1 min-h-[16px] bg-[var(--line-2)] mt-0.5" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium text-[var(--txt-0)]">{label}</span>
                  <span className="text-[10px] text-[var(--txt-2)] font-mono">{ev.createdAt?.slice(0, 16).replace('T', ' ')}</span>
                  {ev.actor && <span className="text-[10px] text-blue-500">{ev.actor.name}</span>}
                </div>
                {ev.note && (
                  <div className={`mt-1 text-[11px] p-2 rounded ${ev.type === "REJECT" ? "bg-red-500/8 text-red-600 border border-red-500/15" : "bg-[var(--bg-3)] text-[var(--txt-1)]"}`}>
                    {ev.note}
                  </div>
                )}
                {ev.evidenceUrl && (
                  <div className="mt-1">
                    <img src={ev.evidenceUrl} alt="凭证" className="max-w-[200px] max-h-[150px] rounded border border-[var(--line-2)] cursor-pointer" onClick={() => window.open(ev.evidenceUrl, '_blank')} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action form */}
      {actionForm ? (
        <div className="mt-3 p-2.5 bg-[var(--bg-3)] rounded-lg flex flex-col gap-2">
          <select value={actorId} onChange={(e) => setActorId(e.target.value)} className="px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] outline-none">
            <option value="">操作人</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {(actionForm === "submit" || actionForm === "resubmit") && (
            <div>
              <label className="text-[10px] text-[var(--txt-2)] block mb-1">上传凭证图片</label>
              <input type="file" accept="image/*" onChange={handleUpload} className="text-[11px] text-[var(--txt-1)]" />
              {uploading && <span className="text-[10px] text-[var(--txt-3)]">上传中…</span>}
              {imageUrl && <img src={imageUrl} alt="preview" className="mt-1 max-w-[150px] max-h-[100px] rounded border border-[var(--line-2)]" />}
            </div>
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doAction(); } }} placeholder={actionForm === "reject" ? "驳回理由…" : "备注（可选）…"} className="px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] outline-none resize-none min-h-[32px]" />
          <div className="flex gap-1 justify-end">
            <button onClick={() => { setActionForm(null); setImageUrl(""); }} className="px-2 py-0.5 rounded text-[10px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
            <button onClick={doAction} disabled={!actorId || submitting} className="px-2 py-0.5 rounded text-[10px] text-white bg-[var(--accent)] disabled:opacity-50">{submitting ? "…" : "确认"}</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5 mt-3">
          {approval.state === "WAITING_SUBMIT" && (
            <button onClick={() => setActionForm("submit")} className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-blue-500/8 text-blue-600 border border-blue-500/15">📎 提交凭证</button>
          )}
          {approval.state === "SUBMITTED" && (
            <>
              <button onClick={() => setActionForm("approve")} className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/8 text-emerald-600 border border-emerald-500/15">✓ 通过</button>
              <button onClick={() => setActionForm("reject")} className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-red-500/8 text-red-600 border border-red-500/15">✗ 驳回</button>
            </>
          )}
          {approval.state === "REJECTED" && (
            <button onClick={() => setActionForm("resubmit")} className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-amber-500/8 text-amber-600 border border-amber-500/15">↻ 重新提交</button>
          )}
          {approval.state === "APPROVED" && (
            <span className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-emerald-500/8 text-emerald-600">✓ 已通过</span>
          )}
        </div>
      )}
    </div>
  );
}

function SubNodeList({ children, stageCode, options, onChanged, parentId }: { children: Item[]; stageCode: string; options: any; onChanged: () => void; parentId: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  const stageChildren = children.filter((c: Item) => {
    if (c.stageType === stageCode) return true;
    if (c.status?.code && STAGE_GROUP_MAP[c.status.code] === stageCode) return true;
    return false;
  });

  async function handleAdd() {
    if (!addTitle.trim() || addSubmitting) return;
    setAddSubmitting(true);
    await fetch(`/api/versions/${parentId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: addTitle.trim(), stageType: stageCode }),
    });
    setAddTitle(""); setShowAdd(false); setAddSubmitting(false);
    onChanged();
  }

  async function deleteNode(childId: string) {
    await fetch(`/api/versions/${parentId}/children/${childId}`, { method: "DELETE" });
    onChanged();
  }

  async function editNodeTitle(childId: string, newTitle: string) {
    await fetch(`/api/versions/${parentId}/children/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    onChanged();
  }

  // Group parallel items
  const rendered: any[] = [];
  let i = 0;
  while (i < stageChildren.length) {
    const node = stageChildren[i];
    if (node.isParallel && node.parallelGroup) {
      const group = [node];
      while (i + 1 < stageChildren.length && stageChildren[i + 1].isParallel && stageChildren[i + 1].parallelGroup === node.parallelGroup) {
        i++;
        group.push(stageChildren[i]);
      }
      rendered.push({ type: "parallel", nodes: group });
    } else {
      rendered.push({ type: "linear", node });
    }
    i++;
  }

  function NodeRow({ node }: { node: Item }) {
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleVal, setTitleVal] = useState(node.title);

    // Node flow status: 0=未开始, 50=进行中, 100=通过, -1=打回
    const flowStatus = node.progress === 100 ? "passed" : node.progress < 0 ? "rejected" : node.progress > 0 ? "active" : "idle";
    const statusIcon = flowStatus === "passed" ? "✓" : flowStatus === "rejected" ? "!" : flowStatus === "active" ? "●" : "○";
    const statusColor = flowStatus === "passed" ? "text-emerald-500" : flowStatus === "rejected" ? "text-red-500" : flowStatus === "active" ? "text-blue-500" : "text-[var(--txt-3)]";

    const apBadge = node.approval?.state === "WAITING_SUBMIT" ? { label: "待提交凭证", cls: "bg-amber-500/8 text-amber-600" }
      : node.approval?.state === "SUBMITTED" ? { label: "待PM审核", cls: "bg-blue-500/8 text-blue-600" }
      : node.approval?.state === "REJECTED" ? { label: "已驳回", cls: "bg-red-500/8 text-red-600" }
      : node.approval?.state === "APPROVED" ? { label: "已通过", cls: "bg-emerald-500/8 text-emerald-600" }
      : null;

    async function changeFlowStatus(val: string) {
      const progress = val === "passed" ? 100 : val === "rejected" ? -1 : val === "active" ? 50 : 0;
      await fetch(`/api/versions/${parentId}/children/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress }),
      });
      onChanged();
    }

    return (
      <div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-2)] transition-colors group/node">
          <span className={`w-4 text-center text-[12px] ${statusColor}`}>{statusIcon}</span>
          {editingTitle ? (
            <input
              autoFocus
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { editNodeTitle(node.id, titleVal); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
              onBlur={() => { if (titleVal !== node.title) editNodeTitle(node.id, titleVal); setEditingTitle(false); }}
              className="flex-1 px-1.5 py-0.5 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] outline-none"
            />
          ) : (
            <span className="text-[13px] text-[var(--txt-0)] flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setTitleVal(node.title); setEditingTitle(true); }}>{node.title}</span>
          )}
          {/* Flow status dropdown */}
          <select
            value={flowStatus}
            onChange={(e) => changeFlowStatus(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border-0 outline-none cursor-pointer appearance-none ${
              flowStatus === "passed" ? "bg-emerald-500/12 text-emerald-600"
              : flowStatus === "rejected" ? "bg-red-500/12 text-red-600"
              : flowStatus === "active" ? "bg-blue-500/12 text-blue-600"
              : "bg-[var(--bg-3)] text-[var(--txt-2)]"
            }`}
          >
            <option value="idle">未开始</option>
            <option value="active">进行中</option>
            <option value="passed">通过</option>
            <option value="rejected">打回</option>
          </select>
          {apBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${apBadge.cls}`}>{apBadge.label}</span>
          )}
          <span className="flex gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); setTitleVal(node.title); setEditingTitle(true); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)]">✎</button>
            <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">✕</button>
          </span>
        </div>
        <ApprovalChain approval={node.approval} nodeId={node.id} options={options} onChanged={onChanged} />
        {node.children?.length > 0 && (
          <div className="ml-6 border-l border-[var(--line)] pl-3">
            {node.children.map((sub: Item) => (
              <div key={sub.id} className="flex items-center gap-2 px-2 py-1 text-[12px]">
                <span className={`w-3 text-center ${sub.progress >= 100 ? "text-emerald-500" : sub.progress > 0 ? "text-blue-500" : "text-[var(--txt-3)]"}`}>
                  {sub.progress >= 100 ? "✓" : sub.progress > 0 ? "●" : "○"}
                </span>
                <span className="text-[var(--txt-0)] flex-1">{sub.title}</span>
                <span className="text-[var(--txt-2)]">{sub.progress}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {rendered.map((r, idx) => {
        if (r.type === "parallel") {
          return (
            <div key={idx} className="border-l-2 border-blue-400/35 ml-2 pl-3 my-1 py-1">
              <div className="text-[10px] text-blue-500 font-mono bg-blue-500/8 px-2 py-0.5 rounded inline-flex items-center gap-1 mb-1.5">⇉ 并行执行</div>
              {r.nodes.map((n: Item) => <NodeRow key={n.id} node={n} />)}
            </div>
          );
        }
        return <NodeRow key={r.node.id} node={r.node} />;
      })}

      {stageChildren.length === 0 && !showAdd && (
        <div className="text-[12px] text-[var(--txt-3)] py-3 text-center">暂无子节点</div>
      )}

      {/* 添加节点 */}
      {showAdd ? (
        <div className="mt-2 p-2.5 bg-[var(--bg-2)] rounded-lg border border-[var(--line-2)] flex flex-col gap-2">
          <input
            autoFocus
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
            placeholder="节点名称，如：HIL测试、代码集成…"
            className="w-full px-2.5 py-1.5 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-1.5 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-md text-[11px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
            <button onClick={handleAdd} disabled={!addTitle.trim() || addSubmitting} className="px-3 py-1 rounded-md text-[11px] text-white bg-[var(--accent)] disabled:opacity-50">{addSubmitting ? "…" : "添加"}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="mt-2 text-[11px] text-[var(--accent)] hover:underline self-start">
          + 添加节点
        </button>
      )}
    </div>
  );
}

function SearchSelect({ value, displayText, options, placeholder, onSelect }: {
  value: string; displayText: string; options: { value: string; label: string }[]; placeholder: string; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

  if (!open) {
    return (
      <div onClick={() => { setQuery(""); setOpen(true); }} className="text-[13px] font-medium cursor-pointer hover:text-[var(--accent)] transition-colors">
        {displayText}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none"
      />
      <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-lg shadow-lg max-h-[160px] overflow-y-auto w-full">
        <div onClick={() => { onSelect(""); setOpen(false); }} className="px-2.5 py-1.5 text-[12px] text-[var(--txt-3)] hover:bg-[var(--bg-2)] cursor-pointer">清除</div>
        {filtered.map(o => (
          <div key={o.value} onClick={() => { onSelect(o.value); setOpen(false); }} className={`px-2.5 py-1.5 text-[12px] hover:bg-[var(--bg-2)] cursor-pointer ${o.value === value ? "text-[var(--accent)] font-medium" : "text-[var(--txt-0)]"}`}>
            {o.label}
          </div>
        ))}
        {filtered.length === 0 && <div className="px-2.5 py-1.5 text-[12px] text-[var(--txt-3)]">无匹配</div>}
      </div>
    </div>
  );
}

function EditableTextArea({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  if (!editing) {
    return (
      <div onClick={() => { setText(value); setEditing(true); }} className="cursor-pointer group/eta">
        {value ? (
          <div className="text-[12px] text-[var(--txt-1)] leading-relaxed whitespace-pre-wrap">{value}</div>
        ) : (
          <div className="text-[12px] text-[var(--txt-3)]">{placeholder}</div>
        )}
        <span className="text-[10px] text-[var(--txt-3)] opacity-0 group-hover/eta:opacity-100 transition-opacity">✎ 点击编辑</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(text); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        className="w-full px-3 py-2 rounded-lg border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[80px] leading-relaxed"
        placeholder={placeholder}
      />
      <div className="flex gap-1.5 justify-end items-center">
        <span className="text-[10px] text-[var(--txt-3)] mr-auto">Enter 保存 · Shift+Enter 换行</span>
        <button onClick={() => setEditing(false)} className="px-3 py-1 rounded text-[11px] text-[var(--txt-1)] border border-[var(--line-2)] hover:bg-[var(--bg-3)]">取消</button>
        <button onClick={() => { onSave(text); setEditing(false); }} className="px-3 py-1 rounded text-[11px] text-white bg-[var(--accent)] hover:opacity-85">保存</button>
      </div>
    </div>
  );
}

function MokraField({ label, color, value, field, placeholder, onSave }: { label: string; color: string; value: string; field: string; placeholder: string; onSave: (field: string, value: unknown) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  const colorMap: Record<string, string> = { blue: "#3b82f6", emerald: "#10b981", amber: "#f59e0b", purple: "#a855f7" };
  const c = colorMap[color] || "#6366f1";

  if (!editing) {
    return (
      <div className="flex items-start gap-2 cursor-pointer group/mokra" onClick={() => { setText(value); setEditing(true); }}>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: c, background: c + "18" }}>{label}</span>
        <span className="text-[12px] text-[var(--txt-1)] flex-1">{value || <span className="text-[var(--txt-3)]">{placeholder}</span>}</span>
        <span className="text-[10px] text-[var(--txt-3)] opacity-0 group-hover/mokra:opacity-100 transition-opacity mt-0.5">✎</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: c, background: c + "18" }}>{label}</span>
      <div className="flex-1 flex flex-col gap-1">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(field, text); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
          className="w-full px-2 py-1.5 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[48px] leading-relaxed"
          placeholder={placeholder}
        />
        <div className="flex gap-1.5 justify-end items-center">
          <span className="text-[10px] text-[var(--txt-3)] mr-auto">Enter · Shift+Enter 换行</span>
          <button onClick={() => setEditing(false)} className="px-2 py-0.5 rounded text-[10px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
          <button onClick={() => { onSave(field, text); setEditing(false); }} className="px-2 py-0.5 rounded text-[10px] text-white bg-[var(--accent)]">保存</button>
        </div>
      </div>
    </div>
  );
}

function DrawerPersonSelect({ currentOwners, allUsers, onSave }: { currentOwners: any[]; allUsers: any[]; onSave: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(currentOwners.map((u: any) => u.id));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelected(currentOwners.map((u: any) => u.id)); }, [currentOwners]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        const prev = currentOwners.map((u: any) => u.id).sort().join(",");
        const next = [...selected].sort().join(",");
        if (prev !== next) onSave(selected);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  }

  const filtered = allUsers.filter((u: any) => u.name.toLowerCase().includes(query.toLowerCase()));
  const selectedUsers = allUsers.filter((u: any) => selected.includes(u.id));

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-1 items-center cursor-pointer" onClick={() => { setQuery(""); setOpen(!open); }}>
        {selectedUsers.length > 0 ? (
          <>
            {selectedUsers.slice(0, 2).map((u: any) => (
              <span key={u.id} className="text-[12px] font-medium">{u.name}</span>
            ))}
            {selectedUsers.length > 2 && <span className="text-[10px] text-[var(--txt-2)]">+{selectedUsers.length - 2}</span>}
          </>
        ) : (
          <span className="text-[12px] text-[var(--txt-3)]">—</span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-lg shadow-lg w-[160px] p-1.5">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索责任人…"
            className="w-full px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-2)] text-[11px] text-[var(--txt-0)] outline-none mb-1"
          />
          <div className="max-h-[140px] overflow-y-auto">
            {filtered.map((u: any) => (
              <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-2)] cursor-pointer text-[12px]">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="accent-[var(--accent)]" />
                {u.name}
              </label>
            ))}
            {filtered.length === 0 && <div className="text-[11px] text-[var(--txt-3)] px-2 py-1">无匹配</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerModuleSelect({ currentModules, allModules, onSave }: { currentModules: any[]; allModules: any[]; onSave: (ids: string[]) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>(currentModules.map((m: any) => m.module.id));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelected(currentModules.map((m: any) => m.module.id)); }, [currentModules]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // save on close
        const prev = currentModules.map((m: any) => m.module.id).sort().join(",");
        const next = [...selected].sort().join(",");
        if (prev !== next) onSave(selected);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  const filtered = allModules.filter((m: any) => m.name.toLowerCase().includes(query.toLowerCase()));
  const selectedModules = allModules.filter((m: any) => selected.includes(m.id));

  return (
    <div ref={ref}>
      <div className="text-[11px] text-[var(--txt-2)]">研发模块</div>
      <div className="flex gap-1 items-center mt-1 cursor-pointer" onClick={() => { setQuery(""); setOpen(!open); }}>
        {selectedModules.length > 0 ? (
          <>
            {selectedModules.slice(0, 3).map((m: any) => (
              <span key={m.id} className="px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap" style={{ background: m.color + "18", color: m.color }}>
                {m.name}
              </span>
            ))}
            {selectedModules.length > 3 && <span className="text-[10px] text-[var(--txt-2)]">+{selectedModules.length - 3}</span>}
          </>
        ) : (
          <span className="text-[13px] text-[var(--txt-3)]">—</span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-lg shadow-lg w-[180px] p-1.5">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模块…"
            className="w-full px-2 py-1 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[11px] text-[var(--txt-0)] outline-none mb-1"
          />
          <div className="max-h-[140px] overflow-y-auto">
            {filtered.map((m: any) => (
              <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-2)] cursor-pointer text-[12px]">
                <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="accent-[var(--accent)]" />
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: m.color + "18", color: m.color }}>{m.name}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="text-[11px] text-[var(--txt-3)] px-2 py-1">无匹配</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function RejectionItem({ rejection: r, index, itemId, options, onChanged }: { rejection: any; index: number; itemId: string; options: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(r.reason);
  const [docLink, setDocLink] = useState(r.docLink || "");

  async function saveEdit() {
    await fetch(`/api/versions/${itemId}/rejections/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim(), docLink: docLink.trim() }),
    });
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    await fetch(`/api/versions/${itemId}/rejections/${r.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="flex gap-2.5 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 group/rej">
      <div className="flex flex-col items-center flex-shrink-0">
        <span className="w-5 h-5 rounded-full bg-[var(--late)] text-white text-[10px] font-mono font-semibold flex items-center justify-center">{index}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] mb-1">
          <span className="font-medium text-[var(--late)]">{r.rejectedBy?.name}</span>
          <span className="text-[var(--txt-2)] font-mono">{r.createdAt?.slice(0, 10)}</span>
          <span className="flex gap-1 opacity-0 group-hover/rej:opacity-100 transition-opacity ml-auto">
            <button onClick={() => { setReason(r.reason); setDocLink(r.docLink || ""); setEditing(true); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)]">✎</button>
            <button onClick={handleDelete} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">✕</button>
          </span>
        </div>
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(false); }}
              className="w-full px-2 py-1 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[36px]"
            />
            <input
              type="text"
              value={docLink}
              onChange={(e) => setDocLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
              placeholder="文档链接…"
              className="w-full px-2 py-1 rounded border border-[var(--line-2)] bg-[var(--bg-2)] text-[11px] text-[var(--txt-0)] outline-none"
            />
            <div className="flex gap-1 justify-end">
              <button onClick={() => setEditing(false)} className="px-2 py-0.5 rounded text-[10px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
              <button onClick={saveEdit} className="px-2 py-0.5 rounded text-[10px] text-white bg-[var(--accent)]">保存</button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-[12px] text-[var(--txt-1)] leading-relaxed">{r.reason}</div>
            {r.docLink && (
              <a href={r.docLink} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--accent)] hover:underline mt-1 block truncate">
                📎 {r.docLink}
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RejectionSection({ item, options, onSaved }: { item: Item; options: any; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [docLink, setDocLink] = useState("");
  const [rejectedById, setRejectedById] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rejections = item.rejections || [];

  async function handleSubmit() {
    if (!reason.trim() || !rejectedById) return;
    setSubmitting(true);
    await fetch(`/api/versions/${item.id}/rejections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim(), docLink: docLink.trim(), rejectedById }),
    });
    setReason(""); setDocLink(""); setRejectedById(""); setShowForm(false);
    setSubmitting(false);
    onSaved();
  }

  return (
    <div className="px-5 py-4 border-t border-[var(--line)]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono">
          版本打回 {rejections.length > 0 && <span className="text-[var(--late)]">({rejections.length})</span>}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-[11px] text-[var(--accent)] hover:text-[var(--txt-0)] transition-colors"
          >
            + 记录打回
          </button>
        )}
      </div>

      {/* 新增打回表单 */}
      {showForm && (
        <div className="mb-3 p-3 bg-[var(--bg-2)] rounded-lg border border-[var(--line-2)]">
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] text-[var(--txt-2)] block mb-0.5">打回人 <span className="text-red-500">*</span></label>
              <select
                value={rejectedById}
                onChange={(e) => setRejectedById(e.target.value)}
                className="w-full px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">选择打回人</option>
                {options?.users?.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--txt-2)] block mb-0.5">打回理由 <span className="text-red-500">*</span></label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                className="w-full px-2 py-1.5 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[40px] focus:border-[var(--accent)]"
                placeholder="打回理由…"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--txt-2)] block mb-0.5">文档链接（钉钉）</label>
              <input
                type="text"
                value={docLink}
                onChange={(e) => setDocLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className="w-full px-2 py-1 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-1.5 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-1 rounded-md text-[11px] text-[var(--txt-1)] border border-[var(--line-2)] hover:bg-[var(--bg-3)]">取消</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !reason.trim() || !rejectedById}
                className="px-3 py-1 rounded-md text-[11px] text-white bg-[var(--late)] hover:opacity-85 disabled:opacity-50"
              >
                {submitting ? "提交中…" : "确认打回"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 打回历史列表 */}
      {rejections.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rejections.map((r: any, idx: number) => (
            <RejectionItem key={r.id} rejection={r} index={rejections.length - idx} itemId={item.id} options={options} onChanged={onSaved} />
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-[var(--txt-3)] text-center py-2">暂无打回记录</div>
      )}
    </div>
  );
}

function LogItem({ log, itemId, onChanged }: { log: any; itemId: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(log.content);

  async function saveEdit() {
    if (!text.trim() || text === log.content) { setEditing(false); return; }
    await fetch(`/api/versions/${itemId}/logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    setEditing(false);
    onChanged();
  }

  async function handleDelete() {
    await fetch(`/api/versions/${itemId}/logs/${log.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="flex gap-2.5 group/log">
      <div className="font-mono text-[11px] text-[var(--txt-2)] min-w-[100px] pt-0.5 flex-shrink-0">{log.logDate}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] text-blue-500 font-medium">{log.author?.name}</span>
          <span className="flex gap-1 opacity-0 group-hover/log:opacity-100 transition-opacity">
            <button onClick={() => { setText(log.content); setEditing(true); }} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--accent)]">✎</button>
            <button onClick={handleDelete} className="text-[10px] text-[var(--txt-3)] hover:text-[var(--late)]">✕</button>
          </span>
        </div>
        {editing ? (
          <div className="flex flex-col gap-1">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(false); }}
              className="w-full px-2 py-1 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[36px]"
            />
            <div className="flex gap-1 justify-end">
              <button onClick={() => setEditing(false)} className="px-2 py-0.5 rounded text-[10px] text-[var(--txt-1)] border border-[var(--line-2)]">取消</button>
              <button onClick={saveEdit} className="px-2 py-0.5 rounded text-[10px] text-white bg-[var(--accent)]">保存</button>
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-[var(--txt-1)] leading-relaxed whitespace-pre-wrap">{log.content}</div>
        )}
      </div>
    </div>
  );
}

export function Drawer({ item, initialStage, onClose }: { item: Item; initialStage: number; onClose: () => void }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialStage);
  const [options, setOptions] = useState<any>(null);
  const [logContent, setLogContent] = useState("");
  const [logSubmitting, setLogSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/options").then(r => r.json()).then(setOptions);
  }, []);

  async function save(field: string, value: unknown) {
    await fetch(`/api/versions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    router.refresh();
  }

  async function saveModules(moduleIds: string[]) {
    await fetch(`/api/versions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleIds }),
    });
    router.refresh();
  }

  async function submitLog() {
    if (!logContent.trim() || logSubmitting) return;
    setLogSubmitting(true);
    await fetch(`/api/versions/${item.id}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: logContent.trim(), authorId: item.ownerId || "" }),
    });
    setLogContent("");
    setLogSubmitting(false);
    router.refresh();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[500px] bg-[var(--bg-1)] border-l border-[var(--line-2)] z-50 flex flex-col shadow-[-12px_0_40px_rgba(0,0,0,0.08)] animate-slide-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-start gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[18px] font-semibold">{item.versionNo}</div>
            <div className="text-[13px] text-[var(--txt-1)] mt-0.5 break-words">{item.title}</div>
          </div>
          {item.status && (
            <span className="px-2 py-1 rounded text-[11px] font-medium" style={{ background: item.status.color + "18", color: item.status.color }}>
              {item.status.label}
            </span>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-md border border-[var(--line-2)] flex items-center justify-center text-[var(--txt-1)] hover:bg-[var(--bg-3)] transition-colors text-[14px]">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Info Grid — 3 cols × 2 rows, editable */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">基本信息</div>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
              <div>
                <div className="text-[11px] text-[var(--txt-2)] mb-1">创建日期</div>
                <div className="text-[12px] font-mono bg-[var(--bg-2)] border border-[var(--line-2)] rounded-md px-2 py-0.5 leading-[22px] text-[var(--txt-1)] w-fit">{item.createdAt?.slice(0, 10) || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--txt-2)] mb-1">预计交付</div>
                <input
                  type="date"
                  defaultValue={item.plannedEnd?.slice(0, 10) || ""}
                  onBlur={(e) => save("plannedEnd", e.target.value || null)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="text-[12px] font-mono bg-[var(--bg-2)] border border-[var(--line-2)] rounded-md px-2 py-0.5 outline-none w-full focus:border-[var(--accent)] transition-colors leading-[22px]"
                />
              </div>
              <div>
                <div className="text-[11px] text-[var(--txt-2)] mb-1">计划起止</div>
                <div className="text-[12px] font-mono bg-[var(--bg-2)] border border-[var(--line-2)] rounded-md px-2 py-0.5 leading-[22px] text-[var(--txt-1)]">
                  {item.actualStart ? item.actualStart.slice(0, 10) : <span className="text-[var(--txt-3)]">未开始</span>}
                  {" ~ "}
                  {item.actualEnd ? item.actualEnd.slice(0, 10) : <span className="text-[var(--txt-3)]">进行中</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--txt-2)] mb-1">责任人</div>
                <DrawerPersonSelect
                  currentOwners={item.owner ? [item.owner] : []}
                  allUsers={options?.users || []}
                  onSave={(ids) => save("ownerId", ids[0] || null)}
                />
              </div>
              <DrawerModuleSelect
                currentModules={item.modules || []}
                allModules={options?.modules || []}
                onSave={saveModules}
              />
              <div>
                <div className="text-[11px] text-[var(--txt-2)] mb-1">回溯历史</div>
                <div className="text-[12px] font-mono leading-[22px]">
                  {(item.rejections?.length || 0) > 0
                    ? <span className="text-[var(--late)] font-medium">打回 {item.rejections.length} 次</span>
                    : <span className="text-[var(--txt-3)]">0 次</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* 规格 — editable */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">规格</div>
            <EditableTextArea value={item.description || ""} placeholder="点击添加规格描述…" onSave={(v) => save("description", v)} />
          </div>

          {/* MOKRA — editable */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">MOKRA</div>
            <div className="flex flex-col gap-2.5">
              <MokraField label="M" color="blue" value={item.mokraMotivation || ""} field="mokraMotivation" onSave={save} placeholder="背景动机…" />
              <MokraField label="O" color="emerald" value={item.mokraObjects || ""} field="mokraObjects" onSave={save} placeholder="目标…" />
              <MokraField label="KR" color="amber" value={item.mokraKeyResults || ""} field="mokraKeyResults" onSave={save} placeholder="关键结果…" />
              <MokraField label="A" color="purple" value={item.mokraActions || ""} field="mokraActions" onSave={save} placeholder="行动项…" />
            </div>
          </div>

          {/* Stage tabs */}
          <div className="border-b border-[var(--line)]">
            <div className="px-5 pt-4">
              <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-2.5">阶段子节点</div>
            </div>
            <div className="flex overflow-x-auto">
              {STAGE_GROUPS.map((g, idx) => (
                <button
                  key={g.code}
                  onClick={() => setActiveTab(idx)}
                  className={`px-3.5 py-2.5 text-[11px] whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === idx
                      ? "text-[var(--accent)] border-[var(--accent)] bg-[var(--accent-dim)]"
                      : "text-[var(--txt-2)] border-transparent hover:text-[var(--txt-0)] hover:bg-[var(--bg-2)]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub nodes */}
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <SubNodeList children={item.children || []} stageCode={STAGE_GROUPS[activeTab].code} options={options} onChanged={() => router.refresh()} parentId={item.id} />
          </div>

          {/* Logs */}
          <div className="px-5 py-4">
            <div className="text-[11px] text-[var(--txt-2)] tracking-wider uppercase font-mono mb-3">跟进日志</div>
            <div className="flex flex-col gap-3">
              {(item.dailyLogs || []).map((log: any) => (
                <LogItem key={log.id} log={log} itemId={item.id} onChanged={() => router.refresh()} />
              ))}
              {(!item.dailyLogs || item.dailyLogs.length === 0) && (
                <div className="text-[12px] text-[var(--txt-3)] text-center py-3">暂无日志</div>
              )}
            </div>
          </div>

          {/* 版本打回记录 */}
          <RejectionSection item={item} options={options} onSaved={() => router.refresh()} />
        </div>

        {/* Log input */}
        <div className="px-5 py-3 border-t border-[var(--line)] flex gap-2 items-end flex-shrink-0">
          <textarea
            value={logContent}
            onChange={(e) => setLogContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitLog(); } }}
            className="flex-1 bg-[var(--bg-2)] border border-[var(--line-2)] rounded-lg px-3 py-2 text-[12px] text-[var(--txt-0)] outline-none resize-none min-h-[40px] focus:border-[var(--accent)] transition-colors placeholder:text-[var(--txt-3)]"
            placeholder="记录今日进展… (Enter 提交, Shift+Enter 换行)"
          />
          <button
            onClick={submitLog}
            disabled={logSubmitting || !logContent.trim()}
            className="px-3.5 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium h-[40px] hover:opacity-85 transition-opacity disabled:opacity-50"
          >
            {logSubmitting ? "…" : "提交"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
}
