// Widgets acessíveis e reutilizáveis (DOM puro). Texto sempre via textContent.
export interface Ctl<T> { el: HTMLElement; set(v: T): void }
export interface Opt { value: string; label: string }

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Slider fino; onInput a cada movimento, onCommit só ao soltar ('change'). */
export function slider(label: string, min: number, max: number, step: number, onInput: (v: number) => void, onCommit: () => void): Ctl<number> {
  const wrap = h('label', 'sl');
  const name = h('span', 'sl-n', label);
  const inp = h('input');
  inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step);
  const out = h('output');
  const dec = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const show = () => { out.textContent = Number(inp.value).toFixed(dec); };
  inp.addEventListener('input', () => { show(); onInput(Number(inp.value)); });
  inp.addEventListener('change', () => onCommit());
  wrap.append(name, inp, out);
  return { el: wrap, set(v) { if (Number(inp.value) !== v) inp.value = String(v); show(); } };
}

/** Toggle [ ON ] / [ OFF ] com aria-pressed. */
export function toggle(label: string, onChange: (v: boolean) => void, onCommit: () => void): Ctl<boolean> {
  const wrap = h('div', 'tg');
  const name = h('span', 'tg-n', label);
  const b = h('button', 'btn tg-b');
  b.type = 'button'; b.setAttribute('aria-label', label);
  let on = false;
  const paint = () => { b.textContent = on ? '[ ON ]' : '[ OFF ]'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); };
  b.addEventListener('click', () => { on = !on; paint(); onChange(on); onCommit(); });
  paint();
  wrap.append(name, b);
  return { el: wrap, set(v) { on = v; paint(); } };
}

export interface SelectCtl extends Ctl<string> { setOptions(o: Opt[]): void; value(): string }
export function select(label: string, opts: Opt[], onChange: (v: string) => void, onCommit: () => void): SelectCtl {
  const wrap = h('label', 'fld');
  const sel = h('select', 'ctl');
  const fill = (o: Opt[]) => {
    sel.replaceChildren();
    for (const x of o) { const op = h('option', undefined, x.label); op.value = x.value; sel.append(op); }
  };
  fill(opts);
  sel.addEventListener('change', () => { onChange(sel.value); onCommit(); });
  wrap.append(h('span', 'fld-n', label), sel);
  return {
    el: wrap, set(v) { sel.value = v; }, value: () => sel.value,
    setOptions(o) { const cur = sel.value; fill(o); sel.value = cur; },
  };
}

export function textInput(label: string, max: number, onInput: (v: string) => void, onCommit: () => void): Ctl<string> {
  const wrap = h('label', 'fld');
  const inp = h('input', 'ctl');
  inp.type = 'text'; inp.maxLength = max; inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.addEventListener('input', () => onInput(inp.value));
  inp.addEventListener('change', () => onCommit());
  wrap.append(h('span', 'fld-n', label), inp);
  return { el: wrap, set(v) { if (inp.value !== v) inp.value = v; } };
}

export function button(label: string, onClick: () => void): Ctl<string> {
  const b = h('button', 'btn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return { el: b, set(v) { b.textContent = v; } };
}
