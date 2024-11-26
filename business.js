const { ObjectId } = require('mongodb')
const persistence = require('./persistence')
const crypto = require("crypto")
const nodemailer = require("nodemailer")
let transporter = nodemailer.createTransport({
    host: "127.0.0.1",
    port: 25,
})

/**
 * Retrieves a user by their unique ID using the persistence layer.
 *
 * @async
 * @function getUserById
 * @param {string} userId - The unique ID of the user to retrieve.
 * @returns {Object|null} The user object if found, or `null` if not found.
 * @throws Will propagate any errors from the persistence layer.
 */

async function getUserById(userId) {
    return await persistence.getUserById(userId)
}

/**
 * Retrieves a user by their email address using the persistence layer.
 *
 * @async
 * @function getUserByEmail
 * @param {string} email - The email address of the user to retrieve.
 * @returns {Object|null} The user object if found, or `null` if not found.
 * @throws Will propagate any errors from the persistence layer.
 */

async function getUserByEmail(email) {
    return await persistence.getUserByEmail(email)
}

/**
 * Validates an email address format and checks if it is not already in use.
 *
 * @async
 * @function validateEmail
 * @param {string} email - The email address to validate.
 * @returns {boolean} `true` if the email is valid and not in use, `false` otherwise.
 * @throws Will propagate any errors from the `getUserByEmail` function.
 */

async function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const user = await getUserByEmail(email)
    return emailRegex.test(email) && !user
}

/**
 * Checks if an email address already exists in the database using the persistence layer.
 *
 * @async
 * @function checkEmailExists
 * @param {string} email - The email address to check.
 * @returns {boolean} `true` if the email exists, `false` otherwise.
 * @throws Will propagate any errors from the persistence layer.
 */

async function checkEmailExists(email) {
    const user = await persistence.getUserByEmail(email)
    return !!user
}

/**
 * Validates if a username exists in the database using the persistence layer.
 *
 * @async
 * @function validateUsername
 * @param {string} username - The username to validate.
 * @returns {Object|null} The user object if the username exists, or `null` if it does not.
 * @throws Will propagate any errors from the persistence layer.
 */

async function validateUsername(username) {
    return await persistence.getUserByUsername(username)
}

/**
 * Validates if a password meets security criteria.
 *
 * @async
 * @function validatePassword
 * @param {string} password - The password to validate.
 * @returns {boolean} `true` if the password meets all criteria, `false` otherwise.
 * @description The password is validated against the following criteria:
 * - At least 8 characters long.
 * - Contains at least one number.
 * - Contains at least one special character.
 * - Contains at least one uppercase letter.
 * - Contains at least one lowercase letter.
 */

async function validatePassword(password) {
    const lengthRegex = /^.{8,}$/
    const numberRegex = /[0-9]/
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/
    const upperCaseRegex = /[A-Z]/
    const lowerCaseRegex = /[a-z]/

    return (
        lengthRegex.test(password) &&
        numberRegex.test(password) &&
        specialCharRegex.test(password) &&
        upperCaseRegex.test(password) &&
        lowerCaseRegex.test(password)
    )
}

/**
 * Validates a profile picture based on file type and size criteria.
 *
 * @async
 * @function validateProfilePicture
 * @param {Object} profilePicture - The profile picture file object to validate. Should include `mimetype` and `size` properties.
 * @returns {Object} An object containing `isValid` (boolean) and optionally a `message` (string) if invalid.
 * @description The validation checks:
 * - Allowed file types: JPEG, JPG, PNG.
 * - Maximum file size: 5MB.
 * - If no profile picture is provided, it defaults to valid.
 */

async function validateProfilePicture(profilePicture) {
    if (!profilePicture) {
        return { isValid: true }
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(profilePicture.mimetype)) {
        return { isValid: false, message: "Invalid file type. Only JPEG, JPG and PNG are allowed." }
    }
    const maxSize = 5 * 1024 * 1024
    if (profilePicture.size > maxSize) {
        return { isValid: false, message: "File size too large. Please upload an image smaller than 5MB." }
    }
    return { isValid: true };
}

/**
 * Creates a salted hash for a given password.
 *
 * @function createSaltedHash
 * @param {string} password - The plain text password to hash.
 * @returns {string} A salted hash in the format `salt:hash`.
 * @description This function generates a 4-byte random salt, appends it to the password, 
 * and creates a SHA-1 hash. The result is returned as a string in the format `salt:hash`.
 */

