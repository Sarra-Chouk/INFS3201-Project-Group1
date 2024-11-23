const express = require("express")
const business = require("./business.js")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const handlebars = require("express-handlebars")
const fileUpload = require('express-fileupload')
let app = express()

const hbs = handlebars.create({
    helpers: {
        ifEquals: (arg1, arg2, options) => {
            return (arg1 === arg2) ? options.fn(this) : options.inverse(this)
        }
    }
})

app.set("views", __dirname + "/templates")
app.set("view engine", "handlebars")
app.engine("handlebars", hbs.engine)
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
            throw new Error("The passwords you entered do not match. Please ensure both password fields are the same.")
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
        res.redirect(`/login?message=${encodeURIComponent("Registration successful.")}&type=success`)

    }
    catch (error) {
        console.error("Signup error:", error.message)
        res.redirect("/sign-up?message=" + encodeURIComponent(error.message))
    }
})

app.get("/login", (req, res) => {
    const message = req.query.message
    const type = req.query.type
    res.render("login", { message, type })
})

app.post("/login", async (req, res) => {
    const { email, password } = req.body
    try {
        const isValidLogin = await business.checkLogin(email, password)

        if (!isValidLogin) {
            return res.redirect(`/login?message=${encodeURIComponent("Invalid email or password.")}&type=error`)
        }

        const sessionKey = await business.startSession()
        res.cookie("sessionKey", sessionKey, { httpOnly: true })
        res.redirect("/dashboard")
    } catch (error) {
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

app.get("/reset-password", async (req, res) => {
    const message = req.query.message
    const type = req.query.type
    res.render("resetPassword", { message, type })
})

app.post("/reset-password", async (req, res) => {
    const email = req.body.email
    try {
        const emailExists = await business.checkEmailExists(email)

        if (!emailExists) {
            return res.redirect('/reset-password?message=' + encodeURIComponent('Invalid or not registered email address.') + '&type=error')
        }

        const resetKey = await business.storeResetKey(email)
        await business.sendPasswordResetEmail(email, resetKey)
        res.redirect('/reset-password?message=' + encodeURIComponent('Password reset email sent. Please check your inbox.') + '&type=success')

    } catch (error) {
        console.error("Error in reset password process:", error.message)
        return res.redirect('/reset-password?message=' + encodeURIComponent('An unexpected error occurred. Please try again.') + '&type=error')
    }
})

app.get("/update-password", async (req, res) => {
    const resetKey = req.query.key
    const message = req.query.message
    const type = req.query.type
    try {
        const user = await business.getUserByResetKey(resetKey);
        if (!user) {
            return res.redirect(`/update-password?message=${encodeURIComponent("Your reset link is invalid or has expired. Please request a new link.")}&type=error`);
        }
        res.render('updatePassword', { resetKey, message, type });
    } catch (error) {
        console.error("Error fetching reset key:", error.message);
        res.redirect(`/update-password?message=${encodeURIComponent("An unexpected error occurred. Please try again.")}&type=error`);
    }
})

app.post("/update-password", async (req, res) => {
    const { resetKey, newPassword, confirmedPassword } = req.body
    try {
        const resetResult = await business.resetPassword(resetKey, newPassword, confirmedPassword)
        if (!resetResult.isValid) {
            return res.redirect(`/update-password?key=${resetKey}&message=${encodeURIComponent(resetResult.message)}&type=error`)
        }
        res.redirect(`/login?message=${encodeURIComponent("Password reset successful. Please log in with your new password.")}&type=success`)
    } catch (error) {
        console.error("Error in update password process:", error.message)
        res.redirect(`/update-password?key=${resetKey}&message=${encodeURIComponent(error.message)}&type=error`)
    }
})

app.listen(8000, () => { })