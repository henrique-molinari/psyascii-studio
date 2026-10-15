// Painel de controles gerado por tabelas descritoras. Texto só via textContent.
import { LIMITS, EFFECT_IDS, POST_IDS, CHARSETS, COLOR_MODES, INTERACT_MODES, FONT_FAMILIES, defaultParams, clampParams } from '../core/types';
import type { Params, FxState, EffectId, PostId } from '../core/types';
import { PALETTES } from '../core/color';
import type { Store } from './store';
import { slider, toggle, select, textInput, button } from './controls';
import type { Opt } from './controls';
import { PRESETS } from './presets';
import { getPrefs } from './prefs';

export interface PanelActions {
  loadFile(): void; sample(): void; exportPng(scale: 1 | 2 | 4): void; exportTxt(): void; copyText(): void;
  saveRecipe(name: string): void; loadRecipe(name: string): void; deleteRecipe(name: string): void;
  share(): void; randomize(): void; exportHtml?(): void; exportWebm?(): void; loadVideo?(): void;
}
type NumKey = keyof typeof LIMITS;

const NUMS: Record<string, [NumKey, string, number][]> = {
  img: [['cols', 'Colunas', 1], ['cellAspect', 'Proporção da célula', 0.01], ['contrast', 'Contraste', 0.05], ['gamma', 'Gama', 0.05], ['brightness', 'Brilho', 0.05], ['edges', 'Bordas (Sobel)', 0.05], ['bgCut', 'Remover fundo claro', 0.05]],
  chr: [['fontSize', 'Tamanho da fonte', 1]],
  col: [['hueSpeed', 'Velocidade do matiz', 0.05]],
};
const CHARSET_L: Record<string, string> = { classic: 'Clássico', blocks: 'Blocos', braille: 'Braille', katakana: 'Katakana', binary: 'Binário', custom: 'Personalizado' };
const MODE_L: Record<string, string> = { mono: 'Monocromático', original: 'Cor original', lum: 'Paleta por luminância', angle: 'Paleta por ângulo', radius: 'Paleta por raio', hue: 'Ciclo de matiz' };
const INT_L: Record<string, string> = { off: 'Desligado', repel: 'Repelir', attract: 'Atrair', ripple: 'Ondulação', reveal: 'Revelar' };
const FX_L: Record<EffectId, string> = { warp: 'Distorção (warp)', wave: 'Ondas', vortex: 'Vórtice', kaleido: 'Caleidoscópio', mirror: 'Espelho', tunnel: 'Túnel', hue: 'Rotação de matiz', aberr: 'Aberração cromática', rain: 'Chuva digital', melt: 'Derreter', jitter: 'Tremor', glitch: 'Glitch' };
const POST_L: Record<PostId, string> = { glow: 'Brilho', scan: 'Scanlines CRT', vignette: 'Vinheta', grain: 'Grão' };

