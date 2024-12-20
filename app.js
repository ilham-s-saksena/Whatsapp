require('dotenv').config(); // Tambahkan dotenv untuk membaca file .env
const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode'); // Tambahkan modul qrcode untuk menghasilkan gambar QR

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY; // Baca API key dari file .env

let socket;

// Middleware untuk parsing JSON body request
app.use(express.json());

// Middleware untuk memeriksa API key
app.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }
    next();
});

async function connectToWhatsapp() {
    try {
        const authState = await useMultiFileAuthState('session');
        socket = makeWASocket({
            browser: ["Bot Klinik", "Desktop", "1.0.10"],
            auth: authState.state,
            logger: pino({ level: 'silent' })
        });

        socket.ev.on('creds.update', authState.saveCreds);

        socket.ev.on('connection.update', async ({ connection, qr }) => {
            if (qr) {
                console.log('QR Code received, updating QR code image');
                socket.qrCode = await qrcode.toDataURL(qr); // Simpan QR code sebagai image data URL
            }

            if (connection === 'open') {
                console.log('WhatsApp connected');
            } else if (connection === 'close') {
                console.log('WhatsApp connection closed. Reconnecting...');
                connectToWhatsapp(); // Reconnect on connection close
            } else if (connection === 'connecting') {
                console.log('.');
            }
        });

        socket.ev.on('messages.upsert', async ({ messages }) => {
            console.log('New message received:', messages);

            // Add Spesify Listener
            const gid = "6285867738032-1527264404@g.us"
            
            if (
                messages[0].key.remoteJid == gid &&             // Listen to group
                messages[0].message.liveLocationMessage         // Listen the LiveLocation Chat
                // && !messages[0].key.fromMe  
            ) {
                const phoneWithDomain = messages[0].key.participant;
                const phone = phoneWithDomain.split('@')[0];
                const lon = messages[0].message.liveLocationMessage.degreesLongitude;
                const lat = messages[0].message.liveLocationMessage.degreesLatitude;

                const requestBody = {
                    longitude: lon,
                    latitude: lat,
                    phone: phone
                };

                const url = 'https://jobs.e-ticketing.id';

                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                const result = await response.json();

                if (result.status) {
                    const messageText = `
✅Absensi Berhhasil!✅

Absensi atas nama *${result.name}* Berhasil!
${result.message}

Terimaksih
                    `;
                    await socket.sendMessage(messages[0].key.remoteJid, { text: messageText }, { quoted: messages[0] })
                } else {
                    const messageText = `
🚫Absensi Gagal🚫

Absensi atas nama *${result.name}* Gagal dilakukan
${result.message}

Terimaksih
                    `;
                await socket.sendMessage(messages[0].key.remoteJid, { text: messageText }, { quoted: messages[0] })
                }
                

            }

            if (!messages[0].key.fromMe && messages[0].message.liveLocationMessage && messages[0].key.remoteJid == '6285134564592@s.whatsapp.net') {
                console.log("=================================");
                console.log(messages[0].message.liveLocationMessage);
                console.log("Longitude: " + messages[0].message.liveLocationMessage.degreesLongitude);
                console.log("Latitude : " + messages[0].message.liveLocationMessage.degreesLatitude);
                console.log("Sender : " + messages[0].key.remoteJid);
                console.log("deg Clock Magnetic: " + messages[0].message.liveLocationMessage.degreesClockwiseFromMagneticNorth);
                console.log("Speed: " + messages[0].message.liveLocationMessage.speedInMps);
                console.log("Acuracy: " + messages[0].message.liveLocationMessage.accuracyInMeters);

                // Reply the Message
                await socket.sendMessage(messages[0].key.remoteJid, { text: 'Location Oke' }, { quoted: messages[0] })
            }
        });
    } catch (error) {
        console.error('Error connecting to WhatsApp:', error);
    }
}

// Endpoint untuk memulai koneksi ke WhatsApp dan mengembalikan gambar QR code
app.get('/login', async (req, res) => {
    try {
        if (socket && socket.qrCode) {
            return res.status(200).json({ message: 'WhatsApp is already connected', qrCode: socket.qrCode });
        }
        await connectToWhatsapp();
        res.status(200).json({ message: 'Connection to WhatsApp started. Check for the QR code.', qrCode: socket.qrCode });
    } catch (error) {
        res.status(500).json({ message: 'Failed to start WhatsApp connection', error: error.message });
    }
});

async function waitForConnection(timeout = 60000, interval = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (socket) {
            // Jika socket sudah terhubung, keluar dari loop
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval)); // Tunggu beberapa detik sebelum mengecek lagi
    }

    return false; // Jika sudah 1 menit tetapi tidak terhubung, return false
}


// Endpoint untuk mengirim pesan
app.post('/send-message', async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message are required' });
    }

    try {
        const { phoneNumber, message } = req.body;

        // Tunggu hingga koneksi socket selama 1 menit
        const isConnected = await waitForConnection();

        if (!isConnected) {
            return res.status(500).json({ message: 'WhatsApp is not connected after 1 minute' });
        }

        const jid = `${phoneNumber}@s.whatsapp.net`;
        await socket.sendMessage(jid, { text: message });
        res.status(200).json({ message: 'Message sent successfully' });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'An error occurred while sending the message', error: error.message });
    }
});

// Endpoint untuk mengirim pesan
app.post('/send-location', async (req, res) => {
    const { phoneNumber, lon, lat } = req.body;

    if (!phoneNumber || !lon || !lat) {
        return res.status(400).json({ message: 'Phone number and message are required' });
    }

    try {
        const { phoneNumber, lon, lat } = req.body;

        // Tunggu hingga koneksi socket selama 1 menit
        const isConnected = await waitForConnection();

        if (!isConnected) {
            return res.status(500).json({ message: 'WhatsApp is not connected after 1 minute' });
        }

        const jid = `${phoneNumber}@s.whatsapp.net`;
        await socket.sendMessage(jid, { location: { degreesLatitude: lat, degreesLongitude: lon } });
        res.status(200).json({ message: 'Message sent successfully' });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'An error occurred while sending the message', error: error.message });
    }
});


// Endpoint untuk mengirim pesan
app.post('/send-group-message', async (req, res) => {
    const { phoneNumber, message } = req.body;
    
    console.log(phoneNumber, message);

    if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message are required' });
    }

    try {
        const { phoneNumber, message } = req.body;

        // Tunggu hingga koneksi socket selama 1 menit
        const isConnected = await waitForConnection();

        if (!isConnected) {
            return res.status(500).json({ message: 'WhatsApp is not connected after 1 minute' });
        }

        const jid = `${phoneNumber}@g.us`;
        await socket.sendMessage(jid, { text: message });
        res.status(200).json({ message: 'Message sent successfully' });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'An error occurred while sending the message', error: error.message });
    }
});

// Memulai server Express
app.listen(PORT, () => {
    connectToWhatsapp(); // Memastikan WhatsApp selalu terhubung saat server diaktifkan
});
// connectToWhatsapp(); // Memastikan WhatsApp selalu terhubung saat server diaktifkan


    // New message received: [
    //     {
    //     key: {
    //         remoteJid: '6285134564592@s.whatsapp.net',
    //         fromMe: false,
    //         id: '1FF45E2391D195BBE2CDBEFE0A02E5E9',
    //         participant: undefined
    //     },
    //     messageTimestamp: 1734620510,
    //     pushName: 'Zeki',
    //     broadcast: false,
    //     message: Message {
    //         locationMessage: [LocationMessage],
    //         messageContextInfo: [MessageContextInfo]
    //     }
    //     }
    // ]