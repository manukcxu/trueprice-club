import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.resolve(__dirname, '../src/data/products.json');
const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'adridiscounts-20';
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is missing.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 30000 } });

const prompt = `Return a JSON array of 5 top Amazon US products in high-commission tiers (Luxury Beauty, Kitchen, Smart Home).
Each item must have:
"id": "item-1",
"asin": "valid 10-char ASIN",
"title": "Clean Title",
"category": "Category Name",
"priceRange": "$XX - $XX",
"commissionTier": "Top Pick",
"features": ["feature 1", "feature 2", "feature 3"],
"description": "Short description"`;

const fallbackSeed = [
  {
    id: "item-1",
    asin: "B001MA0QY2",
    title: "Olaplex No. 3 Hair Perfector Repairing Treatment",
    category: "Luxury Beauty",
    priceRange: "$28 - $32",
    commissionTier: "Top Pick (10% Tier)",
    features: [
      "Repairs damaged and compromised hair",
      "Strengthens and protects hair structure",
      "Restores healthy appearance and texture"
    ],
    description: "The gold-standard at-home bond builder that dramatically improves hair strength and texture."
  },
  {
    id: "item-2",
    asin: "B00004OCNS",
    title: "Lodge 10.25 Inch Pre-Seasoned Cast Iron Skillet",
    category: "Kitchen Essentials",
    priceRange: "$20 - $25",
    commissionTier: "Top Pick (4.5% Tier)",
    features: [
      "Even heat retention and distribution",
      "Pre-seasoned with 100% natural vegetable oil",
      "Versatile for stovetop, oven, grill, or campfire"
    ],
    description: "An indestructible kitchen staple with superior heat retention for searing, baking, and frying."
  },
  {
    id: "item-3",
    asin: "B07984Q8WW",
    title: "Philips Sonicare DiamondClean Smart 9500",
    category: "Luxury Beauty & Personal Care",
    priceRange: "$220 - $260",
    commissionTier: "Top Pick (10% Tier)",
    features: [
      "Removes up to 10x more plaque vs a manual brush",
      "Personalized app coaching and smart sensor technology",
      "Premium glass charging base and deluxe travel case"
    ],
    description: "High-performance sonic electric toothbrush providing clinic-level gum and plaque care."
  },
  {
    id: "item-4",
    asin: "B08N5WRWNW",
    title: "Breville Barista Touch Espresso Machine",
    category: "Kitchen Essentials",
    priceRange: "$995 - $1050",
    commissionTier: "Top Pick (4.5% Tier)",
    features: [
      "Automated touchscreen menu with pre-programmed cafe drinks",
      "ThermoJet 3-second instant heatup system",
      "Hands-free microfoam texturing wand"
    ],
    description: "Cafe-grade espresso and microfoam milk drinks automated in a sleek brushed stainless steel chassis."
  },
  {
    id: "item-5",
    asin: "B08J45P21V",
    title: "ecobee Smart Thermostat Premium with Smart Sensor",
    category: "Smart Home",
    priceRange: "$210 - $250",
    commissionTier: "Top Pick (4% Tier)",
    features: [
      "Built-in air quality monitor and radar occupancy sensor",
      "Seamless integration with Apple HomeKit, Alexa, and Google Assistant",
      "Saves up to 26% on annual heating and cooling costs"
    ],
    description: "High-accuracy smart climate controller with integrated indoor air quality monitoring."
  }
];

async function generateWithModel(modelName) {
  console.log(`Connecting to ${modelName}...`);
  const res = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  });
  return res.text;
}

async function getProducts() {
  const models = ['gemini-3.8-flash'];
  for (const model of models) {
    try {
      const text = await generateWithModel(model);
      if (text) return JSON.parse(text);
    } catch (err) {
      console.warn(`⚠️ ${model} unavailable (${err?.status || err.message}). Switching to fallback...`);
    }
  }
  console.warn('⚠️ Using verified high-tier affiliate seed catalog...');
  return fallbackSeed;
}

async function run() {
  const products = await getProducts();

  const catalog = products.map((item) => ({
    ...item,
    image: `https://images-na.ssl-images-amazon.com/images/P/${item.asin}.01._SCLZZZZZZZ_SX500_.jpg`,
    affiliateUrl: `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`
  }));

  await fs.writeFile(productsPath, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`\n✅ SUCCESS: Populated ${catalog.length} products with universal Amazon CDN images to ${productsPath}.\n`);
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
