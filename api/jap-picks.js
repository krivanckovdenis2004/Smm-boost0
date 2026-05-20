export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://justanotherpanel.com/api/v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          key: process.env.JAP_API_KEY,
          action: "services"
        })
      }
    );

    const data = await response.json();

    const keywords = [
      "instagram premium followers",
      "instagram real followers",
      "tiktok followers",
      "tiktok likes",
      "tiktok views",
      "youtube subscribers",
      "youtube views",
      "youtube likes",
      "vk friends",
      "vk group",
      "vk followers",
      "vk likes",
      "vk repost",
      "vk views"
    ];

    const filtered = data.filter(item => {
      const text = `${item.category} ${item.name}`.toLowerCase();

      return keywords.some(k => {
        const parts = k.split(" ");
        return parts.every(part => text.includes(part));
      });
    });

    const clean = filtered.map(item => ({
      service: item.service,
      name: item.name,
      category: item.category,
      rate: item.rate,
      min: item.min,
      max: item.max
    }));

    return res.status(200).json(clean);
  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
}
