# PROGRESS.md — PsyASCII Studio

## Estado
- Fase 0: em andamento (git, scaffold Vite+TS+Vitest, tokens.css, fonts.css, agentes em .claude/agents, DESIGN.md)
- Próximo: Fase 1 (núcleo)

## DECISÕES
- CLAUDE.md estava em docs/; copiado para a raiz.
- Fonte kana: subset único do DotGothic16 (U+3041-30FE, 8 KB) copiado de @fontsource para src/assets/fonts/kana.woff2 (bundle bem < 1 MB); latim via @fontsource. Katakana usado só em U+30A1-30E1/30E3-30ED (cobertos); fallback latim se a fonte falhar.
- Cor por célula: atlas de glifos BRANCOS (1 linha) + camada offscreen; cor aplicada com 'source-in' usando um canvas cols×rows (1 px/célula) ampliado sem suavização. Zero fillText por quadro, zero alocação.
- Brilho (glow) = camada reduzida (1/4) reampliada com 'lighter'. Aberração cromática, hue e tunnel são feitos em espaço de célula (CPU).
- Subagentes de projeto (.claude/agents) podem não ser registrados na sessão: usar general-purpose com o papel descrito no arquivo do agente.

## CONTRATOS (definidos UMA vez)
Param. nomes exatos em src/core/types.ts (desenvolvedor Fase 1 cria; demais leem):
- Params: cols(20-300,160) cellAspect(.3-1,.5) contrast(0-2,1) gamma(.3-3,1) brightness(-1..1,0) invert edges(0-1,0) dither bgCut(0-1,0=off) charset:'classic'|'blocks'|'braille'|'katakana'|'binary'|'custom' custom:string fontSize(8-24,12) fontFamily:'mono'|'kana' colorMode:'mono'|'original'|'lum'|'angle'|'radius'|'hue' palette:PaletteId hueSpeed(0-1) fx:Record<EffectId,FxState> mix(0-1,1) post:Record<PostId,FxState> kaleidoN(2-12,6) interact:'off'|'repel'|'attract'|'ripple'|'reveal' interactRadius(2-40,12) seed:number
- FxState {on:boolean; amt:number 0-1; speed:number 0-1}. EffectId='warp'|'wave'|'vortex'|'kaleido'|'mirror'|'tunnel'|'hue'|'aberr'|'rain'|'melt'|'jitter'|'glitch'. PostId='glow'|'scan'|'vignette'|'grain'.
- PaletteId (12, ids kebab): fosforo-verde, ambar-crt, ciano-termico, magenta-neon, acido-roxo, infravermelho, arco-iris-corrompido, duotone-verde-preto, calor, aurora-digital, sinal-perdido, glitch-rgb. API: PALETTES:{id,name}[]; paletteColor(id,t01,out:Uint8ClampedArray,o:number):void (sem alocar).
- defaultParams():Params; clampParams(p:Partial<Params>):Params (valida tudo, usada em receitas/hash); JSON puro.
Pipeline por quadro (AsciiRenderer em src/core/renderer.ts):
 1) para cada célula (x,y): (sx,sy)=(x,y); aplica WarpEffect ativos em ordem; amostra Grid (nearest, clamp) -> ctx.lum/r/g/b/mask. Mix interpola sx,sy entre original e distorcido.
 2) CellStage[] (tunnel feedback, melt -> ctx.shift, rain overlay -> ctx.lum/glyphOverride)
 3) lum+shift -> índice de glifo (rampa por charset; escuro=espaço); cor por colorMode escrita em ImageData cols×rows
 4) ColorStage[] (hue, aberr) ; 5) desenho atlas + source-in ; 6) PostStage[] (glow, scan, vignette, grain, reveal)
