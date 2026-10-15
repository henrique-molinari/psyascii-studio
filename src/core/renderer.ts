// AsciiRenderer: grade -> warps -> estágios -> glifos -> cor -> desenho (atlas + 'source-in') -> pós.
import { buildAtlas, ensureFont, type Atlas } from './atlas';
import { getRamp, RAIN_GLYPHS } from './charsets';
import { fillCellColors, type ColorFrameCtx } from './color';
import { buildGrid } from './sampler';
import type { Grid, Params, Pipeline, Pointer, WarpEffect } from './types';

const FAMILY = {
  mono: "'JetBrains Mono', ui-monospace, Consolas, monospace",
  kana: "'Kana', 'JetBrains Mono', monospace",
};
const LATIN_RAIN = RAIN_GLYPHS.filter((g) => g.charCodeAt(0) < 0x3000);
const MAX_EXPORT_PX = 16000;

export class AsciiRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pipeline?: Pipeline;
  private layer = document.createElement('canvas');
  private layerCtx: CanvasRenderingContext2D;
  private colorCanvas = document.createElement('canvas');
  private colorCtx: CanvasRenderingContext2D;
  private colorImg: ImageData | null = null;

  private src: CanvasImageSource | null = null;
  private srcW = 0;
  private srcH = 0;
  private srcDirty = true;
  private params: Params | null = null;
  private sampKey = '';
  private grid: Grid | undefined;

  private atlas: Atlas | null = null;
  private atlasKey = '';
  private glyphList: string[] = [];
  private spaceFlag = new Uint8Array(0);
  private rampLen = 1;
  private rainLen = 1;
  private dpr = 1;
  private triedFonts = new Set<string>();

  private fc: ColorFrameCtx | null = null;
  private lumF = new Float32Array(0);
  private glyphIdx = new Int16Array(0);
  private active: WarpEffect[] = [];
  private tmp = new Float32Array(2);
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, pipeline?: Pipeline) {
    this.canvas = canvas;
    const c = canvas.getContext('2d');
    const l = this.layer.getContext('2d');
    const k = this.colorCanvas.getContext('2d');
    if (!c || !l || !k) throw new Error('ERRO: Canvas 2D indisponível');
    this.ctx = c; this.layerCtx = l; this.colorCtx = k;
    this.pipeline = pipeline;
  }

  setSource(src: CanvasImageSource, w: number, h: number): void {
    this.src = src; this.srcW = Math.max(1, w); this.srcH = Math.max(1, h); this.srcDirty = true;
  }
  getSource(): { src: CanvasImageSource; w: number; h: number } | null {
    return this.src ? { src: this.src, w: this.srcW, h: this.srcH } : null;
  }
  /** Força nova amostragem (fonte mutável, ex.: canvas ou vídeo). */
  invalidateSource(): void { this.srcDirty = true; }

  setParams(p: Params): void {
    this.params = p;
    const key = [p.cols, p.cellAspect, p.contrast, p.gamma, p.brightness, p.invert, p.edges, p.dither, p.bgCut].join('|');
    if (key !== this.sampKey) { this.sampKey = key; this.srcDirty = true; }
  }

  private ensureAtlas(p: Params): void {
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const key = [p.charset, p.custom, p.fontSize, p.fontFamily, p.cellAspect, this.dpr].join('|');
    if (key === this.atlasKey && this.atlas) return;
    const family = FAMILY[p.fontFamily];
    let ramp = getRamp(p.charset, p.custom);
    let rain = RAIN_GLYPHS.slice();
    const wantsKana = p.charset === 'katakana' || p.fontFamily === 'kana';
    let atlas = buildAtlas(ramp.concat(rain), family, p.fontSize, p.fontSize * p.cellAspect, p.fontSize, this.dpr);
    if (wantsKana && atlas.fallback) {
      // Fonte kana ausente: tenta carregar uma vez; enquanto isso, usa latim.
      if (!this.triedFonts.has(family)) {
        this.triedFonts.add(family);
        void ensureFont(family, p.fontSize).then((ok) => { if (ok && !this.disposed) this.atlasKey = ''; });
      }
      if (p.charset === 'katakana') ramp = getRamp('classic', '');
      rain = LATIN_RAIN.slice();
      atlas = buildAtlas(ramp.concat(rain), family, p.fontSize, p.fontSize * p.cellAspect, p.fontSize, this.dpr);
    }
    this.atlas = atlas;
    this.atlasKey = key;
    this.glyphList = ramp.concat(rain);
    this.rampLen = ramp.length;
    this.rainLen = rain.length;
    this.spaceFlag = new Uint8Array(this.glyphList.length);
    for (let i = 0; i < this.glyphList.length; i++) this.spaceFlag[i] = this.glyphList[i] === ' ' ? 1 : 0;
    this.canvas.width = 0; // força redimensionamento
  }

  private ensureBuffers(g: Grid, p: Params): ColorFrameCtx {
    const a = this.atlas as Atlas;
    const W = g.cols * a.cellW, H = g.rows * a.cellH;
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W; this.canvas.height = H;
      this.canvas.style.width = `${W / this.dpr}px`;
      this.canvas.style.height = `${H / this.dpr}px`;
      this.layer.width = W; this.layer.height = H;
    }
    let fc = this.fc;
    if (!fc || fc.cols !== g.cols || fc.rows !== g.rows) {
      const n = g.cols * g.rows;
      this.colorCanvas.width = g.cols; this.colorCanvas.height = g.rows;
      this.colorImg = this.colorCtx.createImageData(g.cols, g.rows);
      this.lumF = new Float32Array(n);
      this.glyphIdx = new Int16Array(n);
      fc = {
        params: p, t: 0, dt: 0, grid: g, cols: g.cols, rows: g.rows,
        lum: new Float32Array(n), r: new Uint8ClampedArray(n), g: new Uint8ClampedArray(n),
        b: new Uint8ClampedArray(n), mask: new Uint8Array(n), shift: new Float32Array(n),
        glyphOverride: new Int16Array(n), ptr: { x: 0, y: 0, down: false, active: false },
        colors: (this.colorImg as ImageData).data,
      };
      this.fc = fc;
      this.pipeline?.resize(g.cols, g.rows);
    }
    fc.params = p; fc.grid = g;
    return fc;
  }

  frame(t: number, dt: number, ptr?: Pointer): void {
    const p = this.params;
    if (!p || !this.src || this.disposed) return;
    const live = typeof HTMLVideoElement !== 'undefined' && this.src instanceof HTMLVideoElement;
    if (this.srcDirty || live || !this.grid) {
      this.grid = buildGrid(this.src, this.srcW, this.srcH, p, this.grid);
      this.srcDirty = false;
    }
    this.ensureAtlas(p);
    const g = this.grid, fc = this.ensureBuffers(g, p), a = this.atlas as Atlas;
    fc.t = t; fc.dt = dt;
    if (ptr) { fc.ptr.x = ptr.x; fc.ptr.y = ptr.y; fc.ptr.down = ptr.down; fc.ptr.active = ptr.active; }
    else fc.ptr.active = false;

    // 1) amostragem com warps
    const act = this.active, pl = this.pipeline, tmp = this.tmp, cols = g.cols, rows = g.rows;
    act.length = 0;
    if (pl) for (const w of pl.warps) if (w.enabled(p)) { w.prepare(fc); act.push(w); }
    const mix = p.mix, nw = act.length;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let si = i;
        if (nw > 0) {
          let sx = x, sy = y;
          for (let k = 0; k < nw; k++) { act[k].map(sx, sy, tmp); sx = tmp[0]; sy = tmp[1]; }
          sx = x + (sx - x) * mix; sy = y + (sy - y) * mix;
          let ix = Math.round(sx), iy = Math.round(sy);
          ix = ix < 0 ? 0 : ix >= cols ? cols - 1 : ix;
          iy = iy < 0 ? 0 : iy >= rows ? rows - 1 : iy;
          si = iy * cols + ix;
        }
        fc.lum[i] = g.lum[si]; fc.r[i] = g.r[si]; fc.g[i] = g.g[si]; fc.b[i] = g.b[si]; fc.mask[i] = g.mask[si];
      }
    }
    // 2) estágios de célula
    fc.shift.fill(0); fc.glyphOverride.fill(-1);
    if (pl) for (const s of pl.cellStages) s(fc);
    // 3) glifo e cor
    const n = cols * rows, nr = this.rampLen, idx = this.glyphIdx, lf = this.lumF;
    for (let i = 0; i < n; i++) {
      let l = fc.lum[i] + fc.shift[i];
      l = l < 0 ? 0 : l > 1 ? 1 : l;
      lf[i] = l;
      const go = fc.glyphOverride[i];
      if (go >= 0) idx[i] = nr + (go % this.rainLen);
      else if (!fc.mask[i]) idx[i] = -1;
      else idx[i] = Math.round((1 - l) * (nr - 1));
    }
    const img = this.colorImg as ImageData;
    fillCellColors(fc, lf, img);
    // 4) estágios de cor
    if (pl) for (const s of pl.colorStages) s(fc);
    this.colorCtx.putImageData(img, 0, 0);
    // 5) desenho: glifos brancos na camada, depois cor via source-in (1 px/célula ampliado sem suavização)
    const lc = this.layerCtx, cw = a.cellW, ch = a.cellH, W = this.layer.width, H = this.layer.height;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    const sp = this.spaceFlag;
    for (let i = 0; i < n; i++) {
      const gi = idx[i];
      if (gi < 0 || sp[gi]) continue;
      lc.drawImage(a.canvas, gi * cw, 0, cw, ch, (i % cols) * cw, ((i / cols) | 0) * ch, cw, ch);
    }
    lc.globalCompositeOperation = 'source-in';
    lc.imageSmoothingEnabled = false;
    lc.drawImage(this.colorCanvas, 0, 0, cols, rows, 0, 0, W, H);
    lc.globalCompositeOperation = 'source-over';
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    c.drawImage(this.layer, 0, 0);
    // 6) pós
    if (pl) for (const s of pl.post) s.draw(c, W, H, fc);
  }

  getText(): string {
    const fc = this.fc;
    if (!fc) return '';
    const lines: string[] = [];
    for (let y = 0; y < fc.rows; y++) {
      let s = '';
      for (let x = 0; x < fc.cols; x++) {
        const gi = this.glyphIdx[y * fc.cols + x];
        s += gi < 0 ? ' ' : this.glyphList[gi];
      }
      lines.push(s.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }

  /** Re-renderiza o último quadro em escala 1x/2x/4x (texto vetorial, sem ampliar bitmap). */
  exportCanvas(scale: 1 | 2 | 4): HTMLCanvasElement {
    const out = document.createElement('canvas');
    const fc = this.fc, a = this.atlas, p = this.params, img = this.colorImg;
    if (!fc || !a || !p || !img) { out.width = 1; out.height = 1; return out; }
    const cwB = a.cellW / this.dpr, chB = a.cellH / this.dpr;
    const f = Math.min(1, MAX_EXPORT_PX / (Math.max(fc.cols * cwB, fc.rows * chB) * scale));
    const s = scale * f, cw = cwB * s, ch = chB * s;
    out.width = Math.max(1, Math.round(fc.cols * cw)); out.height = Math.max(1, Math.round(fc.rows * ch));
    const c = out.getContext('2d');
    if (!c) return out;
    c.fillStyle = '#000';
    c.fillRect(0, 0, out.width, out.height);
    c.font = `${p.fontSize * s}px ${FAMILY[p.fontFamily]}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const d = img.data;
    for (let i = 0; i < fc.cols * fc.rows; i++) {
      const gi = this.glyphIdx[i];
      if (gi < 0 || this.spaceFlag[gi]) continue;
      const o = i * 4;
      c.fillStyle = `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`;
      c.fillText(this.glyphList[gi], ((i % fc.cols) + 0.5) * cw, (((i / fc.cols) | 0) + 0.5) * ch + s * 0.5, cw);
    }
    if (this.pipeline) for (const st of this.pipeline.post) st.draw(c, out.width, out.height, fc);
    return out;
  }

  dispose(): void {
    this.disposed = true;
    this.pipeline?.dispose();
    this.src = null; this.grid = undefined; this.atlas = null; this.fc = null; this.colorImg = null;
    this.layer.width = 0; this.layer.height = 0; this.colorCanvas.width = 0; this.colorCanvas.height = 0;
  }
}
