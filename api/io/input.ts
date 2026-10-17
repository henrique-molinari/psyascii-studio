// Entrada de imagem: arrastar/soltar, seletor, colar e imagem de exemplo. 100% local.
import { MAX_IMAGE_PX } from '../core/types';

export interface LoadedImage { source: CanvasImageSource; w: number; h: number }
export interface InputOptions {
  dropTarget: HTMLElement;
  onImage(img: LoadedImage): void;
  onError(msg: string): void;
}
export interface InputHandle {
  openPicker(): void;
  loadSample(): LoadedImage;
  loadFile(file: File): Promise<void>;
  dispose(): void;
}

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_PIXELS = 100_000_000; // 100 MP
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Valida tipo e tamanho; devolve mensagem de erro ou null. */
export function validateFile(file: File): string | null {
  if (!TYPES.includes(file.type)) return 'ERRO: arquivo inválido (use PNG, JPG, WebP, GIF ou BMP)';
  if (file.size === 0) return 'ERRO: arquivo vazio';
  if (file.size > MAX_BYTES) return 'ERRO: arquivo maior que 25 MB';
  return null;
}

/** Lê largura/altura do cabeçalho (PNG, JPEG, GIF, WebP, BMP) sem decodificar; null se ilegível. */
export function readDims(b: Uint8Array): { w: number; h: number } | null {
  const n = b.length;
  const u16 = (o: number) => (b[o] << 8) | b[o + 1];
  const l16 = (o: number) => b[o] | (b[o + 1] << 8);
  const u32 = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const l32 = (o: number) => ((b[o + 3] << 24) | (b[o + 2] << 16) | (b[o + 1] << 8) | b[o]) | 0;
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) return false; return true; };
  let r: { w: number; h: number } | null = null;
  if (n >= 24 && b[0] === 0x89 && str(1, 'PNG')) {
    r = { w: u32(16), h: u32(20) };
  } else if (n >= 10 && str(0, 'GIF8')) {
    r = { w: l16(6), h: l16(8) };
  } else if (n >= 26 && b[0] === 0x42 && b[1] === 0x4d) {
    r = { w: Math.abs(l32(18)), h: Math.abs(l32(22)) };
  } else if (n >= 30 && str(0, 'RIFF') && str(8, 'WEBP')) {
    if (str(12, 'VP8X')) r = { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    else if (str(12, 'VP8L') && b[20] === 0x2f) {
      r = { w: 1 + (b[21] | ((b[22] & 0x3f) << 8)), h: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)) };
    } else if (str(12, 'VP8 ')) r = { w: l16(26) & 0x3fff, h: l16(28) & 0x3fff };
  } else if (n >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < n) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m === 0xff) { o++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { r = { w: u16(o + 7), h: u16(o + 5) }; break; }
      o += 2 + u16(o + 2);
    }
  }
  return r && r.w > 0 && r.h > 0 ? r : null;
}

/** Decodifica (orientação EXIF aplicada) e reduz para <= 2048 px. GIF = 1º quadro. */
export async function decodeFile(file: File): Promise<LoadedImage> {
  const head = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
  const dims = readDims(head);
  if (!dims) throw new Error('ERRO: arquivo inválido (cabeçalho de imagem ilegível)');
  if (dims.w * dims.h > MAX_PIXELS) throw new Error('ERRO: imagem maior que 100 megapixels');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  if (bmp.width * bmp.height > MAX_PIXELS) { bmp.close(); throw new Error('ERRO: imagem maior que 100 megapixels'); }
  const scale = Math.min(1, MAX_IMAGE_PX / Math.max(bmp.width, bmp.height));
  if (scale >= 1) return { source: bmp, w: bmp.width, h: bmp.height };
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  if (!ctx) { bmp.close(); throw new Error('canvas'); }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { source: c, w, h };
}

/** Imagem de exemplo "Matrix": palavra sobre chuva digital verde, gerada por código. */
export function generateSample(): LoadedImage {
  const w = 640, h = 400;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789:.=*+-<>';
  let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  g.font = '16px monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let x = 8; x < w; x += 16) {
    const len = 8 + Math.floor(rnd() * 18), y0 = Math.floor(rnd() * h) - len * 16;
    for (let i = 0; i < len; i++) {
      const y = y0 + i * 16;
      if (y < -16 || y > h) continue;
      const k = (i + 1) / len;
      g.fillStyle = i === len - 1 ? '#d6ffe0' : `rgba(0,255,65,${(0.15 + 0.85 * k * k).toFixed(2)})`;
      g.fillText(glyphs[Math.floor(rnd() * glyphs.length)], x, y);
    }
  }
  g.font = 'bold 120px monospace'; g.textBaseline = 'middle';
  g.shadowColor = '#000'; g.shadowBlur = 36;
  g.fillStyle = '#000'; for (let i = 0; i < 4; i++) g.fillText('MATRIX', w / 2, h / 2);
  g.shadowBlur = 0; g.fillStyle = '#eaffee'; g.fillText('MATRIX', w / 2, h / 2);
  return { source: c, w, h };
}

export function setupInput(opts: InputOptions): InputHandle {
  const { dropTarget, onImage, onError } = opts;
  let disposed = false;
  let seq = 0;
  let dragDepth = 0;

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = TYPES.join(',');
  picker.hidden = true;
  document.body.appendChild(picker);

  async function loadFile(file: File): Promise<void> {
    const err = validateFile(file);
    if (err) { onError(err); return; }
    const id = ++seq;
    try {
      const img = await decodeFile(file);
      if (disposed || id !== seq) { if (img.source instanceof ImageBitmap) img.source.close(); return; }
      onImage(img);
    } catch (e) {
      if (!disposed) onError(e instanceof Error && e.message.startsWith('ERRO') ? e.message : 'ERRO: não foi possível decodificar a imagem');
    }
  }

  const onPick = () => {
    const f = picker.files?.[0];
    picker.value = '';
    if (f) void loadFile(f);
  };
  const onOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    dropTarget.classList.add('dragover');
  };
  const onEnter = (e: DragEvent) => { e.preventDefault(); dragDepth++; dropTarget.classList.add('dragover'); };
  const onLeave = () => { dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) dropTarget.classList.remove('dragover'); };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth = 0;
    dropTarget.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0];
    if (f) void loadFile(f);
    else onError('ERRO: solte um arquivo de imagem');
  };
  const onPaste = (e: ClipboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) { e.preventDefault(); void loadFile(f); return; }
      }
    }
  };

  picker.addEventListener('change', onPick);
  dropTarget.addEventListener('dragover', onOver);
  dropTarget.addEventListener('dragenter', onEnter);
  dropTarget.addEventListener('dragleave', onLeave);
  dropTarget.addEventListener('drop', onDrop);
  window.addEventListener('paste', onPaste);
  // Impede o navegador de abrir o arquivo se soltar fora da área.
  const stop = (e: DragEvent) => e.preventDefault();
  window.addEventListener('dragover', stop);
  window.addEventListener('drop', stop);

  return {
    openPicker: () => picker.click(),
    loadSample: generateSample,
    loadFile,
    dispose() {
      disposed = true;
      picker.removeEventListener('change', onPick);
      dropTarget.removeEventListener('dragover', onOver);
      dropTarget.removeEventListener('dragenter', onEnter);
      dropTarget.removeEventListener('dragleave', onLeave);
      dropTarget.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
      picker.remove();
    },
  };
}
