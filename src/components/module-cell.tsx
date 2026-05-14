"use client";

import { useState, useRef, useEffect } from "react";

type Module = { id: string; name: string; color: string };

export function ModuleCell({
  itemId,
  currentModules,
  allModules,
  onSave,
}: {
  itemId: string;
  currentModules: { module: Module }[];
  allModules: Module[];
  onSave: (itemId: string, moduleIds: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentModules.map(m => m.module.id));
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(currentModules.map(m => m.module.id));
  }, [currentModules]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        commitAndClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  async function commitAndClose() {
    const prev = currentModules.map(m => m.module.id).sort().join(",");
    const next = [...selected].sort().join(",");
    if (prev !== next) {
      setSaving(true);
      await onSave(itemId, selected);
      setSaving(false);
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex gap-1 items-center cursor-pointer group/mod overflow-hidden"
      >
        {currentModules.length > 0 ? (
          <>
            {currentModules.slice(0, 2).map((im) => (
              <span key={im.module.id} className="px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap flex-shrink-0" style={{ background: im.module.color + "18", color: im.module.color }}>
                {im.module.name}
              </span>
            ))}
            {currentModules.length > 2 && (
              <span className="text-[10px] text-[var(--txt-2)] flex-shrink-0">+{currentModules.length - 2}</span>
            )}
          </>
        ) : (
          <span className="text-[var(--txt-3)] text-[11px]">—</span>
        )}
        <span className="text-[10px] text-[var(--txt-3)] opacity-0 group-hover/mod:opacity-100 transition-opacity flex-shrink-0">✎</span>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-1)] border border-[var(--line-2)] rounded-lg shadow-lg p-2 min-w-[140px]">
          {allModules.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-2)] cursor-pointer text-[12px]"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={() => toggle(m.id)}
                className="rounded border-[var(--line-2)] accent-[var(--accent)]"
              />
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: m.color + "18", color: m.color }}>
                {m.name}
              </span>
            </label>
          ))}
          {saving && <div className="text-[10px] text-[var(--txt-3)] text-center mt-1">保存中…</div>}
        </div>
      )}
    </div>
  );
}
