// Store simples com histórico (desfazer/refazer). Params é JSON puro.
import { defaultParams, clampParams } from '../core/types';
import type { Params } from '../core/types';

export interface Store {
  get(): Params;
  set(patch: Partial<Params>): void;
  subscribe(fn: (p: Params) => void): () => void;
  commit(): void;
  undo(): void;
  redo(): void;
}

const MAX_HISTORY = 100;
const clone = (p: Params): Params => JSON.parse(JSON.stringify(p)) as Params;

export function createStore(initial: Params = defaultParams()): Store {
  let state = clampParams(initial);
  const subs = new Set<(p: Params) => void>();
  const past: Params[] = [];
  const future: Params[] = [];
  let committed = clone(state);

  const emit = () => { for (const fn of subs) fn(state); };

  return {
    get: () => state,
    set(patch) {
      state = clampParams({ ...state, ...patch });
      emit();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    commit() {
      if (JSON.stringify(committed) === JSON.stringify(state)) return;
      past.push(committed);
      if (past.length > MAX_HISTORY) past.shift();
      future.length = 0;
      committed = clone(state);
    },
    undo() {
      const prev = past.pop();
      if (!prev) return;
      future.push(committed);
      committed = prev;
      state = clone(prev);
      emit();
    },
    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(committed);
      committed = next;
      state = clone(next);
      emit();
    },
  };
}
