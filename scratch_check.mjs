import puppeteer from 'puppeteer';

(async () => {
  try {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      } else {
        console.log('PAGE LOG:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('UNCAUGHT PAGE ERROR:', error.message);
    });

    page.on('requestfailed', request => {
      console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
    });

    console.log("Navigating to localhost:5173...");
    await page.goto('http://localhost:5173/dispense', { waitUntil: 'networkidle2' });
    
    console.log("Wait 2s...");
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
    console.log("Done");
  } catch (err) {
    console.error("Puppeteer Error:", err);
  }
})();
