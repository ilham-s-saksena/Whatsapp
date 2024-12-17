import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import QRCode from 'qrcode';

// Fungsi untuk login ke WhatsApp
export async function loginWhatsApp() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("----- Start -----");
            const { state, saveCreds } = await useMultiFileAuthState("session");

            const socket = makeWASocket({
                auth: state,
                browser: ["Linux", "Mozila", "24.04"],
                logger: pino({ level: "silent" }),
                printQRInTerminal: true,
            });

            socket.ev.on("creds.update", saveCreds);

            socket.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log("QR code received.");
                    const qrCodeDataUrl = await QRCode.toDataURL(qr);
                    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    resolve(imageBuffer); // Resolving the imageBuffer
                }

                if (connection === "open") {
                    console.log("Berhasil login ke WhatsApp!");
                    resolve(true);
                } else if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut) {
                        console.log("Logout detected. Removing session.");
                        fs.rmSync("session", { recursive: true, force: true });
                        resolve(await loginWhatsApp());
                    } else {
                        console.log("Koneksi tertutup. Mencoba login ulang...");
                        resolve(await loginWhatsApp());
                    }
                }
            });
        } catch (error) {
            console.error("Error saat login:", error);
            reject(error);
        }
    });
}


export const sendMessageWa = async (phone, message) => {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("session");

        const socket = makeWASocket({
            auth: state,
            logger: pino({ level: "silent" }),
        });

        socket.ev.on("creds.update", saveCreds);

        const isConnected = await new Promise((resolve) => {
            socket.ev.on("connection.update", (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    console.log("Koneksi ke WhatsApp berhasil!");
                    resolve(true);
                } else if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut) {
                        console.log("Sesi telah habis, login ulang diperlukan.");
                        resolve(false);
                    }
                }
            });
        });

        if (!isConnected) {
            console.log("Tidak dapat mengirim pesan, koneksi gagal.");
            return false;
        }

        await socket.sendMessage(phone, { text: message });
        console.log("Pesan berhasil dikirim ke:", phone);
        return true;
    } catch (error) {
        console.error("Error saat mengirim pesan:", error);
        return false;
    }
}

export const destruyWhatsApp = () => {
    fs.rmSync("session", { recursive: true, force: true });
}
