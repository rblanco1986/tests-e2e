const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://www.ricardoblanco.com.br/market-chart', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder*="Ex:"]', { timeout: 20000 });

  const input = await page.$('input[placeholder*="Ex:"]');
  await input.click();
  await input.type('PETR4');
  await page.waitForTimeout(3000);
  const dropdown = await page.$('[role="listbox"] [role="option"]');
  if (dropdown) {
    await dropdown.click();
  } else {
    await input.press('Enter');
  }
  await page.waitForTimeout(6000);

  const info = await page.evaluate(() => {
    const el = document.querySelector('.js-plotly-plot');
    if (!el) return { found: false };
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const parent = el.parentElement;
    const grandParent = parent ? parent.parentElement : null;
    const parentStyle = parent ? window.getComputedStyle(parent) : {};
    const grandStyle = grandParent ? window.getComputedStyle(grandParent) : {};

    // Sobe até 5 níveis procurando quem tem height=0 ou display=none
    let node = el;
    const chain = [];
    for (let i = 0; i < 8; i++) {
      if (!node) break;
      const s = window.getComputedStyle(node);
      const r = node.getBoundingClientRect();
      chain.push({
        tag: node.tagName,
        class: node.className.toString().slice(0, 80),
        display: s.display,
        visibility: s.visibility,
        overflow: s.overflow,
        height: r.height,
        width: r.width,
      });
      node = node.parentElement;
    }

    return {
      found: true,
      display: style.display,
      visibility: style.visibility,
      width: rect.width,
      height: rect.height,
      inViewport: rect.top < window.innerHeight && rect.bottom > 0,
      chain,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'mobile-debug.png', fullPage: true });
  console.log('Screenshot salvo em mobile-debug.png');
  await browser.close();
})();