export function createPanel(root: HTMLElement, store: Store, actions: PanelActions) {
  const syncs: ((p: Params) => void)[] = [];
  const finishers = new Set<() => void>();
  const timers = new Set<number>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const commit = () => store.commit();
  const panel = document.createElement('div');
  panel.className = 'panel';
  const settingsSlot = document.createElement('div');

  const typeText = (el: HTMLElement, text: string) => {
    if (reduced || getPrefs().intensity === 'reduced') { el.textContent = text; return; }
    let i = 0;
    const done = () => { window.clearInterval(id); timers.delete(id); finishers.delete(done); el.textContent = text; };
    const id = window.setInterval(() => { i++; el.textContent = text.slice(0, i) + '▓'; if (i >= text.length) done(); }, 22);
    timers.add(id); finishers.add(done);
  };
  const skip = () => { for (const f of [...finishers]) f(); };
  panel.addEventListener('pointerdown', skip);
  panel.addEventListener('keydown', skip);

  const section = (title: string, open: boolean): HTMLElement => {
    const sec = document.createElement('section'); sec.className = 'sec';
    const head = document.createElement('button'); head.type = 'button'; head.className = 'sec-h';
    const body = document.createElement('div'); body.className = 'sec-b';
    const setOpen = (o: boolean) => { head.setAttribute('aria-expanded', String(o)); body.hidden = !o; };
    head.setAttribute('aria-label', title);
    head.addEventListener('click', () => setOpen(head.getAttribute('aria-expanded') !== 'true'));
    setOpen(open); typeText(head, title);
    sec.append(head, body); panel.append(sec);
    return body;
  };
  const num = (to: HTMLElement, key: NumKey, label: string, step: number) => {
    const [mn, mx] = LIMITS[key];
    const c = slider(label, mn, mx, step, (v) => store.set({ [key]: v } as Partial<Params>), commit);
    to.append(c.el); syncs.push((p) => c.set(p[key]));
  };
  const sel = <K extends 'charset' | 'fontFamily' | 'colorMode' | 'palette' | 'interact'>(to: HTMLElement, key: K, label: string, opts: Opt[]) => {
    const c = select(label, opts, (v) => store.set({ [key]: v } as Partial<Params>), commit);
    to.append(c.el); syncs.push((p) => c.set(p[key]));
  };
  const tog = (to: HTMLElement, key: 'invert' | 'dither', label: string) => {
    const c = toggle(label, (v) => store.set({ [key]: v } as Partial<Params>), commit);
    to.append(c.el); syncs.push((p) => c.set(p[key]));
  };
  const btn = (to: HTMLElement, label: string, fn: () => void) => { to.append(button(label, fn).el); };
  const row = (to: HTMLElement): HTMLElement => { const r = document.createElement('div'); r.className = 'row'; to.append(r); return r; };
  const fxGroup = (to: HTMLElement, kind: 'fx' | 'post', id: string, label: string) => {
    const g = document.createElement('div'); g.className = 'grp';
    const upd = (patch: Partial<FxState>) => {
      const cur = store.get()[kind] as Record<string, FxState>;
      store.set({ [kind]: { ...cur, [id]: { ...cur[id], ...patch } } } as Partial<Params>);
    };
    const on = toggle(label, (v) => upd({ on: v }), commit);
    const amt = slider('Intensidade', 0, 1, 0.05, (v) => upd({ amt: v }), commit);
    const spd = slider('Velocidade', 0, 1, 0.05, (v) => upd({ speed: v }), commit);
    g.append(on.el, amt.el, spd.el); to.append(g);
    syncs.push((p) => { const s = (p[kind] as Record<string, FxState>)[id]; on.set(s.on); amt.set(s.amt); spd.set(s.speed); });
  };

  // [01] IMAGEM
  const s1 = section('[01] IMAGEM', true);
  const r1 = row(s1); btn(r1, 'Carregar imagem', actions.loadFile); btn(r1, 'Imagem de exemplo', actions.sample);
  if (actions.loadVideo) btn(r1, 'Carregar vídeo', actions.loadVideo);
  for (const [k, l, st] of NUMS.img) num(s1, k, l, st);
  tog(s1, 'invert', 'Inverter'); tog(s1, 'dither', 'Dither');
  // [02] CARACTERES
  const s2 = section('[02] CARACTERES', true);
  sel(s2, 'charset', 'Conjunto', CHARSETS.map((c) => ({ value: c, label: CHARSET_L[c] })));
  const cu = textInput('Caracteres personalizados', 64, (v) => store.set({ custom: v }), commit);
  s2.append(cu.el); syncs.push((p) => cu.set(p.custom));
  sel(s2, 'fontFamily', 'Fonte', FONT_FAMILIES.map((f) => ({ value: f, label: f === 'mono' ? 'Monoespaçada' : 'Kana (DotGothic16)' })));
  for (const [k, l, st] of NUMS.chr) num(s2, k, l, st);
  // [03] COR
  const s3 = section('[03] COR', true);
  sel(s3, 'colorMode', 'Modo de cor', COLOR_MODES.map((c) => ({ value: c, label: MODE_L[c] })));
  sel(s3, 'palette', 'Paleta', PALETTES.map((p) => ({ value: p.id, label: p.name })));
  for (const [k, l, st] of NUMS.col) num(s3, k, l, st);
  // [04] EFEITOS
  const s4 = section('[04] EFEITOS', false);
  num(s4, 'mix', 'Mix (original/efeito)', 0.05);
  for (const id of EFFECT_IDS) fxGroup(s4, 'fx', id, FX_L[id]);
  num(s4, 'kaleidoN', 'Segmentos do caleidoscópio', 1);
  sel(s4, 'interact', 'Interação do ponteiro', INTERACT_MODES.map((m) => ({ value: m, label: INT_L[m] })));
  num(s4, 'interactRadius', 'Raio da interação', 1);
  // [05] PÓS
  const s5 = section('[05] PÓS', false);
  for (const id of POST_IDS) fxGroup(s5, 'post', id, POST_L[id]);
  // [06] EXPORTAR
  const s6 = section('[06] EXPORTAR', false);
  const r6 = row(s6);
  for (const sc of [1, 2, 4] as const) btn(r6, 'PNG ' + sc + 'x', () => actions.exportPng(sc));
  const r6b = row(s6);
  btn(r6b, 'TXT', actions.exportTxt); btn(r6b, 'Copiar texto', actions.copyText);
  if (actions.exportHtml) btn(r6b, 'HTML animado', actions.exportHtml);
  const webmBtn = actions.exportWebm ? button('Gravar WebM', actions.exportWebm) : null;
  if (webmBtn) r6b.append(webmBtn.el);
  // [07] RECEITAS
  const s7 = section('[07] RECEITAS', false);
  const pre = select('Presets', PRESETS.map((x) => ({ value: x.name, label: x.name })), () => {}, () => {});
  s7.append(pre.el);
  const r7 = row(s7);
  btn(r7, 'Aplicar preset', () => {
    const f = PRESETS.find((x) => x.name === pre.value());
    if (f) { store.set(clampParams({ ...defaultParams(), ...f.params })); commit(); }
  });
  btn(r7, 'Surpreenda-me', actions.randomize);
  const nm = textInput('Nome da receita', 40, () => {}, () => {});
  let nameVal = '';
  nm.el.querySelector('input')?.addEventListener('input', (e) => { nameVal = (e.target as HTMLInputElement).value; });
  s7.append(nm.el);
  const saved = select('Receitas salvas', [], () => {}, () => {});
  s7.append(saved.el);
  const r7b = row(s7);
  btn(r7b, 'Salvar', () => { if (nameVal.trim()) actions.saveRecipe(nameVal); });
  btn(r7b, 'Carregar', () => { if (saved.value()) actions.loadRecipe(saved.value()); });
  btn(r7b, 'Apagar', () => { if (saved.value()) actions.deleteRecipe(saved.value()); });
  btn(r7b, 'Copiar link', actions.share);

  panel.append(settingsSlot);
  root.append(panel);
  const refresh = () => { const p = store.get(); for (const f of syncs) f(p); };
  const unsub = store.subscribe(refresh);
  refresh();

  return {
    refresh, settingsSlot,
    setRecording(on: boolean) { webmBtn?.set(on ? '■ Parar gravação' : 'Gravar WebM'); },
    setRecipeNames(n: string[]) { saved.setOptions(n.map((x) => ({ value: x, label: x }))); },
    dispose() {
      unsub(); for (const t of timers) window.clearInterval(t);
      timers.clear(); finishers.clear(); panel.remove();
    },
  };
}
