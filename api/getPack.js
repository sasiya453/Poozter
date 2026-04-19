export default async function handler(req, res) {
    const { name } = req.query;
    const token = process.env.BOT_TOKEN;

    if (!name) {
        return res.status(400).json({ 
            ok: false, description: "Pack name required" 
        });
    }

    const cleanName = name.split('/').pop().trim();

    if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({ 
            ok: false, description: "Invalid pack name" 
        });
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${token}/getStickerSet?name=${encodeURIComponent(cleanName)}`
        );

        if (!response.ok) {
            return res.status(502).json({ 
                ok: false, 
                description: `Telegram API error: ${response.status}` 
            });
        }

        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.status(200).json(data);

    } catch (error) {
        console.error('getPack error:', error);
        res.status(500).json({ 
            ok: false, 
            description: "Server error: " + error.message 
        });
    }
}
