import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import sharp from 'sharp';
import { join } from 'path';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: '没有文件' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Generate unique filename
  const ext = isImage ? 'webp' : (file.name.split('.').pop() || 'bin');
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filepath = join(process.cwd(), 'public', 'uploads', filename);

  let outputBuffer: Buffer = inputBuffer;
  if (isImage) {
    const compressed = await sharp(inputBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    outputBuffer = compressed as unknown as Buffer;
  }
  await writeFile(filepath, outputBuffer);

  return NextResponse.json({ url: `/api/uploads/${filename}` }, { status: 201 });
}
