// Estágios de pós-processamento: assets pré-construídos, sem alocação por quadro.
import { bgRemoved, type FrameCtx, type PostStage } from '../core/types';

export interface RevealSource { src: CanvasImageSource; w: number; h: number }
let getRevealSource: (() => RevealSource | null) | null = null;
/** Liga a fonte original ao estágio 'reveal' (ex.: () => renderer.getSource()). */
export function setRevealSource(fn: (() => RevealSource | null) | null): void { getRevealSource = fn; }

type C2 = CanvasRenderingContext2D;
const mk = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

// ---- glow: camada 1/4 reampliada com 'lighter'
let glowCv: HTMLCanvasElement | null = null;
let glowCtx: C2 | null = null;
const glow: PostStage = {
  id: 'glow',
  draw(c, w, h, ctx) {
    const s = ctx.params.post.glow;
    if (!s.on || s.amt <= 0) return;
    const sw = Math.max(1, Math.ceil(w / 4)), sh = Math.max(1, Math.ceil(h / 4));
    if (!glowCv) { glowCv = mk(sw, sh); glowCtx = glowCv.getContext('2d'); }
    if (!glowCtx) return;
    if (glowCv.width !== sw || glowCv.height !== sh) { glowCv.width = sw; glowCv.height = sh; }
    const g = glowCtx;
    g.globalCompositeOperation = 'copy';
    g.imageSmoothingEnabled = true;
    g.drawImage(c.canvas, 0, 0, w, h, 0, 0, sw, sh);
    g.globalCompositeOperation = 'source-over';
    c.save();
    c.globalCompositeOperation = bgRemoved(ctx.params) ? 'source-atop' : 'lighter';
    c.globalAlpha = Math.min(1, s.amt * 0.9);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(glowCv, 0, 0, sw, sh, 0, 0, w, h);
    c.restore();
  },
};

// ---- scan: padrão de linhas CRT (período de 4 px)
let scanPat: CanvasPattern | null = null;
const scan: PostStage = {
  id: 'scan',
  draw(c, w, h, ctx) {
    const s = ctx.params.post.scan;
    if (!s.on || s.amt <= 0) return;
    if (!scanPat) {
      const t = mk(1, 4), g = t.getContext('2d');
      if (!g) return;
      g.fillStyle = '#000';
      g.fillRect(0, 0, 1, 2);
      scanPat = c.createPattern(t, 'repeat');
      if (!scanPat) return;
    }
    c.save();
    if (bgRemoved(ctx.params)) c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = Math.min(1, s.amt * 0.55);
    c.fillStyle = scanPat;
    c.fillRect(0, 0, w, h);
    c.restore();
  },
};

// ---- vignette: gradiente radial 256x256 pré-renderizado, esticado
let vigCv: HTMLCanvasElement | null = null;
const vignette: PostStage = {
  id: 'vignette',
  draw(c, w, h, ctx) {
    const s = ctx.params.post.vignette;
    if (!s.on || s.amt <= 0) return;
    if (!vigCv) {
      vigCv = mk(256, 256);
      const g = vigCv.getContext('2d');
      if (!g) { vigCv = null; return; }
      const gr = g.createRadialGradient(128, 128, 128 * 0.35, 128, 128, 128 * 1.42);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
    }
    c.save();
    if (bgRemoved(ctx.params)) c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = Math.min(1, s.amt);
    c.imageSmoothingEnabled = true;
    c.drawImage(vigCv, 0, 0, 256, 256, 0, 0, w, h);
    c.restore();
  },
};

// ---- grain: tile de ruído 128x128; offset muda no máx. 3 Hz, amplitude baixa
const TILE = 128;
let grainPat: CanvasPattern | null = null;
let gOx = 0, gOy = 0, gLast = -1;
let seedState = 0x9e3779b9;
const rnd = (): number => {
  seedState ^= seedState << 13; seedState >>>= 0;
  seedState ^= seedState >>> 17;
  seedState ^= seedState << 5; seedState >>>= 0;
  return seedState / 4294967296;
};
const grain: PostStage = {
  id: 'grain',
  draw(c, w, h, ctx) {
    const s = ctx.params.post.grain;
    if (!s.on || s.amt <= 0) return;
    if (!grainPat) {
      const t = mk(TILE, TILE), g = t.getContext('2d');
      if (!g) return;
      const img = g.createImageData(TILE, TILE), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = rnd() * 255;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainPat = c.createPattern(t, 'repeat');
      if (!grainPat) return;
    }
    const t = ctx.t;
    if (gLast < 0 || t < gLast || t - gLast >= 1 / 3) {
      gLast = t; gOx = (rnd() * TILE) | 0; gOy = (rnd() * TILE) | 0;
    }
    c.save();
    c.globalAlpha = Math.min(0.2, s.amt * 0.2);
    c.globalCompositeOperation = bgRemoved(ctx.params) ? 'source-atop' : 'overlay';
    c.translate(gOx, gOy);
    c.fillStyle = grainPat;
    c.fillRect(-gOx, -gOy, w, h);
    c.restore();
  },
};

// ---- reveal: imagem original em círculo ao redor do ponteiro
const reveal: PostStage = {
  id: 'reveal',
  draw(c, w, h, ctx: FrameCtx) {
    const p = ctx.params;
    if (p.interact !== 'reveal' || !ctx.ptr.active || !getRevealSource) return;
    const rs = getRevealSource();
    if (!rs) return;
    const r = p.interactRadius * (w / Math.max(1, ctx.cols));
    c.save();
    if (bgRemoved(p)) c.globalCompositeOperation = 'source-atop';
    c.beginPath();
    c.arc(ctx.ptr.x * w, ctx.ptr.y * h, r, 0, Math.PI * 2);
    c.clip();
    c.imageSmoothingEnabled = true;
    c.drawImage(rs.src, 0, 0, rs.w, rs.h, 0, 0, w, h);
    c.restore();
  },
};

/** Zera estado de módulo (chamado em dispose do pipeline). */
export function resetPost(): void {
  glowCv = null; glowCtx = null; scanPat = null; vigCv = null; grainPat = null;
  gOx = 0; gOy = 0; gLast = -1; getRevealSource = null;
}

export const postStages: PostStage[] = [glow, reveal, scan, vignette, grain];
