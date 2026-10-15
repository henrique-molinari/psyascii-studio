// Monta o Pipeline a partir dos módulos de efeitos.
import type { Pipeline } from '../core/types';
import { warps } from './distort';
import { tunnelStage, resetFeedback } from './feedback';
import { charStages } from './chars';
import { colorStages, resetColorfx } from './colorfx';
import { postStages, resetPost } from './post';

export function createPipeline(): Pipeline {
  return {
    warps,
    cellStages: [tunnelStage, ...charStages],
    colorStages,
    post: postStages,
    resize(cols: number, rows: number): void { void cols; void rows; },
    dispose(): void { resetFeedback(); resetColorfx(); resetPost(); },
  };
}
