// Exportar HTML autônomo animado: ~60 quadros de texto, <pre> animado por JS inline.
// Limitação documentada: saída MONOCROMÁTICA (cor principal da paleta, fundo preto).
import type { AsciiRenderer } from '../core/renderer';
import { paletteColor } from '../core/color';
import type { PaletteId } from '../core/types';
import { download } from './export';

export interface HtmlOpts {
  palette: PaletteId;
  /** Pausa o loop principal; devolve a função que o retoma. */
  pause: () => () => void;
  frames?: number;
  /** Tempo de animação atual (s), ponto de partida da captura. */
  t0?: number;
}

const STEP = 1 / 20; // 20 fps
const LT = String.fromCharCode(60), GT = String.fromCharCode(62), AMP = String.fromCharCode(38);
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029), BS = String.fromCharCode(92);

function swap(s: string, from: string, to: string): string {
  return s.split(from).join(to);
}

/** Escape HTML: & < > e separadores de linha Unicode por código numérico. */
export function escapeHtml(s: string): string {
  let r = swap(s, AMP, AMP + 'amp;');
  r = swap(r, LT, AMP + 'lt;');
  r = swap(r, GT, AMP + 'gt;');
  r = swap(r, LS, AMP + '#8232;');
  return swap(r, PS, AMP + '#8233;');
}

/** JSON seguro dentro de <script>: '<' e separadores viram escapes JSON. */
export function safeJson(frames: string[]): string {
  let r = JSON.stringify(frames);
  r = swap(r, LT, BS + 'u003c');
  r = swap(r, LS, BS + 'u2028');
  return swap(r, PS, BS + 'u2029');
}

function hex(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
}

const SCRIPT = [
  'var d=JSON.parse(document.getElementById("d").textContent),p=document.getElementById("a"),i=0;',
  'function s(){p.textContent=d[i];i=(i+1)%d.length}',
  's();if(d.length>1)setInterval(s,50);',
].join('');

export function buildHtml(frames: string[], color: string): string {
  const first = escapeHtml(frames[0] ?? '');
  return [
    '<!doctype html>', '<html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>PsyASCII - animação</title>',
    '<style>html,body{margin:0;background:#000;min-height:100%}',
    'body{display:flex;justify-content:center;align-items:center;min-height:100vh}',
    'pre{margin:0;color:' + color + ';font:10px/1 ui-monospace,Consolas,monospace;white-space:pre;',
    'text-shadow:0 0 4px ' + color + '}</style></head><body>',
    '<pre id="a" aria-label="Arte ASCII animada">' + first + '</pre>',
    '<script type="application/json" id="d">' + safeJson(frames) + '</' + 'script>',
    '<script>' + SCRIPT + '</' + 'script>',
    '</body></html>',
  ].join('\n');
}

/** Captura quadros em passos fixos e baixa o arquivo. Retorna a quantidade de quadros. */
export function exportHtml(renderer: AsciiRenderer, opts: HtmlOpts): number {
  const n = Math.max(2, Math.min(120, opts.frames ?? 60));
  const resume = opts.pause();
  const frames: string[] = [];
  try {
    const t0 = opts.t0 ?? 0;
    for (let i = 0; i < n; i++) {
      renderer.frame(t0 + i * STEP, STEP);
      frames.push(renderer.getText());
    }
  } finally { resume(); }
  const rgb = new Uint8ClampedArray(3);
  paletteColor(opts.palette, 0.8, rgb, 0);
  const html = buildHtml(frames, '#' + hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]));
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  download(new Blob([html], { type: 'text/html;charset=utf-8' }), `psyascii-${stamp}.html`);
  return n;
}
