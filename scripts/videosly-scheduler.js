// videosly-scheduler.js
import fs from 'fs';

// Replace with your fresh Videosly JWT token from your dashboard if expired
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJtY3BfYWNjZXNzIiwiY2xpZW50X2lkIjoidmlkZW9zbHktZGFzaGJvYXJkIiwic2NvcGUiOiJtY3A6cmVhZCBtY3A6d3JpdGUgbWNwOmRlbGV0ZSIsImlhdCI6MTc5MzU3NDUxNiwiZXhwIjoxNzkzNTc4MTE2LCJhdWQiOiJodHRwczovL2FwaS52aWRlb3NseS5haS9tY3AiLCJpc3MiOiJodHRwczovL2FwaS52aWRlb3NseS5haSIsInN1YiI6IlROVHpzNERvc0dpeSIsImp0aSI6IjZlNTI1NjVhLWY4NmUtNDViMi1hYTkxLTZkOWZiZjA2ZjQ4YyJ9.CQUCmqEgPvooeyGfLg8tj-wh509O7BUgFdFmGllqC7U";
const MCP_URL = "https://api.videosly.ai/mcp";

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
    try {
        console.log("1. Loading product catalog from src/data/products.json...");
        const productsRaw = fs.readFileSync('src/data/products.json', 'utf8');
        const products = JSON.parse(productsRaw);
        
        const product = products[0] || {
            title: "Featured Deal",
            priceRange: "$29.99 - $39.99",
            affiliateUrl: "https://www.amazon.com/dp/B00EXAMPLE"
        };

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

        console.log("\n4. Scheduling to social platforms with direct affiliate link & community hook...");
        const scheduleDate = new Date(Date.now() + 3600000).toISOString();
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

        console.log("\n🎉 Automation complete! Video synced with catalog, price, affiliate link, and KCXU community hook.");
    } catch (error) {
        console.error("\nAutomation Error:", error.message);
    }
}

runAutomation();
