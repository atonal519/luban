const fs = require('fs');
const path = require('path');

const AUTH_CHECK = `  const _userId = req.cookies.get('userId')?.value;
  if (!_userId) return NextResponse.json({ error: '未登录' }, { status: 401 });\n\n`;

// Routes to skip (auth routes already handle their own logic)
const SKIP = [
  'auth/login', 'auth/logout', 'auth/me', 'auth/change-password',
];

const API_DIR = 'src/app/api';

function processFile(filePath) {
  const rel = filePath.replace(API_DIR + '/', '');
  if (SKIP.some(s => rel.includes(s))) {
    console.log('SKIP:', rel);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Find all export async function handlers
  const fns = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
  let modified = false;

  for (const fn of fns) {
    const pattern = new RegExp(`export async function ${fn}\\s*\\(\\s*req:\\s*NextRequest`, 'g');
    if (!pattern.test(content)) continue;

    // Check if already has auth check
    const afterFn = content.split(`export async function ${fn}`)[1];
    if (!afterFn) continue;

    // Find the opening brace of the function body
    const braceIdx = afterFn.indexOf('{');
    if (braceIdx === -1) continue;

    const bodyStart = content.indexOf(`export async function ${fn}`);
    const absoluteBrace = bodyStart + content.slice(bodyStart).indexOf('{') + 1;

    // Check if already has userId check nearby
    const nextChunk = content.slice(absoluteBrace, absoluteBrace + 300);
    if (nextChunk.includes('userId') || nextChunk.includes('cookie')) {
      console.log(`  ${fn} already has auth in ${rel}`);
      continue;
    }

    // Insert auth check after opening brace
    content = content.slice(0, absoluteBrace + 1) + '\n' + AUTH_CHECK + content.slice(absoluteBrace + 1);
    modified = true;
    console.log(`  + ${fn} auth added to ${rel}`);
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full);
    else if (entry.name === 'route.ts') processFile(full);
  }
}

walkDir(API_DIR);
console.log('\nDone!');
