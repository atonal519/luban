const fs = require('fs');

// Fix board.tsx: WebkitLineClamp 2 -> 3
let board = fs.readFileSync('src/components/board.tsx', 'utf8');
board = board.replace('WebkitLineClamp: 2,', 'WebkitLineClamp: 3,');
board = board.replace("WebkitLineClamp:2,", 'WebkitLineClamp: 3,');
fs.writeFileSync('src/components/board.tsx', board);
console.log('board fixed, LineClamp:', board.includes('WebkitLineClamp: 3') ? '3 OK' : 'FAIL');

// Fix editable-cell.tsx: add multiline support
let cell = fs.readFileSync('src/components/editable-cell.tsx', 'utf8');

// Add multiline to type
cell = cell.replace(
  "  type?: \"text\" | \"select\";",
  "  type?: \"text\" | \"select\";\n  multiline?: boolean;"
);

// Add multiline to destructuring
cell = cell.replace(
  "  type = \"text\",\n  options,",
  "  type = \"text\",\n  multiline = false,\n  options,"
);

// Add textarea block before final return
const textareaBlock = `
  if (multiline) {
    return (
      <textarea
        autoFocus
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setEditValue(value); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        rows={3}
        className="w-full px-1.5 py-1 rounded border border-[var(--accent)] bg-[var(--bg-2)] text-[13px] outline-none resize-none"
      />
    );
  }

  return (
    <input`;

cell = cell.replace(
  "\n  return (\n    <input",
  textareaBlock
);

fs.writeFileSync('src/components/editable-cell.tsx', cell);
console.log('editable-cell fixed, multiline:', cell.includes('multiline') ? 'OK' : 'FAIL');
