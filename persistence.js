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