import { GoogleGenAI, Type } from "@google/genai";
import Stripe from "stripe";
import fs from "node:fs/promises";
import path from "node:path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const candidateFeed = [
  { id: "c1", title: "Minimalist MagSafe Stand", cost: 22.0, image: "https://images.unsplash.com/photo-1586953208448-b95a79798f07" },
  { id: "c2", title: "Ergonomic Desk Cushion", cost: 18.5, image: "https://images.unsplash.com/photo-1580481077195-c22ae98767e3" },
  { id: "c3", title: "Precision Coffee Scale", cost: 25.0, image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd" },
  { id: "c4", title: "Slim Magnetic Battery Pack", cost: 19.0, image: "https://images.unsplash.com/photo-1609592424300-c917b254a6db" },
  { id: "c5", title: "Smart RGB Monitor Bar", cost: 35.0, image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46" }
];

async function run() {
  const prompt = "Select 5 top products. Set sellingPrice to cost * 1.30 rounded to .99. Write a 2-sentence description.";
  const res = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: [{ text: prompt }, { text: JSON.stringify(candidateFeed) }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            supplierCost: { type: Type.NUMBER },
            sellingPrice: { type: Type.NUMBER },
            imageUrl: { type: Type.STRING }
          },
          required: ["id", "title", "description", "sellingPrice", "imageUrl"]
        }
      }
    }
  });
  const selected = JSON.parse(res.text);
  for (const item of selected) {
    item.stripeUrl = "#";
    item.paypalUrl = "https://paypal.me/truepriceclub";
  }
  await fs.writeFile(path.resolve("src/data/products.json"), JSON.stringify(selected, null, 2));
  console.log("src/data/products.json refreshed!");
}
run();