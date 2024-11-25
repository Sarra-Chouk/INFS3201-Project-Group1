const { ObjectId } = require('mongodb')
const persistence = require('./persistence')
const crypto = require("crypto")
const nodemailer = require("nodemailer")
let transporter = nodemailer.createTransport({
    host: "127.0.0.1",
    port: 25,
})

async function getUserById(userId) {
    return await persistence.getUserById(userId)
}

async function getUserByEmail(email) {
    return await persistence.getUserByEmail(email)
}

async function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const user = await getUserByEmail(email)
    return emailRegex.test(email) && !user
}

async function checkEmailExists(email) {
    const user = await persistence.getUserByEmail(email)
    return !!user
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

function createSaltedHash(password) {
    const salt = crypto.randomBytes(4).toString('hex');
    const hash = crypto.createHash('sha1')
    hash.update(salt + password) 
    const saltedHash = salt + ":" + hash.digest('hex')
    return saltedHash
}

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

async function getUserByVerificationKey(verificationKey) {
    return await persistence.getUserByKey(verificationKey, "verification")
}

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

async function verifyEmail(key) {
    try {
        const user = await persistence.getUserByKey(key, "verification")
        if (!user) throw new Error("Verification failed. The link may have expired or is invalid.")

        await persistence.updateUserField(user.email, { isVerified: true })

        await persistence.clearKey(user.email, "verification")

        console.log(`Email verified for user: ${user.username}`)
    } catch (error) {
        console.error("Error during email verification:", error.message)
    }
}

async function checkLogin(email, password) {
    try {
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
            return { isValid: true, message: "Login successful.",  userId: user._id}
        } else {
            return { isValid: false, message: "Invalid email or password." }
        }
    }
    catch (error) {
        console.error('Error during login check:', error)
    }
}

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

async function getSession(key) {
    return await persistence.getSession(key)
}

async function deleteSession(key) {
    return await persistence.deleteSession(key)
}

async function storeResetKey(email) {
    let resetKey = crypto.randomUUID();
    await persistence.storeKey(email, resetKey, "reset")
    return resetKey
}

async function getUserByResetKey(resetKey) {
    return await persistence.getUserByKey(resetKey, "reset")
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
        from: 'no-reply@globelingo.com',
        to: email,
        subject: 'Password Reset Request',
        html: body,
    })
}

async function resetPassword(resetKey, newPassword, confirmedPassword) {
    if (! await validatePassword(newPassword)) {
        return { isValid: false, message: "Password must be at least 8 characters, include a number, a special character, an uppercase and lowercase letter."}
    }
    if (newPassword.trim() !== confirmedPassword.trim()) {
        return {isValid: false, message: "The passwords you entered do not match. Please ensure both password fields are the same."}
    }
    const user = await persistence.getUserByKey(resetKey, "reset")
    if (!user) {
        return { isValid: false, message: "Your reset link is invalid or has expired. Please request a new link."}
    }
    const saltedHash = createSaltedHash(newPassword)
    await persistence.updatePassword(user.email, saltedHash)
    await persistence.clearKey(user.email, "reset")
    return { isValid: true}
}

async function updatePassword(email, newPassword) {
    const user = await persistence.getUserByEmail(email)
    if (!user) {
        return false
    }
    const saltedHash = createSaltedHash(newPassword)
    await persistence.updatePassword(email, saltedHash)
}

async function getMatchingUsers(userId){
    return await persistence.getMatchingUsers(userId)
}

async function getContacts(userId){
    return await persistence.getContacts(userId)
}

async function addContact(userId, contactId) {
    try {
       
        const contactProfile = await persistence.getUserProfile(contactId);
        if (!contactProfile) {
            throw new Error("Contact not found.");
        }

       
        if (contactProfile.blockedBy) {
            for (const blockedUserId of contactProfile.blockedBy) {
                if (blockedUserId === userId) {
                    throw new Error("You cannot add a user who has blocked you.");
                }
            }
        }

        await persistence.addContact(userId, contactId);
        console.log(`Successfully added contact ${contactId} for user ${userId}`);
    } catch (error) {
        console.error("Error in business layer (addContact):", error.message);
        throw error;
    }
}

async function getProfile(userId) {
    try {
        // Fetch user information from persistence layer
        const user = await persistence.getUserById(userId); 
        if (!user) {
            throw new Error("User not found.");
        }

        // Fetch badges associated with the user
        const badges = await persistence.getUserBadges(userId);

        // Return profile details
        return {
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicturePath || "/images/defaultProfilePicture.jpg",
            badges: badges || []
        };
    } catch (error) {
        console.error("Error fetching profile:", error.message);
        throw error;
    }
}

async function getUserBadges(userId) {
    return await persistence.getUserBadges(userId)
}

async function awardBadge(userId) {
    try {
        const allBadges = await persistence.getAllBadges()
        const userMessages = await persistence.getUserMessages(userId)
        const badgeRules = {
            "First Conversation": async () => {
                return userMessages.some(msg => msg.repliedTo)
            },
            "100 Messages Sent": async () => {
                return userMessages.length >= 100
            }
        }

        for (const badge of allBadges) {
            const userBadges = await persistence.getUserBadges(userId)
            if (userBadges.some(b => b.name === badge.name)) continue

            const isEligible = await badgeRules[badge.name]?.()
            if (isEligible) {
                await persistence.awardBadge(userId, badge)
            }
        }
    } catch (error) {
        console.error("Error in badge awarding process:", error)
    }
}

async function generateFormToken(key) {
    let token = crypto.randomUUID()
    let sessionData = await persistence.getSession(key)
    sessionData.csrfToken = token
    await persistence.updateSession(key, sessionData)
    return token
}

async function cancelToken(key) {
    let sessionData = await persistence.getSession(key)
    delete sessionData.csrfToken
    await persistence.updateSession(key, sessionData)
}

async function sendMessage(senderId, receiverId, message) {
    return await persistence.saveMessage(senderId, receiverId, message)
}

async function getConversation(userId1, userId2) {
    return await persistence.getConversation(userId1, userId2)
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
    addContact, getContacts,
    getProfile,
    getUserBadges, awardBadge, 
    generateFormToken, cancelToken,
    sendMessage, getConversation
}
