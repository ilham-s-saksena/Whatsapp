import { sendMessageWa, loginWhatsApp, destruyWhatsApp } from "../services/whatsappService.js";

export const sendMessage = async (req, res) => {
    const { phone } = req.params;

    console.log(phone);

    if (!req.body.text) {
        return res.status(422).json({message: "Text Field is Required!"});
    }

    if (await sendMessageWa(`${phone}@s.whatsapp.net`, req.body.text)) {
    
        return res.status(200).json({message: `Sending WhatsApp to ${phone}`, text: req.body.text});
    } else {
        return res.status(500).json({message: "errors"});
        
    }

}

export const waLogin = async (req, res) => {
    try {
        const qr = await loginWhatsApp(); // Wait for the resolved value
        
        if (qr && Buffer.isBuffer(qr)) {
            res.setHeader('Content-Type', 'image/png');
            res.end(qr);
        } else {
            return res.status(500).json({ message: "QR Code not available" });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ message: "An error occurred while logging in" });
    }
};

export const waDestroy = (req, res) => {

}