function createSaltedHash(password) {
    const salt = crypto.randomBytes(4).toString('hex');
    const hash = crypto.createHash('sha1')
    hash.update(salt + password)
    const saltedHash = salt + ":" + hash.digest('hex')
    return saltedHash
}

/**
 * Creates a new user in the system with the provided details.
 *
 * @async
 * @function createUser
 * @param {string} username - The username of the new user.
 * @param {string} email - The email address of the new user.
 * @param {string} password - The plain text password of the new user.
 * @param {Array<string>} knownLanguages - A list of languages the user knows.
 * @param {Array<string>} learningLanguages - A list of languages the user is learning.
 * @param {string} profilePicturePath - The file path to the user's profile picture.
 * @throws Will log an error if any validation fails or if user creation fails.
 * @description This function validates the provided email, username, and password before creating a new user.
 * The password is hashed with a salt before storing. The user's email is marked as unverified by default.
 */

async function createUser(username, email, password, knownLanguages, learningLanguages, profilePicturePath) {
    const hashedPassword = createSaltedHash(password)
    if (await validateEmail && await validateUsername && await validatePassword && await checkEmailExists) {
        const user = {
            username: username,
            email: email,
            password: hashedPassword,
            knownLanguages: knownLanguages,
            learningLanguages: learningLanguages,
            profilePicturePath: profilePicturePath,
            isVerified: false
        }
        await persistence.createUser(user)
    }
}

/**
 * Retrieves a user from the database using their verification key.
 *
 * @async
 * @function getUserByVerificationKey
 * @param {string} verificationKey - The verification key associated with the user.
 * @returns {Object|null} The user object if found, or `null` if not found or the key is invalid.
 * @throws Will propagate any errors from the persistence layer.
 */

async function getUserByVerificationKey(verificationKey) {
    return await persistence.getUserByKey(verificationKey, "verification")
}

/**
 * Sends a verification email to the specified user.
 *
 * @async
 * @function sendVerificationEmail
 * @param {string} email - The email address of the user to whom the verification email will be sent.
 * @param {string} username - The username of the user to personalize the email.
 * @throws Will log an error if the operation to store the verification key or send the email fails.
 * @description This function generates a unique verification key, stores it in the database,
 * and sends an email with a verification link to the user.
 */

async function sendVerificationEmail(email, username) {
    const verificationKey = crypto.randomUUID()
    await persistence.storeKey(email, verificationKey, "verification")
    const verificationLink = `http://localhost:8000/verify-email?key=${verificationKey}`
    const body = `
        <p>Hello, ${username},</p>
        <p>Welcome to GlobeLingo! Please click on this link to verify your email address:</p>
        <a href="${verificationLink}">${verificationLink}</a>
        <p>If you did not sign up, please ignore this email.</p>
    `
    await transporter.sendMail({
        from: 'no-reply@globelingo.com',
        to: email,
        subject: 'Email Verification',
        html: body,
    })
}

/**
 * Verifies a user's email using a verification key.
 *
 * @async
 * @function verifyEmail
 * @param {string} key - The verification key associated with the user.
 * @throws Will throw an error if the verification key is invalid or expired.
 * @description This function marks the user's email as verified, and clears the verification key from the database.
 */

async function verifyEmail(key) {
    const user = await persistence.getUserByKey(key, "verification")
    if (!user) throw new Error("Verification failed. The link may have expired or is invalid.")
    await persistence.updateUserField(user.email, { isVerified: true })
    await persistence.clearKey(user.email, "verification")
}


/**
 * Checks the login credentials of a user.
 *
 * @async
 * @function checkLogin
 * @param {string} email - The email address of the user attempting to log in.
 * @param {string} password - The plain text password provided by the user.
 * @returns {Object} An object with `isValid` (boolean), `message` (string), and optionally `userId` (string).
 * @description This function verifies the email and password against the database. It also ensures the user's email is verified.
 */
