# DESIGN.md - PsyASCII Studio (terminal / chuva digital). Tokens: src/ui/tokens.css

## Layout
- Desktop (>=900px): `body{display:grid;grid-template-columns:340px 1fr;height:100dvh}`. Aside rolável (scroll fino), `<main>` centraliza a moldura do canvas com `padding:16px`.
- Moldura do canvas: barra de título (30px, `--bg-2`, texto `--green-dim`, "[ canvas ] 220x110  60fps" + botão pausa sempre visível) + canvas `max-width/height:100%` com `image-rendering:pixelated`; borda 1px `--line`, cantoneiras iguais ao painel.
- Mobile (<900px): canvas ocupa o topo (`height:55dvh`); painel vira gaveta: `position:fixed;inset:auto 0 0;height:min(70dvh,560px);transform:translateY(calc(100% - 56px))`, aberta `translateY(0)` (transition 200ms). Alça de 56px com abas rolando em x (`overflow-x:auto;scroll-snap-type:x`). Alvos `min-height:var(--touch)`. Fechada por padrão deixa o canvas visível; `padding-bottom:env(safe-area-inset-bottom)`.
- Seções: [01] IMAGEM ... [07] RECEITAS; uma aba ativa por vez no mobile, acordeão no desktop.

## Receitas CSS
- Painel com cantoneiras (CSS puro, sem imagens): `.panel{position:relative;background:var(--bg-1);border:1px solid var(--line);padding:16px;box-shadow:inset 0 0 24px rgba(0,255,65,.04)}` `.panel::before,.panel::after{content:"[";position:absolute;top:-1px;left:-3px;font:16px/1 var(--font-ui);color:var(--green);text-shadow:var(--glow)}` `.panel::after{content:"]";left:auto;right:-3px;top:auto;bottom:-1px}`. Variante SVG: 2 `<path d="M8 1H1v14h7" fill="none" stroke="currentColor"/>` espelhados via `transform:scaleX(-1)`, 4 cantos, `color:var(--green)`.
- Scanlines/vinheta (desligáveis por `[data-quality="low"]`): `.crt::after{content:"";position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.55))}` (estático, sem flicker).
- Botão: `.btn{min-height:var(--touch);padding:0 16px;font:14px var(--font-ui);color:var(--green);background:transparent;border:1px solid var(--green-dim);cursor:pointer}` `.btn:hover{background:var(--green);color:#000}` `.btn:disabled{color:var(--green-dark);border-color:var(--green-dark);cursor:not-allowed}` `.btn:active{transform:translateY(1px)}`.
- Toggle: `<button role="switch" aria-checked="true" class="tg">` com texto gerado: `.tg::before{content:"[ OFF ]"}` `.tg[aria-checked=true]::before{content:"[ ON ]";color:var(--green);text-shadow:var(--glow)}`; OFF em `--green-dim`. Largura fixa `7ch`, alvo 44px de altura. Rótulo é `<label>` ao lado (nunca só ON/OFF).
- Slider: `input[type=range]{appearance:none;height:var(--touch);background:transparent}` trilho `::-webkit-slider-runnable-track{height:2px;background:var(--green-dark)}` (+`::-moz-range-track`); marcador `::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-5px;background:var(--green);border:0;border-radius:0}` (+`::-moz-range-thumb`); preenchimento via `background:linear-gradient(var(--green-dim),var(--green-dim)) 0/var(--p,50%) 2px no-repeat`. Valor numérico à direita em `--text`, `tabular-nums`.
- Abas: `<div role="tablist">` com `<button role="tab">[01] IMAGEM</button>`; inativa `--green-dim`; ativa `--green`, `border-bottom:2px solid var(--green)`, glow; setas esquerda/direita movem; rótulo nunca abreviado só por número.
- Tooltip: `[role=tooltip]{position:absolute;background:#000;border:1px solid var(--green-dim);color:var(--text);font:14px var(--font-ui);padding:4px 8px;max-width:28ch;z-index:50}` prefixo `> `; aparece em hover (400ms) E foco; `aria-describedby`; Esc fecha. Mobile: toque longo ou ícone `[?]`.
- Cursor: `.cur::after{content:"\2590";color:var(--green);animation:blink 1s steps(1) infinite}` `@keyframes blink{50%{opacity:0}}` (1 Hz = 1 ciclo/s; ao digitar fica fixo).
- Digitação: JS revela 1 char/22ms, pulável por clique/tecla, `aria-live="polite"` recebe o texto completo de imediato.
- Erro: `.msg-err{border-left:3px solid var(--red);padding:8px 12px;color:var(--red);background:var(--bg-2)}` texto `ERRO: arquivo inválido (use PNG/JPG/WebP até 20 MB)`; `role="alert"`; ícone `[!]` além da cor. Sucesso `OK:` em `--green`; aviso `AVISO:` em `--amber`. Frases curtas, objetivas, com ação.
- Aviso de fotossensibilidade: modal `role="alertdialog"` sobre a chuva, `border:1px solid var(--amber)`, título VT323 28px `--amber` "AVISO DE FOTOSSENSIBILIDADE"; texto: "Esta ferramenta usa movimento e brilho. Pode afetar pessoas com epilepsia fotossensível. Use [ PAUSAR ] a qualquer momento; nada pisca mais de 3x/s." Checkbox "Reduzir movimento" (pré-marcado se `prefers-reduced-motion`), botão `[ ENTRAR ]` com foco inicial. Só na 1a visita (`localStorage psy.seen`).

