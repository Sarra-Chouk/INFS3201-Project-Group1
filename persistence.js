function logInfo(message, details = {}) {
    console.log(`[INFO] ${message}`, Object.keys(details).length ? details : '')
}

function logError(message, error) {
    console.error(`[ERROR] ${message}`, error?.message || error)
}

const { MongoClient, ObjectId } = require('mongodb')

let client = undefined
let db = undefined
let users = undefined
let sessions = undefined
let messages = undefined
let badges = undefined

async function connectDatabase() {
    if (!client) {
        try {
            client = new MongoClient('mongodb+srv://60300372:INFS3201@infs3201.9arv1.mongodb.net/')
            await client.connect()
            db = client.db('INFS3201-Project')
            users = db.collection('users')
            sessions = db.collection('sessions')
            messages = db.collection('messages')
            badges = db.collection('badges')
            logInfo("Connected to the database.")
        } catch (error) {
            logError("Failed to connect to the database", error)
        }
    }
}

async function updateUserField(email, updates) {
    try {
        await connectDatabase()
        const result = await users.updateOne(
            { email: email },
            { $set: updates })
        if (result.modifiedCount > 0) {
            logInfo(`User with email ${email} updated successfully.`)
        } else {
            logInfo(`No updates made for user with email ${email}`)
        }
    } catch (error) {
        logError("Error updating user field", error)
    }
}

async function getUserById(userId) {
    try {
        await connectDatabase()
        const user = await users.findOne({ _id: new ObjectId(userId) })
        if (user) {
            logInfo(`Fetched user by ID: ${userId}`)
        } else {
            logInfo(`User not found by ID: ${userId}`)
        }
        return user
    } catch (error) {
        logError("Error fetching user by ID", error)
    }
}

async function getUserByEmail(email) {
    try {
        await connectDatabase()
        const user = await users.findOne({ email })
        if (user) {
            logInfo(`Fetched user by email: ${email}`)
        } else {
            logInfo(`User not found by email: ${email}`)
        }
        return user
    } catch (error) {
        logError("Error fetching user by email", error)
    }
}

async function getUserByUsername(username) {
    try {
        await connectDatabase()
        const user = await users.findOne({ username })
        if (user) {
            logInfo(`Fetched user by username: ${username}`)
        } else {
            logInfo(`User not found by username: ${username}`)
        }
        return user
    } catch (error) {
        logError("Error fetching user by username:", error)
    }
}

async function createUser(user) {
    try {
        await connectDatabase()
        const result = await users.insertOne(user)
        logInfo(`User created successfully with ID: ${result.insertedId}`)
        return result.insertedId
    } catch (error) {
        logError("Error creating user", error)
    }
}

async function storeKey(email, key, type) {
    try {
        await connectDatabase()
        const expiry = new Date(Date.now() + 5 * 60 * 1000)
        const keyObject = { value: key, expiry }
        const result = await users.updateOne({ email }, { $set: { [`${type}Key`]: keyObject } })
        if (result.modifiedCount > 0) {
            logInfo(`${type} key stored successfully for email: ${email}`)
        } else {
            logInfo(`Failed to store ${type} key: No user found with email: ${email}`)
        }
    } catch (error) {
        logError(`Error storing ${type} key for email: ${email} - ${error}`)
    }
}

async function getUserByKey(key, type) {
    try {
        await connectDatabase()
        const user = await users.findOne({ [`${type}Key.value`]: key })
        if (user) {
            if (user[`${type}Key`].expiry > new Date()) {
                logInfo(`Fetched user by ${type} key successfully: key = ${key}`)
                return user
            } else {
                logInfo(`Expired ${type} key for user: key = ${key}`)
            }
        } else {
            logInfo(`No user found with ${type} key: key = ${key}`)
        }
        return null
    } catch (error) {
        logError(`Error fetching user by ${type} key: key = ${key} - ${error}`)
    }
}

async function clearKey(email, type) {
    try {
        await connectDatabase()
        const result = await users.updateOne({ email }, { $unset: { [`${type}Key`]: "" } })
        if (result.modifiedCount > 0) {
            logInfo(`${type} key cleared successfully for email: ${email}`)
        } else {
            logInfo(`Failed to clear ${type} key: No user found with email: ${email}`)
        }
    } catch (error) {
        logError(`Error clearing ${type} key for email: ${email} - ${error}`)
    }
}

