import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.resolve(__dirname, '../src/data/products.json');
const logPath = path.resolve(__dirname, '../src/data/issue-history.json');

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
    return res.status;
  } catch (err) {
    return 500;
  }
}

async function runHealthCheck() {
  const products = JSON.parse(await fs.readFile(productsPath, 'utf-8'));
  let issueLog = [];
  try {
    issueLog = JSON.parse(await fs.readFile(logPath, 'utf-8'));
  } catch (e) {
    issueLog = [];
  }

  const timestamp = new Date().toISOString();
  const validProducts = [];

  for (const item of products) {
    const imgUrl = `https://images-na.ssl-images-amazon.com/images/P/${item.asin}.01._SCLZZZZZZZ_SX500_.jpg`;
    const status = await checkUrl(imgUrl);

    if (status >= 400) {
      console.warn(`⚠️ Issue detected on ASIN ${item.asin} (HTTP ${status}). Logging...`);
      issueLog.push({
        asin: item.asin,
        title: item.title,
        status,
        timestamp,
        action: 'flagged_for_removal'
      });
    } else {
      validProducts.push(item);
    }
  }

  await fs.writeFile(logPath, JSON.stringify(issueLog, null, 2), 'utf-8');
  await fs.writeFile(productsPath, JSON.stringify(validProducts, null, 2), 'utf-8');
  console.log(`✅ Health check finished. ${validProducts.length}/${products.length} products verified.`);
}

runHealthCheck();
