// Ligação principal: store + renderer + loop + entrada + exportação.
import './style.css';
import { AsciiRenderer } from './core/renderer';
import { createLoop } from './core/loop';
import { createStore } from './ui/store';
import { setupInput } from './io/input';
import type { LoadedImage } from './io/input';
import { exportPng, exportTxt, copyText } from './io/export';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} ausente`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>('cv');
const msg = $('msg');
const title = $('title');
const bPause = $<HTMLButtonElement>('b-pause');
const rCols = $<HTMLInputElement>('r-cols');
const oCols = $('o-cols');

const store = createStore();
const renderer = new AsciiRenderer(canvas);
const ptr = { x: 0, y: 0, down: false, active: false };
let hasImage = false;
let msgTimer = 0;

function say(text: string, err = false): void {
  msg.textContent = text;
  msg.className = err ? 'msg err' : 'msg';
  msg.hidden = false;
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => { msg.hidden = true; }, 4500);
}

function setImage(img: LoadedImage): void {
  renderer.setSource(img.source, img.w, img.h);
  renderer.setParams(store.get());
  hasImage = true;
  title.textContent = `[ canvas ] ${img.w}x${img.h}px -> ${store.get().cols} colunas`;
  say('OK: imagem carregada');
}

const input = setupInput({
  dropTarget: document.body,
  onImage: setImage,
  onError: (m) => say(m, true),
});

const loop = createLoop((t, dt) => {
  if (hasImage) renderer.frame(t, dt, ptr);
});

function syncPause(): void {
  const paused = !loopRunning;
  bPause.textContent = paused ? 'RETOMAR' : 'PAUSAR';
  bPause.setAttribute('aria-pressed', String(paused));
}
let loopRunning = true;
function togglePause(): void {
  loop.toggle();
  loopRunning = !loopRunning;
  syncPause();
}

const unsub = store.subscribe((p) => {
  renderer.setParams(p);
  rCols.value = String(p.cols);
  oCols.textContent = String(p.cols);
  if (!loopRunning && hasImage) renderer.frame(performance.now() / 1000, 0, ptr);
});

// Eventos de UI
const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
  el.addEventListener(ev, fn as EventListener);
  cleanups.push(() => el.removeEventListener(ev, fn as EventListener));
};
const cleanups: Array<() => void> = [];

on($('b-open'), 'click', () => input.openPicker());
on($('b-sample'), 'click', () => setImage(input.loadSample()));
on(bPause, 'click', togglePause);
on($('b-png'), 'click', () => {
  if (!hasImage) return say('ERRO: carregue uma imagem primeiro', true);
  exportPng(renderer, 2).then(() => say('OK: PNG exportado'), () => say('ERRO: falha ao exportar PNG', true));
});
on($('b-txt'), 'click', () => {
  if (!hasImage) return say('ERRO: carregue uma imagem primeiro', true);
  exportTxt(renderer);
  say('OK: TXT exportado');
});
on($('b-copy'), 'click', () => {
  if (!hasImage) return say('ERRO: carregue uma imagem primeiro', true);
  void copyText(renderer).then((ok) => say(ok ? 'OK: texto copiado' : 'ERRO: não foi possível copiar', !ok));
});
on(rCols, 'input', () => store.set({ cols: Number(rCols.value) }));
on(rCols, 'change', () => store.commit());
on(window, 'keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
  else if (e.key === ' ' && t.tagName !== 'BUTTON') { e.preventDefault(); togglePause(); }
});
on(canvas, 'pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  ptr.x = (e.clientX - r.left) / r.width; ptr.y = (e.clientY - r.top) / r.height; ptr.active = true;
});
on(canvas, 'pointerleave', () => { ptr.active = false; ptr.down = false; });
on(canvas, 'pointerdown', () => { ptr.down = true; });
on(canvas, 'pointerup', () => { ptr.down = false; });
on(document.body, 'dragover', () => document.body.classList.add('dragover'));
on(document.body, 'dragleave', () => document.body.classList.remove('dragover'));
on(document.body, 'drop', () => document.body.classList.remove('dragover'));

// Abertura: renderiza o exemplo e inicia o loop.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) { loopRunning = false; syncPause(); }
setImage(input.loadSample());
store.set({});
if (reduced) renderer.frame(0, 0, ptr); else loop.start();

window.addEventListener('pagehide', () => {
  unsub();
  cleanups.forEach((f) => f());
  loop.dispose();
  input.dispose();
  renderer.dispose();
}, { once: true });
