const { ObjectId } = require('mongodb')
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
        },
        formatDate: function(date) {
            const options = { hour: '2-digit', minute: '2-digit', hour12: true }
            const formattedDate = new Date(date).toLocaleTimeString([], options)
            return formattedDate
        }
    }
})

app.set("views", __dirname + "/templates")
app.set("view engine", "handlebars")
app.engine("handlebars", hbs.engine)
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use('/profilePictures', express.static(__dirname + "/static/profilePictures"))
app.use('/badges', express.static(__dirname + '/static/badges'))
app.use('/images', express.static(__dirname + '/static'))
app.use(fileUpload())

app.get("/index", (req, res) => {
    res.render("index")
})

app.get("/sign-up", async (req, res) => {
    const message = req.query.message
    res.render("signup", { message}) 
})

app.post("/sign-up", async (req, res) => {
    const { username, email, password, confirmedPassword, knownLanguages, learningLanguages } = req.body
    const profilePicture = req.files ? req.files.profilePicture : null

     const knownLanguagesArray = knownLanguages
        ? Array.isArray(knownLanguages)
            ? knownLanguages.filter((lang) => lang && lang.trim() !== "")
            : [knownLanguages].filter((lang) => lang && lang.trim() !== "")
        : []

    const learningLanguagesArray = learningLanguages
        ? Array.isArray(learningLanguages)
            ? learningLanguages.filter((lang) => lang && lang.trim() !== "")
            : [learningLanguages].filter((lang) => lang && lang.trim() !== "")
        : []

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

        if (knownLanguagesArray.length === 0) {
            throw new Error("Please select at least one language you speak fluently.")
        }

        if (learningLanguagesArray.length === 0) {
            throw new Error("Please select at least one language you would like to learn.")
        }

        if (!isProfilePictureValid.isValid) {
            throw new Error(isProfilePictureValid.message)
        }

        let profilePicturePath = "/profilePictures/defaultProfilePicture.png"
        if (profilePicture) {
            const uniqueFileName = `${Date.now()}_${profilePicture.name}`
            profilePicturePath = `/profilePictures/${uniqueFileName}`
            await profilePicture.mv(`${__dirname}/static/profilePictures/${uniqueFileName}`)
        }

        await business.createUser(username, email, password, knownLanguagesArray, learningLanguagesArray, profilePicturePath)
        await business.sendVerificationEmail(email, username)
        res.redirect(`/login?message=${encodeURIComponent("Registration successful. A verification email has been sent to your inbox.")}&type=success`)

    }

    catch (error) {

        console.error("Signup error:", error.message)
        res.redirect("/sign-up?message=" + encodeURIComponent(error.message))

    }
})

app.get("/verify-email", async (req, res) => {
    const { key } = req.query

    try {

        await business.verifyEmail(key)
        res.redirect(`/login?message=${encodeURIComponent("Your email has been verified successfully. Please log in with your credentials.")}&type=success`)

    } catch (error) {

        console.error("Email verification error:", error.message);
        res.redirect(`/login?message=${encodeURIComponent(error.message)}&type=error`)
    
    }
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
            return res.redirect(`/reset-password?message=${encodeURIComponent('Invalid or not registered email address.')}&type=error`)
        }

        const resetKey = await business.storeResetKey(email)
        await business.sendPasswordResetEmail(email, resetKey)
        res.redirect(`/reset-password?message=${encodeURIComponent('Password reset email sent. Please check your inbox.')}&type=success`)

    } catch (error) {

        console.error("Error in reset password process:", error.message)
        return res.redirect(`/reset-password?message=${encodeURIComponent('An unexpected error occurred. Please try again.')}&type=error`)

    }
})

app.get("/update-password", async (req, res) => {
    const resetKey = req.query.key
    const message = req.query.message
    const type = req.query.type

    try {

        const user = await business.getUserByResetKey(resetKey)

        if (!user) {
            return res.redirect(`/update-password?message=${encodeURIComponent("Your reset link is invalid or has expired. Please request a new link.")}&type=error`)
        }

        res.render('updatePassword', { resetKey, message, type })
    } catch (error) {

        console.error("Error fetching reset key:", error.message)
        res.redirect(`/update-password?message=${encodeURIComponent("An unexpected error occurred. Please try again.")}&type=error`)

    }
})

app.post("/update-password", async (req, res) => {
    const { resetKey, csrfToken, newPassword, confirmedPassword } = req.body

    try {
        
        const resetResult = await business.resetPassword(resetKey, newPassword, confirmedPassword)

        if (!resetResult.isValid) {
            return res.redirect(`/update-password?key=${resetKey}&message=${encodeURIComponent(resetResult.message)}&type=error`)
        }

        res.redirect(`/login?message=${encodeURIComponent("Password reset successful. Please log in with your new password.")}&type=success`)

    } catch (error) {

        console.error("Error in update password process:", error.message);
        res.redirect(`/update-password?key=${resetKey}&message=${encodeURIComponent("An unexpected error occurred. Please try again.")}&type=error`)

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

        const loginResult = await business.checkLogin(email, password)

        if (!loginResult.isValid) {
            return res.redirect(`/login?message=${encodeURIComponent(loginResult.message)}&type=error`)
        }

        const sessionKey = await business.startSession(loginResult.userId)
        res.cookie("sessionKey", sessionKey, { httpOnly: true })
        res.redirect("/dashboard")

    } catch (error) {

        console.error("Login error:", error.message)
        res.redirect("/login?message=" + encodeURIComponent("An unexpected error occurred. Please try again."))

    }
})

