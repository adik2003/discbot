const express = require('express');

require('dotenv').config();

const app = express();

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("No code provided!");

    const params = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "http://localhost:3000/callback",
        scope: "identify email"
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const data = await response.json();
    res.json(data); // Returns access token and user info
});

app.listen(3000, () => console.log("Server running on port 3000"));
