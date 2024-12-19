const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode'); // Tambahkan modul qrcode untuk menghasilkan gambar QR

const app = express();
const PORT = 3000;

let socket;

// Middleware untuk parsing JSON body request
app.use(express.json());

async function connectToWhatsapp() {
    try {
        const authState = await useMultiFileAuthState('session');
        socket = makeWASocket({
            browser: ['Linux', 'Mozilla', '24.04'],
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
                console.log('Connecting to WhatsApp...');
            }
        });

        socket.ev.on('messages.upsert', ({ messages }) => {
            console.log('New message received:', messages);
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

// Endpoint untuk mengirim pesan
app.post('/send-message', async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).json({ message: 'Phone number and message are required' });
    }

    try {
        if (!socket) {
            return res.status(500).json({ message: 'WhatsApp is not connected' });
        }

        const jid = `${phoneNumber}@s.whatsapp.net`;
        await socket.sendMessage(jid, { text: message });
        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to send message', error: error.message });
    }
});

// Memulai server Express
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectToWhatsapp(); // Memastikan WhatsApp selalu terhubung saat server diaktifkan
});
