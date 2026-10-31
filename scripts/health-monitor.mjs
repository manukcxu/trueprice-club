import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.resolve(__dirname, '../src/data/products.json');
const logPath = path.resolve(__dirname, '../src/data/issue-history.json');

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
    // Validate schema integrity and affiliate link syntax
    const hasValidAsin = item.asin && item.asin.length === 10;
    const hasAffiliate = item.affiliateUrl && item.affiliateUrl.includes(item.asin);

    if (!hasValidAsin || !hasAffiliate) {
      console.warn(`⚠️ Data integrity issue detected on item ${item.id} (${item.title})`);
      issueLog.push({
        asin: item.asin || 'MISSING',
        title: item.title,
        status: 422,
        timestamp,
        action: 'flagged_invalid_schema'
      });
    } else {
      validProducts.push(item);
    }
  }

  await fs.writeFile(logPath, JSON.stringify(issueLog, null, 2), 'utf-8');
  await fs.writeFile(productsPath, JSON.stringify(validProducts, null, 2), 'utf-8');
  console.log(`✅ Self-hosted 3D catalog health check complete. ${validProducts.length}/${products.length} valid items.`);
}

runHealthCheck();
