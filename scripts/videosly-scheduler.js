import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const API_BASE = 'https://api.videosly.ai/v1';
const API_KEY = (process.env.VIDEOSLY_API_KEY || '').trim();
const DRY_RUN = process.env.DRY_RUN === '1';

// UNVERIFIED: confirm these REST paths against Videosly's API reference before running.
const PATHS = {
  generate: '/videos/generate',
  status: (videoId) => `/videos/${videoId}`,
  post: (videoId) => `/videos/${videoId}/posts`,
};

const CHANNELS = [
  { name: 'facebook', channelId: 'Mm60SH0-EK3u' },
  { name: 'instagram', channelId: 'OxXUqei9Uef5' },
  { name: 'youtube', channelId: 'ry2qbxeHiw5x' },
  { name: 'tiktok', channelId: 'aBOx6wcHBoJ_' },
];

const POLL_INTERVAL_MS = 15_000;
const POLL_MAX_ATTEMPTS = 60;

if (!API_KEY) {
  console.error('VIDEOSLY_API_KEY is missing or empty.');
  process.exit(1);
}

async function api(method, route, body) {
  const res = await fetch(`${API_BASE}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

async function verifyUrl(url) {
  if (url.includes('amazon.com') || url.includes('amzn.to')) return true;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return false;
    const html = await res.text();
    return !(html.includes('Page Not Found') || html.includes('Looking for something?'));
  } catch {
    return true;
  }
}

async function generateVideo(product, productUrl) {
  const idempotencyKey = crypto.createHash('sha256').update(productUrl).digest('hex').slice(0, 32);
  const prompt = `${product.name}. ${product.description ?? ''}`.slice(0, 8000);
  const data = await api('POST', PATHS.generate, {
    title: product.name.slice(0, 255),
    prompt,
    duration: 'short',
    aspectRatio: '9:16',
    idempotencyKey,
  });
  if (!data.videoId) throw new Error(`generate returned no videoId: ${JSON.stringify(data)}`);
  return data.videoId;
}

async function waitForVideo(videoId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const video = await api('GET', PATHS.status(videoId));
    if (video.status === 'completed') return;
    // UNVERIFIED: the failure status name; add it here once known.
    if (video.status === 'failed') throw new Error(`video ${videoId} failed to render`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`video ${videoId} not completed after ${POLL_MAX_ATTEMPTS} polls`);
}

async function postToChannels(videoId, title, caption) {
  let allOk = true;
  for (const ch of CHANNELS) {
    if (DRY_RUN) {
      console.log(`[dry run] would post to ${ch.name} (${ch.channelId})`);
      continue;
    }
    try {
      await api('POST', PATHS.post(videoId), {
        channelId: ch.channelId,
        title,
        content: caption.slice(0, 5000),
        privacy: 'public',
        aiGenerated: true,
      });
      console.log(`✅ posted to ${ch.name}`);
    } catch (err) {
      allOk = false;
      console.error(`❌ ${ch.name}: ${err.message}`);
    }
  }
  return allOk;
}

async function main() {
  const catalogPath = path.resolve('src/data/products.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`Catalog not found at ${catalogPath}`);
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const products = catalog.products || catalog;
  console.log(`Loaded ${products.length} products${DRY_RUN ? ' (dry run)' : ''}.`);

  let hasErrors = false;

  for (const [i, product] of products.entries()) {
    const name = product.title || product.name || `Product #${i + 1}`;
    console.log(`\n--- [${i + 1}/${products.length}] ${name} ---`);

    let productUrl = product.url || product.affiliateUrl;
    if (!productUrl) {
      console.warn(`⚠️ "${name}" has no URL. Skipping.`);
      hasErrors = true;
      continue;
    }
    if (!productUrl.includes('tag=adridiscounts-20')) {
      productUrl += (productUrl.includes('?') ? '&' : '?') + 'tag=adridiscounts-20';
    }
    if (!(await verifyUrl(productUrl))) {
      console.warn(`⚠️ Affiliate URL failed validation. Skipping: ${productUrl}`);
      continue;
    }

    try {
      const videoId = await generateVideo(product, productUrl);
      console.log(`🎬 generating ${videoId}`);
      await waitForVideo(videoId);
      console.log(`✔ ${videoId} completed`);

      const caption = `${product.description || ''}\n\nGet yours here: ${productUrl}\n\nBrought to you by KCXU 92.7 FM San Jose.`;
      const ok = await postToChannels(videoId, name, caption);
      if (!ok) hasErrors = true;
    } catch (err) {
      hasErrors = true;
      console.error(`❌ "${name}": ${err.message}`);
    }
  }

  if (hasErrors) {
    console.error('\nFinished with errors.');
    process.exit(1);
  }
  console.log('\n✨ All products processed.');
}

main();
