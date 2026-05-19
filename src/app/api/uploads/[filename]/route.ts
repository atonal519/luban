import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filepath = join(process.cwd(), 'public', 'uploads', safe);

  if (!existsSync(filepath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const buffer = await readFile(filepath);
  const ext = safe.split('.').pop()?.toLowerCase() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : 'application/octet-stream';

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