async function checkLogin(email, password) {
    const user = await persistence.getUserByEmail(email)
    if (!user) {
        return { isValid: false, message: "Invalid email or password." }
    }
    if (!user.isVerified) {
        return { isValid: false, message: "Email is not verified. Please verify your email before logging in." }
    }
    const [storedSalt, storedHash] = user.password.split(':')
    const hash = crypto.createHash('sha1')
    hash.update(storedSalt + password)
    const inputHash = hash.digest('hex')

    if (inputHash === storedHash) {
        return { isValid: true, message: "Login successful.", userId: user._id }
    } else {
        return { isValid: false, message: "Invalid email or password." }
    }
}

/**
 * Starts a new session for a user by creating a session object with a unique session key and expiry time.
 *
 * @async
 * @function startSession
 * @param {string} userId - The ID of the user for whom the session is being created.
 * @returns {string} The session key for the newly created session.
 * @throws Will log an error if the session cannot be saved.
 */
async function startSession(userId) {
    const uuid = crypto.randomUUID()
    const expiry = new Date(Date.now() + 10 * 60 * 1000)
    const session = {
        sessionKey: uuid,
        expiry: expiry,
        data: { userId: userId }
    }
    await persistence.saveSession(session)
    return uuid
}

/**
 * Retrieves a session by its session key.
 *
 * @async
 * @function getSession
 * @param {string} key - The session key to retrieve the session data.
 * @returns {Object|null} The session object if found and valid, or `null` if not found or expired.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getSession(key) {
    return await persistence.getSession(key)
}


/**
 * Deletes a session by its session key.
 *
 * @async
 * @function deleteSession
 * @param {string} key - The session key of the session to delete.
 * @throws Will propagate any errors from the persistence layer.
 */
async function deleteSession(key) {
    return await persistence.deleteSession(key)
}

/**
 * Stores a password reset key for a user in the database.
 *
 * @async
 * @function storeResetKey
 * @param {string} email - The email address of the user for whom the reset key is being generated.
 * @returns {string} The generated reset key.
 * @throws Will log an error if the operation to store the reset key fails.
 */
async function storeResetKey(email) {
    let resetKey = crypto.randomUUID();
    await persistence.storeKey(email, resetKey, "reset")
    return resetKey
}

/**
 * Retrieves a user from the database using a password reset key.
 *
 * @async
 * @function getUserByResetKey
 * @param {string} resetKey - The password reset key associated with the user.
 * @returns {Object|null} The user object if found, or `null` if not found or the key is invalid.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getUserByResetKey(resetKey) {
    return await persistence.getUserByKey(resetKey, "reset")
}

/**
 * Sends a password reset email to the specified user.
 *
 * @async
 * @function sendPasswordResetEmail
 * @param {string} email - The email address of the user requesting the password reset.
 * @param {string} resetKey - The reset key generated for the password reset process.
 * @throws Will log an error if the email fails to send.
 * @description This function constructs a password reset link using the provided reset key and sends it to the user's email.
 */

async function sendPasswordResetEmail(email, resetKey) {
    const resetLink = `http://localhost:8000/update-password?key=${resetKey}`
    const body = `
    <p>Hello,</p>
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>If you did not request a password reset, please ignore this email.</p>
    `;
    await transporter.sendMail({
        from: 'no-reply@globelingo.com',
        to: email,
        subject: 'Password Reset Request',
        html: body,
    })
}

/**
 * Resets a user's password using a reset key.
 *
 * @async
 * @function resetPassword
 * @param {string} resetKey - The password reset key associated with the user.
 * @param {string} newPassword - The new password to set for the user.
 * @param {string} confirmedPassword - The confirmation password to verify against the new password.
 * @returns {Object} An object containing `isValid` (boolean) and a `message` (string) if invalid.
 * @throws Will propagate any errors from the persistence layer.
 * @description This function validates the new password, checks the reset key, ensures passwords match, 
 * hashes the new password, and updates it in the database. It also clears the reset key after use.
 */

async function resetPassword(resetKey, newPassword, confirmedPassword) {
    if (! await validatePassword(newPassword)) {
        return { isValid: false, message: "Password must be at least 8 characters, include a number, a special character, an uppercase and lowercase letter." }
    }
    if (newPassword.trim() !== confirmedPassword.trim()) {
        return { isValid: false, message: "The passwords you entered do not match. Please ensure both password fields are the same." }
    }
    const user = await persistence.getUserByKey(resetKey, "reset")
    if (!user) {
        return { isValid: false, message: "Your reset link is invalid or has expired. Please request a new link." }
    }
    const saltedHash = createSaltedHash(newPassword)
    await persistence.updatePassword(user.email, saltedHash)
    await persistence.clearKey(user.email, "reset")
    return { isValid: true }
}

