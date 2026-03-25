export default async function handler(req, res) {
    const { file_id } = req.query;
    const token = process.env.BOT_TOKEN;

    if (!file_id) return res.status(400).json({ error: "File ID required" });

    try {
        // 1. Get file path from Telegram
        const pathRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file_id}`);
        const pathData = await pathRes.json();
        
        if (!pathData.ok) return res.status(404).json({ error: "File not found" });

        // 2. Fetch the actual file
        const fileUrl = `https://api.telegram.org/file/bot${token}/${pathData.result.file_path}`;
        const fileRes = await fetch(fileUrl);
        
        // 3. Send the file buffer to browser (Hides the token completely!)
        const arrayBuffer = await fileRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        res.setHeader('Content-Type', fileRes.headers.get('content-type'));
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: "Image fetch error" });
    }
}
