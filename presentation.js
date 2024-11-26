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

/**
 * Route handler for the "/index" page.
 * Renders the "index" view.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
app.get("/index", (req, res) => {
    res.render("index")
})

/**
 * Route handler for the "/sign-up" page.
 * Renders the "signup" view and passes a message from the query string.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.query.message - The message from the query string.
 */
app.get("/sign-up", async (req, res) => {
    const message = req.query.message
    res.render("signup", { message}) 
})

/**
 * Route handler for the "/sign-up" page (POST).
 * Handles user registration, validates input, and stores user data.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.body.username - The user's chosen username.
 * @param {string} req.body.email - The user's email address.
 * @param {string} req.body.password - The user's password.
 * @param {string} req.body.confirmedPassword - The user's confirmed password.
 * @param {Array<string>} req.body.knownLanguages - List of languages the user speaks fluently.
 * @param {Array<string>} req.body.learningLanguages - List of languages the user wants to learn.
 * @param {Object} req.files - The files uploaded with the form, including the profile picture.
 * @param {Object} req.files.profilePicture - The profile picture file.
 * 
 * @throws {Error} If validation fails for any of the input fields.
 * 
 * @returns {void} Redirects to the login page with a success message upon successful registration.
 */
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

/**
 * Route handler for the "/verify-email" page.
 * Verifies the user's email using a verification key from the query string.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.query.key - The email verification key.
 * 
 * @throws {Error} If the email verification fails.
 * 
 * @returns {void} Redirects to the login page with a success or error message.
 */
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

/**
 * Route handler for the "/reset-password" page.
 * Renders the password reset page with optional message and type parameters from the query string.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.query.message - Optional message to be displayed on the reset password page.
 * @param {string} req.query.type - Optional type to define the message style (success/error).
 * 
 * @returns {void} Renders the "resetPassword" view with message and type.
 */
app.get("/reset-password", async (req, res) => {
    const message = req.query.message
    const type = req.query.type
    res.render("resetPassword", { message, type })
})

/**
 * Route handler for the "/reset-password" page (POST).
 * Initiates the password reset process by checking if the email exists, storing a reset key, and sending a password reset email.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.body.email - The email address provided by the user for password reset.
 * 
 * @throws {Error} If any error occurs during the reset process.
 * 
 * @returns {void} Redirects to the reset password page with a success or error message.
 */
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

/**
 * Route handler for the "/update-password" page.
 * Renders the update password page with the reset key, message, and type from the query string.
 * Validates the reset key and checks if it is associated with an existing user.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.query.key - The password reset key used for verification.
 * @param {string} req.query.message - Optional message to display on the page.
 * @param {string} req.query.type - Optional type to define the message style (success/error).
 * 
 * @throws {Error} If the reset key is invalid or expired, or if an unexpected error occurs.
 * 
 * @returns {void} Renders the "updatePassword" view or redirects with an error message.
 */
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

/**
 * Route handler for the "/update-password" page (POST).
 * Handles the password reset process by validating the reset key, new password, and confirmation, then updating the user's password.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.body.resetKey - The reset key used for password update.
 * @param {string} req.body.csrfToken - The CSRF token for security validation.
 * @param {string} req.body.newPassword - The new password chosen by the user.
 * @param {string} req.body.confirmedPassword - The confirmation of the new password.
 * 
 * @throws {Error} If any error occurs during the password reset process.
 * 
 * @returns {void} Redirects to the login page with a success or error message.
 */
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

/**
 * Route handler for the "/login" page.
 * Renders the login page with optional message and type parameters from the query string.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.query.message - Optional message to display on the login page.
 * @param {string} req.query.type - Optional type to define the message style (success/error).
 * 
 * @returns {void} Renders the "login" view with message and type.
 */
app.get("/login", (req, res) => {
    const message = req.query.message
    const type = req.query.type
    res.render("login", { message, type })
})

/**
 * Route handler for the "/login" page (POST).
 * Handles the login process by validating the user's credentials and starting a session.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.body.email - The user's email address.
 * @param {string} req.body.password - The user's password.
 * 
 * @throws {Error} If any error occurs during the login process.
 * 
 * @returns {void} Redirects to the dashboard page with a success or error message.
 */