async function updatePassword(email, newPassword) {
    try {
        await connectDatabase()
        const result = await users.updateOne({ email: email }, { $set: { password: newPassword } })
        if (result.modifiedCount > 0) {
            logInfo(`Password updated successfully for email: ${email}`)
            return true
        } else {
            logInfo(`Password update failed: No user found with email: ${email}`)
            return false
        }
    } catch (error) {
        logError(`Error updating password for email: ${email}: ${error}`)
    }
}

async function saveSession(session) {
    try {
        await connectDatabase()
        await sessions.insertOne(session)
        logInfo(`Session saved successfully with sessionKey: ${session.sessionKey}`)
    } catch (error) {
        logError(`Error saving session with sessionKey: ${session.sessionKey} - ${error}`)
    }
}

async function getSession(key) {
    try {
        await connectDatabase()
        const session = await sessions.findOne({ sessionKey: key })
        if (!session) {
            logInfo(`No session found with sessionKey: ${key}`)
            return null
        }
        if (session.expiry < new Date()) {
            logInfo(`Session expired for sessionKey: ${key}`)
            return null
        }
        logInfo(`Session retrieved successfully for sessionKey: ${key}`)
        return session.data
    } catch (error) {
        logError(`Error finding session data for sessionKey: ${key} - ${error}`)
    }
}

async function deleteSession(key) {
    try {
        await connectDatabase()
        const result = await sessions.deleteOne({ sessionKey: key })
        if (result.deletedCount === 1) {
            logInfo(`Session deleted successfully for sessionKey: ${key}`)
        } else {
            logInfo(`No session found with sessionKey: ${key}`)
        }
    } catch (error) {
        logError(`Error deleting session for sessionKey: ${key} - ${error}`)
    }
}

async function updateSession(key, data) {
    try {
        await connectDatabase()
        const session = await sessions.findOne({ sessionKey: key })
        const updatedData = {
            ...session.data, 
            ...data 
        }
        await sessions.updateOne(
            { sessionKey: key },
            { $set: { data: updatedData } }
        )
        if (result.modifiedCount > 0) {
            logInfo(`Session updated successfully for sessionKey: ${key}`)
        } else {
            logInfo(`No session found or updated for sessionKey: ${key}`)
        }
    } catch (error) {
        logError(`Error updating session for sessionKey: ${key} - ${error}`)
    }
}

async function getMatchingUsers(userId) {
    try {
        await connectDatabase()
        const user = await users.findOne({ _id: new ObjectId(userId) })
        let learningLanguages = user.learningLanguages

        const matchingUsers = await users.find({
                knownLanguages: { $in: learningLanguages },
                _id: { $ne: new ObjectId(userId)},
            }).toArray()


        logInfo(`Found ${matchingUsers.length} matching users for userId: ${userId}`)
        return matchingUsers
    }
    catch (error) {
        logError(`Error finding matching users for userId: ${userId} - ${error}`)
    }
}

async function addContact(userId, contactId) {
    try {
        await connectDatabase()
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { contacts: contactId } }
        )
        logInfo(`User: ${userId} successfully added: ${contactId}`)

    } catch (error) {
        logError(`Error adding contact for userId: ${userId}, contactId: ${contactId} - ${error}`)
    }
}

async function removeContact(userId, contactId) {
    try {
        await connectDatabase()
        const result = await users.updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { contacts: contactId } }
        )
        if (result.modifiedCount > 0) {
            logInfo(`Contact removed successfully: userId = ${userId}, contactId = ${contactId}`)
        } else {
            logInfo(`No changes made. Contact not found in user's contact list: userId = ${userId}, contactId = ${contactId}`)
        }
    } catch (error) {
        logError(`Error removing contact for userId: ${userId}, contactId: ${contactId} - ${error}`)
    }
}

async function getContacts(userId) {
    try {
        await connectDatabase()
        const user = await users.findOne(
            { _id: new ObjectId(userId) }
        )
        if (!user) {
            logInfo(`No user found with userId: ${userId}`)
            return []
        }
        if (user.contacts && user.contacts.length > 0) {
            const contacts = await users.find(
                { _id: { $in: user.contacts.map(id => new ObjectId(id)) } }
            ).toArray()
            logInfo(`Retrieved ${contacts.length} contacts for userId: ${userId}`)
            return contacts
        }
        logInfo(`No contacts found for userId: ${userId}`)
        return []
    } catch (error) {
        logError(`Error retrieving contacts for userId: ${userId} - ${error}`)
    }
}

