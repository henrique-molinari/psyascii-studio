// Exportação: PNG (1x/2x/4x), TXT e copiar texto. Tudo local via Blob.
import type { AsciiRenderer } from '../core/renderer';

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPng(renderer: AsciiRenderer, scale: 1 | 2 | 4 = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    const c = renderer.exportCanvas(scale);
    c.toBlob((b) => {
      if (!b) { reject(new Error('ERRO: falha ao gerar PNG')); return; }
      download(b, `psyascii-${stamp()}-${scale}x.png`);
      resolve();
    }, 'image/png');
  });
}

export function exportTxt(renderer: AsciiRenderer): void {
  const blob = new Blob([renderer.getText()], { type: 'text/plain;charset=utf-8' });
  download(blob, `psyascii-${stamp()}.txt`);
}

/** Copia o texto; usa a Clipboard API e cai para execCommand. Retorna sucesso. */
export async function copyText(renderer: AsciiRenderer): Promise<boolean> {
  const text = renderer.getText();
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* cai no fallback */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
