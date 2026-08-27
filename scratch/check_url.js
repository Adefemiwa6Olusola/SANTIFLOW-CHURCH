import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const urls = [
    'https://sanctiflow.vercel.app/display',
    'https://sanctiflow.vercel.app/projection',
    'https://sanctiflow.vercel.app/overlay'
  ];

  for (const url of urls) {
    const page = await browser.newPage();
    console.log(`\n=== Testing URL: ${url} ===`);

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR]:`, msg.text());
      }
    });

    page.on('pageerror', err => {
      console.log('PAGE UNCAUGHT EXCEPTION:', err.toString());
    });

    try {
      await page.goto(`${url}?cb=${Date.now()}`, {
        waitUntil: 'networkidle2',
        timeout: 20000
      });
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log(`Rendered successfully. HTML length: ${bodyHTML.length}`);
    } catch (err) {
      console.log(`Failed to load ${url}:`, err.message);
    }
    await page.close();
  }

  await browser.close();
  console.log('\nAll checks complete.');
})();