/**
 * Updates a user's password in the database.
 *
 * @async
 * @function updatePassword
 * @param {string} email - The email address of the user whose password is to be updated.
 * @param {string} newPassword - The new password to set for the user.
 * @returns {boolean} `false` if the user is not found, otherwise nothing is returned.
 * @throws Will propagate any errors from the persistence layer.
 */
async function updatePassword(email, newPassword) {
    const user = await persistence.getUserByEmail(email)
    if (!user) {
        return false
    }
    const saltedHash = createSaltedHash(newPassword)
    await persistence.updatePassword(email, saltedHash)
}

/**
 * Retrieves a list of users whose known languages match the learning languages of a given user.
 *
 * @async
 * @function getMatchingUsers
 * @param {string} userId - The ID of the user for whom matching users are to be found.
 * @returns {Array<Object>} An array of matching user objects.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getMatchingUsers(userId) {
    return await persistence.getMatchingUsers(userId)
}

/**
 * Retrieves the list of contacts for a specific user.
 *
 * @async
 * @function getContacts
 * @param {string} userId - The ID of the user whose contacts are to be retrieved.
 * @returns {Array<Object>} An array of contact objects.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getContacts(userId) {
    return await persistence.getContacts(userId)
}

/**
 * Adds a contact to a user's contact list in the database.
 *
 * @async
 * @function addContact
 * @param {string} userId - The ID of the user who is adding the contact.
 * @param {string} contactId - The ID of the contact to be added.
 * @throws Will propagate any errors from the persistence layer.
 */
async function addContact(userId, contactId) {
    await persistence.addContact(userId, contactId);
}

/**
 * Removes a contact from a user's contact list in the database.
 *
 * @async
 * @function removeContact
 * @param {string} userId - The ID of the user from whose contact list the contact is to be removed.
 * @param {string} contactId - The ID of the contact to be removed.
 * @throws Will propagate any errors from the persistence layer.
 */

async function removeContact(userId, contactId) {
    await persistence.removeContact(userId, contactId)
}

/**
 * Blocks a contact for a specific user by adding the contact ID to the user's blocked contacts list.
 *
 * @async
 * @function blockContact
 * @param {string} userId - The ID of the user who wants to block the contact.
 * @param {string} contactId - The ID of the contact to be blocked.
 * @throws Will propagate any errors from the persistence layer.
 */
async function blockContact(userId, contactId){
    await persistence.blockContact(userId, contactId)
}

/**
 * Retrieves the profile of a user, including their username, email, profile picture, and badges.
 *
 * @async
 * @function getProfile
 * @param {string} userId - The ID of the user whose profile is to be retrieved.
 * @returns {Object} An object containing the user's profile details: `username`, `email`, `profilePicture`, and `badges`.
 * @throws Will throw an error if the user is not found.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getProfile(userId) {
    const user = await persistence.getUserById(userId)
    if (!user) {
        throw new Error("User not found.")
    }
    const badges = await persistence.getUserBadges(userId)
    return {
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicturePath || "/profilePictures/defaultProfilePicture.jpg",
        badges: badges || []
    }
}


/**
 * Retrieves the badges associated with a specific user.
 *
 * @async
 * @function getUserBadges
 * @param {string} userId - The ID of the user whose badges are to be retrieved.
 * @returns {Array<Object>} An array of badge objects, or an empty array if the user has no badges.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getUserBadges(userId) {
    return await persistence.getUserBadges(userId)
}

/**
 * Checks if a user has received a reply in a conversation with another user.
 *
 * @async
 * @function hasReceivedReply
 * @param {string} senderId - The ID of the user who sent the initial message.
 * @param {string} receiverId - The ID of the user who is expected to reply.
 * @returns {boolean} `true` if the sender has received a reply from the receiver, `false` otherwise.
 * @throws Will propagate any errors from the `getConversation` function or persistence layer.
 */

