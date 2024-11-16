const express = require("express")
const business = require("./business.js")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const handlebars = require("express-handlebars")
const fileUpload = require('express-fileupload')
let app = express()

app.set("views", __dirname + "/templates")
app.set("view engine", "handlebars")
app.engine("handlebars", handlebars.engine())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use('/images', express.static(__dirname + "/static/profilePictures"))
app.use(fileUpload())

app.get("/", (req, res) => {
    res.render("index")
})

app.get("/sign-up", (req, res) => {
    const message = req.query.message
    res.render("signup", { message })
})

app.post("/sign-up", async (req, res) => {
    const { username, email, password, confirmedPassword, knownLanguages, learningLanguages } = req.body
    const profilePicture = req.files ? req.files.profilePicture : null
    const knownLanguagesArray = Array.isArray(knownLanguages) ? knownLanguages : [knownLanguages]
    const learningLanguagesArray = Array.isArray(learningLanguages) ? learningLanguages : [learningLanguages]

    try {
        const isEmailValid = await business.validateEmail(email)
        const isPasswordValid = await business.validatePassword(password)
        const isUsernameValid = await business.validateUsername(username)
        const isProfilePictureValid = await business.validateProfilePicture(profilePicture)

        if (!isEmailValid) {
            throw new Error("Invalid or already registered email address.")
        }
        if (!isPasswordValid) {
            throw new Error("Password must be at least 8 characters, include a number, a special character, an uppercase and lowercase letter.")
        }
        if (confirmedPassword.trim() != password.trim()) {
            throw new Error("Passwords do not match. Please ensure both password fields are the same.")
        }
        if (isUsernameValid) {
            throw new Error("Username is already taken. Please choose a different one.")
        }
        if (!isProfilePictureValid.isValid) {
            throw new Error(isProfilePictureValid.message)
        }

        let profilePicturePath = "/images/defaultProfilePicture.jpg"
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

app.get("/login", (req, res) => {
    const message = req.query.message
    res.render("login", { message })
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body
    try {
        const isValidLogin = await business.checkLogin(email, password)

        if (!isValidLogin) {
            throw new Error("Invalid email or password.");
        }

        const sessionKey = await business.startSession()
        res.cookie("sessionKey", sessionKey, {httpOnly: true})
        res.redirect("/dashboard")
    } catch (error){
        console.error("Login error:", error.message)
        res.redirect("/login?message=" + encodeURIComponent(error.message))
    }
})

app.get("/logout", async (req, res) => {
    const sessionKey = req.cookies.sessionKey
    try {
        if (sessionKey) {
            await business.deleteSession(sessionKey);
            res.clearCookie("sessionKey");
        }
        res.redirect("/login?message=" + encodeURIComponent("You have been logged out. Please login again!"));
    } catch (error) {
        console.error("Logout error:", error.message);
        res.redirect("/dashboard?message=" + encodeURIComponent("An error occurred while logging out."));
    }
})

app.get("/dashboard", async (req, res) => {
    res.send("Coming Soon...")
})

app.get("/reset-password", async(req, res) => {
    res.send("Coming Soon...")
})

app.post("/reset-password", async (req, res) => {
    let email = req.body.email
    const user = await business.getUserByEmail(email)
    if (user) {
        const resetKey = await business.storeResetKey(email)
        await business.sendPasswordResetEmail(email, resetKey)
    }
    res.redirect('/reset-password?message=Password reset email sent. Please check your inbox.')
})

app.get("/update-password", async (req, res) => {
    const resetKey = req.query.key
    const message = req.query.message
    const user = await business.getUserByResetKey(resetKey) 
    if (!user) {
        return res.redirect('/?message=Invalid or expired reset key.')
    }
    res.render('updatePassword', { resetKey: resetKey, message: message })
})

app.post("/update-password", async (req, res) => {
    const { resetKey, newPassword, confirmedPassword } = req.body
    try {
        await business.resetPassword(resetKey, newPassword, confirmedPassword)
        res.redirect('/?message=Password reset successful. Please log in with your new password.')
    } catch (error) {
        res.redirect(`/update-password?key=${resetKey}&message=${encodeURIComponent(error.message)}`)
    }
})

app.listen(8000, () => { })