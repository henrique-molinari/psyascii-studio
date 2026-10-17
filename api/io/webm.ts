// Gravação WebM do canvas via MediaRecorder. Local, cancelável, limite de 15 s.
import { download } from './export';

export const MAX_WEBM_SECONDS = 15;
const MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export interface WebmHandle {
  /** Encerra e entrega o arquivo. */
  stop(): void;
  /** Descarta a gravação sem baixar. */
  cancel(): void;
}

export function webmSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && MIMES.some((m) => MediaRecorder.isTypeSupported(m));
}

/** Retorna null (e chama onError) quando não há suporte. onDone só roda após o download iniciar. */
export function recordWebm(
  canvas: HTMLCanvasElement, seconds: number, onDone: () => void, onError: (m: string) => void,
): WebmHandle | null {
  const mime = typeof MediaRecorder === 'undefined' ? undefined : MIMES.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime || typeof canvas.captureStream !== 'function') {
    onError('ERRO: gravação de vídeo indisponível neste navegador');
    return null;
  }
  const limit = Math.max(1, Math.min(MAX_WEBM_SECONDS, seconds)) * 1000;
  let stream: MediaStream, rec: MediaRecorder;
  try {
    stream = canvas.captureStream(30);
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  } catch {
    onError('ERRO: gravação de vídeo indisponível neste navegador');
    return null;
  }
  const chunks: Blob[] = [];
  let keep = true, finished = false;
  const timer = window.setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, limit);

  const release = (): void => {
    window.clearTimeout(timer);
    for (const tr of stream.getTracks()) tr.stop();
    rec.ondataavailable = null; rec.onstop = null; rec.onerror = null;
  };
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  rec.onerror = () => {
    if (finished) return;
    finished = true; keep = false;
    release();
    onError('ERRO: falha na gravação de vídeo');
  };
  rec.onstop = () => {
    if (finished) return;
    finished = true;
    release();
    if (!keep || chunks.length === 0) { if (keep) onError('ERRO: gravação vazia'); return; }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    download(new Blob(chunks, { type: 'video/webm' }), `psyascii-${stamp}.webm`); // download revoga a URL
    chunks.length = 0;
    onDone();
  };
  try { rec.start(250); } catch {
    release();
    onError('ERRO: gravação de vídeo indisponível neste navegador');
    return null;
  }
  return {
    stop() { if (rec.state !== 'inactive') rec.stop(); },
    cancel() {
      keep = false;
      if (rec.state !== 'inactive') rec.stop();
      else if (!finished) { finished = true; release(); }
    },
  };
}
