import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';

const PRODUCTS_FILE = "/Users/mjm/trueprice-club/products.json";
const HISTORY_FILE = "/Users/mjm/trueprice-club/performance_history.json";
const USER_DATA_DIR = path.join(process.cwd(), 'puppeteer_profile');

console.log("🧠 Reading trending products dataset...");
const rawData = fs.readFileSync(PRODUCTS_FILE, 'utf8');
const products = JSON.parse(rawData);

console.log("✅ Products loaded successfully!\n");
console.log("🚀 Launching Persistent Browser Session with Performance Logging...");

async function runAutomationWithLogging() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: null,
    userDataDir: USER_DATA_DIR,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  console.log("👉 Navigating to Videosly calendar...");
  await page.goto('https://app.videosly.ai/calendar', { waitUntil: 'networkidle2' });

  if (page.url().includes('/login')) {
    console.log("🔒 Please log in manually in the browser window...");
    await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 180000 });
    console.log("✅ Login saved!");
  } else {
    console.log("✅ Session loaded successfully!");
  }

  const productList = products.items || products;
  const runTimestamp = new Date().toISOString();
  const executedProducts = [];

  for (const product of productList) {
    const productUrl = `https://trueprice.club/cart?add=${product.asin || product.id}`;
    const titleText = `Today's trending drop: ${product.title}`;
    const captionText = `🔥 Secure yours here:\n${productUrl}\n\n#trending #musthave #trueprice #kcxu`;

    console.log(`\n----------------------------------------`);
    console.log(`Processing Product: ${product.title}`);

    if (!page.url().includes('/calendar')) {
      await page.goto('https://app.videosly.ai/calendar', { waitUntil: 'networkidle2' });
    }

    try {
      await page.waitForSelector('button', { timeout: 8000 });
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const targetBtn = buttons.find(b => b.textContent && b.textContent.includes('Create post'));
        if (targetBtn) {
          targetBtn.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log("✅ Clicked '+ Create post' button successfully.");
        
        await page.waitForSelector('input, textarea', { timeout: 8000 });
        await new Promise(resolve => setTimeout(resolve, 1500));

        const titleInput = await page.$('input[placeholder*="title" i], input[name*="title" i]');
        if (titleInput) {
          await titleInput.click({ clickCount: 3 });
          await titleInput.type(titleText, { delay: 15 });
          console.log(`✅ Filled Title: ${titleText}`);
        }

        const captionInput = await page.$('textarea[placeholder*="share" i], textarea[name*="caption" i], textarea');
        if (captionInput) {
          await captionInput.click({ clickCount: 3 });
          await captionInput.type(captionText, { delay: 10 });
          console.log(`✅ Filled Caption & Direct Link: ${productUrl}`);
        }

        // Record successful post execution data
        executedProducts.push({
          title: product.title,
          asin: product.asin || product.id,
          url: productUrl,
          timestamp: runTimestamp
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log("⚠️ Could not locate the 'Create post' button on the page.");
      }
    } catch (err) {
      console.log(`⚠️ Notice during interaction: ${err.message}`);
    }
  }

  // Accumulate performance history into performance_history.json
  let existingHistory = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      existingHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch (e) {
      existingHistory = [];
    }
  }

  existingHistory.push({
    runDate: runTimestamp,
    totalProcessed: executedProducts.length,
    products: executedProducts
  });

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(existingHistory, null, 2));
  console.log(`\n📊 Performance history successfully updated and saved to ${HISTORY_FILE}`);
  console.log("\n🎉 All products automated and logged!");
}

runAutomationWithLogging();
