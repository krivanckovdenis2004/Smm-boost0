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

    const filtered = data.filter(item => {
      const name = String(item.name || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();

      return (
        name.includes("instagram") ||
        category.includes("instagram") ||
        name.includes("tiktok") ||
        category.includes("tiktok") ||
        name.includes("youtube") ||
        category.includes("youtube") ||
        name.includes("vk") ||
        category.includes("vk") ||
        name.includes("vkontakte") ||
        category.includes("vkontakte")
      );
    });

    return res.status(200).json(filtered);
  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
}
