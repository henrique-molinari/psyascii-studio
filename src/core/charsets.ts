// Rampas de caracteres, ordenadas do mais denso ao mais vazio (último = espaço/vazio).
import { sanitizeCustom, type CharsetId } from './types';

const CLASSIC = Array.from('@#S08Xox+=;:-,. ');
const BLOCKS = Array.from('█▓▒░ ');
const BINARY = ['1', '0', ' '];
// Katakana cobertos pela fonte (U+30A1-30E1 e U+30E3-30ED), do mais denso ao mais leve (aprox.).
const KANA_RAMP = Array.from('ホネギタキマオセヌメミラクスコテハナヘトニルレノリロシソヤユ').concat([' ']);

function popcount(n: number): number {
  let c = 0;
  for (let v = n; v; v &= v - 1) c++;
  return c;
}

/** Braille U+2800..: 9 níveis (8..0 pontos), padrões espalhados para boa textura. */
function buildBraille(): string[] {
  const byCount: number[][] = [[], [], [], [], [], [], [], [], []];
  for (let m = 0; m < 256; m++) byCount[popcount(m)].push(m);
  const out: string[] = [];
  for (let c = 8; c >= 1; c--) {
    const list = byCount[c];
    out.push(String.fromCodePoint(0x2800 + list[Math.floor(list.length / 2)]));
  }
  out.push(' ');
  return out;
}
const BRAILLE = buildBraille();

function buildKana(): string[] {
  const out: string[] = [];
  for (let c = 0x30a1; c <= 0x30e1; c++) out.push(String.fromCodePoint(c));
  for (let c = 0x30e3; c <= 0x30ed; c++) out.push(String.fromCodePoint(c));
  for (let d = 0; d < 10; d++) out.push(String(d));
  return out;
}
/** Katakana cobertos + dígitos (para atlas da chuva). */
export const KANA_GLYPHS: readonly string[] = buildKana();
/** Glifos da chuva: kana, dígitos e símbolos. */
export const RAIN_GLYPHS: readonly string[] = KANA_GLYPHS.concat(Array.from(':.=*+-<>|¦╌'));

export function getRamp(charset: CharsetId, custom: string): string[] {
  switch (charset) {
    case 'blocks': return BLOCKS.slice();
    case 'braille': return BRAILLE.slice();
    case 'katakana': return KANA_RAMP.slice();
    case 'binary': return BINARY.slice();
    case 'custom': {
      const s = Array.from(sanitizeCustom(custom));
      return s.length ? s : CLASSIC.slice();
    }
    default: return CLASSIC.slice();
  }
}
