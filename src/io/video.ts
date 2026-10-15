// Entrada de vídeo local (P2 enxuta): <video> mudo em loop como fonte mutável do renderer.
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export interface LoadedVideo { source: HTMLVideoElement; w: number; h: number; dispose(): void }

export function videoSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const v = document.createElement('video');
  return !!(v.canPlayType('video/mp4') || v.canPlayType('video/webm') || v.canPlayType('video/ogg'));
}

export function validateVideo(file: File): string | null {
  if (!file.type.startsWith('video/')) return 'ERRO: arquivo não é um vídeo';
  if (file.size > MAX_VIDEO_BYTES) return 'ERRO: vídeo maior que 100 MB';
  if (file.size === 0) return 'ERRO: arquivo vazio';
  return null;
}

/** Abre o seletor de arquivos de vídeo (input transitório, fora do DOM). */
export function openVideoPicker(onFile: (f: File) => void): void {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'video/*';
  inp.addEventListener('change', () => { const f = inp.files?.[0]; if (f) onFile(f); }, { once: true });
  inp.click();
}

export async function loadVideoFile(file: File): Promise<LoadedVideo> {
  const bad = validateVideo(file);
  if (bad) throw new Error(bad);
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  let done = false;
  const dispose = (): void => {
    if (done) return;
    done = true;
    v.pause(); v.removeAttribute('src'); v.load();
    URL.revokeObjectURL(url);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => fail(), 8000);
      const cleanup = (): void => {
        window.clearTimeout(to);
        v.removeEventListener('loadeddata', ok); v.removeEventListener('error', fail);
      };
      const ok = (): void => { cleanup(); resolve(); };
      const fail = (): void => { cleanup(); reject(new Error('ERRO: não foi possível ler o vídeo')); };
      v.addEventListener('loadeddata', ok); v.addEventListener('error', fail);
      v.src = url;
    });
    if (!v.videoWidth || !v.videoHeight) throw new Error('ERRO: vídeo sem imagem');
    try { await v.play(); } catch { /* autoplay bloqueado: mostra o primeiro quadro */ }
  } catch (e) { dispose(); throw e; }
  return { source: v, w: v.videoWidth, h: v.videoHeight, dispose };
}
