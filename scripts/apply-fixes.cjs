const fs = require('fs');

// 1. drawer.tsx: fix paste handler to use native input setter
let d = fs.readFileSync('src/components/drawer.tsx', 'utf8');

// Add logTextareaRef + setLogImagesRef + useEffect paste handler
const oldPaste = `  const logTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    function handleGlobalPaste(e: ClipboardEvent) {
      if (!logTextareaRef.current) return;
      const focused = document.activeElement;
      if (focused !== logTextareaRef.current) return;
      const files = Array.from(e.clipboardData?.files || []);
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      e.preventDefault();
      imageFiles.forEach(file => {
        const fd = new FormData();
        fd.append('file', file);
        fetch('/api/upload', { method: 'POST', body: fd })
          .then(res => res.json())
          .then(data => { if (data.url) setLogImages(prev => [...prev, data.url]); });
      });
    }
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);`;

const newPaste = `  const logTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    function handleGlobalPaste(e: ClipboardEvent) {
      if (!logTextareaRef.current) return;
      const files = Array.from(e.clipboardData?.files || []);
      const imageFiles = files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      e.preventDefault();
      imageFiles.forEach(file => {
        const fd = new FormData();
        fd.append('file', file);
        fetch('/api/upload', { method: 'POST', body: fd })
          .then(res => res.json())
          .then(data => {
            if (data.url) {
              const ta = logTextareaRef.current;
              if (ta) {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (setter) {
                  setter.call(ta, ta.value + ' [图片](' + data.url + ')');
                  ta.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }
            }
          });
      });
    }
    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, []);`;

if (d.includes(oldPaste)) {
  d = d.replace(oldPaste, newPaste);
  console.log('drawer paste handler: replaced');
} else {
  console.log('drawer paste handler: old pattern not found, skipping');
}

// 2. Add ref to textarea
d = d.replace(
  '          <textarea\n            value={logContent}',
  '          <textarea\n            ref={logTextareaRef}\n            value={logContent}'
);

// 3. Update placeholder
d = d.replace(
  'placeholder="记录今日进展… (Enter 提交, Shift+Enter 换行)"',
  'placeholder="记录今日进展… (Enter 提交, Shift+Enter 换行, Ctrl+V 粘贴图片)"'
);

// 4. Render [图片](url) as images in log display
d = d.replace(
  '<div className="text-[12px] text-[var(--txt-1)] leading-relaxed whitespace-pre-wrap">{log.content}</div>',
  `<div className="text-[12px] text-[var(--txt-1)] leading-relaxed whitespace-pre-wrap">
                    {log.content.split(/(\\[图片\\]\\([^)]+\\))/g).map((part, i) => {
                      const m = part.match(/^\\[图片\\]\\(([^)]+)\\)$/);
                      if (m) return <img key={i} src={m[1]} alt="附图" className="max-w-[200px] max-h-[150px] rounded border border-[var(--line-2)] cursor-pointer mt-1 block" onClick={() => window.open(m[1], '_blank')} />;
                      return part;
                    })}
                  </div>`
);

fs.writeFileSync('src/components/drawer.tsx', d);

// 5. upload/route.ts: add sharp compression
let u = fs.readFileSync('src/app/api/upload/route.ts', 'utf8');
if (!u.includes('sharp')) {
  u = u.replace(
    "import { writeFile } from 'fs/promises';",
    "import { writeFile } from 'fs/promises';\nimport sharp from 'sharp';"
  );
  u = u.replace(
    'const bytes = await file.arrayBuffer();\n  const buffer = Buffer.from(bytes);',
    `const bytes = await file.arrayBuffer();
  const inputBuffer = Buffer.from(new Uint8Array(bytes));
  const isImage = file.type.startsWith('image/');`
  );
  u = u.replace(
    "const ext = file.name.split('.').pop() || 'png';",
    "const ext = isImage ? 'webp' : (file.name.split('.').pop() || 'bin');"
  );
  u = u.replace(
    'await writeFile(filepath, buffer);',
    `let outputBuffer: Buffer = inputBuffer;
  if (isImage) {
    const compressed = await sharp(inputBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    outputBuffer = compressed as unknown as Buffer;
  }
  await writeFile(filepath, outputBuffer);`
  );
  fs.writeFileSync('src/app/api/upload/route.ts', u);
  console.log('upload: sharp compression added');
} else {
  console.log('upload: sharp already present');
}

// 6. middleware.ts: allow /api/uploads
let m = fs.readFileSync('src/middleware.ts', 'utf8');
if (!m.includes('/api/uploads')) {
  m = m.replace(
    "pathname.startsWith('/api/auth')",
    "pathname.startsWith('/api/auth') ||\n    pathname.startsWith('/api/uploads')"
  );
  fs.writeFileSync('src/middleware.ts', m);
  console.log('middleware: /api/uploads allowed');
} else {
  console.log('middleware: already allows /api/uploads');
}

console.log('All done!');
