import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('http://localhost:3000');
  
  // Wait for bugs to load
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate(() => {
    return {
      bodyHeight: document.body.scrollHeight,
      windowHeight: window.innerHeight,
      scrollY: window.scrollY,
      htmlOverflow: window.getComputedStyle(document.documentElement).overflow,
      bodyOverflow: window.getComputedStyle(document.body).overflow,
      rootOverflow: window.getComputedStyle(document.getElementById('root')).overflow
    };
  });

  console.log("Metrics:", JSON.stringify(metrics, null, 2));

  // Try to scroll down
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  
  await page.waitForTimeout(500);
  
  const scrollYAfter = await page.evaluate(() => window.scrollY);
  console.log("Scroll Y after trying to scroll:", scrollYAfter);

  await browser.close();
}

run();
