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

const ai = new GoogleGenAI({ apiKey });

const behavioralPrompt = `You are an expert e-commerce conversion analyst optimizing an affiliate catalog.
Select 6 trending Amazon US items purely based on CONSUMER PURCHASE BEHAVIOR and maximum conversion velocity.

Evaluate against these behavioral buying criteria:
1. Low-friction price point ($15 - $60 sweet spot for immediate single-session checkout).
2. High purchase velocity & universal mass appeal (cross-demographic, not locked to one narrow niche).
3. Immediate pain-relief or quality-of-life upgrade (high perceived value vs price).
4. Low return rate / high satisfaction track record.

Return a strictly valid JSON array of 6 items with these exact keys:
[
  {
    "id": "item-1",
    "asin": "10-character Amazon ASIN",
    "title": "Clean, recognizable product title (under 50 chars)",
    "purchaseDriver": "Primary behavioral trigger (e.g. Loss Prevention, Battery Anxiety, Daily Habit)",
    "priceBenchmark": "Soft estimate like 'Under $30' or 'Around $50' (never exact tight bounds)",
    "features": ["Quick punchy benefit 1", "Quick punchy benefit 2", "Quick punchy benefit 3"],
    "description": "One sentence explaining why consumers urgently purchase this item.",
    "conversionHook": "Short badge text like 'High Velocity' or 'Essential Everyday'"
  }
]`;

const fallbackBehavioralCatalog = [
  {
    id: "item-1",
    asin: "B0933BVK6T",
    title: "Apple AirTag 4-Pack",
    purchaseDriver: "Instant Loss Prevention",
    priceBenchmark: "Under $90",
    features: ["Precision Finding with Ultra Wideband", "One-tap seamless pairing", "1+ year replaceable battery"],
    description: "Eliminates daily anxiety by instantly locating luggage, keys, and wallets.",
    conversionHook: "Essential Everyday Tracker"
  },
  {
    id: "item-2",
    asin: "B0BYNYN87M",
    title: "Anker 20,000mAh 30W Fast Portable Charger",
    purchaseDriver: "Low Battery Anxiety Relief",
    priceBenchmark: "Under $50",
    features: ["30W USB-C Power Delivery", "Smart digital percentage readout", "Multi-device charging"],
    description: "Compact travel battery that removes the friction of searching for outlets.",
    conversionHook: "High-Velocity Travel Pick"
  },
  {
    id: "item-3",
    asin: "B0C9R89D6R",
    title: "Stanley Quencher H2.0 FlowState 40 oz Tumbler",
    purchaseDriver: "Social Proof & Daily Habit Stacking",
    priceBenchmark: "Under $50",
    features: ["48-hour ice retention", "Car cup-holder base", "Ergonomic comfort handle"],
    description: "The viral standard for effortless daily hydration across home, work, and travel.",
    conversionHook: "Viral Trend Leader"
  },
  {
    id: "item-4",
    asin: "B0C6B8DPM7",
    title: "Ninja Blast Cordless 16 oz Personal Blender",
    purchaseDriver: "Frictionless Healthy Habits",
    priceBenchmark: "Under $60",
    features: ["Rechargeable USB-C base", "Crushes frozen fruit cord-free", "One-handed sip lid"],
    description: "Removes kitchen counter cleanup friction for instant smoothies anywhere.",
    conversionHook: "Impulse Lifestyle Upgrade"
  },
  {
    id: "item-5",
    asin: "B07984Q8WW",
    title: "Philips Sonicare ProtectiveClean 6100",
    purchaseDriver: "Health Investment & Trust",
    priceBenchmark: "Under $110",
    features: ["Pressure sensor protects gums", "3 brushing modes", "Proven plaque removal"],
    description: "High-trust oral care item with strong repeat purchases and dental backing.",
    conversionHook: "Clinic-Grade Routine"
  },
  {
    id: "item-6",
    asin: "B00004OCNS",
    title: "Lodge 10.25-Inch Cast Iron Skillet",
    purchaseDriver: "Lifetime Value & Low-Cost Durability",
    priceBenchmark: "Under $25",
    features: ["Pre-seasoned with 100% natural oil", "Heirloom build", "Versatile stovetop/oven"],
    description: "Sub-$25 impulse kitchen buy that lasts generations with zero obsolescence.",
    conversionHook: "Best Lifetime Value"
  }
];

async function callModel(modelName, timeoutMs = 25000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${timeoutMs / 1000}s`)), timeoutMs)
  );

  const requestConfig = {
    responseMimeType: 'application/json'
  };

  const requestPromise = ai.models.generateContent({
    model: modelName,
    contents: behavioralPrompt,
    config: requestConfig
  });

  return Promise.race([requestPromise, timeoutPromise]);
}

async function fetchBehavioralTrends() {
  const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  
  for (const model of models) {
    try {
      console.log(`Connecting to ${model}...`);
      const res = await callModel(model, 25000);
      if (res?.text) {
        console.log(`✅ Success with ${model}`);
        return JSON.parse(res.text);
      }
    } catch (err) {
      console.warn(`⚠️ ${model} unavailable: ${err.message}`);
    }
  }

  console.warn('⚠️ API clusters unavailable. Applying behavior-validated catalog...');
  return fallbackBehavioralCatalog;
}

async function run() {
  const products = await fetchBehavioralTrends();

  const catalog = products.map((item) => ({
    ...item,
    affiliateUrl: `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`
  }));

  await fs.writeFile(productsPath, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`\n✅ Generated ${catalog.length} behavior-driven products in ${productsPath}\n`);
}

run().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
