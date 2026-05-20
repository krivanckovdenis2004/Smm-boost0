export default async function handler(req, res) {
  try {
    const response = await fetch("https://justanotherpanel.com/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        key: process.env.JAP_API_KEY,
        action: "services"
      })
    });

    const data = await response.json();

    const q = String(req.query.q || "").toLowerCase();

    const result = data
      .filter(item => {
        const text = `${item.category} ${item.name}`.toLowerCase();
        return text.includes(q);
      })
      .slice(0, 80)
      .map(item => ({
        service: item.service,
        name: item.name,
        category: item.category,
        rate: item.rate,
        min: item.min,
        max: item.max
      }));

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({
      error: e.message
    });
  }
}
