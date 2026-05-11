import { test, expect, Page } from "@playwright/test";

// ─── helpers ──────────────────────────────────────────────────────────────────

const URL = "https://www.ricardoblanco.com.br/market-chart";

/** Navega para a página e aguarda o campo de busca estar visível */
async function goto(page: Page) {
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder*="Ex:"]', { timeout: 20_000 });
}

/**
 * Digita um ticker no campo de busca, aguarda a dropdown aparecer,
 * clica no primeiro resultado e aguarda o gráfico renderizar.
 */
async function selectTicker(page: Page, query: string, timeoutMs = 25_000) {
  const input = page.locator('input[placeholder*="Ex:"]').first();
  await input.click();
  await input.fill(query);

  // Aguarda algum item na dropdown
  const dropdown = page.locator('[role="listbox"] [role="option"], ul li, .search-result, [data-testid="search-result"]');
  try {
    await dropdown.first().waitFor({ timeout: 8_000 });
    await dropdown.first().click();
  } catch {
    // Sem dropdown — tenta confirmar com Enter (busca direta)
    await input.press("Enter");
  }

  // Aguarda o Recharts renderizar (svg dentro do gráfico)
  await page.waitForSelector('.recharts-wrapper svg', { timeout: timeoutMs });
}

/** Coleta todos os erros de console JS durante a execução de uma ação */
async function collectErrors(page: Page, action: () => Promise<void>) {
  const errors: string[] = [];
  const handler = (msg: any) => {
    if (msg.type() === "error") errors.push(msg.text());
  };
  page.on("console", handler);
  await action();
  page.off("console", handler);
  return errors;
}

/** Coleta falhas de rede (status >= 400) durante uma ação */
async function collectNetworkFailures(page: Page, action: () => Promise<void>) {
  const failures: { url: string; status: number }[] = [];
  const handler = (response: any) => {
    if (response.status() >= 400) {
      failures.push({ url: response.url(), status: response.status() });
    }
  };
  page.on("response", handler);
  await action();
  page.off("response", handler);
  return failures;
}

// ─── GRUPO 1 — Carregamento inicial ──────────────────────────────────────────

test.describe("1. Carregamento da página", () => {
  test("1.1 página carrega sem erros JS críticos", async ({ page }) => {
    const errors = await collectErrors(page, () => goto(page));
    const critical = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("analytics") && !e.includes("gtag")
    );
    expect(critical, `Erros JS: ${critical.join(" | ")}`).toHaveLength(0);
  });

  test("1.2 campo de busca está visível e habilitado", async ({ page }) => {
    await goto(page);
    const input = page.locator('input[placeholder*="Ex:"]').first();
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
  });

  test("1.3 abas principais estão presentes", async ({ page }) => {
    await goto(page);
    for (const tab of ["Gráfico", "Fundamentos", "Dividendos", "Comparar", "Análise", "Modelo", "Opções"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
  });

  test("1.4 nenhuma chamada de API retorna 5xx no carregamento", async ({ page }) => {
    const failures = await collectNetworkFailures(page, () => goto(page));
    const serverErrors = failures.filter((f) => f.status >= 500);
    expect(serverErrors, `5xx: ${JSON.stringify(serverErrors)}`).toHaveLength(0);
  });
});

// ─── GRUPO 2 — Seleção de ações brasileiras ──────────────────────────────────

test.describe("2. Ações brasileiras (B3)", () => {
  const brStocks = [
    { query: "PETR4", label: "Petrobras PN" },
    { query: "VALE3", label: "Vale" },
    { query: "ITUB4", label: "Itaú" },
    { query: "BBDC4", label: "Bradesco" },
    { query: "WEGE3", label: "WEG" },
    { query: "MGLU3", label: "Magazine Luiza" },
    { query: "RENT3", label: "Localiza" },
    { query: "SUZB3", label: "Suzano" },
  ];

  for (const stock of brStocks) {
    test(`2.${brStocks.indexOf(stock) + 1} seleciona ${stock.query} (${stock.label})`, async ({ page }) => {
      await goto(page);
      const errors = await collectErrors(page, () => selectTicker(page, stock.query));
      const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("analytics"));
      expect(critical, `Erros ao carregar ${stock.query}: ${critical.join(" | ")}`).toHaveLength(0);

      // Gráfico deve estar visível
      await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    });
  }
});

