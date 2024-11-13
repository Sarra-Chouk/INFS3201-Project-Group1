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
        return await sessions.findOne({ sessionKey: key });
    } catch (error) {
        console.error("Error finding session data:", error)
    }
}

async function deleteSession(key) {
    try {
        await connectDatabase()
        const result = await sessions.deleteOne({ sessionKey: key });
        if (result.deletedCount === 1) {
            console.log("Session deleted successfully.");
        } else {
            console.log("No session found with the given key.");
        }
    } catch (error) {
        console.error("Error deleting session:", error)
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

