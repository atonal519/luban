import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import sharp from 'sharp';
import { join } from 'path';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar', '7z', 'csv']);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '没有文件' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(new Uint8Array(bytes));
    const isImage = file.type.startsWith('image/');

    // 非图片时校验扩展名白名单
    const rawExt = (file.name.split('.').pop() || '').toLowerCase();
    if (!isImage && !ALLOWED_EXTENSIONS.has(rawExt)) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
    }

    const ext = isImage ? 'webp' : rawExt;
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const dir = join(process.cwd(), 'public', 'uploads');
    await mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);

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
  } catch {
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
