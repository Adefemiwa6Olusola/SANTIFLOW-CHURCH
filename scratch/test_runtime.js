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

  const email = `test_user_${Date.now()}@sanctiflow.com`;
  console.log(`Using email for test signup: ${email}`);

  try {
    console.log('Navigating to live signup page...');
    await page.goto('https://sanctiflow.vercel.app/projection?cb=' + Date.now(), {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Filling out signup form...');
    await page.type('#signup-name', 'QA Verification Bot');
    await page.type('#signup-church', 'SanctiFlow Automated Church');
    await page.type('#signup-email', email);
    await page.type('#signup-password', 'TestPassword123');

    console.log('Submitting signup form...');
    await Promise.all([
      page.click('#signup-submit-btn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    console.log('Current URL after navigation:', page.url());

    // Wait a couple of seconds for any async mounting or API calls
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Checking page HTML structure after login...');
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('Body HTML length:', bodyHTML.length);
    console.log('Body HTML preview:', bodyHTML.slice(0, 1500));
  } catch (err) {
    console.error('Error during signup or dashboard test:', err);
  }

  await browser.close();
  console.log('Test complete.');
})();