async function attachSessionData(req, res, next) {
    const sessionKey = req.cookies.sessionKey
    if (!sessionKey) {
        return res.redirect(`/login?message=${encodeURIComponent("Please log in.")}&type=error`)
    }

    try {

        const sessionData = await business.getSession(sessionKey)
        if (!sessionData || !sessionData.userId) {
            return res.redirect(`/login?message=${encodeURIComponent("Your session has expired. Please log in again.")}&type=error`)
        }
        req.userId = sessionData.userId
        next()

    } catch (error) {

        console.error("Error in attachSessionData middleware:", error.message)
        res.redirect("/login?message=" + encodeURIComponent("An error occurred. Please try again.") + "&type=error")

    }
}

app.get("/dashboard", attachSessionData, async (req, res) => {
    try {
        const message = req.query.message
        const type = req.query.type
        const userId = req.userId
        const user = await business.getUserById(userId)
        const matchingUsers = await business.getMatchingUsers(userId)

        res.render("dashboard", {matchingUsers, userId: userId, username: user.username, message, type})

    } catch (err) {

        console.error("Error fetching dashboard data:", err.message)
        res.status(500).send("An error occurred while loading your dashboard.")

    }
})

app.get("/profile", attachSessionData, async (req, res) => {
    try {
        const userId = req.userId;

        const profile = await business.getProfile(userId);

        
        res.render("profile", {
            username: profile.username,
            email: profile.email,
            profilePicture: profile.profilePicture,
            badges: profile.badges
        });
    } catch (error) {
        console.error("Error rendering profile:", error.message);
        res.status(500).send("An error occurred while loading your profile.");
    }
})

app.get("/add-contact/:contactId", attachSessionData, async (req, res) => {
    try {
        const contactId = req.params.contactId
        const userId = req.userId

        await business.addContact(userId, contactId)
        res.redirect(`/dashboard?message=${encodeURIComponent("Contact was added successfully!")}&type=success`)
    } catch (error) {
        console.error("Error fetching conversation:", error.message)
    }
})

app.get("/my-contacts", attachSessionData, async (req, res) => {

    const userId = req.userId

    try {
      const contacts = await business.getContacts(userId)
      
      res.render('myContacts', {
        contacts: contacts
      })
    } catch (err) {
      res.status(500).send('Error fetching data');
    }
})

app.get('/conversation/:receiverId', attachSessionData, async (req, res) => {
    try {

        const senderId = req.userId
        const receiverId = req.params.receiverId
        const sender = await business.getUserById(senderId)
        const receiver = await business.getUserById(receiverId)
        const csrfToken = await business.generateFormToken(req.cookies.sessionKey)

        const conversation = await business.getConversation(senderId, receiverId)
        res.render('conversation', {
            conversation, 
            sender: sender.username, 
            receiver: receiver.username,
            receiverId: receiverId,
            csrfToken
        })

    } catch (error) {

        console.error("Error fetching conversation:", error.message)
        res.status(500).send("An error occurred while loading the conversation.")
        
    }
})

app.post('/conversation/:receiverId', attachSessionData, async (req, res) => {
    try {

        const { message, csrfToken } = req.body
        const senderId = req.userId
        const receiverId = req.params.receiverId

        const sessionData = await business.getSession(req.cookies.sessionKey)
        if (!sessionData || sessionData.csrfToken !== csrfToken) {
            return res.redirect(`/login?message=${encodeURIComponent("Your session has expired. Please log in again.")}&type=error`)
        }

        await business.sendMessage(senderId, receiverId, message)
        await business.awardBadge(senderId, receiverId)
        await business.awardBadge(receiverId, senderId)
        
        res.redirect(`/conversation/${receiverId}`)

    } catch (error) {

        console.error("Error sending message:", error.message)
        res.status(500).send("An error occurred while sending the message.")

    }
})

app.get("/blocked-contacts", (req, res) => {
    res.render("blockedContacts")
})

app.get("/badges", attachSessionData, async (req, res) => {
    try {
    
        const userBadges = await business.getUserBadges(req.userId)
        if (userBadges.length === 0) {
            return res.render("badges", { message: "You have not earned any badges yet" })
        }
        res.render("badges", { badges: userBadges })

    } catch (error) {

        console.error("Error fetching badges:", error.message);
        res.redirect(`/dashboard/test?message=${encodeURIComponent("An error occurred while retrieving the badges.")}&type=error`)

    }
})

app.get("/logout", async (req, res) => {
    const sessionKey = req.cookies.sessionKey

    try {

        if (sessionKey) {
            await business.cancelToken(sessionKey)
            await business.deleteSession(sessionKey)
            res.clearCookie("sessionKey")
        }

        res.redirect("/login?message=" + encodeURIComponent("You have been logged out."))

    } catch (error) {

        console.error("Logout error:", error.message)
        res.redirect("/dashboard?message=" + encodeURIComponent("An unexpected error occurred. Please try again."))

    }
})

app.listen(8000, () => { })