// Monta o Pipeline a partir dos módulos de efeitos.
import type { Pipeline } from '../core/types';
import { warps } from './distort';
import { tunnelStage } from './feedback';
import { charStages } from './chars';
import { colorStages } from './colorfx';
import { postStages } from './post';

export function createPipeline(): Pipeline {
  return {
    warps,
    cellStages: [tunnelStage, ...charStages],
    colorStages,
    post: postStages,
    resize(cols: number, rows: number): void { void cols; void rows; },
    dispose(): void { /* assets de post são módulos estáticos e leves */ },
  };
}
