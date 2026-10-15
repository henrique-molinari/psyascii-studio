import { describe, it, expect } from 'vitest';
import { luminance, toneCurve, mulberry32, hash2d, bayer4, backgroundMask } from '../src/core/tone';
import { getRamp, RAIN_GLYPHS } from '../src/core/charsets';
import { CHARSETS, PALETTE_IDS, MAX_CUSTOM_CHARS, LIMITS, sanitizeCustom, defaultParams, clampParams } from '../src/core/types';
import { paletteColor } from '../src/core/color';

describe('tone', () => {
  it('luminance extremos e monotonia', () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 6);
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
    expect(luminance(255, 0, 0)).toBeGreaterThan(luminance(0, 0, 255));
  });
  it('toneCurve limita a 0..1 e inverte', () => {
    for (const v of [-5, 0, 0.3, 1, 9]) {
      const x = toneCurve(v, 2, 1.5, 0.2, false);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
    expect(toneCurve(0.2, 1, 1, 0, true)).toBeCloseTo(0.8, 6);
  });
  it('bayer4 em -0.5..0.5; backgroundMask', () => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const b = bayer4(x, y); expect(b).toBeGreaterThan(-0.5); expect(b).toBeLessThan(0.5);
    }
    const m = new Uint8Array(2);
    backgroundMask(new Float32Array([1, 0]), 2, 0, m); expect([...m]).toEqual([1, 1]);
    backgroundMask(new Float32Array([1, 0]), 2, 1, m); expect([...m]).toEqual([0, 1]);
  });
});

describe('rng/hash', () => {
  it('mulberry32 determinístico, 0..1, seeds distintas divergem', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('mulberry32 aceita seed lixo sem NaN', () => {
    for (const s of [NaN, Infinity, -1, 2 ** 40, 1.5]) expect(Number.isFinite(mulberry32(s)())).toBe(true);
  });
  it('hash2d determinístico e em 0..1', () => {
    expect(hash2d(3, 4, 5)).toBe(hash2d(3, 4, 5));
    expect(hash2d(3, 4, 5)).not.toBe(hash2d(4, 3, 5));
    for (let i = -20; i < 20; i++) {
      const h = hash2d(i, i * 7, 9); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1);
    }
  });
});

describe('charsets', () => {
  it('todas as rampas são não vazias e terminam em vazio', () => {
    for (const c of CHARSETS) expect(getRamp(c, 'ab').length).toBeGreaterThan(1);
    for (const c of ['classic', 'blocks', 'braille', 'katakana', 'binary'] as const)
      expect(getRamp(c, '').at(-1)).toBe(' ');
  });
  it('getRamp devolve cópia', () => {
    getRamp('classic', '').pop();
    expect(getRamp('classic', '').at(-1)).toBe(' ');
  });
  it('custom vazio/só controles cai no classic', () => {
    expect(getRamp('custom', '')).toEqual(getRamp('classic', ''));
    expect(getRamp('custom', '\n\t\u0000')).toEqual(getRamp('classic', ''));
  });
  it('sanitizeCustom', () => {
    expect(sanitizeCustom('a\nb‮c​d﻿')).toBe('abcd');
    expect(sanitizeCustom(123 as unknown)).toBe('');
    expect(sanitizeCustom(null)).toBe('');
    expect(Array.from(sanitizeCustom('😀'.repeat(200))).length).toBe(MAX_CUSTOM_CHARS);
    expect(getRamp('custom', '😀x')).toEqual(['😀', 'x']);
  });
  it('RAIN_GLYPHS válidos', () => {
    expect(RAIN_GLYPHS.length).toBeGreaterThan(10);
    expect(RAIN_GLYPHS.every((g) => g.length > 0)).toBe(true);
  });
});

describe('paletteColor', () => {
  it('12 paletas, valores 0..255 sem NaN', () => {
    expect(PALETTE_IDS.length).toBe(12);
    for (const id of PALETTE_IDS) for (const t of [0, 0.5, 1, -3, 7, 0.999]) {
      const o = new Uint8ClampedArray(5);
      paletteColor(id, t, o, 1);
      for (let k = 1; k < 4; k++) { expect(Number.isNaN(o[k])).toBe(false); expect(o[k]).toBeGreaterThanOrEqual(0); expect(o[k]).toBeLessThanOrEqual(255); }
      expect(o[0]).toBe(0); expect(o[4]).toBe(0);
    }
  });
  it('id desconhecido usa fallback', () => {
    const o = new Uint8ClampedArray(3);
    paletteColor('xx' as never, 0.5, o, 0);
    expect(o[1]).toBeGreaterThan(0);
  });
  it('t=NaN mantém saída em 0..255', () => {
    const o = new Uint8ClampedArray(3).fill(7);
    paletteColor('calor', NaN, o, 0);
    expect(o.every((v) => v >= 0 && v <= 255)).toBe(true);
  });
});

describe('params', () => {
  it('defaultParams é estável e válido', () => {
    expect(clampParams(defaultParams())).toEqual(defaultParams());
    expect(defaultParams()).not.toBe(defaultParams());
  });
  it('clampParams fora de faixa', () => {
    const p = clampParams({ cols: 99999, cellAspect: -5, contrast: 50, gamma: 0, brightness: -9, fontSize: 1, kaleidoN: 100, mix: 2 } as never);
    expect(p.cols).toBe(LIMITS.cols[1]); expect(p.cellAspect).toBe(LIMITS.cellAspect[0]);
    expect(p.contrast).toBe(2); expect(p.gamma).toBe(0.3); expect(p.brightness).toBe(-1);
    expect(p.fontSize).toBe(8); expect(p.kaleidoN).toBe(12); expect(p.mix).toBe(1);
  });
  it('clampParams com lixo', () => {
    for (const bad of [null, undefined, 5, 'x', [], { cols: NaN, charset: 'nope', palette: 3, fx: 'a', post: null, seed: 'z', invert: 'true' }]) {
      const p = clampParams(bad as never);
      expect(p.cols).toBe(160); expect(p.charset).toBe('classic'); expect(p.palette).toBe('fosforo-verde');
      expect(p.invert).toBe(false); expect(p.seed).toBe(1);
      expect(Object.keys(p.fx).length).toBe(12);
    }
    expect(clampParams({ cols: Infinity } as never).cols).toBe(160);
  });
  it('clampParams seed e fx parcial', () => {
    expect(clampParams({ seed: -5 } as never).seed).toBe(-5 >>> 0);
    expect(clampParams({ seed: 3.9 } as never).seed).toBe(3);
    const p = clampParams({ fx: { warp: { on: true, amt: 9, speed: -1 } } } as never);
    expect(p.fx.warp).toEqual({ on: true, amt: 1, speed: 0 });
  });
  it('clampParams via JSON ida e volta', () => {
    const d = defaultParams(); d.cols = 77; d.custom = 'xyz';
    expect(clampParams(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it('clampParams não vaza __proto__', () => {
    const p = clampParams(JSON.parse('{"__proto__":{"polluted":1},"fx":{"__proto__":{"x":1}}}'));
    expect((p as unknown as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
