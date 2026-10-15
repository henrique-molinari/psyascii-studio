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

/** Decodifica (orientação EXIF aplicada) e reduz para <= 2048 px. GIF = 1º quadro. */
export async function decodeFile(file: File): Promise<LoadedImage> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
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

/** Imagem de exemplo gerada por código (gradientes, formas e círculos). */
export function generateSample(): LoadedImage {
  const w = 640, h = 400;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0b1e3a'); bg.addColorStop(0.5, '#c0392b'); bg.addColorStop(1, '#f4d03f');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const sun = g.createRadialGradient(w * 0.5, h * 0.45, 4, w * 0.5, h * 0.45, h * 0.38);
  sun.addColorStop(0, '#ffffff'); sun.addColorStop(0.6, '#ffd27a'); sun.addColorStop(1, 'rgba(255,210,122,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6;
  for (let i = 1; i <= 5; i++) { g.beginPath(); g.arc(w * 0.5, h * 0.45, i * 32, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#000';
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 20) g.lineTo(x, h * 0.78 - Math.abs(Math.sin(x * 0.021)) * 70);
  g.lineTo(w, h); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(40, 40, 90, 90);
  g.fillStyle = '#000'; g.fillRect(60, 60, 50, 50);
  return { source: c, w, h };
}

export function setupInput(opts: InputOptions): InputHandle {
  const { dropTarget, onImage, onError } = opts;
  let disposed = false;
  let seq = 0;
  const urls: string[] = [];

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
    } catch {
      if (!disposed) onError('ERRO: não foi possível decodificar a imagem');
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
  const onLeave = () => dropTarget.classList.remove('dragover');
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
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
      dropTarget.removeEventListener('dragleave', onLeave);
      dropTarget.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
      picker.remove();
      for (const u of urls.splice(0)) URL.revokeObjectURL(u);
    },
  };
}
