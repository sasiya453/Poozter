export default async function handler(req, res) {
    const { name } = req.query;
    const token = process.env.BOT_TOKEN; // Vercel එකෙන් මේක ඔටෝ ගන්නවා

    if (!name) return res.status(400).json({ error: "Pack name required" });

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getStickerSet?name=${name}`);
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}
