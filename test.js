let body = {
    password : "chukwuma11",
    email:"chuukwuma",

}

//const {password,email} = body

//sconst email = body.email

let req = {
    body:{
        username:"chukwuma",
        password:"ygtyffjdf"
    }
}

let username = req.body.username

const {password,email} = req.body
//const password = req.body.password

console.log(password)