async function hasReceivedReply(senderId, receiverId) {
    const convo = await getConversation(senderId, receiverId)
    if (convo.length >= 2) {
        for (let i = 0; i < convo.length - 1; i++) {
            const currentMessage = convo[i]
            const nextMessage = convo[i + 1]

            if (
                currentMessage.senderId.toString() === senderId.toString() &&
                currentMessage.receiverId.toString() === receiverId.toString() &&
                nextMessage.senderId.toString() === receiverId.toString() &&
                nextMessage.receiverId.toString() === senderId.toString()
            ) {
                return true
            }
        }
    }
    return false
}

/**
 * Awards badges to a user based on predefined rules and conditions.
 *
 * @async
 * @function awardBadge
 * @param {string} senderId - The ID of the user who may be eligible for badges.
 * @param {string} receiverId - The ID of the user involved in the badge eligibility check (e.g., for a conversation-based badge).
 * @throws Will propagate any errors from the persistence layer or eligibility checks.
 * @description This function checks badge eligibility for the sender based on predefined rules, 
 * such as having a first conversation or sending 100 messages. If eligible, the badge is awarded.
 */

async function awardBadge(senderId, receiverId) {
    const allBadges = await persistence.getAllBadges()
    const userMessages = await persistence.getUserMessages(senderId)
    const badgeRules = {
        "First Conversation": async () => {
            return await hasReceivedReply(senderId, receiverId)
        },
        "100 Messages Sent": async () => {
            return userMessages.length >= 100
        }
    }

    for (const badge of allBadges) {
        const userBadges = await persistence.getUserBadges(senderId)
        if (userBadges.some(b => b.name === badge.name)) continue

        const isEligible = await badgeRules[badge.name]?.()
        if (isEligible) {
            await persistence.awardBadge(senderId, badge)
        }
    }
}

/**
 * Sends a message from one user to another.
 *
 * @async
 * @function sendMessage
 * @param {string} senderId - The ID of the user sending the message.
 * @param {string} receiverId - The ID of the user receiving the message.
 * @param {string} message - The content of the message.
 * @returns {Object} The result of the save operation.
 * @throws Will propagate any errors from the persistence layer.
 */

async function sendMessage(senderId, receiverId, message) {
    return await persistence.saveMessage(senderId, receiverId, message)
}

/**
 * Retrieves the conversation between two users.
 *
 * @async
 * @function getConversation
 * @param {string} userId1 - The ID of the first user in the conversation.
 * @param {string} userId2 - The ID of the second user in the conversation.
 * @returns {Array<Object>} An array of messages exchanged between the two users.
 * @throws Will propagate any errors from the persistence layer.
 */
async function getConversation(userId1, userId2) {
    return await persistence.getConversation(userId1, userId2)
}


/**
 * Generates a CSRF token and associates it with a session.
 *
 * @async
 * @function generateFormToken
 * @param {string} key - The session key associated with the user.
 * @returns {string} The generated CSRF token.
 * @throws Will propagate any errors from the persistence layer.
 * @description This function creates a CSRF token, stores it in the session data, and returns the token.
 */
async function generateFormToken(key) {
    let token = crypto.randomUUID()
    let sessionData = await persistence.getSession(key)
    sessionData.csrfToken = token
    await persistence.updateSession(key, sessionData)
    return token
}

/**
 * Cancels a CSRF token by removing it from the session data.
 *
 * @async
 * @function cancelToken
 * @param {string} key - The session key associated with the user.
 * @throws Will propagate any errors from the persistence layer.
 * @description This function deletes the CSRF token from the session data.
 */
async function cancelToken(key) {
    let sessionData = await persistence.getSession(key)
    delete sessionData.csrfToken
    await persistence.updateSession(key, sessionData)
}

module.exports = {
    getUserById, getUserByEmail,
    validateEmail, checkEmailExists, validatePassword, validateUsername, validateProfilePicture,
    createUser,
    getUserByVerificationKey, sendVerificationEmail, verifyEmail,
    checkLogin,
    startSession, getSession, deleteSession,
    storeResetKey, getUserByResetKey, sendPasswordResetEmail, resetPassword, updatePassword,
    getMatchingUsers,
    getContacts, addContact, removeContact, blockContact,
    getProfile,
    getUserBadges, awardBadge,
    sendMessage, getConversation,
    generateFormToken, cancelToken,
}
