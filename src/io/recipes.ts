// Receitas: codificação base64url, localStorage e link por hash.
import { clampParams } from '../core/types';
import type { Params } from '../core/types';

const MAX_BYTES = 8192;
const PREFIX = 'psyascii:recipe:';

export function encodeRecipe(p: Params): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, p }));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
}

export function decodeRecipe(s: string): Params | null {
  try {
    if (typeof s !== 'string' || s.length === 0 || s.length > MAX_BYTES) return null;
    let b = s.split('-').join('+').split('_').join('/');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const o = JSON.parse(new TextDecoder().decode(bytes)) as { v?: unknown; p?: unknown };
    if (!o || o.v !== 1 || !o.p || typeof o.p !== 'object') return null;
    return clampParams(o.p as Partial<Params>);
  } catch {
    return null;
  }
}

/** Remove controles e limita a 40 caracteres. */
export function sanitizeName(n: string): string {
  return Array.from(String(n)).filter((c) => {
    const k = c.codePointAt(0) as number;
    return k >= 32 && !(k >= 0x7f && k <= 0x9f) && !(k >= 0x200b && k <= 0x200f) && !(k >= 0x202a && k <= 0x202e);
  }).slice(0, 40).join('').trim();
}

export function saveLocal(name: string, p: Params): boolean {
  const n = sanitizeName(name);
  if (!n) return false;
  try { localStorage.setItem(PREFIX + n, encodeRecipe(p)); return true; } catch { return false; }
}
export function loadLocal(name: string): Params | null {
  try {
    const s = localStorage.getItem(PREFIX + sanitizeName(name));
    return s ? decodeRecipe(s) : null;
  } catch { return null; }
}
export function deleteLocal(name: string): void {
  try { localStorage.removeItem(PREFIX + sanitizeName(name)); } catch { /* indisponível */ }
}
export function listLocal(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
  } catch { /* indisponível */ }
  return out.sort();
}

export const hashFromRecipe = (p: Params): string => '#r=' + encodeRecipe(p);
export function recipeFromHash(hash: string): Params | null {
  const m = /^#r=([A-Za-z0-9_-]+)$/.exec(hash);
  return m ? decodeRecipe(m[1]) : null;
}
export function shareUrl(p: Params): string {
  return location.origin + location.pathname + hashFromRecipe(p);
}