app.post("/login", async (req, res) => {
    const { email, password } = req.body

    try {

        const loginResult = await business.checkLogin(email, password)

        if (!loginResult.isValid) {
            return res.redirect(`/login?message=${encodeURIComponent(loginResult.message)}&type=error`)
        }

        const sessionKey = await business.startSession(loginResult.userId)
        res.cookie("sessionKey", sessionKey, { httpOnly: true })
        res.redirect("/dashboard?message=" + encodeURIComponent("Welcome to GlobeLingo!") + "&type=success")

    } catch (error) {

        console.error("Login error:", error.message)
        res.redirect("/login?message=" + encodeURIComponent("An unexpected error occurred. Please try again."))

    }
})

/**
 * Middleware to attach session data to the request object.
 * Verifies the session key from cookies and fetches the session data.
 * If the session is invalid or expired, the user is redirected to the login page.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function to be executed if the session is valid.
 * 
 * @throws {Error} If there is an error fetching session data or if the session is invalid or expired.
 * 
 * @returns {void} Redirects to the login page with an appropriate message if the session is invalid or expired.
 */
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

/**
 * Route handler for the "/dashboard" page.
 * Fetches and renders the dashboard with the user's data, including matching users.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.query.message - Optional message to display on the dashboard page.
 * @param {string} req.query.type - Optional type to define the message style (success/error).
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * 
 * @throws {Error} If any error occurs while fetching user data or matching users.
 * 
 * @returns {void} Renders the "dashboard" view with user and matching user data.
 */
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

/**
 * Route handler for the "/profile" page.
 * Fetches and renders the user's profile information, including their username, email, profile picture, and badges.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * 
 * @throws {Error} If any error occurs while fetching the profile data.
 * 
 * @returns {void} Renders the "profile" view with the user's profile information.
 */
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

/**
 * Route handler for the "/my-contacts" page.
 * Fetches and renders the user's contacts.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * @param {string} req.query.message - Optional message to display on the contacts page.
 * @param {string} req.query.type - Optional type to define the message style (success/error).
 * 
 * @throws {Error} If any error occurs while fetching contacts.
 * 
 * @returns {void} Renders the "myContacts" view with the user's contacts.
 */
app.get("/my-contacts", attachSessionData, async (req, res) => {

    const userId = req.userId
    const message = req.query.message
    const type = req.query.type

    try {
      const contacts = await business.getContacts(userId)
      
      res.render('myContacts', {
        contacts: contacts,
        message: message,
        type: type
      })
    } catch (err) {
      res.status(500).send('Error fetching data');
    }
})

/**
 * Route handler for the "/remove-contact/:contactId" page (POST).
 * Removes a contact from the user's contact list.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.contactId - The ID of the contact to be removed.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * 
 * @throws {Error} If any error occurs while removing the contact.
 * 
 * @returns {void} Redirects to the "my-contacts" page with a success or error message.
 */
app.post("/remove-contact/:contactId", attachSessionData, async (req, res) => {
    try {
        const contactId = req.params.contactId
        const userId = req.userId

        await business.removeContact(userId, contactId)

        res.redirect(`/my-contacts?message=${encodeURIComponent("Contact removed successfully!")}&type=success`)
    } catch (error) {
        console.error("Error removing contact:", error.message)
        res.redirect(`/my-contacts?message=${encodeURIComponent("An error occurred while removing the contact.")}&type=error`)
    }
})

/**
 * Route handler for the "/add-contact/:contactId" page.
 * Adds a contact to the user's contact list.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.contactId - The ID of the contact to be added.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * 
 * @throws {Error} If any error occurs while adding the contact.
 * 
 * @returns {void} Redirects to the dashboard page with a success or error message.
 */
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

/**
 * Route handler for the "/block-contact/:contactId" page.
 * Blocks a contact from the user's contact list.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.contactId - The ID of the contact to be blocked.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * 
 * @throws {Error} If any error occurs while blocking the contact.
 * 
 * @returns {void} Redirects to the dashboard page with a success or error message.
 */
