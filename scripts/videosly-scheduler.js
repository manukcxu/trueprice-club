// videosly-scheduler.js

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXAiOiJtY3BfYWNjZXNzIiwiY2xpZW50X2lkIjoidmlkZW9zbHktZGFzaGJvYXJkIiwic2NvcGUiOiJtY3A6cmVhZCBtY3A6d3JpdGUgbWNwOmRlbGV0ZSIsImlhdCI6MTc5MzU3NDUxNiwiZXhwIjoxNzkzNTc4MTE2LCJhdWQiOiJodHRwczovL2FwaS52aWRlb3NseS5haS9tY3AiLCJpc3MiOiJodHRwczovL2FwaS52aWRlb3NseS5haSIsInN1YiI6IlROVHpzNERvc0dpeSIsImp0aSI6IjZlNTI1NjVhLWY4NmUtNDViMi1hYTkxLTZkOWZiZjA2ZjQ4YyJ9.CQUCmqEgPvooeyGfLg8tj-wh509O7BUgFdFmGllqC7U"; // Paste your JWT token here
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
        console.log("1. Generating Video...");
        const generateResText = await callMcpTool("videosly_generate_video", {
            prompt: "60-second explainer on the new KCXU Live Line schedule",
            title: "Live Line teaser",
            duration: "medium",
            aspectRatio: "9:16",
            language: "eng"
        });
        
        // Specifically look for the exact **Video ID**: label
        const idMatch = generateResText.match(/\*\*Video ID\*\*:\s*([a-zA-Z0-9_-]+)/i); 
        if (!idMatch) throw new Error("Could not find the Video ID in the response.");
        
        const videoId = idMatch[1];
        console.log(`Extracted Video ID: ${videoId}`);

        console.log("\n2. Waiting for render to complete (this may take a few minutes)...");
        let isReady = false;
        while (!isReady) {
            const statusResText = await callMcpTool("videosly_get_video", { videoId: videoId });
            
            // Extract the status using the same method
            const statusMatch = statusResText.match(/\*\*Status\*\*:\s*([a-zA-Z0-9_-]+)/i);
            const currentStatus = statusMatch ? statusMatch[1].toLowerCase() : "unknown";
            
            console.log(`Current status: ${currentStatus}`);
            
            if (currentStatus === "completed" || currentStatus === "success") {
                isReady = true;
            } else if (currentStatus === "failed" || currentStatus === "error") {
                throw new Error("Video rendering failed on server.");
            } else {
                // Wait 15 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 15000));
            }
        }

        console.log("\n3. Scheduling to social platforms...");
        // You can adjust this date and text whenever you need to!
        const scheduleDate = "2026-11-02T17:00:00Z";
        const contentText = "Check out the new KCXU schedule! 📻 #kcxu #radio #sanjose";

        for (const [platform, channelId] of Object.entries(CHANNELS)) {
            console.log(`Posting to ${platform}...`);
            await callMcpTool("videosly_post_video", {
                videoId: videoId,
                channelId: channelId,
                content: contentText,
                privacy: "public",
                aiGenerated: true,
                scheduledAt: scheduleDate
            });
            console.log(`Successfully scheduled on ${platform}!`);
        }

        console.log("\n🎉 Automation complete! All videos scheduled.");
    } catch (error) {
        console.error("\nAutomation Error:", error.message);
    }
}

runAutomation();
