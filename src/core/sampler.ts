// Amostragem da imagem em grade de células: luminância, tom, bordas, dither e máscara de fundo.
import type { Grid, Params } from './types';
import { applyTone, backgroundMask, ditherOrdered, fillLuminance, mixEdges, sobel } from './tone';

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// Buffers de trabalho reutilizados entre chamadas.
let scratch: AnyCanvas | null = null;
let scratchCtx: Ctx2D | null = null;
let image: ImageData | null = null;
let edgeBuf = new Float32Array(0);

/** Número de linhas para a imagem srcW×srcH com `cols` colunas e proporção de célula (largura/altura). */
export function rowsFor(cols: number, srcW: number, srcH: number, cellAspect: number): number {
  const r = Math.round(cols * (srcH / Math.max(1, srcW)) * cellAspect);
  return Math.max(1, Math.min(600, r));
}

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function getScratch(w: number, h: number): Ctx2D | null {
  if (!scratch || !scratchCtx) {
    scratch = makeCanvas(w, h);
    scratchCtx = scratch.getContext('2d', { willReadFrequently: true }) as Ctx2D | null;
  } else if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  if (scratchCtx) {
    scratchCtx.imageSmoothingEnabled = true;
    scratchCtx.imageSmoothingQuality = 'high';
  }
  return scratchCtx;
}

function emptyGrid(cols: number, rows: number): Grid {
  const n = cols * rows;
  return {
    cols, rows, lum: new Float32Array(n),
    r: new Uint8ClampedArray(n), g: new Uint8ClampedArray(n), b: new Uint8ClampedArray(n),
    mask: new Uint8Array(n),
  };
}

/**
 * Reduz `src` a cols×rows e calcula lum/r/g/b/mask. Reutiliza `grid` quando as dimensões coincidem.
 * Ordem: luminância -> máscara de fundo (sobre o valor cru) -> tom -> bordas -> dither.
 */
export function buildGrid(src: CanvasImageSource, srcW: number, srcH: number, params: Params, grid?: Grid): Grid {
  const cols = Math.max(1, Math.round(params.cols));
  const rows = rowsFor(cols, srcW, srcH, params.cellAspect);
  const n = cols * rows;
  const g = grid && grid.cols === cols && grid.rows === rows ? grid : emptyGrid(cols, rows);

  const c = getScratch(cols, rows);
  if (!c) {
    g.lum.fill(0); g.r.fill(0); g.g.fill(0); g.b.fill(0); g.mask.fill(1);
    return g;
  }
  c.clearRect(0, 0, cols, rows);
  c.drawImage(src, 0, 0, srcW, srcH, 0, 0, cols, rows);
  if (!image || image.width !== cols || image.height !== rows) image = c.getImageData(0, 0, cols, rows);
  else {
    const fresh = c.getImageData(0, 0, cols, rows);
    image.data.set(fresh.data);
  }

  fillLuminance(image.data, n, g.lum, g.r, g.g, g.b);
  backgroundMask(g.lum, n, params.bgCut, g.mask);
  applyTone(g.lum, n, params.contrast, params.gamma, params.brightness, params.invert);

  if (params.edges > 0) {
    if (edgeBuf.length < n) edgeBuf = new Float32Array(n);
    sobel(g.lum, cols, rows, edgeBuf);
    mixEdges(g.lum, edgeBuf, n, params.edges);
  }
  if (params.dither) ditherOrdered(g.lum, cols, rows, 6);
  return g;
}

/** Libera os buffers de trabalho (opcional, ao descartar a aplicação). */
export function disposeSampler(): void {
  scratch = null;
  scratchCtx = null;
  image = null;
  edgeBuf = new Float32Array(0);
}
