const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const router = express.Router();


const supabase = createClient(
    "https://ftgxnvvjtynbdkhldbls.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0Z3hudnZqdHluYmRraGxkYmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzMxNDcsImV4cCI6MjA2NTc0OTE0N30.z2fODv-5eCWWZtueoJPbkH-N8W65f2kT6PrKolzqZ0c"
);

 router.post('/',  async (req, res) => {
    const {userName, email, verifiacationCode} = req.body

    try{
        const {data: users, error: selectError} = await supabase
        .from('newUser')
        .select('*')
        .eq('email', email)            //where email = email
        .eq('userName', userName)
        .eq('OTP', verifiacationCode);

        if(selectError){
            return res.status (500).json({
                message: "Database query error"
            })
        }

        if(users.length < 1 ){
            return res.status (400).json ({
                message: "Either your email or verification code is incorrect"
            })

        }else if(users.length > 0 && users[0].OTP  === 'verified'){
            return res.status (400).json({
                message: "Your Email already verified"
            })
        }else{
            const {error: updateError} = await supabase
            .from('newUser')
            .update({verificationStatus: 'verified'})
            .eq('email', email);

            if(updateError){
                return res.status(500).json({
                    message: "error updating verification status"
                })

            }

            res.status (200).json({
                message: "Email verification Succesful"
            })
            
        }

        
    }catch(error)
    {
        console.error('error:', error )
        return res.status(500).json({
            message:"An error occured during the verification process"
        })
    }
}) 

module.exports = router;