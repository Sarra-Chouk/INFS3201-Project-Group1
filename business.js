const persistence = require('./persistence')
const crypto = require("crypto")
const nodemailer = require("nodemailer")

let transporter = nodemailer.createTransport({
    host: "127.0.0.1",
    port: 25,
})

async function startSession() {
    const uuid = crypto.randomUUID()
    const expiry = new Date(Date.now() + 5 * 60 * 1000)
    const session = {
        sessionKey: uuid,
        expiry: expiry
    }
    await persistence.saveSession(session)
    return uuid
}

async function getSession(key) {
    return await persistence.getSession(key)
}

async function deleteSession(key) {
    return await persistence.deleteSession(key)
}

async function getUserByEmail(email) {
    return await persistence.getUserByEmail(email)
}

async function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const user = await getUserByEmail(email)
    return emailRegex.test(email) && !user
}

async function validateUsername(username) {
    return await persistence.getUserByUsername(username)
}

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

async function createSaltedHash(password) {
    const salt = crypto.randomBytes(4).toString('hex');
    const hash = crypto.createHash('sha1')
    hash.update(salt + password) 
    const saltedHash = salt + ":" + hash.digest('hex')
    return saltedHash
}

async function createUser(username, email, password, knownLanguages, learningLanguages, profilePicturePath) {
    const hashedPassword = createSaltedHash(password) 
    if (await validateEmail && await validateUsername && await validatePassword) {
        const user = {
            username: username,
            email: email,
            password: hashedPassword,
            knownLanguages: knownLanguages,
            learningLanguages: learningLanguages,
            profilePicturePath: profilePicturePath,
        }
        await persistence.createUser(user)
    } 
}

async function checkLogin(email, password) {
    try {
        const user = await persistence.getUserByEmail(email)
        if (!user) {
            return false
        }
        const [storedSalt, storedHash] = user.password.split(':')
        const hash = crypto.createHash('sha1')
        hash.update(storedSalt + password) 
        const inputHash = hash.digest('hex')
        if (inputHash === storedHash) { 
            return true
        } else {
            return false
        }
    }
    catch (error) {
        console.error('Error during login check:', error)
        return false
    }
}

async function storeResetKey(email) {
    let resetKey = crypto.randomUUID();
    await persistence.storeResetKey(email, resetKey)
    return resetKey
}

async function getUserByResetKey(resetKey) {
    return await persistence.getUserByResetKey(resetKey)
}

async function sendPasswordResetEmail(email, resetKey) {
    const resetLink = `http://localhost:8000/update-password?key=${resetKey}`
    const body = `
    <p>Hello,</p>
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <a href="${resetLink}">${resetLink}</a>
    <p>If you did not request a password reset, please ignore this email.</p>
    `;
    await transporter.sendMail({
        from: 'no-reply@INFS3201.com',
        to: email,
        subject: 'Password Reset Request',
        html: body,
    })
}

async function resetPassword(resetKey, newPassword, confirmedPassword) {
    if (newPassword !== confirmedPassword) {
        throw new Error("Passwords do not match")
    }
    const user = await persistence.findUserByResetKey(resetKey)
    if (!user) {
        throw new Error("Invalid or expired reset key")
    }
    const saltedHash = await createSaltedHash(newPassword)
    await persistence.updatePassword(user.email, saltedHash)
    await persistence.clearResetKey(user.email)
}

async function updatePassword(email, newPassword) {
    const user = await persistence.getUserByEmail(email)
    if (!user) {
        return false
    }
    const saltedHash = createSaltedHash(newPassword)
    await persistence.updatePassword(email, saltedHash)
}

module.exports = {
    startSession, getSession, deleteSession,
    getUserByEmail,
    validateEmail, validatePassword, validateUsername, validateProfilePicture,
    createUser,
    checkLogin,
    storeResetKey, getUserByResetKey, sendPasswordResetEmail, resetPassword, updatePassword
}
