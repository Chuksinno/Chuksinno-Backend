const express = require("express")
const { createClient } = require("@supabase/supabase-js")
const router = express.Router()
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const autheticatedApiKey = require("../middleware/autheticatedApiKey")

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

const supabase = createClient(
    "https://ftgxnvvjtynbdkhldbls.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0Z3hudnZqdHluYmRraGxkYmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzMxNDcsImV4cCI6MjA2NTc0OTE0N30.z2fODv-5eCWWZtueoJPbkH-N8W65f2kT6PrKolzqZ0c"
)

const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

router.post('/', autheticatedApiKey, async (req, res) => {
    try {
        const { userName, email, password, confirmPassword } = req.body;
        
        // Add validation
        if (!userName || !email || !password || !confirmPassword) {
            return res.status(400).json({ 
                error: "ValidationError",
                message: "All fields are required" 
            });
        }
        
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords don't match" });
        }

        const { data: existingUser, error: checkError } = await supabase
            .from('newUser')
            .select('*')
            .or(`email.eq.${email}, userName.eq.${userName}`);

        if (checkError) {
            return res.status(500).json({ message: "Database query Error" });
        }

        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Email or username already exists" });
        } 
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = generateVerificationCode();

        // Insert into Supabase
        const { data, error: insertError } = await supabase
            .from('newUser')
            .insert([
                { 
                    userName: userName,
                    email: email,
                    password: hashedPassword,
                    OTP: verificationCode,
                    verificationStatus: 'unverified'
                }
            ]);

        if (insertError) {
            throw insertError;
        }

        // Create email content
        const mailOptions = {
            from: '"Your App Name" <chukwumauche78@gmail.com>',
            to: email,
            subject: 'Verify Your Account',
            html: `
                <h1>Welcome to Our Service</h1>
                <p>Thank you for registering!</p>
                <p>Your verification code is: <strong>${verificationCode}</strong></p>
                <p>Please use this code to verify your account.</p>
                <p>If you didn't request this, please ignore this email.</p>
            `
        };

        // Send the email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Email sending error:", error);
                return res.status(500).json({ 
                    message: "User created but verification email failed to send", 
                    error: error.message 
                });
            }
            
            console.log("Email sent:", info.response);
            return res.status(201).json({ 
                message: "Registration successful. Verification email sent.",
                user: {
                    userName,
                    email,
                    verificationStatus: 'unverified'
                }
            });
        });

    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ 
            message: "Internal server error during registration", 
            error: error.message 
        });
    }
});

module.exports = router;