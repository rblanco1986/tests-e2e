# CLAUDE.md — tests-e2e

## Marco atual

- Suite Playwright E2E que valida `https://ricardoblanco.com.br` em produção real.
- Foco principal hoje: **MarketChart** (página com mais complexidade — gráficos Plotly, busca de ticker, múltiplas abas).
- Sem `.git` próprio (parte do produto Portfólio; vive como pasta no monorepo `c:\Dev\portfolio\tests-e2e\`).
- Hospedagem em `lovable_initial/tests-e2e/` desde antes do descolamento Lovable.

## Visão geral

Suite Playwright apontando para **URL de produção** (`https://www.ricardoblanco.com.br/market-chart`), não para dev local. Testa o estado real do site, não build local. Detecta:

- Quebras de UI funcional (busca de ticker, mudança de aba, render de gráfico)
- 5xx do backend `api.ricardoblanco.com.br` em consumo do MarketChart
- Erros no console do browser (CORS, 404 de assets, etc)
- Edge cases (caracteres especiais, janela muito pequena, timeout)

## Stack

| Camada | Tecnologia |
|---|---|
| Test framework | Playwright 1.49 |
| Linguagem | TypeScript |
| Browsers | Chromium (default) — Firefox/WebKit configuráveis |
| Scripts | `test`, `test:headed`, `test:report` |

## Estrutura

| Caminho | Função |
|---|---|
| `market-chart.spec.ts` | Suite principal (MarketChart) |
| `playwright.config.ts` | Configuração Playwright (browsers, timeouts, etc) |
| `debug-mobile*.js` | Scripts ad-hoc de debug visual mobile |
| `test-results/` | Outputs (gitignored — videos, traces, screenshots de falha) |
| `package.json` | Deps + scripts |

## Como rodar

| Ação | Comando |
|---|---|
| Instalar deps | `npm install` |
| Instalar browsers Playwright | `npx playwright install` |
| Rodar testes | `npm test` |
| Rodar headed (ver o browser) | `npm run test:headed` |
| Ver relatório último run | `npm run test:report` |

## Regras de negócio (do produto Portfólio que tests-e2e valida)

1. **MarketChart deve sempre renderizar gráfico** para tickers válidos (PETR4, VALE3, etc) — falha ≠ aceitável em produção.
2. **Disclaimer financeiro** deve estar visível na aba `model` — regra HARD do site ([CLAUDE.md do site](c:\Dev\portfolio\site\CLAUDE.md)).
3. **Console limpo** — sem erros 4xx/CORS em fluxos golden path.
4. **Performance**: `/api/chart` responde em < 8s (teste 10.2 do suite).

## Acoplamento com `site` (mudanças que quebram)

| Mudança no `site` | Impacto no tests-e2e |
|---|---|
| Renomear `<input placeholder="Ex: ...">` | Helper `goto()` quebra — atualizar seletor |
| Renomear/remover aba (ex: "Screener" → "Análise") | Teste 1.3 lista hard-coded de tabs — atualizar array |
| Trocar lib de chart (ex: Recharts → outra) | Seletor `.recharts-wrapper` no spec — substituir |
| Mudar URL base da página | Constante `URL` no topo do spec |

## Pendências

- CI workflow GitHub Actions com Playwright (não existe ainda).
- Cobrir Index page (landing) + FisioAgenda (case page).
- Testes de regressão visual com `expect(page).toHaveScreenshot()`.
- Mover URLs hardcoded para `.env.test`.

## O que evitar sem alinhamento

- Rodar testes contra prod com frequência alta (gera tráfego/load real).
- Atualizar `@playwright/test` major sem rodar full suite + ver screenshots.
- Adicionar testes flakey (intermittent failures degradam confiança da suite).

## Critério de qualidade

- Todos os testes em `market-chart.spec.ts` passam contra prod.
- Sem timeouts > 30s em condições normais.
- Sem dependência de dado de mercado em específico (testar com tickers líquidos — PETR4, VALE3 — que tem sempre dados).