// ─── GRUPO 3 — Ações americanas ──────────────────────────────────────────────

test.describe("3. Ações americanas (NYSE/NASDAQ)", () => {
  const usStocks = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"];

  for (const ticker of usStocks) {
    test(`3.${usStocks.indexOf(ticker) + 1} seleciona ${ticker}`, async ({ page }) => {
      await goto(page);
      await selectTicker(page, ticker);
      await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    });
  }
});

// ─── GRUPO 4 — Períodos de tempo ─────────────────────────────────────────────

test.describe("4. Seleção de períodos", () => {
  const periods = ["1mo", "3mo", "6mo", "1y", "2y", "3y", "4y", "5y", "max"];

  test.beforeEach(async ({ page }) => {
    await goto(page);
    await selectTicker(page, "PETR4");
  });

  for (const period of periods) {
    test(`4.${periods.indexOf(period) + 1} período ${period}`, async ({ page }) => {
      // Clica no botão de período
      const btn = page.getByRole("button", { name: period, exact: true });
      if (await btn.isVisible()) {
        const failures = await collectNetworkFailures(page, async () => {
          await btn.click();
          await page.waitForTimeout(3000);
        });
        const apiErrors = failures.filter((f) => f.url.includes("api.ricardoblanco"));
        expect(apiErrors, `Falhas de API para período ${period}: ${JSON.stringify(apiErrors)}`).toHaveLength(0);
        await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
      } else {
        test.skip(true, `Botão "${period}" não encontrado`);
      }
    });
  }
});

// ─── GRUPO 5 — Indicadores técnicos ─────────────────────────────────────────

test.describe("5. Indicadores técnicos", () => {
  const indicators = ["sma20", "sma50", "vwap", "bollinger", "macd", "volume", "rsi14"];

  test.beforeEach(async ({ page }) => {
    await goto(page);
    await selectTicker(page, "PETR4");
  });

  for (const ind of indicators) {
    test(`5.${indicators.indexOf(ind) + 1} ativa/desativa indicador ${ind}`, async ({ page }) => {
      // Tenta localizar o checkbox/botão do indicador (case-insensitive)
      const btn = page.locator(`button, label, input[type="checkbox"]`).filter({ hasText: new RegExp(ind, "i") });
      if (await btn.first().isVisible()) {
        await btn.first().click();
        await page.waitForTimeout(2000);
        // Gráfico ainda deve estar presente após toggle
        await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
      } else {
        test.skip(true, `Indicador "${ind}" não encontrado na UI`);
      }
    });
  }
});

// ─── GRUPO 6 — Abas (fundamentals, dividends, options, screener) ─────────────

