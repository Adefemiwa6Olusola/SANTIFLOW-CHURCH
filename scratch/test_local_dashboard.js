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
    const email = `test_bot_${Date.now()}@sanctiflow.com`;
    console.log(`Using email for test signup: ${email}`);

    console.log('Navigating to signup page...');
    await page.goto('https://sanctiflow.vercel.app/signup', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Filling out signup form...');
    await page.type('#signup-name', 'Dashboard Tester');
    await page.type('#signup-church', 'Test Church');
    await page.type('#signup-email', email);
    await page.type('#signup-password', 'Password123!');

    console.log('Submitting signup...');
    await Promise.all([
      page.click('#signup-submit-btn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    console.log('Redirected URL after signup:', page.url());
    
    // Wait for 5 seconds on the dashboard to capture any async runtime crash
    console.log('Waiting on dashboard...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('Dashboard body HTML length:', bodyHTML.length);
    console.log('Dashboard body HTML preview:', bodyHTML.slice(0, 1000));

  } catch (err) {
    console.error('Error during dashboard testing:', err);
  }

  await browser.close();
  console.log('Test complete.');
})();
