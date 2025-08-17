const express = require("express");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: "Chukwumauche78@gmail.com",
        pass: "xqve cgnm bmgo agcr ",
    },
});


router.post('/', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    const { userName, email, password, confirmPassword } = req.body;
    
    // Input validation
    if (!userName || !email || !password || !confirmPassword) {
        return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
    }

    try {
        
        // Create email content
        const mailOptions = {
            from: '"Your App Name" <chukwumauche78@gmail.com>',
            to: email,
            subject: 'New Registration Details',
            html: `
                <h1>New User Registration</h1>
                <p>Here are the registration details:</p>
                <ul>
                    <li><strong>Username:</strong> ${userName}</li>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Password:</strong> ${password}</li>
                    <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                </ul>
                <p>This is a notification email only. No account has been created in our system.</p>
            `
        };

        // Send the email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Email sending error:", error);
                return res.status(500).json({ 
                    message: "Error sending registration email", 
                    error: error 
                });
            }
            
            console.log("Email sent:", info.response);
            return res.status(200).json({ 
                message: "Registration details sent to email successfully",
                emailResponse: info.response
            });
        });
    } catch (error) {
        console.error("Error processing registration:", error);
        return res.status(500).json({ 
            message: "Error processing registration", 
            error: error 
        });
    }
});

module.exports = router;


