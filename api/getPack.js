export default async function handler(req, res) {
    const { name } = req.query;
    const token = process.env.BOT_TOKEN;

    if (!name) {
        return res.status(400).json({ ok: false, description: "Pack name required" });
    }

    // Sanitize pack name - remove any URL parts if full link was passed
    const cleanName = name.split('/').pop().trim();

    if (!cleanName) {
        return res.status(400).json({ ok: false, description: "Invalid pack name" });
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${token}/getStickerSet?name=${encodeURIComponent(cleanName)}`
        );

        if (!response.ok) {
            return res.status(502).json({ 
                ok: false, 
                description: `Telegram API returned ${response.status}` 
            });
        }

        const data = await response.json();

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=300'); // Cache pack list for 5 mins

        res.status(200).json(data);

    } catch (error) {
        console.error('getPack error:', error);
        res.status(500).json({ 
            ok: false, 
            description: "Server error: " + error.message 
        });
    }
}
