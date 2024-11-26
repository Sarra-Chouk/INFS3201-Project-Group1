/**
 * Logs informational messages to the console with optional details.
 *
 * @function logInfo
 * @param {string} message - The informational message to log.
 * @param {Object} [details={}] - Additional details to include with the log message.
 */
function logInfo(message, details = {}) {
    console.log(`[INFO] ${message}`, Object.keys(details).length ? details : '')
}

/**
 * Logs error messages to the console with optional error details.
 *
 * @function logError
 * @param {string} message - The error message to log.
 * @param {Error|string} error - The error object or message to include with the log.
 */
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

/**
 * Establishes a connection to the MongoDB database if not already connected.
 * Initializes the database and its collections for use.
 *
 * @async
 * @function connectDatabase
 * @throws Will log an error if the connection to the database fails.
 */
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

/**
 * Updates specific fields of a user in the database based on their email.
 *
 * @async
 * @function updateUserField
 * @param {string} email - The email address of the user to update.
 * @param {Object} updates - An object containing the fields to update and their new values.
 * @throws Will log an error if the update operation fails.
 */
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

/**
 * Retrieves a user from the database by their unique ID.
 *
 * @async
 * @function getUserById
 * @param {string} userId - The unique ID of the user to retrieve.
 * @returns {Object|null} The user object if found, or `null` if not found.
 * @throws Will log an error if the retrieval operation fails.
 */
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

/**
 * Retrieves a user from the database by their email address.
 *
 * @async
 * @function getUserByEmail
 * @param {string} email - The email address of the user to retrieve.
 * @returns {Object|null} The user object if found, or `null` if not found.
 * @throws Will log an error if the retrieval operation fails.
 */
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

/**
 * Retrieves a user from the database by their username.
 *
 * @async
 * @function getUserByUsername
 * @param {string} username - The username of the user to retrieve.
 * @returns {Object|null} The user object if found, or `null` if not found.
 * @throws Will log an error if the retrieval operation fails.
 */
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

/**
 * Creates a new user in the database.
 *
 * @async
 * @function createUser
 * @param {Object} user - The user object to be inserted into the database.
 * @returns {string|null} The ID of the newly created user, or `null` if the operation fails.
 * @throws Will log an error if the user creation operation fails.
 */
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

/**
 * Stores a key with an expiry time for a specific user in the database.
 *
 * @async
 * @function storeKey
 * @param {string} email - The email of the user to associate with the key.
 * @param {string} key - The key to be stored.
 * @param {string} type - The type of key being stored (e.g., "reset", "verification").
 * @throws Will log an error if the key storage operation fails.
 */
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

/**
 * Retrieves a user from the database by a specific key and type.
 *
 * @async
 * @function getUserByKey
 * @param {string} key - The key to search for.
 * @param {string} type - The type of key being searched (e.g., "reset", "verification").
 * @returns {Object|null} The user object if found and the key is valid, or `null` if not found or expired.
 * @throws Will log an error if the retrieval operation fails.
 */
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

/**
 * Clears a specific key for a user in the database.
 *
 * @async
 * @function clearKey
 * @param {string} email - The email of the user whose key should be cleared.
 * @param {string} type - The type of key to clear (e.g., "reset", "verification").
 * @throws Will log an error if the key clearing operation fails.
 */
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

/**
 * Updates the password for a user in the database.
 *
 * @async
 * @function updatePassword
 * @param {string} email - The email of the user whose password should be updated.
 * @param {string} newPassword - The new password to set for the user.
 * @returns {boolean} `true` if the password was successfully updated, `false` otherwise.
 * @throws Will log an error if the password update operation fails.
 */
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

/**
 * Saves a session object to the database.
 *
 * @async
 * @function saveSession
 * @param {Object} session - The session object to be saved, including properties like sessionKey and other metadata.
 * @throws Will log an error if the session saving operation fails.
 */
async function saveSession(session) {
    try {
        await connectDatabase()
        await sessions.insertOne(session)
        logInfo(`Session saved successfully with sessionKey: ${session.sessionKey}`)
    } catch (error) {
        logError(`Error saving session with sessionKey: ${session.sessionKey} - ${error}`)
    }
}

/**
 * Retrieves a session from the database by its session key.
 *
 * @async
 * @function getSession
 * @param {string} key - The session key used to retrieve the session.
 * @returns {Object|null} The session data if found and valid, or `null` if not found or expired.
 * @throws Will log an error if the session retrieval operation fails.
 */
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

/**
 * Deletes a session from the database by its session key.
 *
 * @async
 * @function deleteSession
 * @param {string} key - The session key of the session to be deleted.
 * @throws Will log an error if the session deletion operation fails.
 */
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

/**
 * Updates the data of an existing session in the database by its session key.
 *
 * @async
 * @function updateSession
 * @param {string} key - The session key of the session to be updated.
 * @param {Object} data - The data to be merged into the existing session data.
 * @throws Will log an error if the session update operation fails.
 */
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

/**
 * Finds users whose known languages match the learning languages of a specified user.
 *
 * @async
 * @function getMatchingUsers
 * @param {string} userId - The ID of the user for whom matching users are to be found.
 * @returns {Array<Object>} An array of matching user objects.
 * @throws Will log an error if the operation to find matching users fails.
 */
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

