import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.videosly.ai/v1';
const REFRESH_TOKEN = process.env.VIDEOSLY_API_KEY;

async function getAccessToken() {
  if (!REFRESH_TOKEN) {
    console.error("❌ Error: VIDEOSLY_API_KEY secret is missing or empty.");
    process.exit(1);
  }

  console.log("🔄 Exchanging refresh token for access token...");
  const response = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REFRESH_TOKEN}`
    },
    body: JSON.stringify({ refresh_token: REFRESH_TOKEN })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`❌ Failed to exchange refresh token: ${response.status} ${errText}`);
    process.exit(1);
  }

  const data = await response.json();
  if (!data.access_token) {
    console.error("❌ Error: Response from /oauth/token did not contain an access_token.");
    process.exit(1);
  }

  console.log("✅ Successfully acquired fresh access token.");
  return data.access_token;
}

async function verifyUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    
    if (!res.ok) return false;
    const html = await res.text();
    if (html.includes('Page Not Found') || html.includes('Looking for something?')) {
      return false;
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

async function runScheduler() {
  const accessToken = await getAccessToken();

  const catalogPath = path.resolve('src/data/products.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`❌ Catalog file not found at ${catalogPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(catalogPath, 'utf8');
  const catalog = JSON.parse(rawData);
  const products = catalog.products || catalog;

  console.log(`📦 Loaded ${products.length} products from catalog. Processing...`);

  let hasErrors = false;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n--- Processing Product [${i + 1}/${products.length}]: ${product.name} ---`);

    let productUrl = product.url || product.affiliateUrl;
    if (productUrl && !productUrl.includes('tag=adridiscounts-20')) {
      const separator = productUrl.includes('?') ? '&' : '?';
      productUrl = `${productUrl}${separator}tag=adridiscounts-20`;
    }

    if (productUrl) {
      console.log(`🔍 Verifying URL: ${productUrl}`);
      const isValid = await verifyUrl(productUrl);
      if (!isValid) {
        console.warn(`⚠️ Warning: Affiliate URL failed resolution or page-not-found check: ${productUrl}. Skipping product.`);
        continue;
      }
    }

    const payload = {
      title: product.name,
      description: `${product.description}\n\nGet yours here: ${productUrl}\n\nBrought to you by KCXU 92.7 FM San Jose.`,
      product_url: productUrl,
      audio_intro: "kcxu_station_intro_san_jose.mp3",
      platforms: ["tiktok", "instagram", "facebook"]
    };

    try {
      const postRes = await fetch(`${API_BASE}/videos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!postRes.ok) {
        const errDetail = await postRes.text();
        console.error(`❌ Failed to post video for "${product.name}": ${postRes.status} - ${errDetail}`);
        hasErrors = true;
      } else {
        const resultData = await postRes.json();
        console.log(`✅ Successfully queued video for "${product.name}":`, resultData.id || 'OK');
      }
    } catch (apiErr) {
      console.error(`❌ Network or API error posting "${product.name}":`, apiErr.message);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\n❌ Scheduler finished with errors. Exiting with status 1.");
    process.exit(1);
  } else {
    console.log("\n✨ All catalog products processed successfully!");
  }
}

runScheduler();
