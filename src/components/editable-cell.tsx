"use client";

import { useState, useRef, useEffect } from "react";

type EditableCellProps = {
  value: string;
  itemId: string;
  field: string;
  type?: "text" | "select";
  options?: { value: string; label: string; color?: string }[];
  displayNode?: React.ReactNode;
  onSave: (itemId: string, field: string, value: string) => Promise<void>;
};

export function EditableCell({
  value,
  itemId,
  field,
  type = "text",
  options,
  displayNode,
  onSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditValue(value);
    setEditing(true);
  }

  async function commit() {
    if (editValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(itemId, field, editValue);
    } catch {
      // revert on error
      setEditValue(value);
    }
    setSaving(false);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setEditValue(value); setEditing(false); }
  }

  if (!editing) {
    return (
      <div
        onDoubleClick={startEdit}
        className="cursor-default min-h-[20px] rounded px-1 -mx-1 hover:bg-[var(--bg-3)] transition-colors"
        title="双击编辑"
      >
        {displayNode || <span className="text-[12px]">{value || "—"}</span>}
      </div>
    );
  }

  if (type === "select" && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={editValue}
        onChange={(e) => { setEditValue(e.target.value); }}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        className="w-full px-1.5 py-1 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      disabled={saving}
      className="w-full px-1.5 py-1 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[12px] text-[var(--txt-0)] outline-none font-mono"
    />
  );
}
