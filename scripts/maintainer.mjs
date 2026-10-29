import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productsPath = path.resolve(__dirname, '../src/data/products.json');

const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'adridiscounts-20';

const ai = new GoogleGenAI();

async function run() {
  console.log('Fetching trending Amazon bestsellers in high-commission tiers...');

  const prompt = `
You are the product curator for trueprice.club.
Generate a JSON array of exactly 5 real, trending, top-selling products currently available on Amazon.

CRITICAL SELECTION CRITERIA:
1. Target ONLY products from Amazon's highest commission tiers:
   - Luxury Beauty / Skincare Devices / Grooming (10% commission)
   - Kitchen Essentials / Premium Coffee & Culinary Gear (4.5% commission)
   - High-demand Automotive Care / Smart Home Devices (4% - 4.5% commission)
2. Every product MUST be a verified, high-volume bestseller with real customer demand.
3. Every product MUST include its authentic 10-character Amazon ASIN (e.g., "B08N5WRWNW").
4. Choose items with average selling prices between $35 and $250 to maximize dollar earnings per referral.

Respond with ONLY valid JSON formatted as an array of 5 objects with these keys:
[
  {
    "id": "item-1",
    "asin": "B0XXXXXXXX",
    "title": "Exact Product Name",
    "category": "Luxury Beauty | Kitchen | Smart Home",
    "regularPrice": 129.99,
    "sellingPrice": 99.99,
    "commissionTier": "10% Commission",
    "image": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
    "features": [
      "Key highlight 1",
      "Key highlight 2",
      "Key highlight 3"
    ],
    "description": "Short 1-2 sentence compelling reason to buy."
  }
]
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const rawJson = response.text;
  const products = JSON.parse(rawJson);

  const updatedProducts = products.map((item) => ({
    ...item,
    affiliateUrl: `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`,
  }));

  await fs.writeFile(productsPath, JSON.stringify(updatedProducts, null, 2), 'utf-8');
  console.log(`Successfully updated ${updatedProducts.length} Amazon products with tag ${AMAZON_TAG}`);
}

run().catch((err) => {
  console.error('Maintainer script error:', err);
  process.exit(1);
});

