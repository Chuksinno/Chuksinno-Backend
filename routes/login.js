const express = require("express");
const {createClient} = require("@supabase/supabase-js")
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken")
const router = express.Router();
const autheticateApiKey = require("../middleware/autheticatedApiKey")

const supabase = createClient(
    "https://ftgxnvvjtynbdkhldbls.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0Z3hudnZqdHluYmRraGxkYmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzMxNDcsImV4cCI6MjA2NTc0OTE0N30.z2fODv-5eCWWZtueoJPbkH-N8W65f2kT6PrKolzqZ0c"
)

// router.post('/', async(req, res)=>{
//     const {email, password} = req.body;

//     if (!email || !password) {
//         return res.status(400).json({ 
//           error: "ValidationError",
//           message: "All fields are required" 
//         })
//     }
//     // Insert into Supabase
//     const { data, error } = await supabase
//     .from('newUser') // Make sure this matches your table name
//     .select('*')           // select all
//     .eq('email', email )
//     //.single();

//     if(error){
//         return res.status (500).json({               //server error
//             error: Error,
//             message: "Data base querry error"
//         })

//     }
//     if(!data){
//         return res.status (400).json({              //client error
//             message: "email or password incorrect"
//         })

//     }

//     const isMatch = await bcrypt.compare(password, data.password)
//     if(!isMatch){
//         return res.status(400).json({
//             message: "email or password incorrect"
//         })
//     }

//     const token = jwt.sign({
//         id: data.id,
//         userName: data.userName,
//         email: data.email
//     }, "4c8f5b6e8a88a0a09e33947f017ab8a295b9b94c94f57f7fcadc9c94aef8d0cc9c8a13b1775e30fce91ef61c0b7b198f51484316c446d67ff25a73ef365e9f9e", { //browse jsonwebtoken online
//         expiresIn: "1h"
//     }
// )

// res.status(200).json({
//     message: "login succesful",
//     token: token
// })
   
// })

// module.exports = router


router.post('/', autheticateApiKey, async(req, res)=>{
    const {email, password} = req.body;

    if (!email || !password) {
        return res.status(400).json({ 
            error: "ValidationError",
            message: "All fields are required" 
        });
    }

    try {
        // Query Supabase
        const { data, error } = await supabase
            .from('newUser')
            .select('*')
            .eq('email', email);

        if(error){
            return res.status(500).json({               
                error: "DatabaseError",
                message: "Database query error"
            });
        }

        // Handle no user found
        if(!data || data.length === 0){
            return res.status(400).json({             
                message: "Email or password incorrect"
            });
        }

        // Extract user from array
        const user = data[0];
        
        // Verify password exists
        if (!user.password) {
            return res.status(500).json({
                error: "DataError",
                message: "Password field missing in user record"
            });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({
                message: "Email or password incorrect"
            });
        }

        // Generate JWT
        const token = jwt.sign({
            id: user.id,
            userName: user.userName,
            email: user.email
        }, "4c8f5b6e8a88a0a09e33947f017ab8a295b9b94c94f57f7fcadc9c94aef8d0cc9c8a13b1775e30fce91ef61c0b7b198f51484316c446d67ff25a73ef365e9f9e", {
            expiresIn: "1h"
        });

        res.status(200).json({
            message: "Login successful",
            token: token
        });
        
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            error: "InternalError",
            message: "Internal server error"
        });
    }
});


module.exports = router