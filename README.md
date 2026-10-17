# PsyASCII Studio

Ferramenta web que converte imagens (e vídeos curtos) em arte ASCII psicodélica, com interface de terminal verde-fósforo. Tudo roda no navegador.

## Como rodar

```bash
npm install        # instala dependências
npm run dev        # servidor de desenvolvimento (Vite)
npm run build      # checagem de tipos (tsc) + build de produção em dist/
npm test           # testes unitários (Vitest)
npm run preview    # serve o build de produção localmente
```

## Estrutura de pastas

- `api/core`: tipos, tom/luminância, charsets, atlas de glifos, amostragem, cor, renderer e loop.
- `api/fx`: chuva digital (`rain.ts`), efeitos de distorção, feedback, caracteres, pós-processamento e cor; `index.ts` monta o pipeline.
- `api/io`: entrada de arquivos, exportação (PNG/TXT/HTML), WebM, vídeo de entrada e receitas.
- `api/state`: store de estado com undo/redo, presets e preferências.
- `web`: index.html, main.ts, estilos e `ui/` (painéis, controles, abertura, atalhos).
- `web/assets/fonts`: subset de fonte com katakana (U+3041-30FE).
- `test/`: testes das funções puras (núcleo e exportação).
- `docs/`: PROGRESS.md, DESIGN.md e demais documentos; `CLAUDE.md` fica na raiz.

## Recursos

- **Entrada:** arrastar e soltar, selecionar, colar ou usar uma imagem de exemplo gerada por código. Limite de 2048 px, com leitura de EXIF. Tipo e tamanho são validados.
- **Caracteres:** grade com proporção configurável, luminância, contraste, gama, brilho, inversão, detecção de bordas (Sobel), dithering e remoção de fundo claro.
- **Charsets:** clássico, blocos, Braille, katakana, binário e personalizado.
- **Cor:** mono, original, paleta por luminância, por ângulo ou raio, e ciclo de matiz.
- **Paletas:** 12 (Fósforo Verde, Âmbar CRT, Ciano Térmico, Magenta Neon, Ácido Roxo, Infravermelho, Arco-íris Corrompido, Duotone Verde e Preto, Calor, Aurora Digital, Sinal Perdido, Glitch RGB).
- **Efeitos:** 12 (domain warp, ondas, vórtice, caleidoscópio, espelho, túnel, rotação de matiz, aberração cromática, chuva digital, melt, jitter e glitch).
- **Efeitos interativos:** repelir, atrair, ondulação e revelar, controlados pelo ponteiro.
- **Pós:** brilho, linhas de varredura, vinheta e grão.
- **Vídeo de entrada:** carrega um vídeo curto e processa quadro a quadro.
- **Receitas:** salvas no localStorage do navegador ou compartilhadas por link com `#r=`.
- **Exportações:** PNG (1x, 2x, 4x), TXT, copiar texto, HTML autônomo (animado) e WebM.

## Atalhos

- `Espaço`: pausa ou retoma.
- `R`: randomiza os parâmetros.
- `Ctrl+Z` / `Ctrl+Y`: desfazer e refazer.
- `S`: exporta.
- `Alt+=` / `Alt+-` (ou `+` / `-`): aumenta ou diminui a fonte (6 a 48 px). Também há botões "A−" e "A+" em [02] CARACTERES.
- Em [01] IMAGEM, "Retirar fundo (automático)" e "Tolerância do fundo" isolam o sujeito: efeitos só o afetam e o PNG sai transparente.

## Privacidade

Tudo é processado localmente. Nenhuma imagem sai do navegador. O projeto não usa backend, analytics ou CDN; as fontes vêm de pacotes npm (`@fontsource`).

## Saúde e acessibilidade

- A primeira abertura mostra um aviso de fotossensibilidade. A abertura animada pode ser pulada com `Esc`, clique ou botão "Pular".
- Efeitos, chuva e cursor não piscam mais de 3 vezes por segundo por padrão.
- Com `prefers-reduced-motion`, a abertura vira um fade curto e a chuva fica estática.
- Um botão de pausa fica sempre visível.

## Limitações conhecidas

- O HTML exportado é monocromático, com 60 quadros (cerca de 3 s em loop).
- Microfone reativo e GIF animado não estão implementados. O GIF usa apenas o primeiro quadro.
- O WebM depende da API MediaRecorder do navegador.
- A fonte kana cobre apenas U+3041-30FE. Outros caracteres usam a fonte latina de fallback.
- Arrastar o canvas só funciona com zoom acima de 1 e com interação ligada.
- Os testes headless foram executados apenas no Microsoft Edge.
- A versão para celular não foi testada em dispositivo real.