## Tela de abertura (RainEngine, ~3,5 s, pulável a qualquer momento)
- Estados: `warning` (1a visita; chuva ao fundo, espera clique) -> `rain` -> `boot` -> `reveal` -> `done`. Visitas seguintes iniciam em `rain`. Esc/clique/tecla/botão "Pular" ->`reveal` curto (200ms).
- Timeline: 0-1,2s chuva cobre a tela (colunas nascem escalonadas); 0,8-2,4s linhas de boot digitadas ("> inicializando PsyASCII Studio...", "> carregando módulos...", "> pronto") com cursor; 2,4-3,5s colunas esvaziam de cima para baixo (máscara de scanline 4px descendo) e a UI faz fade-in 0->1; 3,5s overlay removido (`inert` na UI até lá, removido ao pular). Nunca bloqueia >4 s.
- Overlay `position:fixed;inset:0;z-index:100;background:#000`; canvas da chuva com atlas pré-renderizado; "Pular" fixo no canto inferior direito, 44px.

## Foco e teclado
- `:focus-visible{outline:2px solid var(--green);outline-offset:2px;box-shadow:0 0 0 4px #000}` global; nunca `outline:none` sem substituto. Em hover-invertido (fundo verde) o anel usa `--head`. Ordem de tab segue DOM: abas, controles, canvas. Dialog prende o foco e devolve ao fechar.

## Contraste AA (calculado, WCAG 2.x)
- `--text #b8ffc9` / `--bg-0` 18,2:1; / `--bg-2` 15,6:1. `--green #00ff41` / `--bg-0` 15,4:1; / `--bg-2` 13,2:1. `#000` / `--green` (hover) 15,4:1.
- `--green-dim #2fbf5a` / `--bg-0` 8,7:1; / `--bg-2` 7,5:1 (texto secundário e bordas de controle >=3:1).
- `--amber #ffb000` / `--bg-0` 11,5:1. `--red #ff4d4d` / `--bg-0` 6,4:1; / `--bg-2` 5,5:1.
- NÃO usar como texto: `--green-dark` / `--bg-0` 2,6:1 (só desabilitado, trilho do slider, decoração) e `--line` 1,7:1 (só divisórias). Controles ativos usam borda `--green-dim`.

## Reduced motion e qualidade
- `@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.cur::after{opacity:1}}`; JS lê `matchMedia` e liga `body.reduced`: abertura vira fade de 300ms sem chuva animada (um quadro estático), chuva ambiente estática, digitação instantânea, gaveta sem slide, efeitos do canvas começam desligados/lentos.
- Preferência do usuário "Animação de abertura" e "Qualidade" (scanlines/vinheta/glow) sobrepõem o padrão. Pausa global `[ PAUSAR ]` congela chuva, efeitos e cursor.
- Originalidade: apenas ornamentos SVG/CSS próprios, glifos genéricos, sem marcas, citações ou símbolos de obras existentes.
