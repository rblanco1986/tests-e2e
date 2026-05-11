const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 812 });

  const errors = [];
  const networkFails = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', res => { if (res.status() >= 400) networkFails.push({ url: res.url(), status: res.status() }); });

  await page.goto('https://www.ricardoblanco.com.br/market-chart', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[placeholder*="Ex:"]', { timeout: 20000 });

  // Usa PETR4.SA diretamente para simular seleção via dropdown
  const input = await page.$('input[placeholder*="Ex:"]');
  await input.click();
  await input.type('PETR4');
  await page.waitForTimeout(4000);

  // Tenta clicar no primeiro item da dropdown
  const dropdown = await page.$('[role="listbox"] [role="option"], [role="option"]');
  if (dropdown) {
    const text = await dropdown.innerText();
    console.log('Dropdown item:', text);
    await dropdown.click();
  } else {
    console.log('Sem dropdown, pressionando Enter');
    await input.press('Enter');
  }

  // Aguarda mais tempo para o gráfico renderizar
  await page.waitForTimeout(10000);

  // Verifica o valor atual do input
  const inputValue = await page.$eval('input[placeholder*="Ex:"]', el => el.value);
  console.log('Input value após seleção:', inputValue);

  // Verifica o DOM
  const domInfo = await page.evaluate(() => {
    const plot = document.querySelector('.js-plotly-plot');
    const svg = document.querySelector('.js-plotly-plot svg');
    const chartArea = document.querySelector('[class*="chart"], [class*="plot"], [class*="graph"]');

    // Procura qualquer elemento com altura > 0 que contenha SVG
    const svgs = document.querySelectorAll('svg');
    const svgInfo = Array.from(svgs).map(s => ({
      width: s.getBoundingClientRect().width,
      height: s.getBoundingClientRect().height,
      class: s.className?.toString().slice(0, 50),
    })).filter(s => s.width > 0 || s.height > 0);

    return {
      plotFound: !!plot,
      svgFound: !!svg,
      svgCount: svgs.length,
      svgInfo,
      plotHtml: plot ? plot.innerHTML.slice(0, 200) : null,
    };
  });

  console.log('DOM info:', JSON.stringify(domInfo, null, 2));
  console.log('Console errors:', errors);
  console.log('Network failures:', networkFails.filter(f => f.url.includes('ricardoblanco')));

  await page.screenshot({ path: 'mobile-debug2.png', fullPage: true });
  console.log('Screenshot salvo');
  await browser.close();
})();
