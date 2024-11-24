const mongodb = require('mongodb')

let client = undefined
let db = undefined
let users = undefined 
let sessions = undefined
let messages = undefined
let badges = undefined

async function connectDatabase() {
    if (!client) {
        client = new mongodb.MongoClient('mongodb+srv://60300372:INFS3201@infs3201.9arv1.mongodb.net/')
        await client.connect()
        db = client.db('INFS3201-Project')
        users = db.collection('users')
        sessions = db.collection('sessions')
        messages = db.collection('messages')
        badges = db.collection('badges')
    }
}

async function saveSession(session) {
    try {
        await connectDatabase()
        await sessions.insertOne(session)
        console.log("Session saved successfully.")
    } catch (error) {
        console.error("Error saving session:", error)
    }
}

async function getSession(key) {
    try {
        await connectDatabase()
        return await sessions.findOne({ sessionKey: key })
    } catch (error) {
        console.error("Error finding session data:", error)
    }
}
   
async function deleteSession(key) {
    try {
        await connectDatabase()
        const result = await sessions.deleteOne({ sessionKey: key })
        if (result.deletedCount === 1) {
            console.log("Session deleted successfully.")
        } else {
            console.log("No session found with the given key.")
        }
    } catch (error) {
        console.error("Error deleting session:", error)
    }
}

async function updateSession(key, data) {
    try {
        await connectDatabase()
        await sessions.replaceOne({sessionKey: key}, data)
    }
    catch (error) {
        console.error("Error updating session:", error)
    }
}

async function getUserByEmail(email) {
    try {
        await connectDatabase()
        const user = await users.findOne({ email })
        return user
    }
    catch (error) {
        console.error("Error fetching user by email:", error)
    }
}

async function getUserByUsername(username) {
    try {
        await connectDatabase()
        const user = await users.findOne({ username })
        return user
    }
    catch (error) {
        console.error("Error fetching user by username:", error)
    }
}

async function createUser(user) {
    try {
        await connectDatabase()
        const result = await users.insertOne(user)
        return result.insertedId 
    }
    catch (error) {
        console.error("Error creating user:", error)
    }
}

async function storeResetKey(email, resetKey) {
    await connectDatabase()
    const expiry = new Date(Date.now() + 5 * 60 * 1000)
    const resetKeyObject = {
        value: resetKey,
        expiry: expiry
    }
    await users.updateOne(
        { email: email },
        { $set: { resetKey: resetKeyObject} }
    )
}

async function getUserByResetKey(resetKey) {
    await connectDatabase()
    const user = await users.findOne({ "resetKey.value": resetKey })
    if (user && user.resetKey.expiry > new Date()) {
        return user
    }
    return null
}

async function clearResetKey(email) {
    await connectDatabase()
    await users.updateOne(
        { email: email },
        { $unset: { resetKey: "" } }
    )
}

async function updatePassword(email, newPassword) {
    try {
        await connectDatabase()
        const result = await users.updateOne(
            { email: email },
            { $set: { password: newPassword } })
        return result.modifiedCount > 0 
    }
    catch (error) {
        console.error("Error updating password:", error)
    }

}

async function addContact(userId, contactId) {
    try {
        await connectDatabase();
        await users.updateOne(
            { _id: new mongodb.ObjectId(userId) },
            { $addToSet: { contacts: contactId } } 
        );
        console.log(`Contact ${contactId} added to user ${userId}'s contact list.`);
    } catch (error) {
        console.error("Error adding contact:", error);
        throw error; 
    }
}

async function removeContact(userId, contactId) {
    try {
        await connectDatabase();
        await users.updateOne(
            { _id: new mongodb.ObjectId(userId) },
            { $pull: { contacts: contactId } }
        );
        console.log(`Contact ${contactId} removed from user ${userId}'s contact list.`);
    } catch (error) {
        console.error("Error removing contact:", error);
        throw error; 
    }
}

async function getContacts(userId) {
    try {
        await connectDatabase();
        const user = await users.findOne(
            { _id: new mongodb.ObjectId(userId) },
            { projection: { contacts: 1 } } 
        );

        if (user) {
            if (user.contacts) {
                return user.contacts; 
            } else {
                return []; 
            }
        } else {
            return []; 
        }
    } catch (error) {
        console.error("Error retrieving contacts:", error);
        throw error; 
    }
}

async function createBadge(badge) {
    try {
        await connectDatabase()
        const badgeResult = await badges.insertOne(badge)
        console.log("Badge created successfully.")
    } catch (error) {
        console.error("Error creating badge:", error)
    }
}

async function getAllBadges() {
    try {
        await connectDatabase()
        return await badges.find({}).toArray()
    } catch (error) {
        console.error("Error fetching badges:", error)
        return []
    }
}

async function getUserBadges(userId) {
    try {
        await connectDatabase()
        const user = await users.findOne(
            { _id: new mongodb.ObjectId(userId) },
            { projection: { badges: 1, _id: 0 } } 
        )
        if (!user) {
            console.log(`User with ID ${userId} not found.`)
            return []
        }
        return user.badges || []
    } catch (error) {
        console.error("Error fetching user badges:", error)
        return []
    }
}

async function awardBadge(userId, badge) {
    try {
        await connectDatabase()
        const timestamp = new Date()
        const badgeWithTimestamp = { ...badge, timestamp }
        await users.updateOne(
            { _id: new mongodb.ObjectId(userId) },
            { $push: { badges: badgeWithTimestamp } }
        )
        console.log(`Badge added to user ${userId}:`, badge.name)
    } catch (error) {
        console.error("Error adding badge to user:", error)
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
        console.log("Badges initialized successfully.")
    } catch (error) {
        console.error("Error initializing badges:", error)
    }
}

module.exports = {
    saveSession, getSession, deleteSession, updateSession,
    getUserByUsername, getUserByEmail,
    createUser,
    storeResetKey, getUserByResetKey, clearResetKey, updatePassword,
    addContact, removeContact, getContacts,
    getAllBadges, getUserBadges, awardBadge
}