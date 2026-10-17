// Atlas de glifos: 1 linha, glifos brancos sobre transparente, desenhados UMA vez.

export interface Atlas {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Tamanho da célula em pixels do atlas (CSS px * dpr, arredondado). */
  cellW: number;
  cellH: number;
  /** glifo -> posição (coluna) no atlas. */
  index: Map<string, number>;
  /** true se a fonte pedida não está disponível (usa fonte do sistema). */
  fallback: boolean;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fontSpec(fontFamily: string, px: number): string {
  return `${px}px ${fontFamily}`;
}

/** Carrega a fonte (assíncrono). Retorna false se falhar. Chame antes de buildAtlas. */
export async function ensureFont(fontFamily: string, fontPx: number, sample = 'アA0'): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts) return false;
  try {
    const faces = await document.fonts.load(fontSpec(fontFamily, fontPx), sample);
    return faces.length > 0 && document.fonts.check(fontSpec(fontFamily, fontPx), sample);
  } catch {
    return false;
  }
}

function fontAvailable(fontFamily: string, fontPx: number, glyphs: readonly string[]): boolean {
  if (typeof document === 'undefined' || !document.fonts) return false;
  try {
    return document.fonts.check(fontSpec(fontFamily, fontPx), glyphs.slice(0, 8).join(''));
  } catch {
    return false;
  }
}

export function buildAtlas(
  glyphs: readonly string[], fontFamily: string, fontPx: number, cellW: number, cellH: number, dpr: number,
): Atlas {
  const d = Math.max(0.25, Math.min(2, dpr || 1));
  const cw = Math.max(1, Math.round(cellW * d));
  const ch = Math.max(1, Math.round(cellH * d));
  const list = glyphs.length ? glyphs : [' '];
  const canvas = makeCanvas(cw * list.length, ch);
  const ctx = canvas.getContext('2d') as Ctx2D | null;
  const index = new Map<string, number>();
  const fallback = !fontAvailable(fontFamily, fontPx, list);
  if (!ctx) return { canvas, cellW: cw, cellH: ch, index, fallback: true };
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontSpec(fontFamily, fontPx * d);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (!index.has(g)) index.set(g, i);
    if (g !== ' ') ctx.fillText(g, i * cw + cw / 2, ch / 2 + d * 0.5, cw);
  }
  return { canvas, cellW: cw, cellH: ch, index, fallback };
}
