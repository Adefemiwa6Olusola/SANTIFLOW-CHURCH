import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Capture all console output
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type().toUpperCase()}]:`, msg.text());
  });

  page.on('pageerror', err => {
    console.log('PAGE UNCAUGHT EXCEPTION:', err.toString());
  });

  try {
    console.log('Navigating to login page...');
    const response = await page.goto('https://sanctiflow.vercel.app/login', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('Response status:', response.status());
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('Body HTML length:', bodyHTML.length);
    console.log('Body HTML preview:', bodyHTML.slice(0, 1000));
  } catch (err) {
    console.error('Error during test:', err);
  }

  await browser.close();
  console.log('Test complete.');
})();
