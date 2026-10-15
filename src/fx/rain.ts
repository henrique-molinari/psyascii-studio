// RainEngine: chuva digital em canvas com atlas pré-renderizado (sem fillText por quadro).
import { RAIN_GLYPHS } from '../core/charsets';

const FAMILY = "'Kana', 'JetBrains Mono', monospace";
const GREEN = '#00ff41';
const HEAD = '#d6ffe0';

export interface RainOptions { fontSize: number; reduced: boolean }

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class RainEngine {
  private fs: number;
  private reduced: boolean;
  private canvas: HTMLCanvasElement | null = null;
  private c: CanvasRenderingContext2D | null = null;
  private atlas: HTMLCanvasElement | null = null;
  private glyphs: string[] = [];
  private kanaOk = false;
  private fontTried = false;
  private disposed = false;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;
  private cw = 0; // largura da célula em px do dispositivo
  private ch = 0;
  private cols = 0;
  private rows = 0;
  private head = new Float32Array(0);
  private speed = new Float32Array(0);
  private len = new Float32Array(0);
  private stag = new Float32Array(0);
  private cell = new Uint8Array(0);
  private reveal = 0;
  private opacity = 1;
  private swapAcc = 0;

  constructor(opts: RainOptions) {
    this.fs = Math.max(8, Math.min(48, opts.fontSize || 16));
    this.reduced = !!opts.reduced;
  }

  static columnsFor(w: number, fontSize: number, mobile: boolean): number {
    const colW = fontSize * (mobile ? 1.5 : 1);
    return Math.max(1, Math.floor(w / colW));
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    if (!this.c) throw new Error('ERRO: Canvas 2D indisponível');
    if (this.cssW > 0) this.resize(this.cssW, this.cssH, this.dpr);
  }

  private loadFont(): void {
    if (this.fontTried || typeof document === 'undefined' || !document.fonts) return;
    this.fontTried = true;
    const spec = `${this.fs}px ${FAMILY}`;
    document.fonts.load(spec, 'ア').then((faces) => {
      if (this.disposed || faces.length === 0) return;
      this.kanaOk = true;
      this.buildAtlas();
    }).catch(() => { this.kanaOk = false; });
  }

  private buildAtlas(): void {
    const list = this.kanaOk ? RAIN_GLYPHS : RAIN_GLYPHS.filter((g) => g.charCodeAt(0) < 12288);
    this.glyphs = list.slice();
    const n = this.glyphs.length;
    const a = this.atlas ?? document.createElement('canvas');
    a.width = this.cw * n;
    a.height = this.ch * 2;
    const x = a.getContext('2d');
    if (!x) return;
    x.clearRect(0, 0, a.width, a.height);
    x.font = `${this.fs * this.dpr}px ${FAMILY}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let r = 0; r < 2; r++) {
      x.fillStyle = r === 0 ? GREEN : HEAD;
      for (let i = 0; i < n; i++) x.fillText(this.glyphs[i], i * this.cw + this.cw / 2, r * this.ch + this.ch / 2, this.cw);
    }
    this.atlas = a;
    for (let i = 0; i < this.cell.length; i++) this.cell[i] = (Math.random() * n) | 0;
  }

  private respawn(i: number, initial: boolean): void {
    this.speed[i] = 6 + Math.random() * 16;
    this.len[i] = 8 + Math.random() * 20;
    this.head[i] = initial ? Math.random() * (this.rows + this.len[i]) : -Math.random() * this.rows * 0.5;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = Math.max(1, Math.min(2, dpr || 1));
    const mobile = this.cssW < 600;
    this.cols = RainEngine.columnsFor(this.cssW, this.fs, mobile);
    const colW = this.cssW / this.cols;
    this.cw = Math.max(1, Math.round(colW * this.dpr));
    this.ch = Math.max(1, Math.round(this.fs * 1.15 * this.dpr));
    this.rows = Math.max(1, Math.ceil((this.cssH * this.dpr) / this.ch));
    const cv = this.canvas;
    if (cv) {
      cv.width = this.cw * this.cols;
      cv.height = this.ch * this.rows;
      cv.style.width = `${this.cssW}px`;
      cv.style.height = `${this.cssH}px`;
    }
    this.head = new Float32Array(this.cols);
    this.speed = new Float32Array(this.cols);
    this.len = new Float32Array(this.cols);
    this.stag = new Float32Array(this.cols);
    this.cell = new Uint8Array(this.cols * this.rows);
    for (let i = 0; i < this.cols; i++) { this.respawn(i, true); this.stag[i] = Math.random(); }
    this.buildAtlas();
    this.loadFont();
    if (this.reduced) this.draw();
  }

  step(dt: number): void {
    if (this.reduced || this.disposed || this.cols === 0 || (typeof document !== 'undefined' && document.hidden)) return;
    const d = Math.min(0.1, Math.max(0, dt));
    for (let i = 0; i < this.cols; i++) {
      this.head[i] += this.speed[i] * d;
      if (this.head[i] - this.len[i] > this.rows) this.respawn(i, false);
    }
    const n = this.glyphs.length;
    if (n === 0) return;
    this.swapAcc += d * this.cols * this.rows * 0.3;
    while (this.swapAcc >= 1) {
      this.cell[(Math.random() * this.cell.length) | 0] = (Math.random() * n) | 0;
      this.swapAcc -= 1;
    }
  }

  draw(): void {
    const c = this.c, a = this.atlas, cv = this.canvas;
    if (!c || !a || !cv || this.disposed || (typeof document !== 'undefined' && document.hidden)) return;
    c.globalAlpha = 1;
    c.clearRect(0, 0, cv.width, cv.height);
    const { cols, rows, cw, ch, reveal, opacity } = this;
    const hideBase = reveal * rows * 1.4;
    for (let col = 0; col < cols; col++) {
      const hy = Math.floor(this.head[col]);
      const len = Math.ceil(this.len[col]);
      const hide = hideBase - this.stag[col] * rows * 0.4;
      for (let k = 0; k < len; k++) {
        const y = hy - k;
        if (y < 0 || y >= rows || y < hide) continue;
        const f = 1 - k / len;
        c.globalAlpha = (k === 0 ? 1 : f * f) * opacity;
        const gi = this.cell[y * cols + col];
        c.drawImage(a, gi * cw, k === 0 ? ch : 0, cw, ch, col * cw, y * ch, cw, ch);
      }
    }
    c.globalAlpha = 1;
  }

  /** 0 = tudo visível; 1 = colunas esvaziadas, de cima para baixo. */
  setReveal(p: number): void { this.reveal = Math.min(1, Math.max(0, p || 0)); }
  setOpacity(a: number): void { this.opacity = Math.min(1, Math.max(0, a ?? 1)); }

  /** Intensidade 0..1 por célula (sem estado, sem alocação), para o efeito 'rain'. */
  fillField(cols: number, rows: number, out: Float32Array, t: number): void {
    const span = rows + 30;
    for (let x = 0; x < cols; x++) {
      const sp = 4 + hash(x * 3 + 1) * 10;
      const len = 6 + hash(x * 3 + 2) * 14;
      const head = (t * sp + hash(x * 3 + 3) * span) % span;
      for (let y = 0; y < rows; y++) {
        const d = head - y;
        const dd = d < 0 ? d + span : d;
        out[y * cols + x] = dd < len ? (dd < 1 ? 1 : (1 - dd / len) * (1 - dd / len)) : 0;
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.canvas) { this.canvas.width = 0; this.canvas.height = 0; }
    if (this.atlas) { this.atlas.width = 0; this.atlas.height = 0; }
    this.canvas = null; this.c = null; this.atlas = null;
    this.head = new Float32Array(0); this.cell = new Uint8Array(0);
  }
}
