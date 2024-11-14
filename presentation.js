const express=require("express")
const business = require("./business.js")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const handlebars = require("express-handlebars")
let app = express()

app.set("views", __dirname+"/templates")
app.set("view engine", "handlebars")
app.engine("handlebars", handlebars.engine())
app.use(bodyParser.urlencoded({extended: false}))
app.use(cookieParser())

app.get("/", (req, res) => {
})

app.get("/sign-up", (req, res) => {
})

app.post("/sign-up", async (req, res) => {
})

app.get("/login'", (req, res) => {
})

app.post("/login", async (req, res) => {
})

app.get("/logout", async (req, res) => {
})

app.get("/dashboard", async (req, res) => {
})

app.get("/reset-password", (req, res) => {
})

app.post("/reset-password", async (req, res) => {
})

app.get("/update-password", async (req, res) => {
})

app.post("/update-password", async (req, res) => {
})

app.listen(8000, () => {})