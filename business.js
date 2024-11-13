const persistence = require('./persistence')
const crypto = require("crypto")

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