Tipos (types.ts): Grid{cols,rows,lum:Float32Array,r,g,b:Uint8ClampedArray,mask:Uint8Array}; FrameCtx{params,t,dt,grid,cols,rows,lum,r,g,b,mask,shift:Float32Array,glyphOverride:Int16Array,ptr:{x,y,down,active}}; WarpEffect{id,enabled(p),prepare(ctx),map(x,y,out:Float32Array)}; CellStage=(ctx)=>void; PostStage{id,draw(c:CanvasRenderingContext2D,w,h,ctx:FrameCtx)}; Pipeline{warps:WarpEffect[];cellStages:CellStage[];colorStages:CellStage[];post:PostStage[];resize(cols,rows):void;dispose():void}.
Renderer: new AsciiRenderer(canvas, pipeline?) ; setSource(src:CanvasImageSource,w,h); setParams(p); frame(t,dt,ptr); getText():string; exportCanvas(scale:1|2|4):HTMLCanvasElement; dispose(). Sem pipeline = só núcleo.
RainEngine (src/fx/rain.ts): new RainEngine({fontSize,reduced}); attach(canvas) ; resize(cssW,cssH,dpr); step(dt); draw(); setReveal(p 0..1 de cima p/ baixo); setOpacity(a); fillField(cols,rows,out:Float32Array,t):void (intensidade por célula, para efeito 'rain'); static columnsFor(w,fontSize,mobile); dispose(). Glifos: Katakana coberto + dígitos + símbolos; fallback latim. DPR≤2, pausa em aba oculta.
Store (src/ui/store.ts): get(), set(patch), subscribe(fn)->unsub, commit() (empilha undo), undo(), redo(). Receita: encodeRecipe(p)->string base64url; decodeRecipe(s)->Params|null (src/io/recipes.ts).
Módulos: src/core/{types,tone,charsets,atlas,sampler,color,renderer,loop}.ts, src/fx/{rain,distort,feedback,chars,post,index}.ts (index exporta createPipeline()), src/io/{input,export,recipes,video}.ts, src/ui/*.

## Fases
- Fase 0: feita (commit). Fase 1: núcleo escrito, build ok; validador F1 apontou (a corrigir): [F3 em main.ts] atalhos disparam em TEXTAREA/SELECT, pagehide/bfcache, ImageBitmap antigo sem close(), pipeline não ligado; [F5] sampler getImageData aloca por chamada, canvas gigante (cols 300 × DPR 2) precisa limite de área, 1 drawImage/célula (gargalo), input sem limite de pixels, export limita só o lado (limitar área), urls morto em input.ts.
- Ponteiro ptr é NORMALIZADO 0..1 (main.ts -> renderer -> fx). Interact = WarpEffect id "interact" em distort.ts; reveal em post.ts via setRevealSource.
- Validador F2 (corrigir na F5): grain troca offset a 12 Hz → ≤3 Hz (regra 8); feedback prev não zera quando cols×rows trocam com mesmo produto; rain grava glyphOverride com mix=0; NaN em warps (cellAspect=0) → guarda no renderer; createPipeline.dispose vazio (zerar estado de módulo); jitter/glitch com folga (≤2,5/s); ensureAtlas faz join por quadro; túnel ignora mask.
- Validador F3 (corrigir na F5, sem ALTA): atalhos R/S/Ctrl+Z ativos sob o aviso modal (shortcuts.ts:18/main.ts:126); foco não volta após intro porque #app ainda inert (intro.ts:61/main.ts:185); "Rever abertura" ignorado com intro off (force); botões de zoom <44px no celular (style.css:62); editing() trata input range como texto (shortcuts.ts:13); título digitado ignora prefs.intensity reduced; trilho de slider/borda intro-btn com --green-dark (<3:1); sem limite de receitas; sem hashchange; #cv tabindex sem função.
- Smoke test (Edge headless via playwright-core em scratchpad): abertura+UI+12 efeitos rodam sem erro de console.
- Fase 4 feita (exportHtml mono, webm, video). Próximo: F5 correções + testes + performance.

## FINAL
- Fase 5 concluída: correções F1–F3 aplicadas, validador final sem ALTA; 4 MÉDIAS corrigidas (readDims antes de decodificar, HTML exportado com pausa/reduced-motion/sem corte, atlas independente de cols). Testes 30/30, build ok. Performance (Edge headless, 220 cols): frame() 36→4,5 ms sem efeitos; 6 efeitos 51,7→15 ms (~51 rAF/s; warps por célula são o suspeito).
- Smoke Edge: aviso+abertura+UI, 12 efeitos, mobile 390 px sem overflow, upload real e arquivo inválido sem erros de console.
- Limitações: microfone reativo e GIF animado não implementados; HTML exportado monocromático; WebM/vídeo não exercitados em navegador real; celular real não testado.