/**
 * Adds a contact to a user's contact list in the database.
 *
 * @async
 * @function addContact
 * @param {string} userId - The ID of the user to whom the contact will be added.
 * @param {string} contactId - The ID of the contact to be added.
 * @throws Will log an error if the operation to add a contact fails.
 */
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

/**
 * Removes a contact from a user's contact list in the database.
 *
 * @async
 * @function removeContact
 * @param {string} userId - The ID of the user from whose contact list the contact will be removed.
 * @param {string} contactId - The ID of the contact to be removed.
 * @throws Will log an error if the operation to remove a contact fails.
 */
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

/**
 * Retrieves the list of contacts for a specific user from the database.
 *
 * @async
 * @function getContacts
 * @param {string} userId - The ID of the user whose contacts are to be retrieved.
 * @returns {Array<Object>} An array of contact objects if found, or an empty array if no contacts are available.
 * @throws Will log an error if the operation to retrieve contacts fails.
 */
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

/**
 * Creates a new badge in the database.
 *
 * @async
 * @function createBadge
 * @param {Object} badge - The badge object to be created, containing its properties (e.g., name, description, criteria).
 * @throws Will log an error if the operation to create the badge fails.
 */
async function createBadge(badge) {
    try {
        await connectDatabase()
        const badgeResult = await badges.insertOne(badge)
        logInfo(`Badge ${badge.name} created successfully.`)
    } catch (error) {
        logError(`Error creating badge - ${error}`)
    }
}

/**
 * Retrieves all badges from the database.
 *
 * @async
 * @function getAllBadges
 * @returns {Array<Object>} An array of badge objects.
 * @throws Will log an error if the operation to fetch badges fails.
 */
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

/**
 * Retrieves the badges associated with a specific user from the database.
 *
 * @async
 * @function getUserBadges
 * @param {string} userId - The ID of the user whose badges are to be retrieved.
 * @returns {Array<Object>} An array of badge objects, or an empty array if the user has no badges or does not exist.
 * @throws Will log an error if the operation to fetch user badges fails.
 */
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

/**
 * Awards a badge to a specific user by adding it to their list of badges in the database.
 *
 * @async
 * @function awardBadge
 * @param {string} userId - The ID of the user to whom the badge will be awarded.
 * @param {Object} badge - The badge object to be awarded, including its properties (e.g., name, description).
 * @throws Will log an error if the operation to award the badge fails.
 */
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

/**
 * Initializes a predefined set of badges in the database if they do not already exist.
 *
 * @async
 * @function initializeBadges
 * @throws Will log an error if the badge initialization process fails.
 */
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

/**
 * Saves a message in the database between a sender and a receiver.
 *
 * @async
 * @function saveMessage
 * @param {string} senderId - The ID of the user sending the message.
 * @param {string} receiverId - The ID of the user receiving the message.
 * @param {string} message - The content of the message.
 * @returns {Object} The result of the insert operation.
 * @throws Will log an error if the operation to save the message fails.
 */
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

/**
 * Retrieves the conversation between two users, sorted by timestamp in ascending order.
 *
 * @async
 * @function getConversation
 * @param {string} userId1 - The ID of the first user in the conversation.
 * @param {string} userId2 - The ID of the second user in the conversation.
 * @returns {Array<Object>} An array of message objects representing the conversation.
 * @throws Will log an error if the operation to fetch the conversation fails.
 */
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

/**
 * Retrieves all messages sent by a specific user.
 *
 * @async
 * @function getUserMessages
 * @param {string} userId - The ID of the user whose messages are to be retrieved.
 * @returns {Array<Object>} An array of message objects sent by the user.
 * @throws Will log an error if the operation to fetch messages fails.
 */
async function getUserMessages(userId) {
    try {
        await connectDatabase()
        const userMessages = await messages.find({ senderId: new ObjectId(userId) }).toArray()
        return userMessages
    } catch (error) {
        logError(`Error fetching messages for userId: ${userId} - ${error}`)
    }
}

/**
 * Blocks a contact for a specific user by adding the contact ID to the user's blocked contacts list.
 *
 * @async
 * @function blockContact
 * @param {string} userId - The ID of the user who wants to block the contact.
 * @param {string} contactId - The ID of the contact to be blocked.
 * @throws Will log an error if the operation to block the contact fails.
 */
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

async function getBlockedContacts(userId) {
    try {
        await connectDatabase()
        const user = await users.findOne(
            { _id: new ObjectId(userId) }
        )
        if (!user) {
            logInfo(`No user found with userId: ${userId}`)
            return []
        }
        if (user.blockedContacts && user.blockedContacts.length > 0) {
            const blockedContacts = await users.find(
                { _id: { $in: user.blockedContacts.map(id => new ObjectId(id)) } }
            ).toArray()

            logInfo(`Retrieved ${blockedContacts.length} blocked contacts for userId: ${userId}`)
            return blockedContacts
        }
        logInfo(`No blocked contacts found for userId: ${userId}`)
        return []
    } catch (error) {
        logError(`Error retrieving blocked contacts for userId: ${userId} - ${error}`)
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
    blockContact, getBlockedContacts
}