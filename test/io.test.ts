import { describe, it, expect, vi, afterEach } from 'vitest';
import { encodeRecipe, decodeRecipe, sanitizeName, hashFromRecipe, recipeFromHash, saveLocal, loadLocal, deleteLocal, listLocal } from '../lib/io/recipes';
import { defaultParams, clampParams } from '../lib/core/types';
import { RainEngine } from '../lib/fx/rain';

afterEach(() => { vi.unstubAllGlobals(); });

describe('recipes', () => {
  it('ida e volta', () => {
    const p = defaultParams(); p.cols = 123; p.custom = 'áé😀'; p.palette = 'calor'; p.fx.warp.on = true;
    const s = encodeRecipe(p);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeRecipe(s)).toEqual(clampParams(p));
  });
  it('hash ida e volta', () => {
    const p = defaultParams();
    expect(recipeFromHash(hashFromRecipe(p))).toEqual(p);
    expect(recipeFromHash('#r=!!!')).toBeNull();
    expect(recipeFromHash('#x=abc')).toBeNull();
  });
  it('entradas inválidas retornam null', () => {
    for (const s of ['', 'abc', '!!!', '%%%', 'e30', btoa('{"v":2,"p":{}}'), btoa('null'), btoa('{"v":1}'), btoa('{"v":1,"p":5}')])
      expect(decodeRecipe(s)).toBeNull();
    for (const s of [null, undefined, 5, {}]) expect(decodeRecipe(s as never)).toBeNull();
  });
  it('entrada gigante rejeitada', () => {
    expect(decodeRecipe('A'.repeat(8193))).toBeNull();
    expect(decodeRecipe('A'.repeat(5_000_000))).toBeNull();
  });
  it('receita com valores fora de faixa é clampada', () => {
    const s = btoa(JSON.stringify({ v: 1, p: { cols: 1e9, palette: 'x' } })).replace(/=+$/, '');
    const p = decodeRecipe(s)!;
    expect(p.cols).toBe(300); expect(p.palette).toBe('fosforo-verde');
  });
  it('sanitizeName', () => {
    expect(sanitizeName('a\u0000b‮ c')).toBe('ab c');
    expect(sanitizeName('x'.repeat(100)).length).toBe(40);
    expect(sanitizeName('  \n ')).toBe('');
  });
  it('localStorage mock: salvar/listar/carregar/apagar', () => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
    });
    expect(saveLocal('  ', defaultParams())).toBe(false);
    expect(saveLocal('b', defaultParams())).toBe(true);
    expect(saveLocal('a', defaultParams())).toBe(true);
    m.set('outro', 'x');
    expect(listLocal()).toEqual(['a', 'b']);
    expect(loadLocal('a')).toEqual(defaultParams());
    expect(loadLocal('zz')).toBeNull();
    deleteLocal('a');
    expect(listLocal()).toEqual(['b']);
  });
  it('localStorage indisponível não lança', () => {
    vi.stubGlobal('localStorage', new Proxy({}, { get() { throw new Error('blocked'); } }));
    expect(saveLocal('a', defaultParams())).toBe(false);
    expect(loadLocal('a')).toBeNull();
    expect(listLocal()).toEqual([]);
    expect(() => deleteLocal('a')).not.toThrow();
  });
});

describe('RainEngine.columnsFor', () => {
  it('calcula colunas', () => {
    expect(RainEngine.columnsFor(160, 16, false)).toBe(10);
    expect(RainEngine.columnsFor(160, 16, true)).toBe(6);
  });
  it('mínimo 1 em larguras degeneradas', () => {
    expect(RainEngine.columnsFor(0, 16, false)).toBe(1);
    expect(RainEngine.columnsFor(-50, 16, true)).toBe(1);
    expect(RainEngine.columnsFor(5, 16, false)).toBe(1);
  });
});
