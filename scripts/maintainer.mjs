import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productsPath = path.resolve(__dirname, '../src/data/products.json');

const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'adridiscounts-20';
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

if (!apiKey) {
  console.error('CRITICAL: GEMINI_API_KEY environment variable is missing.');
  process.exit(1);
}

async function run() {
  console.log('Querying Gemini API via direct REST endpoint...');

  const promptText = `
You are the product curator for trueprice.club.
Generate a JSON array of exactly 5 real, trending, top-selling products currently available on Amazon US.

CRITICAL SELECTION CRITERIA:
1. Target ONLY products from Amazon's highest commission tiers:
   - Luxury Beauty / Skincare Devices / Grooming (10% commission)
   - Kitchen Essentials / Premium Coffee & Culinary Gear (4.5% commission)
   - Automotive Care / Smart Home Devices (4% - 4.5% commission)
2. Every product MUST have a real, authentic 10-character Amazon ASIN (e.g., "B08N5WRWNW").
3. Give an estimated price range string (e.g., "$35 - $50" or "$120 - $150").

Respond with ONLY valid JSON formatted as an array of 5 objects:
[
  {
    "id": "item-1",
    "asin": "B0XXXXXXXX",
    "title": "Exact Clean Product Title",
    "category": "Luxury Beauty | Kitchen | Smart Home",
    "priceRange": "$45 - $65",
    "commissionTier": "Top Pick",
    "features": [
      "Key highlight 1",
      "Key highlight 2",
      "Key highlight 3"
    ],
    "description": "Short 1-2 sentence compelling reason to buy."
  }
]
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Gemini API HTTP Error (${res.status} ${res.statusText}):\n${errorBody}`);
    process.exit(1);
  }

  const data = await res.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawJson) {
    console.error('Empty response structure from Gemini:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const products = JSON.parse(rawJson);

  const updatedProducts = products.map((item) => ({
    ...item,
    image: `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&Format=_SL500_&ASIN=${item.asin}&MarketPlace=US&ID=AsinImage&WS=1`,
    affiliateUrl: `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`,
  }));

  await fs.writeFile(productsPath, JSON.stringify(updatedProducts, null, 2), 'utf-8');
  console.log(`SUCCESS: Updated ${updatedProducts.length} Amazon products with tag ${AMAZON_TAG}`);
}

run().catch((err) => {
  console.error('Unexpected execution error:', err);
  process.exit(1);
});