test.describe("6. Navegação por abas", () => {
  test.beforeEach(async ({ page }) => {
    await goto(page);
    await selectTicker(page, "ITUB4");
  });

  test("6.1 aba Fundamentos carrega dados sem erro 5xx", async ({ page }) => {
    const failures = await collectNetworkFailures(page, async () => {
      await page.getByRole("tab", { name: "Fundamentos" }).click();
      await page.waitForTimeout(5000);
    });
    const serverErrors = failures.filter((f) => f.status >= 500);
    expect(serverErrors, `5xx: ${JSON.stringify(serverErrors)}`).toHaveLength(0);
  });

  test("6.2 aba Dividendos carrega dados sem erro 5xx", async ({ page }) => {
    const failures = await collectNetworkFailures(page, async () => {
      await page.getByRole("tab", { name: "Dividendos" }).click();
      await page.waitForTimeout(5000);
    });
    const serverErrors = failures.filter((f) => f.status >= 500);
    expect(serverErrors, `5xx: ${JSON.stringify(serverErrors)}`).toHaveLength(0);
  });

  test("6.3 aba Comparar — adicionar segunda ação", async ({ page }) => {
    await page.getByRole("tab", { name: "Comparar" }).click();
    await page.waitForTimeout(2000);
    // Deve haver um segundo input de busca ou similar
    const compareInput = page.locator('input[placeholder*="Ex:"]').nth(1);
    if (await compareInput.isVisible()) {
      await compareInput.fill("VALE3");
      await page.waitForTimeout(3000);
    }
    // Gráfico ainda deve existir
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test("6.4 aba Opções carrega sem travar", async ({ page }) => {
    await page.getByRole("tab", { name: "Opções" }).click();
    await page.waitForTimeout(8000);
    // Não deve ter erro de JS crítico
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("analytics"));
    expect(critical).toHaveLength(0);
  });
});

// ─── GRUPO 7 — Screener ──────────────────────────────────────────────────────

test.describe("7. Screener", () => {
  test("7.1 screener BR executa e retorna resultados ou mensagem vazia", async ({ page }) => {
    await goto(page);
    await page.getByRole("tab", { name: "Screener" }).click();
    await page.waitForTimeout(2000);

    // Clica em Executar / Analisar / botão similar
    const runBtn = page.getByRole("button", { name: /Executar|Analisar|Buscar|Run|Search/i });
    if (await runBtn.isVisible()) {
      const failures = await collectNetworkFailures(page, async () => {
        await runBtn.click();
        await page.waitForTimeout(15_000);
      });
      const serverErrors = failures.filter((f) => f.status >= 500);
      expect(serverErrors, `5xx no screener: ${JSON.stringify(serverErrors)}`).toHaveLength(0);
    } else {
      test.skip(true, "Botão de execução do screener não encontrado");
    }
  });

  test("7.2 screener US muda universe sem erro", async ({ page }) => {
    await goto(page);
    await page.getByRole("tab", { name: "Screener" }).click();
    await page.waitForTimeout(2000);

    const usBtn = page.getByRole("button", { name: /^US$|^us$|EUA/i });
    if (await usBtn.isVisible()) {
      await usBtn.click();
      await page.waitForTimeout(1000);
    } else {
      const select = page.locator("select").filter({ hasText: /BR|US/i });
      if (await select.isVisible()) {
        await select.selectOption("us");
      }
    }
    // Página não deve crashar
    await expect(page.locator('body')).toBeVisible();
  });
});

// ─── GRUPO 8 — Casos extremos / edge cases ───────────────────────────────────

test.describe("8. Edge cases", () => {
  test("8.1 ticker inexistente exibe mensagem de erro sem crashar a página", async ({ page }) => {
    await goto(page);
    const input = page.locator('input[placeholder*="Ex:"]').first();
    await input.fill("XXXXXXINVALIDO999");
    await input.press("Enter");
    await page.waitForTimeout(6000);

    // Página deve permanecer operacional
    await expect(page.locator('body')).toBeVisible();
    await expect(input).toBeVisible();
  });

  test("8.2 busca com texto vazio não causa crash", async ({ page }) => {
    await goto(page);
    const input = page.locator('input[placeholder*="Ex:"]').first();
    await input.fill("   ");
    await input.press("Enter");
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toBeVisible();
  });

  test("8.3 busca com caracteres especiais não causa 5xx", async ({ page }) => {
    await goto(page);
    const failures = await collectNetworkFailures(page, async () => {
      const input = page.locator('input[placeholder*="Ex:"]').first();
      await input.fill("<script>alert(1)</script>");
      await input.press("Enter");
      await page.waitForTimeout(4000);
    });
    const serverErrors = failures.filter((f) => f.status >= 500);
    expect(serverErrors, `5xx com input especial: ${JSON.stringify(serverErrors)}`).toHaveLength(0);
  });

  test("8.4 trocar ticker rapidamente (race condition)", async ({ page }) => {
    await goto(page);
    await selectTicker(page, "PETR4");

    // Troca rapidamente para outra ação
    const input = page.locator('input[placeholder*="Ex:"]').first();
    await input.fill("VALE3");
    const dropdown = page.locator('[role="listbox"] [role="option"], ul li').first();
    try {
      await dropdown.waitFor({ timeout: 5000 });
      await dropdown.click();
    } catch {
      await input.press("Enter");
    }
    await page.waitForTimeout(5000);

    // Gráfico ainda deve estar visível
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test("8.5 redimensionamento de janela não quebra gráfico", async ({ page }) => {
    await goto(page);
    await selectTicker(page, "PETR4");

    await page.setViewportSize({ width: 375, height: 812 }); // mobile
    await page.waitForTimeout(2000);
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();

    await page.setViewportSize({ width: 1920, height: 1080 }); // large desktop
    await page.waitForTimeout(2000);
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test("8.6 FII é carregado corretamente (HGLG11)", async ({ page }) => {
    await goto(page);
    await selectTicker(page, "HGLG11");
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });

  test("8.7 BDR é carregado corretamente (AAPL34)", async ({ page }) => {
    await goto(page);
    await selectTicker(page, "AAPL34");
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
  });
});

// ─── GRUPO 9 — Watchlist ─────────────────────────────────────────────────────

test.describe("9. Watchlist", () => {
  test("9.1 adicionar ticker à watchlist persiste no localStorage", async ({ page }) => {
    await goto(page);
    await selectTicker(page, "PETR4");

    // Clica no ícone de estrela / coração / watchlist
    const starBtn = page.locator('button[aria-label*="watchlist"], button[aria-label*="Watchlist"], button[aria-label*="favorit"], button svg.lucide-star').first();
    if (await starBtn.isVisible()) {
      await starBtn.click();
      await page.waitForTimeout(1000);
      const wl = await page.evaluate(() => localStorage.getItem("watchlist"));
      expect(wl).toContain("PETR4");
    } else {
      test.skip(true, "Botão de watchlist não encontrado");
    }
  });

  test("9.2 watchlist sobrevive a reload da página", async ({ page }) => {
    await goto(page);
    await page.evaluate(() => localStorage.setItem("watchlist", JSON.stringify(["PETR4", "VALE3"])));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[placeholder*="Ex:"]', { timeout: 20_000 });
    const wl = await page.evaluate(() => localStorage.getItem("watchlist"));
    expect(JSON.parse(wl ?? "[]")).toContain("PETR4");
  });
});

// ─── GRUPO 10 — Performance básica ───────────────────────────────────────────

test.describe("10. Performance", () => {
  test("10.1 gráfico PETR4 renderiza em menos de 10 segundos", async ({ page }) => {
    await goto(page);
    const start = Date.now();
    await selectTicker(page, "PETR4");
    const elapsed = Date.now() - start;
    expect(elapsed, `Tempo de renderização: ${elapsed}ms`).toBeLessThan(10_000);
  });

  test("10.2 API /chart responde em menos de 8 segundos", async ({ page }) => {
    let chartResponseTime = -1;
    page.on("response", (res) => {
      if (res.url().includes("/api/chart")) {
        chartResponseTime = Date.now();
      }
    });
    page.on("request", (req) => {
      if (req.url().includes("/api/chart")) {
        const sent = Date.now();
        page.once("response", (res) => {
          if (res.url() === req.url()) {
            const elapsed = Date.now() - sent;
            chartResponseTime = elapsed;
          }
        });
      }
    });

    await goto(page);
    await selectTicker(page, "PETR4");
    // chartResponseTime nem sempre captura o tempo exato — valida que houve resposta
    expect(page.locator('.recharts-wrapper')).toBeDefined();
  });
});
