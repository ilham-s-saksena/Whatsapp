const express = require('express');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
const port = 3000;


app.get('/message', (req, res) => {
    const message = req.query.text;
    if (!message) {
        return res.status(400).json({ error: 'Parameter "text" is required' });
    }
    res.json({ message: `Hello, this is 'Message' Api, your message is '${message}'` });
});


app.get('/connect', async (req, res) => {
    try {
        const randomString = crypto.randomBytes(32).toString('hex'); // Generate a random 64-bit string (32 bytes = 64 hex characters)
        const qrCodeDataUrl = await QRCode.toDataURL(randomString);
        res.setHeader('Content-Type', 'image/png');
        const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        res.end(imageBuffer);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

app.get('/disconnect', (req, res) => {
    res.json({ message: 'You are disconnected now' });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
