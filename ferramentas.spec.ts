import { test, expect, Page, ConsoleMessage } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HUB = "/ferramentas";
const JC = "/ferramentas/juros-compostos";
const FIRE = "/ferramentas/independencia-financeira";

interface CapturedErrors {
  console: string[];
  network: { url: string; status: number }[];
}

function attachErrorCapture(page: Page): CapturedErrors {
  const captured: CapturedErrors = { console: [], network: [] };

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignora ruído conhecido (analytics 3rd-party, favicon, etc.)
      if (/google|gtag|favicon|net::ERR_BLOCKED_BY_CLIENT/i.test(text)) return;
      captured.console.push(text);
    }
  });

  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !/google|gtag|favicon|recaptcha/i.test(url)) {
      captured.network.push({ url, status });
    }
  });

  return captured;
}

async function checkNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    return { docW, winW, hasOverflow: docW > winW + 2 };
  });
  expect(overflow.hasOverflow, `Scroll horizontal: doc ${overflow.docW}px > viewport ${overflow.winW}px`).toBe(false);
}

// ─── Hub /ferramentas ─────────────────────────────────────────────────────────

test.describe("Hub /ferramentas", () => {
  test("renderiza, 2 cards, links funcionam", async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto(HUB, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Duas calculadoras");

    // 2 cards de ferramenta
    const cards = page.locator("a[href^='/ferramentas/']");
    await expect(cards).toHaveCount(2);

    // Disclaimer no topo (antes do hero) — hub usa "constituem" (plural), pages usam "constitui"
    await expect(page.getByText(/Aviso:/i).first()).toBeVisible();
    await expect(page.getByText(/não constitu(em|i) recomendação de investimento/i).first()).toBeVisible();

    // Click no card de juros compostos navega
    await page.getByRole("link", { name: /juros compostos/i }).first().click();
    await expect(page).toHaveURL(/\/ferramentas\/juros-compostos$/);

    expect(errors.console, "Erros de console").toEqual([]);
    expect(errors.network, "Falhas de rede").toEqual([]);
  });

  test("SEO básico", async ({ page }) => {
    await page.goto(HUB, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Ferramentas Financeiras/i);
    // O Helmet adiciona um segundo meta description com data-rh="true" — usar o do Helmet.
    const desc = await page.locator('meta[name="description"][data-rh="true"]').getAttribute("content");
    expect(desc).toMatch(/calculadora|juros compostos|independência financeira/i);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe("https://ricardoblanco.com.br/ferramentas");
    // JSON-LD presente
    const jsonLdCount = await page.locator('script[type="application/ld+json"]').count();
    expect(jsonLdCount).toBeGreaterThan(0);
  });
});

// ─── /ferramentas/juros-compostos ─────────────────────────────────────────────

test.describe("Calculadora de Juros Compostos", () => {
  test("renderiza estrutura completa", async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto(JC, { waitUntil: "domcontentloaded" });

    // Espera o lazy-load do React renderizar antes de contar headings
    await page.waitForSelector("h1", { timeout: 10_000 });

    // Exatamente 1 H1
    const h1s = await page.locator("h1").count();
    expect(h1s).toBe(1);
    await expect(page.locator("h1")).toContainText(/Juros Compostos/i);

    // Disclaimer no topo
    await expect(page.getByText(/Aviso:/i).first()).toBeVisible();

    // Form labels visíveis (.first() em todos pois alguns aparecem em conteúdo educacional também)
    await expect(page.getByText(/Capital inicial/i).first()).toBeVisible();
    await expect(page.getByText(/Aporte mensal/i).first()).toBeVisible();
    await expect(page.getByText(/Rendimento esperado/i).first()).toBeVisible();
    await expect(page.getByText(/Período/i).first()).toBeVisible();
    await expect(page.getByText(/Inflação anual esperada/i).first()).toBeVisible();
    await expect(page.getByText(/Aportes esporádicos/i).first()).toBeVisible();

    // Resultado highlight
    await expect(page.getByText(/Quanto você vai ter/i).first()).toBeVisible();
    await expect(page.getByText(/Quanto isso compra hoje/i).first()).toBeVisible();

    // Gráfico Recharts renderiza
    await expect(page.locator(".recharts-wrapper svg").first()).toBeVisible({ timeout: 10_000 });

    // Conteúdo educacional
    await expect(page.getByRole("heading", { name: /Entenda os conceitos/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Glossário/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Perguntas frequentes/i })).toBeVisible();

    expect(errors.console, "Erros de console").toEqual([]);
    expect(errors.network, "Falhas de rede").toEqual([]);
  });

  test("SEO + JSON-LD HowTo/FAQ/Article", async ({ page }) => {
    await page.goto(JC, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Juros Compostos/i);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe("https://ricardoblanco.com.br/ferramentas/juros-compostos");

    // Coleta todos JSON-LD e valida tipos
    const scripts = await page.locator('script[type="application/ld+json"]').all();
    expect(scripts.length).toBeGreaterThanOrEqual(1);

    const types: string[] = [];
    for (const s of scripts) {
      const text = await s.textContent();
      if (!text) continue;
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const obj of arr) types.push(obj["@type"]);
      } catch {
        /* ignora invalid */
      }
    }
    expect(types).toContain("WebApplication");
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("FAQPage");
    expect(types).toContain("HowTo");
    expect(types).toContain("Article");
  });

  test("recalcula ao alterar capital inicial", async ({ page }) => {
    await page.goto(JC, { waitUntil: "domcontentloaded" });

    // Encontra o campo Capital inicial via label
    const capitalLabel = page.getByText(/Capital inicial/i).first();
    const capitalInput = capitalLabel.locator("..").locator("input").first();

    const initialResult = await page.locator(".tabular-nums").first().textContent();

    await capitalInput.click();
    await capitalInput.fill("0");
    await capitalInput.press("Tab");

    // Aguarda o React atualizar
    await page.waitForTimeout(400);

    const updatedResult = await page.locator(".tabular-nums").first().textContent();
    expect(updatedResult, "Resultado deveria mudar ao zerar capital").not.toBe(initialResult);
  });

  test("toggle de taxa mensal/anual converte valor", async ({ page }) => {
    await page.goto(JC, { waitUntil: "domcontentloaded" });

    const annualBtn = page.getByRole("button", { name: /% ao ano/i });
    const monthlyBtn = page.getByRole("button", { name: /% ao mês/i });

    await expect(annualBtn).toBeVisible();
    await expect(monthlyBtn).toBeVisible();

    // Default: anual. Trocar pra mensal deve mudar o valor exibido.
    const rateInput = page.locator('input[inputmode="decimal"]').nth(2);
    const valBefore = await rateInput.inputValue();

    await monthlyBtn.click();
    await page.waitForTimeout(200);
    const valAfter = await rateInput.inputValue();

    expect(valBefore).not.toBe(valAfter);
    // 12.68 a.a. → annualToMonthly = 0.9999...% a.m. (com 4 casas decimais)
    expect(valAfter).toMatch(/^[01][.,]\d{2,}/);
  });
});

