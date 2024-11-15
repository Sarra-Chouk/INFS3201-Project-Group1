const express=require("express")
const business = require("./business.js")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const handlebars = require("express-handlebars")
const fileUpload =require('express-fileupload')
let app = express()

app.set("views", __dirname+"/templates")
app.set("view engine", "handlebars")
app.engine("handlebars", handlebars.engine())
app.use(bodyParser.urlencoded({extended: false}))
app.use(cookieParser())
app.use('/images', express.static(__dirname+"/static/profilePictures"))
app.use(fileUpload())

app.get("/", (req, res) => {
})

app.get("/sign-up", (req, res) => {
    const message = req.query.message
    res.render("signup", { message })
})

app.post("/sign-up", async (req, res) => {
    const { username, email, password, knownLanguages, learningLanguages } = req.body
    const profilePicture = req.files ? req.files.profilePicture : null
    const knownLanguagesArray = Array.isArray( knownLanguages) ?  knownLanguages : [ knownLanguages]
    const learningLanguagesArray = Array.isArray(learningLanguages) ? learningLanguages : [learningLanguages]

    try {
        const isEmailValid = await business.validateEmail(email)
        const isPasswordValid = await business.validatePassword(password)
        const isUsernameValid = await business.validateUsername(username)

        if (!isEmailValid) {
            throw new Error("Invalid or already registered email address.")
        }
        if (!isPasswordValid) {
            throw new Error("Password must be at least 8 characters, include a number, a special character, an uppercase and lowercase letter.")
        }
        if (isUsernameValid) {
            throw new Error("Username is already taken. Please choose a different one.")
        }

        let profilePicturePath = "/images/defaultProfilePic.jpg"
        if (profilePicture) {
            const uniqueFileName = `${Date.now()}_${profilePicture.name}`
            profilePicturePath = `/images/${uniqueFileName}`
            await profilePicture.mv(`${__dirname}/static/profilePictures/${uniqueFileName}`)
        }

        await business.createUser(username, email, password, knownLanguagesArray, learningLanguagesArray, profilePicturePath)
        res.redirect("/login?message=Registration successful. Please log in.")
    }
    catch (error) {
        console.error("Signup error:", error.message)
        res.redirect("/sign-up?message=" + encodeURIComponent(error.message))
    }
})

app.get("/login'", (req, res) => {
})

app.post("/login", async (req, res) => {
})

app.get("/logout", async (req, res) => {
})

app.get("/dashboard", async (req, res) => {
})

app.get("/reset-password", (req, res) => {
})

app.post("/reset-password", async (req, res) => {
})

app.get("/update-password", async (req, res) => {
})

app.post("/update-password", async (req, res) => {
})

app.listen(8000, () => {})