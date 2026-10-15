// Ligação principal: store + renderer + loop + entrada + painel + abertura.
import './style.css';
import { AsciiRenderer } from './core/renderer';
import { createLoop } from './core/loop';
import { defaultParams } from './core/types';
import { createStore } from './ui/store';
import { createPanel } from './ui/panel';
import { randomizeParams } from './ui/presets';
import { getPrefs, setPrefs, subscribe as subPrefs, reducedMotion } from './ui/prefs';
import { runIntro } from './ui/intro';
import { createAmbient } from './ui/ambient';
import { mountSettings } from './ui/settings';
import { createViewport } from './ui/viewport';
import { createShortcuts } from './ui/shortcuts';
import { setupInput } from './io/input';
import type { LoadedImage } from './io/input';
import { exportPng, exportTxt, copyText } from './io/export';
import { exportHtml } from './io/exportHtml';
import { recordWebm, webmSupported } from './io/webm';
import type { WebmHandle } from './io/webm';
import { loadVideoFile, openVideoPicker, videoSupported } from './io/video';
import type { LoadedVideo } from './io/video';
import { MAX_RECIPES, sanitizeName, recipeFromHash, shareUrl, saveLocal, loadLocal, deleteLocal, listLocal } from './io/recipes';
import { createPipeline } from './fx';
import { setRevealSource } from './fx/post';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} ausente`);
  return el as T;
};
const canvas = $<HTMLCanvasElement>('cv');
const msg = $('msg'), title = $('title'), bPause = $<HTMLButtonElement>('b-pause');
const side = $('side'), bDrawer = $<HTMLButtonElement>('b-drawer'), fpsEl = $('fps'), empty = $('empty'), app = $('app');

let msgTimer = 0;
function say(text: string, err = false): void {
  msg.textContent = text;
  msg.className = err ? 'msg err' : 'msg';
  msg.hidden = false;
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => { msg.hidden = true; }, 5000);
}

// Renderer: se o pipeline de efeitos falhar, segue só com o núcleo.
let renderer: AsciiRenderer;
let startupWarn = '';
try { renderer = new AsciiRenderer(canvas, createPipeline()); }
catch {
  startupWarn = 'AVISO: efeitos indisponíveis neste navegador (modo básico)';
  try { renderer = new AsciiRenderer(canvas); }
  catch { throw new Error('canvas 2D indisponível'); }
}
setRevealSource(() => renderer.getSource());

// Estado inicial: receita da hash (inválida mantém o padrão).
const hash = location.hash;
const fromHash = recipeFromHash(hash);
if (/^#r=/.test(hash) && !fromHash) startupWarn = 'ERRO: receita do link inválida (usando padrão)';
const store = createStore(fromHash ?? defaultParams());
const ptr = { x: 0, y: 0, down: false, active: false };
let hasImage = false, curSource: CanvasImageSource | null = null, lastT = 0;

let curVideo: LoadedVideo | null = null;
function setImage(img: LoadedImage, video?: LoadedVideo): void {
  const prev = curSource;
  if (curVideo && curVideo.source !== img.source) curVideo.dispose();
  curVideo = video ?? null;
  renderer.setSource(img.source, img.w, img.h);
  curSource = img.source;
  if (prev && prev !== img.source && typeof ImageBitmap !== 'undefined' && prev instanceof ImageBitmap) prev.close();
  renderer.setParams(store.get());
  hasImage = true;
  empty.hidden = true;
  view.reset();
  title.textContent = `[ canvas ] ${img.w}x${img.h}px -> ${store.get().cols} colunas`;
  renderOnce();
  say('OK: imagem carregada');
}
const input = setupInput({ dropTarget: document.body, onImage: setImage, onError: (m) => say(m, true) });

// FPS opcional (atualiza a cada 0,5 s).
let frames = 0, fpsT = 0;
const loop = createLoop((t, dt) => {
  lastT = t;
  if (!hasImage) return;
  if (curVideo) renderer.invalidateSource();
  renderer.frame(t, dt, ptr);
  frames++;
  if (getPrefs().fps && t - fpsT >= 0.5) { fpsEl.textContent = `${Math.round(frames / (t - fpsT))} FPS`; frames = 0; fpsT = t; }
});
function renderOnce(): void { if (hasImage && loop.paused) renderer.frame(lastT, 0, ptr); }

function syncPause(): void {
  bPause.textContent = loop.paused ? 'RETOMAR' : 'PAUSAR';
  bPause.setAttribute('aria-pressed', String(loop.paused));
  if (curVideo) { if (loop.paused) curVideo.source.pause(); else void curVideo.source.play().catch(() => undefined); }
}
function togglePause(): void { loop.toggle(); syncPause(); }

const needImage = (): boolean => { if (!hasImage) say('ERRO: carregue uma imagem primeiro', true); return hasImage; };
function applyParams(p: ReturnType<typeof defaultParams>): void { store.set(p); store.commit(); }
function refreshRecipes(): void { panel.setRecipeNames(listLocal()); }

let rec: WebmHandle | null = null;
function endRec(): void { rec = null; panel.setRecording(false); }
function toggleWebm(): void {
  if (rec) { rec.stop(); return; }
  if (!needImage()) return;
  if (!webmSupported()) { say('ERRO: gravação de vídeo indisponível neste navegador', true); return; }
  if (loop.paused) say('AVISO: animação pausada, o vídeo sairá parado', true);
  rec = recordWebm(canvas, 15, () => { endRec(); say('OK: WebM exportado'); }, (m) => { endRec(); say(m, true); });
  if (rec) { panel.setRecording(true); say('REC: gravando (máx. 15 s) - clique em Parar'); }
}
function doHtml(): void {
  if (!needImage()) return;
  const wasPaused = loop.paused;
  try {
    const n = exportHtml(renderer, {
      palette: store.get().palette, t0: lastT,
      pause: () => { if (!wasPaused) loop.pause(); return () => { if (!wasPaused) { loop.toggle(); syncPause(); } }; },
    });
    say(`OK: HTML animado exportado (${n} quadros, monocromático)`);
  } catch { say('ERRO: falha ao exportar HTML', true); }
}
function doVideo(): void {
  if (!videoSupported()) { say('ERRO: vídeo indisponível neste navegador', true); return; }
  openVideoPicker((f) => {
    loadVideoFile(f).then((v) => { setImage(v, v); say('OK: vídeo carregado (local, sem áudio)'); }, (e: unknown) => say(e instanceof Error && e.message.startsWith('ERRO') ? e.message : 'ERRO: falha ao carregar vídeo', true));
  });
}

async function copyLink(): Promise<void> {
  const url = shareUrl(store.get());
  try { history.replaceState(null, '', new URL(url).hash); } catch { /* ignorado */ }
  try {
    await navigator.clipboard.writeText(url);
    say('OK: link copiado (#r=...)');
  } catch { say('OK: link na barra de endereço (copie manualmente)'); }
}

const panel = createPanel(side, store, {
  loadFile: () => input.openPicker(),
  sample: () => setImage(input.loadSample()),
  exportPng: (s) => { if (needImage()) exportPng(renderer, s).then(() => say(`OK: PNG ${s}x exportado`), (e: unknown) => say(e instanceof Error && e.message.startsWith('ERRO') ? e.message : 'ERRO: falha ao exportar PNG', true)); },
  exportTxt: () => { if (needImage()) { exportTxt(renderer); say('OK: TXT exportado'); } },
  copyText: () => { if (needImage()) void copyText(renderer).then((ok) => say(ok ? 'OK: texto copiado' : 'ERRO: não foi possível copiar', !ok)); },
  saveRecipe: (n) => { if (listLocal().length >= MAX_RECIPES && !listLocal().includes(sanitizeName(n))) { say(`ERRO: limite de ${MAX_RECIPES} receitas salvas (apague alguma)`, true); return; } if (saveLocal(n, store.get())) { refreshRecipes(); say('OK: receita salva'); } else say('ERRO: nome inválido ou armazenamento cheio (cota)', true); },
  loadRecipe: (n) => { const p = loadLocal(n); if (p) { applyParams(p); say('OK: receita carregada'); } else say('ERRO: receita não encontrada', true); },
  deleteRecipe: (n) => { deleteLocal(n); refreshRecipes(); say('OK: receita apagada'); },
  share: () => { void copyLink(); },
  exportHtml: doHtml, exportWebm: toggleWebm, loadVideo: doVideo,
  randomize: () => { applyParams(randomizeParams(store.get(), (Math.random() * 4294967296) >>> 0)); },
});
refreshRecipes();

const unsubStore = store.subscribe((p) => {
  renderer.setParams(p);
  if (hasImage) title.textContent = title.textContent!.replace(/-> \d+ colunas/, `-> ${p.cols} colunas`);
  renderOnce();
});

// Viewport, atalhos, configurações, ambiente.
const view = createViewport($('vp'), canvas, () => { /* zoom só afeta a transformação */ }, () => store.get().interact === 'off');
const shortcuts = createShortcuts({
  togglePause, undo: () => store.undo(), redo: () => store.redo(),
  randomize: () => applyParams(randomizeParams(store.get(), (Math.random() * 4294967296) >>> 0)),
  exportPng: () => { if (needImage()) void exportPng(renderer, 1).then(() => say('OK: PNG 1x exportado'), () => say('ERRO: falha ao exportar PNG', true)); },
});
const ambient = createAmbient(document.body);
const settings = mountSettings(panel.settingsSlot, { getPrefs, setPrefs, subscribe: subPrefs }, () => { void playIntro(true); });

const applyPrefs = (): void => {
  const p = getPrefs();
  document.body.classList.toggle('crt', p.crt);
  fpsEl.hidden = !p.fps;
  ambient.setEnabled(p.ambient);
};
const unsubPrefs = subPrefs(applyPrefs);
applyPrefs();

// Eventos de UI.
const ac = new AbortController();
const on = (el: EventTarget, ev: string, fn: (e: never) => void): void => el.addEventListener(ev, fn as EventListener, { signal: ac.signal });
on(bPause, 'click', togglePause);
on($('b-zin'), 'click', () => view.zoomBy(1.25));
on($('b-zout'), 'click', () => view.zoomBy(0.8));
on($('b-zfit'), 'click', () => view.fit());
on(bDrawer, 'click', () => {
  const open = !side.classList.contains('open');
  side.classList.toggle('open', open);
  bDrawer.setAttribute('aria-expanded', String(open));
});
on(canvas, 'pointermove', (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  ptr.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  ptr.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  ptr.active = true;
});
on(canvas, 'pointerleave', () => { ptr.active = false; ptr.down = false; });
on(canvas, 'pointerdown', () => { ptr.down = true; });
on(window, 'pointerup', () => { ptr.down = false; });
on(window, 'hashchange', () => { const p = recipeFromHash(location.hash); if (p) { applyParams(p); say('OK: receita do link aplicada'); } else if (/^#r=/.test(location.hash)) say('ERRO: receita do link inválida', true); });

let disposed = false;
function cleanup(): void {
  if (disposed) return;
  disposed = true;
  rec?.cancel(); curVideo?.dispose(); curVideo = null;
  ac.abort(); unsubStore(); unsubPrefs(); clearTimeout(msgTimer);
  shortcuts.dispose(); view.dispose(); settings.dispose(); panel.dispose(); ambient.dispose();
  loop.dispose(); input.dispose(); renderer.dispose();
}
// bfcache: só destrói em descarte real; em persisted o loop retoma sozinho pela visibilidade.
window.addEventListener('pagehide', (e) => { if (!e.persisted) cleanup(); });
window.addEventListener('pageshow', (e) => { if (e.persisted && !disposed) renderOnce(); });

async function playIntro(force: boolean): Promise<void> {
  if (!force && !getPrefs().intro && getPrefs().seenWarning) return;
  const wasPaused = loop.paused;
  app.inert = true;
  try { await runIntro({ container: document.body, reduced: reducedMotion() || getPrefs().intensity === 'reduced', force, release: () => { app.inert = false; } }); }
  finally { app.inert = false; if (wasPaused !== loop.paused) syncPause(); }
}

// Início: app monta por trás da abertura.
try { setImage(input.loadSample()); }
catch { empty.hidden = false; startupWarn = startupWarn || 'ERRO: falha ao gerar a imagem de exemplo'; }
const startReduced = reducedMotion() || getPrefs().intensity === 'reduced';
loop.start();
if (startReduced) { loop.pause(); renderOnce(); }
syncPause();
if (document.fonts?.ready) void document.fonts.ready.then(renderOnce, () => say('AVISO: fonte não carregou (usando fallback)', true));
void playIntro(false).then(() => { if (startupWarn) say(startupWarn, startupWarn.startsWith('ERRO')); });