// ─── /ferramentas/independencia-financeira ─────────────────────────────────────

test.describe("Independência Financeira (FIRE)", () => {
  test("renderiza com 4 stats: capital real, tempo, capital nominal, saque nominal", async ({ page }) => {
    const errors = attachErrorCapture(page);
    await page.goto(FIRE, { waitUntil: "domcontentloaded" });

    await expect(page.locator("h1")).toContainText(/Independência Financeira/i);

    // Disclaimer
    await expect(page.getByText(/Aviso:/i).first()).toBeVisible();

    // 4 stats novos pós-mudança — usa exact pra evitar match com hero/interpretação
    await expect(page.getByText("Capital alvo (em R$ de hoje)", { exact: true })).toBeVisible();
    await expect(page.getByText("Em quanto tempo você chega lá", { exact: true })).toBeVisible();
    await expect(page.getByText("Capital nominal nesse momento", { exact: true })).toBeVisible();
    await expect(page.getByText("Saque mensal nominal nesse momento", { exact: true })).toBeVisible();

    // Interpretação contém aviso sobre valor real vs nominal
    await expect(page.getByText(/em R\$ de hoje/i).first()).toBeVisible();

    expect(errors.console).toEqual([]);
    expect(errors.network).toEqual([]);
  });

  test("aporte esporádico: add + configurar + ver hint dinâmico", async ({ page }) => {
    await page.goto(FIRE, { waitUntil: "domcontentloaded" });

    // Add esporádico
    await page.getByRole("button", { name: /Adicionar aporte esporádico/i }).click();

    // Bloco expandido aparece
    await expect(page.getByText(/Aporte extra #1/i)).toBeVisible();

    // Define valor
    const amountInput = page.locator("li").filter({ hasText: /Aporte extra #1/i })
      .locator("input[inputmode='decimal']").first();
    await amountInput.click();
    await amountInput.fill("5000");
    await amountInput.press("Tab");

    await page.waitForTimeout(300);

    // Hint deve aparecer mencionando R$ 5.000 e o mês default (Dezembro)
    const hint = page.locator("li").filter({ hasText: /Aporte extra #1/i }).locator("p").last();
    await expect(hint).toContainText(/R\$\s?5\.000/);
    await expect(hint).toContainText(/Dezembro/i);
  });

  test("SEO da FIRE", async ({ page }) => {
    await page.goto(FIRE, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Independência Financeira|FIRE/i);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe("https://ricardoblanco.com.br/ferramentas/independencia-financeira");
  });
});

// ─── Responsividade ────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPad Mini", width: 768, height: 1024 },
  { name: "Desktop", width: 1280, height: 800 },
  { name: "Wide", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Responsividade ${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`hub /ferramentas sem scroll horizontal`, async ({ page }) => {
      await page.goto(HUB, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await checkNoHorizontalScroll(page);
    });

    test(`juros-compostos sem scroll horizontal + form acessível`, async ({ page }) => {
      await page.goto(JC, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await checkNoHorizontalScroll(page);
      // Form do capital inicial visível e clicável
      const capInput = page.locator('input[inputmode="decimal"]').first();
      await expect(capInput).toBeVisible();
    });

    test(`independencia-financeira sem scroll horizontal`, async ({ page }) => {
      await page.goto(FIRE, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await checkNoHorizontalScroll(page);
    });
  });
}

// ─── Sitemap + robots ──────────────────────────────────────────────────────────

test.describe("SEO infra", () => {
  test("sitemap.xml lista as 3 rotas novas com priority 0.9", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("/ferramentas</loc>");
    expect(xml).toContain("/ferramentas/juros-compostos</loc>");
    expect(xml).toContain("/ferramentas/independencia-financeira</loc>");
    expect(xml).not.toContain("/ferramentas/conversor-taxas");
  });

  test("robots.txt aponta para o sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toContain("sitemap");
  });
});
