export default async function handler(req, res) {
  const { ids } = req.query;
  const token = process.env.BOT_TOKEN;

  if (!ids) {
    return res.status(400).json({ ok: false, description: "ids required" });
  }

  try {
    const idArray = ids.split(',').slice(0, 200); // max 200 per Telegram docs
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getCustomEmojiStickers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_emoji_ids: idArray })
      }
    );

    if (!response.ok) {
      return res.status(502).json({ ok: false, description: `Telegram API error: ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ ok: false, description: "Server error: " + error.message });
  }
}
