// importation
const express = require ("express")
const cors = require ("cors")
const app = express ()
const logger = require("morgan")
const fs = require('fs').promises




const signupRoute = require("./routes/signup.js")
const createRoute = require("./routes/createAccount.js")
const loginRoute = require("./routes/login.js")
const emailVerification = require("./routes/emailVerification.js")
const activities = require("./routes/activities.js")
const china = require("./routes/chuksboychina.js")
const chukachina = require("./routes/chukachina.js")
const baddo = require("./routes/baddo.js")
const khalid = require("./routes/khalid.js")
const khalid2 = require("./routes/khalid2.js")







app.use(express.json())
app.use(logger('dev'))
app.use(cors({origin:"*", optionsSuccessStatus :200}))

app.use("/signup",signupRoute)
app.use("/createAccount", createRoute)
app.use("/login", loginRoute)
app.use("/emailVerification", emailVerification)
app.use("/activities", activities)
app.use("/chuksboychina", china)
app.use("/chukachina", chukachina)
app.use("/baddo", baddo)
app.use("/khalid", khalid)
app.use("/khalid2", khalid2)





app.listen(3137, ()=>{
    console.log("server is working")
})

//const PORT = process.env.PORT || 3000;
//app.listen(PORT, () => {
  //  console.log(`Server is running on port ${PORT}`);
//});



