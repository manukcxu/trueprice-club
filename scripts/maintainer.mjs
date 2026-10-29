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
    image: `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&Format=_SL500_&ASIN=${item.asin}&MarketPlace=US&ID=AsinImage&WS=1`,
    affiliateUrl: `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`,
  }));

  await fs.writeFile(productsPath, JSON.stringify(updatedProducts, null, 2), 'utf-8');
  console.log(`Successfully updated ${updatedProducts.length} Amazon products with tag ${AMAZON_TAG}`);
}

run().catch((err) => {
  console.error('Maintainer script error:', err);
  process.exit(1);
});

