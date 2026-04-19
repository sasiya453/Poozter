export default async function handler(req, res) {
    const { file_id } = req.query;
    const token = process.env.BOT_TOKEN;

    if (!file_id) {
        return res.status(400).json({ error: "file_id required" });
    }

    try {
        const fileRes = await fetch(
            `https://api.telegram.org/bot${token}/getFile?file_id=${file_id}`
        );
        const fileData = await fileRes.json();

        if (!fileData.ok) {
            return res.status(404).json({
                error: "File not found",
                details: fileData.description
            });
        }

        const filePath = fileData.result.file_path;
        const imageRes = await fetch(
            `https://api.telegram.org/file/bot${token}/${filePath}`
        );

        if (!imageRes.ok) {
            return res.status(502).json({
                error: "Failed to fetch file from Telegram"
            });
        }

        const contentType =
            filePath.endsWith('.webm') ? 'video/webm' :
            filePath.endsWith('.tgs')  ? 'image/webp' :
            'image/webp';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control',
            'public, max-age=86400, stale-while-revalidate=604800');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const buffer = await imageRes.arrayBuffer();
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error('Image fetch error:', error);
        res.status(500).json({
            error: "Server error",
            details: error.message
        });
    }
}