app.get("/block-contact/:contactId", attachSessionData, async (req, res) => {

    try {
        const contactId = req.params.contactId
        const userId = req.userId

        await business.blockContact(userId, contactId)

        res.redirect(`/dashboard?message=${encodeURIComponent("Contact blocked successfully!")}&type=success`)
    } catch (error) {
        console.error("Error blocking contact:", error.message)
        res.redirect(`/dashboard?message=${encodeURIComponent("An error occurred while blocking the contact.")}&type=error`)
    }
})

app.post("/unblock-contact/:contactId", attachSessionData, async (req, res) => {
    const userId = req.userId
    const contactId = req.params.contactId

    try {
        await business.unblockContact(userId, contactId)
        res.redirect(`/blocked-contacts?message=${encodeURIComponent("Contact unblocked successfully!")}&type=success`)
    } catch (err) {
        console.error(`Error unblocking contact: ${err.message}`)
        res.redirect(`/blocked-contacts?message=${encodeURIComponent("An error occurred while unblocking the contact.")}&type=error`)
    }
})

/**
 * Route handler for the "/blocked-contacts" page.
 * Fetches and renders the list of blocked contacts for the user.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * @param {string} req.query.message - Optional message to display on the blocked contacts page.
 * @param {string} req.query.type - Optional type to define the message style (success/error).
 * 
 * @throws {Error} If any error occurs while fetching blocked contacts.
 * 
 * @returns {void} Renders the "blockedContacts" view with the user's blocked contacts.
 */
app.get("/blocked-contacts", attachSessionData, async (req, res) => {
    const userId = req.userId
    const message = req.query.message
    const type = req.query.type

    try {
        const blockedContacts = await business.getBlockedContacts(userId)

        res.render('blockedContacts', {
            blockedContacts: blockedContacts,
            message: message,
            type: type
        })
    } catch (err) {
        console.error("Error fetching blocked contacts:", err.message)
        res.status(500).send('Error fetching data')
    }
})

/**
 * Route handler for the "/conversation/:receiverId" page.
 * Fetches and renders the conversation between the logged-in user (sender) and another user (receiver).
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.receiverId - The ID of the receiver in the conversation.
 * @param {string} req.userId - The ID of the currently logged-in user (sender), extracted from session data.
 * 
 * @throws {Error} If any error occurs while fetching the conversation or user data.
 * 
 * @returns {void} Renders the "conversation" view with the conversation details and user information.
 */
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

/**
 * Route handler for sending a message in a conversation.
 * Validates the session and CSRF token, then sends the message and awards badges.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.receiverId - The ID of the receiver in the conversation.
 * @param {string} req.userId - The ID of the currently logged-in user (sender), extracted from session data.
 * @param {string} req.body.message - The message to be sent.
 * @param {string} req.body.csrfToken - The CSRF token for session validation.
 * 
 * @throws {Error} If any error occurs while sending the message or validating the session.
 * 
 * @returns {void} Redirects to the conversation page with the receiver.
 */
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

/**
 * Route handler for the "/badges" page.
 * Fetches and renders the list of badges earned by the logged-in user.
 * Requires session data, validated by the `attachSessionData` middleware.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.userId - The ID of the currently logged-in user, extracted from session data.
 * 
 * @throws {Error} If any error occurs while fetching badges.
 * 
 * @returns {void} Renders the "badges" view with the user's earned badges or a message if no badges are earned.
 */
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

/**
 * Route handler for the "/logout" page.
 * Logs the user out by canceling the session token and clearing the session data.
 * Redirects to the login page with a success message.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.cookies.sessionKey - The session key from the cookies.
 * 
 * @throws {Error} If any error occurs while logging out or managing session data.
 * 
 * @returns {void} Redirects to the login page with a success or error message.
 */
app.get("/logout", async (req, res) => {
    const sessionKey = req.cookies.sessionKey

    try {

        if (sessionKey) {
            await business.cancelToken(sessionKey)
            await business.deleteSession(sessionKey)
            res.clearCookie("sessionKey")
        }

        res.redirect(`/login?message=${encodeURIComponent("You have been logged out.")}&type=success`)

    } catch (error) {

        console.error("Logout error:", error.message)
        res.redirect("/dashboard?message=" + encodeURIComponent("An unexpected error occurred. Please try again."))

    }
})

app.listen(8000, () => { })