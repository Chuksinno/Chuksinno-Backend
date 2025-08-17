
const autheticatedApiKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"]

    if(apiKey === "X9j4T2m8QkL6V7aYpD3RzE1NfWcUbG0HsIqJoKvMlPtSdXeY"){
        next()
        
    }else{
        res.status(403).json({message: "error occur"})
    }
}

module.exports = autheticatedApiKey