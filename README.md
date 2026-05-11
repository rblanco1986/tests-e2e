# tests-e2e — Playwright suite contra prod

Suite Playwright E2E que valida `https://ricardoblanco.com.br` em produção real. Foco em **MarketChart** (página mais complexa: Plotly + busca de ticker + múltiplas abas).

Pasta sem `.git` próprio — parte do produto **Portfólio**.

## Quick start

```bash
npm install
npx playwright install         # baixar browsers
npm test                       # roda toda a suite
npm run test:headed            # com browser visível
npm run test:report            # abrir relatório do último run
```

## Estrutura

- `market-chart.spec.ts` — suite principal (MarketChart em prod)
- `playwright.config.ts` — config (browsers, timeouts, retries)
- `debug-mobile*.js` — scripts ad-hoc de debug
- `test-results/` — outputs (gitignored)

## URL alvo

Hardcoded em `market-chart.spec.ts`:

```typescript
const URL = "https://www.ricardoblanco.com.br/market-chart";
```

A suite testa **prod direto**, não build local. Útil pra detectar quebras pós-deploy.

## Documentação

- [CLAUDE.md](CLAUDE.md) — visão geral, regras de negócio que valida, pendências.

## Histórico

- 2026-05-11: migração Plotly→Recharts em prod. Seletor atualizado de `.js-plotly-plot` para `.recharts-wrapper` (com `.first()` por causa de múltiplos charts/subplots).
