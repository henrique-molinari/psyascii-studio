// Efeitos de distorção (WarpEffect): mapeiam a célula de destino para a célula de origem.
import type { EffectId, FrameCtx, Params, WarpEffect } from '../core/types';

interface S { cols: number; rows: number; cx: number; cy: number; asp: number; t: number; amt: number; sp: number; n: number; px: number; py: number; R: number; on: boolean }
type MapFn = (s: S, x: number, y: number, out: Float32Array) => void;

const TAU = Math.PI * 2;

function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function make(id: EffectId | 'interact', enabled: (p: Params) => boolean, amtId: EffectId, map: MapFn): WarpEffect {
  const s: S = { cols: 1, rows: 1, cx: 0, cy: 0, asp: 0.5, t: 0, amt: 0, sp: 0, n: 6, px: 0, py: 0, R: 1, on: false };
  return {
    id,
    enabled,
    prepare(ctx: FrameCtx): void {
      const p = ctx.params, f = p.fx[amtId];
      s.cols = ctx.cols; s.rows = ctx.rows; s.cx = ctx.cols / 2; s.cy = ctx.rows / 2;
      s.asp = p.cellAspect; s.t = ctx.t; s.amt = f.amt; s.sp = 0.2 + f.speed * 2.5; s.n = id === 'interact' ? (p.interact === 'repel' ? 1 : p.interact === 'attract' ? 2 : 3) : p.kaleidoN;
      s.R = p.interactRadius;
      s.on = ctx.ptr.active;
      s.px = ctx.ptr.x * ctx.cols; s.py = ctx.ptr.y * ctx.rows;
    },
    map(x: number, y: number, out: Float32Array): void { map(s, x, y, out); },
  };
}

const on = (id: EffectId) => (p: Params) => p.fx[id].on;

const warp = make('warp', on('warp'), 'warp', (s, x, y, o) => {
  const amp = s.amt * s.cols * 0.06, t = s.t * s.sp;
  o[0] = x + amp * Math.sin(y * 0.13 + t + 1.7 * Math.sin(x * s.asp * 0.2 - t * 0.7));
  o[1] = y + amp * s.asp * 1.2 * Math.cos(x * 0.11 - t * 0.8 + 1.3 * Math.sin(y * 0.1 + t * 0.5));
});

const wave = make('wave', on('wave'), 'wave', (s, x, y, o) => {
  const t = s.t * s.sp * 2;
  o[0] = x + s.amt * s.cols * 0.05 * Math.sin(y * 0.3 + t);
  o[1] = y + s.amt * s.rows * 0.03 * Math.sin(x * 0.2 - t * 0.8);
});

const vortex = make('vortex', on('vortex'), 'vortex', (s, x, y, o) => {
  const dx = (x - s.cx) * s.asp, dy = y - s.cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const th = s.amt * 4 * Math.exp(-r / (s.rows * 0.5)) * Math.sin(s.t * s.sp * 0.5 + 1) + s.amt * 1.5 * Math.exp(-r / (s.rows * 0.3));
  const cs = Math.cos(th), sn = Math.sin(th);
  o[0] = s.cx + (dx * cs - dy * sn) / s.asp;
  o[1] = s.cy + dx * sn + dy * cs;
});

const kaleido = make('kaleido', on('kaleido'), 'kaleido', (s, x, y, o) => {
  const dx = (x - s.cx) * s.asp, dy = y - s.cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const seg = TAU / Math.max(2, s.n);
  let a = Math.atan2(dy, dx) + s.t * s.sp * 0.15;
  a = ((a % seg) + seg) % seg;
  a = Math.abs(a - seg / 2);
  const kx = s.cx + (r * Math.cos(a)) / s.asp, ky = s.cy + r * Math.sin(a);
  o[0] = x + (kx - x) * s.amt;
  o[1] = y + (ky - y) * s.amt;
});

const mirror = make('mirror', on('mirror'), 'mirror', (s, x, y, o) => {
  const cx = s.cx + Math.sin(s.t * s.sp * 0.5) * s.amt * s.cols * 0.15;
  o[0] = x > cx ? 2 * cx - x : x;
  o[1] = s.amt > 0.5 && y > s.cy ? 2 * s.cy - y : y;
});

const jitter = make('jitter', on('jitter'), 'jitter', (s, x, y, o) => {
  const k = Math.floor(s.t * (0.5 + (s.sp - 0.2) * 1.0)); // no máx. ~3 mudanças/s
  const m = s.amt * 2.5;
  o[0] = x + (hash3(x, y, k) - 0.5) * 2 * m;
  o[1] = y + (hash3(y, x, k + 977) - 0.5) * 2 * m * s.asp * 2;
});

const glitch = make('glitch', on('glitch'), 'glitch', (s, x, y, o) => {
  const k = Math.floor(s.t * (0.5 + (s.sp - 0.2) * 1.0));
  const band = Math.floor(y / 3);
  const h = hash3(band, k, 31);
  o[0] = h > 1 - s.amt * 0.5 ? x + (hash3(band, k, 77) - 0.5) * s.cols * 0.3 * s.amt : x;
  o[1] = y;
});

const interact = make('interact', (p) => p.interact === 'repel' || p.interact === 'attract' || p.interact === 'ripple', 'warp', (s, x, y, o) => {
  o[0] = x; o[1] = y;
  if (!s.on) return;
  const dx = x - s.px, dy = y - s.py;
  const d = Math.sqrt(dx * dx * s.asp * s.asp + dy * dy);
  if (d >= s.R || d < 1e-6) return;
  const q = 1 - d / s.R;
  const mode = s.n; // 1 repelir, 2 atrair, 3 ondulação
  const f = q * q * 0.9;
  if (mode === 1) { o[0] = x - dx * f; o[1] = y - dy * f; } // repelir: amostra mais perto do ponteiro
  else if (mode === 2) { o[0] = x + dx * f; o[1] = y + dy * f; } // atrair
  else {
    const w = Math.sin(d * 1.1 - s.t * 6) * q * 2.5;
    o[0] = x + (dx / d) * w / s.asp; o[1] = y + (dy / d) * w;
  }
});

export const warps: WarpEffect[] = [warp, wave, vortex, kaleido, mirror, jitter, glitch, interact];
