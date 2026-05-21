"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useState, useEffect } from "react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const PRESET_COLORS = [
  "#1a1f2e", "#dc3535", "#d97706", "#059669",
  "#3b6ff0", "#8b5cf6", "#ec4899", "#7e8da8",
];

export function RichEditor({ content, onChange, placeholder = "输入内容…", editable = true }: RichEditorProps) {
  const [showColors, setShowColors] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      Color, TextStyle,
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: "8px", overflow: "hidden", background: "white" }}>
      {editable && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1px", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.07)", background: "#f8f9fb", alignItems: "center" }}>
          <select
            value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) as 1 | 2 | 3 }).run();
            }}
            style={{ fontSize: "12px", padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.1)", background: "white", cursor: "pointer", height: "28px" }}
          >
            <option value="p">正文</option>
            <option value="h1">标题 1</option>
            <option value="h2">标题 2</option>
            <option value="h3">标题 3</option>
          </select>

          <Sep />
          <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗"><b>B</b></Btn>
          <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><i>I</i></Btn>
          <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线"><u>U</u></Btn>
          <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><s>S</s></Btn>
          <Sep />

          {/* Color preset */}
          <div style={{ position: "relative" }}>
            <Btn active={false} onClick={() => setShowColors(p => !p)} title="文字颜色">
              <span style={{ color: "#dc3535", fontWeight: 700 }}>A</span>
            </Btn>
            {showColors && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "white", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "6px", padding: "6px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => { editor.chain().focus().setColor(c).run(); setShowColors(false); }}
                    style={{ width: "22px", height: "22px", borderRadius: "4px", background: c, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer" }} />
                ))}
                <button onClick={() => { editor.chain().focus().unsetColor().run(); setShowColors(false); }}
                  style={{ width: "22px", height: "22px", borderRadius: "4px", background: "white", border: "1px solid rgba(0,0,0,0.15)", cursor: "pointer", fontSize: "9px", color: "#7e8da8" }}
                  title="清除颜色">✕</button>
              </div>
            )}
          </div>
          <Sep />

          <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="4" cy="7" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="7" x2="20" y2="7"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="12" x2="20" y2="12"/><circle cx="4" cy="17" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="17" x2="20" y2="17"/></svg>
          </Btn>
          <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><text x="2" y="9" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><line x1="9" y1="7" x2="20" y2="7"/><text x="2" y="14.5" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><line x1="9" y1="12" x2="20" y2="12"/><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text><line x1="9" y1="17" x2="20" y2="17"/></svg>
          </Btn>
          <Sep />

          <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="左对齐">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
          </Btn>
          <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="居中">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </Btn>
          <Sep />

          <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/></svg>
          </Btn>
          <Btn active={false} onClick={() => { const url = prompt("输入链接地址："); if (url) editor.chain().focus().setLink({ href: url }).run(); }} title="链接">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </Btn>
          <Btn active={false} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="插入表格">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          </Btn>
        </div>
      )}

      <EditorContent editor={editor} style={{ padding: "12px 16px", minHeight: "200px", fontSize: "13px", lineHeight: "1.7" }} />

      <style>{`
        .tiptap { outline: none; }
        .tiptap h1 { font-size: 20px; font-weight: 700; margin: 12px 0 6px; }
        .tiptap h2 { font-size: 16px; font-weight: 600; margin: 10px 0 4px; }
        .tiptap h3 { font-size: 14px; font-weight: 600; margin: 8px 0 4px; }
        .tiptap p { margin: 4px 0; }
        .tiptap ul { padding-left: 20px; margin: 4px 0; }
        .tiptap ul li { list-style-type: disc; margin: 2px 0; }
        .tiptap ul ul li { list-style-type: circle; }
        .tiptap ul ul ul li { list-style-type: square; }
        .tiptap ol { padding-left: 20px; margin: 4px 0; list-style-type: decimal; }
        .tiptap ol li { margin: 2px 0; }
        .tiptap li { margin: 2px 0; }
        .tiptap blockquote { border-left: 3px solid #3b6ff0; padding-left: 12px; color: #7e8da8; margin: 8px 0; }
        .tiptap a { color: #3b6ff0; text-decoration: underline; }
        .tiptap table { border-collapse: collapse; width: 100%; margin: 8px 0; }
        .tiptap th, .tiptap td { border: 1px solid rgba(0,0,0,0.12); padding: 6px 10px; text-align: left; }
        .tiptap th { background: #f5f6fa; font-weight: 600; }
        .tiptap s { text-decoration: line-through; }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #b0b8cc;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
    </div>
  );
}

function Btn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} type="button"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: "28px", height: "28px", borderRadius: "4px", fontSize: "13px",
        fontWeight: active ? 700 : 500,
        background: active ? "rgba(59,111,240,0.1)" : "transparent",
        color: active ? "#3b6ff0" : "#4a5270",
        border: "none", cursor: "pointer",
      }}
    >{children}</button>
  );
}

function Sep() {
  return <span style={{ width: "1px", height: "18px", background: "rgba(0,0,0,0.1)", margin: "0 4px", flexShrink: 0 }} />;
}
