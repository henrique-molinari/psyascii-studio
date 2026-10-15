// Atalhos globais. Ignorados quando o foco está em campos de edição.
export interface ShortcutActions {
  togglePause(): void;
  randomize(): void;
  undo(): void;
  redo(): void;
  exportPng(): void;
}

function editing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    const ty = (el as HTMLInputElement).type;
    return ['text', 'search', 'url', 'email', 'tel', 'password', 'number'].includes(ty);
  }
  return tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function createShortcuts(a: ShortcutActions): { dispose(): void } {
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.isComposing || editing(e.target)) return;
    if (document.querySelector('.intro-overlay')) return; // abertura/aviso modal aberta
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) a.redo(); else a.undo(); }
      else if (k === 'y') { e.preventDefault(); a.redo(); }
      return;
    }
    if (e.altKey) return;
    // Em botões, espaço/Enter pertencem ao botão.
    if (k === ' ' || k === 'spacebar') {
      if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      e.preventDefault(); a.togglePause();
    } else if (k === 'r' && !e.repeat) a.randomize();
    else if (k === 's' && !e.repeat) a.exportPng();
  };
  window.addEventListener('keydown', onKey);
  return { dispose(): void { window.removeEventListener('keydown', onKey); } };
}
