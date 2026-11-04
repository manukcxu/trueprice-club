// videosly-scheduler.js
import fs from 'fs';

// Token comes from the GitHub Actions secret VIDEOSLY_API_KEY (never hardcode it).
const TOKEN = process.env.VIDEOSLY_API_KEY;
const MCP_URL = "https://api.videosly.ai/mcp";
// TEST MODE: only the first two products, posted immediately.
const PRODUCT_COUNT = Number(process.env.PRODUCT_COUNT || 2);

const CHANNELS = {
    tiktok: "aBOX6wcHBoJ_",
    instagram: "OxXUqei9Uef5",
    facebook: "Mm60SH0-EK3u"
};

async function callMcpTool(toolName, args) {
    const response = await fetch(MCP_URL, {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream"
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now().toString(),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        })
    });

    if (!response.ok) throw new Error(`Tool ${toolName} failed: ${await response.text()}`);
    const data = await response.json();
    if (data.error) throw new Error(`API Error: ${JSON.stringify(data.error)}`);
    
    return data.result.content.find(c => c.type === "text").text;
}

async function runAutomation() {
    if (!TOKEN) {
        console.error("VIDEOSLY_API_KEY is not set. Add it as a GitHub Actions secret.");
        process.exit(1);
    }
    console.log("1. Loading product catalog from src/data/products.json...");
    const products = JSON.parse(fs.readFileSync('src/data/products.json', 'utf8'));
    const selected = products.slice(0, PRODUCT_COUNT);
    if (selected.length === 0) throw new Error("No products found in src/data/products.json");
    for (const product of selected) {
        try {
            await runForProduct(product);
        } catch (error) {
            console.error(`Automation Error for "${product.title}":`, error.message);
        }
    }
}

async function runForProduct(product) {
    {
        const priceDisplay = product.priceRange || 
            (product.minPrice && product.maxPrice ? `$${product.minPrice} - $${product.maxPrice}` : 
            (product.price ? `$${product.price}` : "$29.99 - $39.99"));

        // Guarantee direct tracking link with tag=adridiscounts-20 applied exactly once
        let rawUrl = product.affiliateUrl || product.url || "https://www.amazon.com";
        const baseUrl = rawUrl.split('&tag=')[0].split('?tag=')[0];
        const affiliateLink = `${baseUrl}?tag=adridiscounts-20`;

        const communityHook = "Shop now to get a great deal while supporting San Jose’s KCXU 92.7 FM community radio.";

        console.log(`Selected Product: ${product.title}`);
        console.log(`Price Range: ${priceDisplay}`);
        console.log(`Verified Affiliate Link: ${affiliateLink}`);

        console.log("\n2. Generating Video via Videosly...");
        const promptText = `High-realism 45-second product showcase video for "${product.title}". Highlight key features clearly with professional pacing. Mention the price range ${priceDisplay}. Conclude with the exact call to action and visual button overlay: "${communityHook}" linking directly to ${affiliateLink}`;

        const generateResText = await callMcpTool("videosly_generate_video", {
            prompt: promptText,
            title: `Deal: ${product.title}`,
            duration: "medium",
            aspectRatio: "9:16",
            language: "eng"
        });
        
        const idMatch = generateResText.match(/\*\*Video ID\*\*:\s*([a-zA-Z0-9_-]+)/i); 
        if (!idMatch) throw new Error("Could not find the Video ID in the response.");
        
        const videoId = idMatch[1];
        console.log(`Extracted Video ID: ${videoId}`);

        console.log("\n3. Waiting for render to complete...");
        let isReady = false;
        while (!isReady) {
            const statusResText = await callMcpTool("videosly_get_video", { videoId: videoId });
            const statusMatch = statusResText.match(/\*\*Status\*\*:\s*([a-zA-Z0-9_-]+)/i);
            const currentStatus = statusMatch ? statusMatch[1].toLowerCase() : "unknown";
            
            console.log(`Current status: ${currentStatus}`);
            
            if (currentStatus === "completed" || currentStatus === "success") {
                isReady = true;
            } else if (currentStatus === "failed" || currentStatus === "error") {
                throw new Error("Video rendering failed on server.");
            } else {
                await new Promise(resolve => setTimeout(resolve, 15000));
            }
        }

        console.log("\n4. Posting to social platforms immediately (test mode)...");
        const scheduleDate = new Date().toISOString();
        const socialCaption = `🔥 Get ${product.title} for ${priceDisplay}!\n\n${communityHook}\n\n👉 Order here: ${affiliateLink}\n\n#kcxu #sanjose #deals #adridiscounts`;

        for (const [platform, channelId] of Object.entries(CHANNELS)) {
            console.log(`Posting to ${platform}...`);
            await callMcpTool("videosly_post_video", {
                videoId: videoId,
                channelId: channelId,
                content: socialCaption,
                privacy: "public",
                aiGenerated: true,
                scheduledAt: scheduleDate
            });
            console.log(`Successfully scheduled on ${platform}!`);
        }

        console.log(`\n🎉 Done: ${product.title}`);
    }
}

runAutomation().catch(err => {
    console.error("Fatal:", err.message);
    process.exit(1);
});