async function blockContact(userId, contactId) {
    try {
        await connectDatabase()
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { blockedContacts: contactId } }
        )
        logInfo(`User: ${userId} successfully added: ${contactId}`)
    } catch (error) {
        logError(`Error blocking contact for userId: ${userId}, contactId: ${contactId} - ${error}`)
    }
}

async function createBadge(badge) {
    try {
        await connectDatabase()
        const badgeResult = await badges.insertOne(badge)
        logInfo(`Badge ${badge.name} created successfully.`)
    } catch (error) {
        logError(`Error creating badge - ${error}`)
    }
}

async function getAllBadges() {
    try {
        await connectDatabase()
        const result = await badges.find({}).toArray()
        logInfo("Fetched all badges successfully.", { badgeCount: result.length })
        return result
    } catch (error) {
        logError(`Error fetching all badges: - ${error}`)
        return []
    }
}

async function getUserBadges(userId) {
    try {
        await connectDatabase()
        const user = await users.findOne(
            { _id: new ObjectId(userId) },
            { projection: { badges: 1, _id: 0 } }
        )
        if (!user) {
            logInfo(`User not found when fetching badges.`, { userId })
            return []
        }
        logInfo(`Fetched user badges successfully.`)
        return user.badges || []
    } catch (error) {
        logError(`Error fetching badges for userId: ${userId} - ${error}`)
        return []
    }
}

async function awardBadge(userId, badge) {
    try {
        await connectDatabase()
        const timestamp = new Date()
        const badgeWithTimestamp = { ...badge, timestamp }
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $push: { badges: badgeWithTimestamp } }
        )
        logInfo(`Badge ${badge.name} awarded successfully to ${userId}.`)
    } catch (error) {
        logError(`Error awarding badge to userId: ${userId} - ${error}`)
    }
}

async function initializeBadges() {
    try {
        await connectDatabase()
        const badgesToAdd = [
            {
                name: "First Conversation",
                imageUrl: "/images/badges/firstConversation.png"
            },
            {
                name: "100 Messages Sent",
                imageUrl: "/images/badges/Messages100.png"
            }
        ]
        for (const badge of badgesToAdd) {
            const existingBadge = await badges.findOne({ name: badge.name })
            if (!existingBadge) {
                await createBadge(badge)
            } else {
                console.log(`Badge "${badge.name}" already exists.`)
            }
        }
        logInfo("Badges initialized successfully.")
    } catch (error) {
        logError(`Error initializing badges - ${error}`)
    }
}

async function saveMessage(senderId, receiverId, message) {
    try {
        await connectDatabase()
        return await messages.insertOne({
            senderId: new ObjectId(senderId),
            receiverId: new ObjectId(receiverId),
            message,
            timestamp: new Date(),
        })
    } catch (error) {
        logError(`Error saving message from senderId: ${senderId} to receiverId: ${receiverId} - ${error}`)
    }
}

async function getConversation(userId1, userId2) {
    try {
        await connectDatabase()
        return await messages
            .find({
                $or: [
                    { senderId: new ObjectId(userId1), receiverId: new ObjectId(userId2) },
                    { senderId: new ObjectId(userId2), receiverId: new ObjectId(userId1) },
                ],
            })
            .sort({ timestamp: 1 }
            ).toArray()
    } catch (error) {
        logError(`Error fetching conversation between userId1: ${userId1} and userId2: ${userId2} - ${error}`)
    }
}

async function getUserMessages(userId) {
    try {
        await connectDatabase()
        const userMessages = await messages.find({ senderId: new ObjectId(userId) }).toArray()
        return userMessages
    } catch (error) {
        logError(`Error fetching messages for userId: ${userId} - ${error}`)
    }
}

module.exports = {
    updateUserField,
    getUserById, getUserByUsername, getUserByEmail,
    createUser,
    storeKey, getUserByKey, clearKey,
    updatePassword,
    saveSession, getSession, deleteSession, updateSession,
    getMatchingUsers,
    addContact, removeContact, getContacts,
    blockContact,
    getAllBadges, getUserBadges, awardBadge,
    saveMessage, getConversation, getUserMessages,
}